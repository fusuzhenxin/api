const crypto = require("crypto");

const KINDS = ["home", "check", "cat", "site", "model", "official", "apply", "other"];
const KIND_LABEL = {
  home: "首页",
  check: "模型检测",
  cat: "分类",
  site: "站点页",
  model: "模型",
  official: "官方状态",
  apply: "申请收录",
  other: "其他",
};
const BLOB_PATH = "visits.json";
const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_SECONDS = 40 * 24 * 60 * 60;
const DAYS = 30;
const memory = new Map();
let forceMemory = false;

function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function recentDates(count = DAYS, now = new Date()) {
  const dates = [];
  for (let i = 0; i < count; i += 1) dates.push(shanghaiDate(new Date(now.getTime() - i * DAY_MS)));
  return dates;
}

function isBotUa(ua) {
  const text = String(ua || "").trim().toLowerCase();
  if (text.length < 12) return true;
  return /ahrefs|mj12bot|bingbot|yandex|shapbot|applebot|googlebot|google-inspectiontool|petalbot|bytespider|baiduspider|semrush|dotbot|sogou|360spider|yisouspider|curl\/|wget\/|python-requests|go-http-client|headlesschrome|local-mirror|scrapy|httpclient|spider|crawler|slurp|\bbot\b/.test(
    text
  );
}

function normalizeId(raw) {
  const id = String(raw || "").trim();
  return /^[a-z0-9]{16,48}$/.test(id) ? id : "";
}

function normalizeKind(raw) {
  const kind = String(raw || "").trim();
  return KINDS.indexOf(kind) >= 0 ? kind : "";
}

function hasRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function storageMode() {
  if (forceMemory) return "memory";
  if (hasRedis()) return "redis";
  if (hasBlob()) return "blob";
  if (process.env.VERCEL) return "missing";
  return "memory";
}

function configuredKey() {
  const key = String(process.env.VISIT_STATS_KEY || "");
  return key.length >= 16 ? key : "";
}

