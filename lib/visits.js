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
const BOT_RE =
  /ahrefs|mj12bot|bingbot|yandex|shapbot|applebot|googlebot|google-inspectiontool|google-extended|petalbot|bytespider|baiduspider|semrush|dotbot|sogou|360spider|yisouspider|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-searchbot|claude-user|anthropic-ai|perplexity|ccbot|amazonbot|meta-externalagent|meta-externalfetcher|cohere-ai|diffbot|youbot|curl\/|wget\/|python-requests|go-http-client|headlesschrome|local-mirror|scrapy|httpclient|spider|crawler|slurp|\bbot\b/;
const BLOB_PATH = "visits.json";
const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_SECONDS = 40 * 24 * 60 * 60;
const DAYS = 30;
const memoryStore = { days: {} };
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
  return BOT_RE.test(text);
}

function normalizeId(raw) {
  const id = String(raw || "").trim();
  return /^[a-z0-9]{16,48}$/.test(id) ? id : "";
}

function normalizeKind(raw) {
  const kind = String(raw || "").trim();
  return KINDS.indexOf(kind) >= 0 ? kind : "";
}

function normalizeActed(data) {
  if (!data || typeof data !== "object" || !Object.prototype.hasOwnProperty.call(data, "acted")) return true;
  return data.acted === true;
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

function openKey(day) {
  return "veridrop:visit:open:" + day;
}

function actKey(day) {
  return "veridrop:visit:act:" + day;
}

function seenKey(day) {
  return "veridrop:visit:seen:" + day;
}

function kindKey(day) {
  return "veridrop:visit:kind:" + day;
}

function resetMemory() {
  memoryStore.days = {};
}

function setForceMemory(on) {
  forceMemory = Boolean(on);
  memoryStore.days = {};
}

function seedLegacyVisit(id, kind, now = new Date()) {
  const cleanId = normalizeId(id);
  const cleanKind = normalizeKind(kind);
  if (!cleanId || !cleanKind) return;
  const day = shanghaiDate(now);
  if (!memoryStore.days[day] || typeof memoryStore.days[day] !== "object") memoryStore.days[day] = {};
  memoryStore.days[day][cleanId] = cleanKind;
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
  let pruned = false;
  Object.keys(data.days || {}).forEach((day) => {
    if (!keep.has(day)) {
      delete data.days[day];
      pruned = true;
    }
  });
  return pruned;
}

// Older rows stored the page kind as a string. Those visits had an interaction and no open.
function entryFromStored(value) {
  if (typeof value === "string") {
    const kind = normalizeKind(value);
    if (!kind) return null;
    return { k: kind, o: 0, a: 1 };
  }
  if (!value || typeof value !== "object") return null;
  const kind = normalizeKind(value.k);
  if (!kind) return null;
  return { k: kind, o: value.o ? 1 : 0, a: value.a ? 1 : 0 };
}

function mergeVisit(prev, kind, acted) {
  const eventOpen = acted ? 0 : 1;
  const eventAct = acted ? 1 : 0;
  if (prev == null || prev === "") return { entry: { k: kind, o: eventOpen, a: eventAct }, changed: true };
  const current = entryFromStored(prev);
  if (!current) return { entry: { k: kind, o: eventOpen, a: eventAct }, changed: true };
  const next = {
    k: current.k,
    o: current.o || eventOpen,
    a: current.a || eventAct,
  };
  const changed = typeof prev !== "object" || next.o !== current.o || next.a !== current.a;
  return { entry: next, changed };
}

function recordInDays(days, id, kind, acted, now) {
  const day = shanghaiDate(now);
  if (!days[day] || typeof days[day] !== "object") days[day] = {};
  const merged = mergeVisit(days[day][id], kind, acted);
  if (!merged.changed) return false;
  days[day][id] = merged.entry;
  return true;
}

async function recordRedis(id, kind, acted, day) {
  const redis = RedisFromEnv();
  const added = Number(await redis.sadd(seenKey(day), id)) || 0;
  if (added) {
    await redis.expire(seenKey(day), KEEP_SECONDS);
    await redis.hincrby(kindKey(day), kind, 1);
    await redis.expire(kindKey(day), KEEP_SECONDS);
  }
  const flagKey = acted ? actKey(day) : openKey(day);
  const flagged = Number(await redis.sadd(flagKey, id)) || 0;
  if (flagged) await redis.expire(flagKey, KEEP_SECONDS);
}

function RedisFromEnv() {
  const { Redis } = require("@upstash/redis");
  return Redis.fromEnv();
}

async function recordBlob(id, kind, acted, now) {
  const data = await readBlobStore();
  const changed = recordInDays(data.days, id, kind, acted, now);
  const pruned = pruneDays(data, now);
  if (!changed && !pruned) return;
  await writeBlobStore(data);
}

function recordMemory(id, kind, acted, now) {
  recordInDays(memoryStore.days, id, kind, acted, now);
  pruneDays(memoryStore, now);
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
  const acted = normalizeActed(data);
  const day = shanghaiDate(now);
  if (mode === "redis") await recordRedis(id, kind, acted, day);
  else if (mode === "blob") await recordBlob(id, kind, acted, now);
  else recordMemory(id, kind, acted, now);
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

function emptyRow(date) {
  return { date, open: 0, acted: 0, kinds: numberMap(null) };
}

function rowsFromDays(dates, days) {
  return dates.map((date) => {
    const row = (days && days[date]) || {};
    const kinds = numberMap(null);
    let open = 0;
    let acted = 0;
    if (!row || typeof row !== "object") return emptyRow(date);
    Object.keys(row).forEach((id) => {
      const entry = entryFromStored(row[id]);
      if (!entry) return;
      if (entry.o) open += 1;
      if (entry.a) acted += 1;
      kinds[entry.k] += 1;
    });
    return { date, open, acted, kinds };
  });
}

async function loadReport(now = new Date()) {
  const dates = recentDates(DAYS, now);
  const mode = storageMode();
  if (mode === "missing") return { mode, dates, rows: dates.map(emptyRow) };
  if (mode === "blob") {
    const data = await readBlobStore();
    return { mode, dates, rows: rowsFromDays(dates, data.days) };
  }
  if (mode === "memory") return { mode, dates, rows: rowsFromDays(dates, memoryStore.days) };
  const redis = RedisFromEnv();
  const pipe = redis.pipeline();
  dates.forEach((date) => {
    pipe.scard(openKey(date));
    pipe.scard(actKey(date));
    pipe.hgetall(kindKey(date));
  });
  const packed = await pipe.exec();
  const rows = dates.map((date, index) => ({
    date,
    open: Number(packed[index * 3]) || 0,
    acted: Number(packed[index * 3 + 1]) || 0,
    kinds: numberMap(packed[index * 3 + 2]),
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

function numCell(value, className) {
  const names = [];
  if (className) names.push(className);
  if (!value) names.push("zero");
  const cls = names.length ? ' class="' + names.join(" ") + '"' : "";
  return "<td" + cls + ">" + value + "</td>";
}

function renderRows(rows, today) {
  return rows
    .map((row) => {
      const classes = [];
      if (row.date === today) classes.push("is-today");
      if (!row.open && !row.acted) classes.push("is-empty");
      const cls = classes.length ? ' class="' + classes.join(" ") + '"' : "";
      const kinds = KINDS.map((kind) => numCell(row.kinds[kind], "")).join("");
      return (
        "<tr" +
        cls +
        "><td>" +
        escapeHtml(row.date) +
        "</td>" +
        numCell(row.open, "col-open") +
        numCell(row.acted, "col-act") +
        kinds +
        "</tr>"
      );
    })
    .join("");
}

function reportNote(mode) {
  const rule =
    "每个浏览器按上海时间一天记一次。页面脚本跑起来记「打开」，当天第一次点击、按键或滚动再记「有操作」。爬虫和自动脚本不算。右侧是当天第一次出现的页面。上面两个数是这 30 天每天相加，同一个人连续来几天会各记一次。这次改版前记下的，以及只上报了操作的旧数据，只算有操作。";
  if (mode === "missing") return "线上还没有接上存储，打开页面也不会把数字留下。" + rule;
  if (mode === "memory") return "这台预览只记在当前进程里，重启服务就没了。线上会记在已有的 Blob 里。" + rule;
  return rule;
}

function renderHtml(report) {
  const head =
    "<th>日期</th><th class=\"col-open\">打开</th><th class=\"col-act\">有操作</th>" +
    KINDS.map((kind) => "<th>" + KIND_LABEL[kind] + "</th>").join("");
  const openSum = report.rows.reduce((total, row) => total + row.open, 0);
  const actSum = report.rows.reduce((total, row) => total + row.acted, 0);
  const today = report.dates[0] || "";
  return (
    "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"robots\" content=\"noindex\">" +
    "<meta name=\"referrer\" content=\"no-referrer\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>访客</title>" +
    "<script>(function(){try{var saved=localStorage.getItem(\"xiantan.theme\");var theme=saved===\"light\"||saved===\"dark\"?saved:(window.matchMedia&&window.matchMedia(\"(prefers-color-scheme: light)\").matches?\"light\":\"dark\");document.documentElement.setAttribute(\"data-theme\",theme);}catch(e){document.documentElement.setAttribute(\"data-theme\",\"dark\");}})();</script>" +
    "<style>" +
    ":root{color-scheme:dark;--bg:#070b14;--panel:#121b2e;--line:rgba(168,196,255,.12);--text:#e9f0ff;--muted:#8b9bb8;--teal:#3ee0c2;--blue:#7aa7ff;--placeholder:#6d7d99}" +
    "html[data-theme=light]{color-scheme:light;--bg:#f3f6fb;--panel:#fff;--line:rgba(28,49,80,.1);--text:#172033;--muted:#5c6b82;--teal:#0f9d86;--blue:#3b6fd4;--placeholder:#8a97ad}" +
    "*{box-sizing:border-box}body{margin:0;font:16px/1.5 \"PingFang SC\",\"Microsoft YaHei\",\"Noto Sans SC\",system-ui,sans-serif;color:var(--text);background:var(--bg)}" +
    ".wrap{max-width:1120px;margin:0 auto;padding:28px 20px 64px}" +
    ".top{display:flex;align-items:center;gap:12px}" +
    ".top img{width:36px;height:36px;border-radius:10px}" +
    ".brand{margin:0;color:var(--muted);font-size:13px}" +
    "h1{margin:0;font-size:28px;font-weight:600;letter-spacing:-.02em}" +
    ".sub{margin:6px 0 0;color:var(--muted);font-size:14px}" +
    ".stats{display:flex;gap:16px;margin:22px 0 14px}" +
    ".stat{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px 20px 16px}" +
    ".stat .label{display:block;color:var(--muted);font-size:14px}" +
    ".stat .num{display:block;margin-top:4px;font-size:40px;line-height:1.1;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.03em}" +
    ".stat.open .num{color:var(--teal)}.stat.act .num{color:var(--blue)}" +
    ".stat .fine{display:block;margin-top:6px;color:var(--placeholder);font-size:13px}" +
    ".note{margin:0 0 18px;color:var(--muted);font-size:14px;max-width:70em}" +
    ".table-wrap{background:var(--panel);border:1px solid var(--line);border-radius:18px;overflow:auto}" +
    "table{width:100%;border-collapse:collapse;min-width:920px}" +
    "th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}" +
    "th:first-child,td:first-child{text-align:left}" +
    "th{font-size:13px;font-weight:600;color:var(--muted);position:sticky;top:0;background:var(--panel)}" +
    "th.col-open,td.col-open{color:var(--teal)}th.col-act,td.col-act{color:var(--blue)}" +
    "td.zero{color:var(--placeholder)}" +
    "tr:last-child td{border-bottom:0}" +
    "tr.is-empty td{color:var(--placeholder)}" +
    "tr.is-today td:first-child{color:var(--text);font-weight:600}" +
    "@media(max-width:640px){.stats{flex-direction:column}h1{font-size:24px}}" +
    "</style></head><body><div class=\"wrap\">" +
    "<header class=\"top\"><img src=\"/img/icon-192.png\" width=\"36\" height=\"36\" alt=\"\">" +
    "<div><p class=\"brand\">API中转站导航</p><h1>访客</h1><p class=\"sub\">近 30 天 · 上海时间</p></div></header>" +
    "<div class=\"stats\"><section class=\"stat open\"><span class=\"label\">打开</span><strong id=\"open-total\" class=\"num\">" +
    openSum +
    "</strong><span class=\"fine\">30 天每天相加</span></section>" +
    "<section class=\"stat act\"><span class=\"label\">有操作</span><strong id=\"act-total\" class=\"num\">" +
    actSum +
    "</strong><span class=\"fine\">30 天每天相加</span></section></div>" +
    "<p class=\"note\">" +
    escapeHtml(reportNote(report.mode)) +
    "</p><div class=\"table-wrap\"><table><thead><tr>" +
    head +
    "</tr></thead><tbody>" +
    renderRows(report.rows, today) +
    "</tbody></table></div></div></body></html>"
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
  seedLegacyVisit,
};
