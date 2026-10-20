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
const SITE_ORDER = ["veridrop", "modeltool"];
const SITES = {
  veridrop: {
    label: "API中转站导航",
    origins: ["https://www.veridrop.cn", "https://veridrop.cn", "http://127.0.0.1:4173", "http://localhost:4173"],
    kinds: KINDS,
  },
  modeltool: {
    label: "降智检测",
    origins: ["https://www.modeltool.cn", "https://modeltool.cn"],
    kinds: null,
  },
};
const BOT_RE =
  /ahrefs|mj12bot|bingbot|yandex|shapbot|applebot|googlebot|google-inspectiontool|google-extended|petalbot|bytespider|baiduspider|semrush|dotbot|sogou|360spider|yisouspider|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-searchbot|claude-user|anthropic-ai|perplexity|ccbot|amazonbot|meta-externalagent|meta-externalfetcher|cohere-ai|diffbot|youbot|curl\/|wget\/|python-requests|go-http-client|headlesschrome|local-mirror|scrapy|httpclient|spider|crawler|slurp|\bbot\b/;
const BLOB_PATH = "visits.json";
const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_SECONDS = 40 * 24 * 60 * 60;
const DAYS = 30;
const memoryStore = { sites: {} };
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

function openKey(site, day) {
  return "veridrop:visit:" + site + ":open:" + day;
}

function actKey(site, day) {
  return "veridrop:visit:" + site + ":act:" + day;
}

function seenKey(site, day) {
  return "veridrop:visit:" + site + ":seen:" + day;
}

function kindKey(site, day) {
  return "veridrop:visit:" + site + ":kind:" + day;
}

function resetMemory() {
  memoryStore.sites = {};
}

function setForceMemory(on) {
  forceMemory = Boolean(on);
  memoryStore.sites = {};
}

function cleanOrigin(origin) {
  return String(origin || "").trim();
}

function originAllowed(origin) {
  const value = cleanOrigin(origin);
  return SITE_ORDER.some((id) => SITES[id].origins.indexOf(value) >= 0);
}

function siteForRequest(rawSite, origin) {
  const value = cleanOrigin(origin);
  const requested = String(rawSite || "").trim();
  if (requested) {
    const site = SITES[requested];
    if (!site || site.origins.indexOf(value) < 0) return "";
    return requested;
  }
  if (SITES.veridrop.origins.indexOf(value) >= 0) return "veridrop";
  return "";
}

function ensureDays(store, site) {
  if (!store.sites[site] || typeof store.sites[site] !== "object") store.sites[site] = { days: {} };
  if (!store.sites[site].days || typeof store.sites[site].days !== "object") store.sites[site].days = {};
  return store.sites[site].days;
}

function seedLegacyVisit(id, kind, now = new Date()) {
  const cleanId = normalizeId(id);
  const cleanKind = normalizeKind(kind);
  if (!cleanId || !cleanKind) return;
  const day = shanghaiDate(now);
  const days = ensureDays(memoryStore, "veridrop");
  if (!days[day] || typeof days[day] !== "object") days[day] = {};
  days[day][cleanId] = cleanKind;
}

function asSites(data) {
  const sites = {};
  const incoming = data && data.sites && typeof data.sites === "object" ? data.sites : null;
  if (incoming) {
    Object.keys(incoming).forEach((id) => {
      if (!SITES[id]) return;
      const bucket = incoming[id];
      if (!bucket || typeof bucket !== "object" || !bucket.days || typeof bucket.days !== "object") return;
      sites[id] = { days: bucket.days };
    });
  }
  if ((!incoming || !sites.veridrop) && data && data.days && typeof data.days === "object") {
    sites.veridrop = { days: data.days };
  }
  return { sites };
}

function emptyResponse() {
  return { status: 204, headers: { "cache-control": "no-store" }, body: "" };
}

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": cleanOrigin(origin),
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function withCors(result, origin) {
  if (!originAllowed(origin)) return result;
  return {
    status: result.status,
    headers: Object.assign({}, result.headers, corsHeaders(origin)),
    body: result.body,
  };
}