function keyMatches(given) {
  const expected = configuredKey();
  const actual = String(given || "");
  if (!expected || actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function dayKey(day) {
  return "veridrop:visit:" + day;
}

function kindKey(day) {
  return "veridrop:visit:kind:" + day;
}

function resetMemory() {
  memory.clear();
}

function setForceMemory(on) {
  forceMemory = Boolean(on);
  memory.clear();
}

function memoryRedisFixed() {
  const api = {
    async sadd(key, member) {
      let set = memory.get(key);
      if (!(set instanceof Set)) {
        set = new Set();
        memory.set(key, set);
      }
      const before = set.size;
      set.add(member);
      return set.size - before;
    },
    expire: async () => {},
    scard: async (key) => {
      const set = memory.get(key);
      return set instanceof Set ? set.size : 0;
    },
    hincrby: async (key, field, amount) => {
      let hash = memory.get(key);
      if (!hash || hash instanceof Set) {
        hash = {};
        memory.set(key, hash);
      }
      hash[field] = Number(hash[field] || 0) + amount;
      return hash[field];
    },
    hgetall: async (key) => {
      const hash = memory.get(key);
      return hash && !(hash instanceof Set) ? Object.assign({}, hash) : {};
    },
    pipeline() {
      const jobs = [];
      return {
        scard(key) {
          jobs.push(() => api.scard(key));
          return this;
        },
        hgetall(key) {
          jobs.push(() => api.hgetall(key));
          return this;
        },
        exec() {
          return Promise.all(jobs.map((job) => job()));
        },
      };
    },
  };
  return api;
}

function emptyResponse() {
  return { status: 204, headers: { "cache-control": "no-store" }, body: "" };
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

async function readBlobStore() {
  const { get } = require("@vercel/blob");
  const existing = await get(BLOB_PATH, { access: "private", useCache: false });
  if (existing && existing.statusCode === 200 && existing.stream) {
    try {
      const data = JSON.parse(await streamText(existing.stream));
      if (data && data.days && typeof data.days === "object") return data;
    } catch {
      /* replace a damaged store on the next write */
    }
  }
  return { days: {} };
}

async function writeBlobStore(data) {
  const { put } = require("@vercel/blob");
  await put(BLOB_PATH, JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

function pruneDays(data, now) {
  const keep = new Set(recentDates(40, now));
  Object.keys(data.days || {}).forEach((day) => {
    if (!keep.has(day)) delete data.days[day];
  });
}

async function recordRedis(id, kind, day) {
  const redis = RedisFromEnv();
  const added = Number(await redis.sadd(dayKey(day), id)) || 0;
  if (!added) return;
  await redis.expire(dayKey(day), KEEP_SECONDS);
  await redis.hincrby(kindKey(day), kind, 1);
  await redis.expire(kindKey(day), KEEP_SECONDS);
}

function RedisFromEnv() {
  const { Redis } = require("@upstash/redis");
  return Redis.fromEnv();
}

async function recordBlob(id, kind, now) {
  const data = await readBlobStore();
  const day = shanghaiDate(now);
  const row = data.days[day] || (data.days[day] = {});
  if (!row[id]) row[id] = kind;
  pruneDays(data, now);
  await writeBlobStore(data);
}

async function recordMemory(id, kind, day) {
  const redis = memoryRedisFixed();
  const added = Number(await redis.sadd(dayKey(day), id)) || 0;
  if (!added) return;
  await redis.hincrby(kindKey(day), kind, 1);
}

async function recordVisit({ ua, body, now = new Date() }) {
  if (isBotUa(ua)) return emptyResponse();
  let data;
  try {
    data = JSON.parse(body || "");
  } catch {
    return emptyResponse();
  }
  const id = normalizeId(data && data.id);
  const kind = normalizeKind(data && data.kind);
  if (!id || !kind) return emptyResponse();
  const mode = storageMode();
  if (mode === "missing") return emptyResponse();
  const day = shanghaiDate(now);
  if (mode === "redis") await recordRedis(id, kind, day);
  else if (mode === "blob") await recordBlob(id, kind, now);
  else await recordMemory(id, kind, day);
  return emptyResponse();
}

function numberMap(raw) {
  const out = {};
  KINDS.forEach((kind) => {
    out[kind] = 0;
  });
  if (!raw || typeof raw !== "object") return out;
  Object.keys(raw).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = Number(raw[key]) || 0;
  });
  return out;
}

function rowsFromDays(dates, days) {
  return dates.map((date) => {
    const row = (days && days[date]) || {};
    const kinds = numberMap(null);
    Object.keys(row).forEach((id) => {
      const kind = row[id];
      if (Object.prototype.hasOwnProperty.call(kinds, kind)) kinds[kind] += 1;
    });
    return { date, total: Object.keys(row).length, kinds };
  });
}

async function loadReport(now = new Date()) {
  const dates = recentDates(DAYS, now);
  const mode = storageMode();
  if (mode === "missing") {
    return { mode, dates, rows: dates.map((date) => ({ date, total: 0, kinds: numberMap(null) })) };
  }
  if (mode === "blob") {
    const data = await readBlobStore();
    return { mode, dates, rows: rowsFromDays(dates, data.days) };
  }
  const redis = mode === "redis" ? RedisFromEnv() : memoryRedisFixed();
  const pipe = redis.pipeline();
  dates.forEach((date) => {
    pipe.scard(dayKey(date));
    pipe.hgetall(kindKey(date));
  });
  const packed = await pipe.exec();
  const rows = dates.map((date, index) => ({
    date,
    total: Number(packed[index * 2]) || 0,
    kinds: numberMap(packed[index * 2 + 1]),
  }));
  return { mode, dates, rows };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(report) {
  const head = KINDS.map((kind) => "<th>" + KIND_LABEL[kind] + "</th>").join("");
  const body = report.rows
    .map((row) => {
      const cells = KINDS.map((kind) => "<td>" + row.kinds[kind] + "</td>").join("");
      return "<tr><td>" + escapeHtml(row.date) + "</td><td>" + row.total + "</td>" + cells + "</tr>";
    })
    .join("");
  const sum = report.rows.reduce((total, row) => total + row.total, 0);
  const note =
    report.mode === "missing"
      ? "线上还没有接上存储，打开页面也不会把数字留下。"
      : report.mode === "memory"
        ? "这台预览只记在当前进程里，重启服务就没了。线上会记在已有的 Blob 里。"
        : "每个浏览器每天第一次点击、按键或滚动记 1 人。爬虫、自动脚本，以及只打开页面没有操作的访问不算。数字从这次功能上线后开始累。";
  return (
    "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"robots\" content=\"noindex\">" +
    "<meta name=\"referrer\" content=\"no-referrer\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>访客</title>" +
    "<style>body{margin:24px;font:15px/1.5 sans-serif;color:#1c2430;background:#f3f6fb}table{border-collapse:collapse;background:#fff}th,td{padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right}th:first-child,td:first-child{text-align:left}th{font-weight:600}</style>" +
    "</head><body><h1>访客</h1><p>" +
    note +
    "</p><p>近 30 天合计 " +
    sum +
    " 人。时区是上海。</p><table><thead><tr><th>日期</th><th>访客</th>" +
    head +
    "</tr></thead><tbody>" +
    body +
    "</tbody></table></body></html>"
  );
}

async function readVisits({ key, format, now }) {
  if (!keyMatches(key)) {
    return { status: 404, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" }, body: "not found" };
  }
  const report = await loadReport(now);
  const headers = {
    "cache-control": "no-store",
    "x-robots-tag": "noindex",
    "referrer-policy": "no-referrer",
  };
  if (format === "json") {
    headers["content-type"] = "application/json; charset=utf-8";
    return {
      status: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        configured: report.mode === "redis" || report.mode === "blob",
        timezone: "Asia/Shanghai",
        days: report.rows,
      }),
    };
  }
  headers["content-type"] = "text/html; charset=utf-8";
  return { status: 200, headers, body: renderHtml(report) };
}

module.exports = {
  KINDS,
  shanghaiDate,
  isBotUa,
  normalizeId,
  normalizeKind,
  keyMatches,
  recordVisit,
  readVisits,
  resetMemory,
  setForceMemory,
};
