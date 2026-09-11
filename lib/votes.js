const fs = require("fs");
const path = require("path");

const MAX_LOG = 500;
const VOTER_MAX = 80;
const REDIS_KEY = "veridrop:votes";
const BLOB_PATH = "votes.json";
const FILE = path.join(__dirname, "..", "data", "votes.json");

function utcnow() {
  return new Date().toISOString().replace(/\.\d+Z$/, (m) => m.slice(0, 4) + "Z");
}

function emptyStore() {
  return { updatedAt: "", stations: {}, ballots: {}, log: [] };
}

function normalizeId(raw) {
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id)) throw new Error("invalid id");
  return String(id);
}

function normalizeVoter(raw) {
  const voter = String(raw || "")
    .trim()
    .split("")
    .filter((ch) => /[A-Za-z0-9_-]/.test(ch))
    .join("")
    .slice(0, VOTER_MAX);
  return voter || "anon";
}

function publicPayload(data, voter) {
  const mine = {};
  if (voter) {
    const raw = (data.ballots || {})[voter] || {};
    Object.keys(raw).forEach((k) => {
      if (raw[k] === "up" || raw[k] === "down") mine[String(k)] = raw[k];
    });
  }
  const stations = {};
  Object.keys(data.stations || {}).forEach((sid) => {
    const row = data.stations[sid] || {};
    stations[String(sid)] = { up: Number(row.up || 0), down: Number(row.down || 0) };
  });
  return { updatedAt: data.updatedAt || "", stations, mine };
}

function applyVoteInMemory(data, stationId, direction, voter) {
  const sid = normalizeId(stationId);
  if (direction !== "up" && direction !== "down") throw new Error("dir must be up or down");
  voter = normalizeVoter(voter);
  const stations = data.stations || (data.stations = {});
  const ballots = data.ballots || (data.ballots = {});
  const mine = ballots[voter] || (ballots[voter] = {});
  const prev = mine[sid];
  const counts = stations[sid] || (stations[sid] = { up: 0, down: 0 });
  counts.up = Number(counts.up || 0);
  counts.down = Number(counts.down || 0);
  let nowDir = "";
  if (prev === direction) {
    counts[prev] = Math.max(0, counts[prev] - 1);
    delete mine[sid];
  } else {
    if (prev === "up" || prev === "down") counts[prev] = Math.max(0, counts[prev] - 1);
    counts[direction] += 1;
    mine[sid] = direction;
    nowDir = direction;
  }
  if (!Object.keys(mine).length) delete ballots[voter];
  if (counts.up === 0 && counts.down === 0) delete stations[sid];
  data.updatedAt = utcnow();
  const log = data.log || (data.log = []);
  log.push({ id: Number(sid), dir: nowDir || "cancel", prev: prev || "", voter, at: data.updatedAt });
  data.log = log.slice(-MAX_LOG);
  return { id: Number(sid), up: counts.up || 0, down: counts.down || 0, mine: nowDir };
}

function hasRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function streamText(stream) {
  const chunks = [];
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }
  return chunks.join("");
}

function loadFile() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (!data || typeof data !== "object") return emptyStore();
    data.stations = data.stations || {};
    data.ballots = data.ballots || {};
    data.log = data.log || [];
    return data;
  } catch {
    return emptyStore();
  }
}

function saveFile(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}

function normalizeStore(data) {
  if (!data || typeof data !== "object") data = emptyStore();
  data.stations = data.stations || {};
  data.ballots = data.ballots || {};
  data.log = data.log || [];
  return data;
}

async function readBlob(fresh) {
  const { get } = require("@vercel/blob");
  const existing = await get(BLOB_PATH, { access: "private", useCache: !fresh });
  if (existing && existing.statusCode === 200 && existing.stream) {
    try {
      return normalizeStore(JSON.parse(await streamText(existing.stream)));
    } catch {
      /* fall through */
    }
  }
  return normalizeStore(loadFile());
}

async function writeBlob(data) {
  const { put } = require("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readStore() {
  if (hasRedis()) {
    const { Redis } = require("@upstash/redis");
    const data = await Redis.fromEnv().get(REDIS_KEY);
    return normalizeStore(data && typeof data === "object" ? data : loadFile());
  }
  if (hasBlob()) return readBlob(false);
  if (process.env.VERCEL) throw new Error("vote store not configured");
  return loadFile();
}

async function mutateStore(fn) {
  if (hasRedis()) {
    const { Redis } = require("@upstash/redis");
    const redis = Redis.fromEnv();
    const data = normalizeStore(await redis.get(REDIS_KEY));
    const result = fn(data);
    await redis.set(REDIS_KEY, data);
    return result;
  }
  if (hasBlob()) {
    const data = await readBlob(true);
    const result = fn(data);
    await writeBlob(data);
    return result;
  }
  if (process.env.VERCEL) throw new Error("vote store not configured");
  const data = loadFile();
  const result = fn(data);
  saveFile(data);
  return result;
}

async function dump(voter) {
  return publicPayload(await readStore(), voter ? normalizeVoter(voter) : "");
}

async function getOne(id, voter) {
  const sid = normalizeId(id);
  const payload = await dump(voter);
  const row = payload.stations[sid] || { up: 0, down: 0 };
  return {
    id: Number(sid),
    up: row.up,
    down: row.down,
    mine: payload.mine[sid] || "",
    updatedAt: payload.updatedAt,
  };
}

async function vote(id, dir, voter) {
  return mutateStore((data) => applyVoteInMemory(data, id, dir, voter || "anon"));
}

module.exports = { dump, getOne, vote, hasRedis };
