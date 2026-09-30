/**
 * Daily relay-status cache from zuiquanapi.com /api/bootstrap.
 * Copies online, latency, and uptime only. Names, blurbs, URLs, and votes stay put.
 */
const fs = require("fs");
const path = require("path");

const SOURCE = "https://www.zuiquanapi.com/api/bootstrap";
const UA = "XianTanNav/1.0 (local catalog sync)";
const REDIS_KEY = "veridrop:station-status";
const BLOB_PATH = "station-status.json";
const FILE = path.join(__dirname, "..", "data", "station-status.json");
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function hasRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function numOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeRemoteStatus(raw) {
  if (!raw || typeof raw !== "object") return null;
  const checkedAt = typeof raw.checkedAt === "string" ? raw.checkedAt : "";
  if (!checkedAt || Number.isNaN(Date.parse(checkedAt))) return null;
  let online = null;
  if (typeof raw.online === "boolean") online = raw.online;
  else if (raw.online === 0 || raw.online === 1 || raw.online === "0" || raw.online === "1") {
    online = Boolean(Number(raw.online));
  }
  if (online == null) return null;
  return {
    online,
    ms: numOrNull(raw.ms),
    uptime: numOrNull(raw.uptime),
    avgMs: numOrNull(raw.avgMs),
    checkedAt,
  };
}

function slimBootstrap(json) {
  const src = json && json.status;
  const stations = {};
  if (src && typeof src === "object") {
    Object.keys(src).forEach((id) => {
      if (!/^\d+$/.test(id)) return;
      const row = normalizeRemoteStatus(src[id]);
      if (row) stations[id] = row;
    });
  }
  return { fetchedAt: new Date().toISOString(), stations };
}

function isFresh(payload, now) {
  if (!payload || typeof payload.fetchedAt !== "string" || !payload.stations) return false;
  const at = Date.parse(payload.fetchedAt);
  if (Number.isNaN(at)) return false;
  return (now == null ? Date.now() : now) - at < MAX_AGE_MS;
}

function normalizeCache(data) {
  if (!data || typeof data !== "object" || !data.stations || typeof data.stations !== "object") return null;
  if (typeof data.fetchedAt !== "string") return null;
  return { fetchedAt: data.fetchedAt, stations: data.stations };
}

function readFile() {
  try {
    return normalizeCache(JSON.parse(fs.readFileSync(FILE, "utf8")));
  } catch {
    return null;
  }
}

function saveFile(payload) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(payload));
  fs.renameSync(tmp, FILE);
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

async function readBlob() {
  const { get } = require("@vercel/blob");
  const existing = await get(BLOB_PATH, { access: "private", useCache: false });
  if (existing && existing.statusCode === 200 && existing.stream) {
    return normalizeCache(JSON.parse(await streamText(existing.stream)));
  }
  return null;
}

async function readCache() {
  try {
    if (hasRedis()) {
      const { Redis } = require("@upstash/redis");
      return normalizeCache(await Redis.fromEnv().get(REDIS_KEY));
    }
    if (hasBlob()) return await readBlob();
    if (!process.env.VERCEL) return readFile();
  } catch (err) {
    console.warn("station status cache", err && err.message ? err.message : err);
  }
  return null;
}

async function writeCache(payload) {
  if (hasRedis()) {
    const { Redis } = require("@upstash/redis");
    await Redis.fromEnv().set(REDIS_KEY, payload);
    return;
  }
  if (hasBlob()) {
    const { put } = require("@vercel/blob");
    await put(BLOB_PATH, JSON.stringify(payload), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  if (!process.env.VERCEL) saveFile(payload);
}

async function fetchUpstream() {
  const res = await fetch(SOURCE, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error("bootstrap HTTP " + res.status);
  const slim = slimBootstrap(await res.json());
  if (!Object.keys(slim.stations).length) throw new Error("bootstrap status empty");
  return slim;
}

async function getStationStatus(options) {
  const force = Boolean(options && options.force);
  if (!force) {
    const cached = await readCache();
    if (isFresh(cached)) return { payload: cached, stale: false };
  }
  try {
    const payload = await fetchUpstream();
    try {
      await writeCache(payload);
    } catch (err) {
      console.warn("station status cache write", err && err.message ? err.message : err);
    }
    return { payload, stale: false };
  } catch (err) {
    const cached = await readCache();
    if (cached) return { payload: cached, stale: true };
    throw err;
  }
}

function cronAuthorized(headerValue) {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) return !process.env.VERCEL;
  return String(headerValue || "") === "Bearer " + secret;
}

module.exports = {
  SOURCE,
  MAX_AGE_MS,
  normalizeRemoteStatus,
  slimBootstrap,
  isFresh,
  getStationStatus,
  cronAuthorized,
};