function preflightVisit(origin) {
  return withCors(emptyResponse(), origin);
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
      if (data && ((data.sites && typeof data.sites === "object") || (data.days && typeof data.days === "object"))) return data;
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

function pruneSites(data, now) {
  const keep = new Set(recentDates(40, now));
  let pruned = false;
  Object.keys(data.sites || {}).forEach((site) => {
    const days = data.sites[site] && data.sites[site].days;
    if (!days || typeof days !== "object") {
      delete data.sites[site];
      pruned = true;
      return;
    }
    Object.keys(days).forEach((day) => {
      if (!keep.has(day)) {
        delete days[day];
        pruned = true;
      }
    });
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
  if (value.k) {
    const kind = normalizeKind(value.k);
    if (!kind) return null;
    return { k: kind, o: value.o ? 1 : 0, a: value.a ? 1 : 0 };
  }
  if (!value.o && !value.a) return null;
  return { k: "", o: value.o ? 1 : 0, a: value.a ? 1 : 0 };
}

function mergeVisit(prev, kind, acted) {
  const eventOpen = acted ? 0 : 1;
  const eventAct = acted ? 1 : 0;
  function fresh() {
    const entry = { o: eventOpen, a: eventAct };
    if (kind) entry.k = kind;
    return { entry, changed: true };
  }
  if (prev == null || prev === "") return fresh();
  const current = entryFromStored(prev);
  if (!current) return fresh();
  const next = { o: current.o || eventOpen, a: current.a || eventAct };
  const nextKind = current.k || kind || "";
  if (nextKind) next.k = nextKind;
  const changed =
    typeof prev !== "object" || next.o !== current.o || next.a !== current.a || (next.k || "") !== (current.k || "");
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

async function recordRedis(site, id, kind, acted, day) {
  const redis = RedisFromEnv();
  const added = Number(await redis.sadd(seenKey(site, day), id)) || 0;
  if (added) await redis.expire(seenKey(site, day), KEEP_SECONDS);
  if (added && kind) {
    await redis.hincrby(kindKey(site, day), kind, 1);
    await redis.expire(kindKey(site, day), KEEP_SECONDS);
  }
  const flagKey = acted ? actKey(site, day) : openKey(site, day);
  const flagged = Number(await redis.sadd(flagKey, id)) || 0;
  if (flagged) await redis.expire(flagKey, KEEP_SECONDS);
}

function RedisFromEnv() {
  const { Redis } = require("@upstash/redis");
  return Redis.fromEnv();
}

async function recordBlob(site, id, kind, acted, now) {
  const raw = await readBlobStore();
  const data = asSites(raw);
  const changed = recordInDays(ensureDays(data, site), id, kind, acted, now);
  const pruned = pruneSites(data, now);
  const shapeChanged = Boolean(raw && raw.days && !raw.sites);
  if (!changed && !pruned && !shapeChanged) return;
  await writeBlobStore({ sites: data.sites });
}

function recordMemory(site, id, kind, acted, now) {
  recordInDays(ensureDays(memoryStore, site), id, kind, acted, now);
  pruneSites(memoryStore, now);
}

async function recordVisit({ ua, body, origin = "", now = new Date() }) {
  if (isBotUa(ua)) return withCors(emptyResponse(), origin);
  let data;
  try {
    data = JSON.parse(body || "");
  } catch {
    return withCors(emptyResponse(), origin);
  }
  const site = siteForRequest(data && data.site, origin);
  const id = normalizeId(data && data.id);
  if (!site || !id) return withCors(emptyResponse(), origin);
  const kinds = SITES[site].kinds;
  const kind = kinds ? normalizeKind(data && data.kind) : "";
  if (kinds && !kind) return withCors(emptyResponse(), origin);
  const mode = storageMode();
  if (mode === "missing") return withCors(emptyResponse(), origin);
  const acted = normalizeActed(data);
  const day = shanghaiDate(now);
  if (mode === "redis") await recordRedis(site, id, kind, acted, day);
  else if (mode === "blob") await recordBlob(site, id, kind, acted, now);
  else recordMemory(site, id, kind, acted, now);
  return withCors(emptyResponse(), origin);
}

function numberMap(raw, kinds) {
  const out = {};
  (kinds || []).forEach((kind) => {
    out[kind] = 0;
  });
  if (!raw || typeof raw !== "object") return out;
  Object.keys(raw).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = Number(raw[key]) || 0;
  });
  return out;
}

function emptyRow(date, kinds) {
  return { date, open: 0, acted: 0, kinds: numberMap(null, kinds) };
}

function rowsFromDays(dates, days, kinds) {
  return dates.map((date) => {
    const row = (days && days[date]) || {};
    const counts = numberMap(null, kinds);
    let open = 0;
    let acted = 0;
    if (!row || typeof row !== "object") return emptyRow(date, kinds);
    Object.keys(row).forEach((id) => {
      const entry = entryFromStored(row[id]);
      if (!entry) return;
      if (entry.o) open += 1;
      if (entry.a) acted += 1;
      if (entry.k && Object.prototype.hasOwnProperty.call(counts, entry.k)) counts[entry.k] += 1;
    });
    return { date, open, acted, kinds: counts };
  });
}

async function loadReport(site, now = new Date()) {
  const dates = recentDates(DAYS, now);
  const kinds = SITES[site].kinds;
  const mode = storageMode();
  if (mode === "missing") return { mode, site, dates, rows: dates.map((date) => emptyRow(date, kinds)) };
  if (mode === "blob") {
    const data = asSites(await readBlobStore());
    const days = (data.sites[site] && data.sites[site].days) || {};
    return { mode, site, dates, rows: rowsFromDays(dates, days, kinds) };
  }
  if (mode === "memory") {
    const days = (memoryStore.sites[site] && memoryStore.sites[site].days) || {};
    return { mode, site, dates, rows: rowsFromDays(dates, days, kinds) };
  }
  const redis = RedisFromEnv();
  const pipe = redis.pipeline();
  dates.forEach((date) => {
    pipe.scard(openKey(site, date));
    pipe.scard(actKey(site, date));
    pipe.hgetall(kindKey(site, date));
  });
  const packed = await pipe.exec();
  const rows = dates.map((date, index) => ({
    date,
    open: Number(packed[index * 3]) || 0,
    acted: Number(packed[index * 3 + 1]) || 0,
    kinds: numberMap(packed[index * 3 + 2], kinds),
  }));
  return { mode, site, dates, rows };
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

function renderRows(rows, today, kinds) {
  return rows
    .map((row) => {
      const classes = [];
      if (row.date === today) classes.push("is-today");
      if (!row.open && !row.acted) classes.push("is-empty");
      const cls = classes.length ? ' class="' + classes.join(" ") + '"' : "";
      const kindCells = (kinds || []).map((kind) => numCell(row.kinds[kind] || 0, "")).join("");
      return (
        "<tr" +
        cls +
        "><td>" +
        escapeHtml(row.date) +
        "</td>" +
        numCell(row.open, "col-open") +
        numCell(row.acted, "col-act") +
        kindCells +
        "</tr>"
      );
    })
    .join("");
}

function reportNote(mode, site) {
  const storage =
    mode === "missing"
      ? "线上还没有接上存储，打开页面也不会把数字留下。"
      : mode === "memory"
        ? "这台预览只记在当前进程里，重启服务就没了。线上会记在已有的 Blob 里。"
        : "";
  const base =
    "每个浏览器按上海时间一天记一次。页面脚本跑起来记「打开」，当天第一次点击、按键或滚动再记「有操作」。爬虫和自动脚本不算。这里只算当前这个站。";
  const extra = SITES[site].kinds
    ? "右侧是当天第一次出现的页面。上面两个数是这 30 天每天相加，同一个人连续来几天会各记一次。这次改版前记下的，以及只上报了操作的旧数据，只算有操作。"
    : "上面两个数是这 30 天每天相加，同一个人连续来几天会各记一次。";
  return storage + base + extra;
}

function renderSiteNav(current) {
  const links = SITE_ORDER.map((id) => {
    const currentAttr = id === current ? ' aria-current="page"' : "";
    return (
      '<a data-site-link="' +
      id +
      '" href="#' +
      id +
      '"' +
      currentAttr +
      ">" +
      escapeHtml(SITES[id].label) +
      "</a>"
    );
  }).join("");
  return (
    '<nav class="sites" aria-label="站点">' +
    links +
    "</nav><script>(function(){var current=" +
    JSON.stringify(current) +
    ";document.querySelectorAll(\"[data-site-link]\").forEach(function(a){var id=a.getAttribute(\"data-site-link\");if(id===current)a.setAttribute(\"aria-current\",\"page\");a.addEventListener(\"click\",function(ev){ev.preventDefault();var url=new URL(location.href);if(id===\"veridrop\")url.searchParams.delete(\"site\");else url.searchParams.set(\"site\",id);location.assign(url.pathname+url.search);});});})();</script>"
  );
}

function renderHtml(report) {
  const kinds = SITES[report.site].kinds || [];
  const label = SITES[report.site].label;
  const head =
    "<th>日期</th><th class=\"col-open\">打开</th><th class=\"col-act\">有操作</th>" +
    kinds.map((kind) => "<th>" + KIND_LABEL[kind] + "</th>").join("");
  const openSum = report.rows.reduce((total, row) => total + row.open, 0);
  const actSum = report.rows.reduce((total, row) => total + row.acted, 0);
  const today = report.dates[0] || "";
  return (
    "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"robots\" content=\"noindex\">" +
    "<meta name=\"referrer\" content=\"no-referrer\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>访客 · " +
    escapeHtml(label) +
    "</title>" +
    "<script>(function(){try{var saved=localStorage.getItem(\"xiantan.theme\");var theme=saved===\"light\"||saved===\"dark\"?saved:(window.matchMedia&&window.matchMedia(\"(prefers-color-scheme: light)\").matches?\"light\":\"dark\");document.documentElement.setAttribute(\"data-theme\",theme);}catch(e){document.documentElement.setAttribute(\"data-theme\",\"dark\");}})();</script>" +
    "<style>" +
    ":root{color-scheme:dark;--bg:#070b14;--panel:#121b2e;--line:rgba(168,196,255,.12);--text:#e9f0ff;--muted:#8b9bb8;--teal:#3ee0c2;--blue:#7aa7ff;--placeholder:#6d7d99}" +
    "html[data-theme=light]{color-scheme:light;--bg:#f3f6fb;--panel:#fff;--line:rgba(28,49,80,.1);--text:#172033;--muted:#5c6b82;--teal:#0f9d86;--blue:#3b6fd4;--placeholder:#8a97ad}" +
    "*{box-sizing:border-box}body{margin:0;font:16px/1.5 \"PingFang SC\",\"Microsoft YaHei\",\"Noto Sans SC\",system-ui,sans-serif;color:var(--text);background:var(--bg)}" +
    ".wrap{max-width:1120px;margin:0 auto;padding:28px 20px 64px}" +
    ".top{display:flex;align-items:center;gap:12px}" +
    ".top img{width:36px;height:36px;border-radius:10px}" +
    ".brand{margin:0;color:var(--muted);font-size:13px}" +
    ".sites{display:flex;gap:18px;margin:16px 0 0}" +
    ".sites a{color:var(--muted);font-size:14px;text-decoration:none}" +
    ".sites a[aria-current=page]{color:var(--text);font-weight:600}" +
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
    "table.plain{min-width:0}" +
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
    "<div><p class=\"brand\">" +
    escapeHtml(label) +
    "</p><h1>访客</h1><p class=\"sub\">近 30 天 · 上海时间</p>" +
    renderSiteNav(report.site) +
    "</div></header>" +
    "<div class=\"stats\"><section class=\"stat open\"><span class=\"label\">打开</span><strong id=\"open-total\" class=\"num\">" +
    openSum +
    "</strong><span class=\"fine\">30 天每天相加</span></section>" +
    "<section class=\"stat act\"><span class=\"label\">有操作</span><strong id=\"act-total\" class=\"num\">" +
    actSum +
    "</strong><span class=\"fine\">30 天每天相加</span></section></div>" +
    "<p class=\"note\">" +
    escapeHtml(reportNote(report.mode, report.site)) +
    "</p><div class=\"table-wrap\"><table" +
    (kinds.length ? "" : ' class="plain"') +
    "><thead><tr>" +
    head +
    "</tr></thead><tbody>" +
    renderRows(report.rows, today, kinds) +
    "</tbody></table></div></div></body></html>"
  );
}

async function readVisits({ key, format, site, now }) {
  if (!keyMatches(key)) {
    return { status: 404, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" }, body: "not found" };
  }
  const siteId = String(site || "").trim() || "veridrop";
  if (!SITES[siteId]) {
    return { status: 404, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" }, body: "not found" };
  }
  const report = await loadReport(siteId, now);
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
        site: report.site,
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
  SITES,
  shanghaiDate,
  isBotUa,
  normalizeId,
  normalizeKind,
  keyMatches,
  asSites,
  preflightVisit,
  recordVisit,
  readVisits,
  resetMemory,
  setForceMemory,
  seedLegacyVisit,
};
