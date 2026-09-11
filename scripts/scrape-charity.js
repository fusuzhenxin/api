/**
 * 从 baipiao.org/charity 公开列表同步公益站。
 * 用法：node scripts/scrape-charity.js
 *
 * 匹配已有目录里的站，打上 charity；名单里没有的再补新站（id 从 900001 起）。
 * 写出：data/charity.json，并更新 data/stations.json、js/stations-data.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = "https://baipiao.org/charity/";
const UA = "XianTanNav/1.0 (charity catalog sync)";
const CHARITY_ID_BASE = 900000;
const DATA_PATH = path.join(ROOT, "data", "stations.json");
const JS_PATH = path.join(ROOT, "js", "stations-data.js");
const CHARITY_PATH = path.join(ROOT, "data", "charity.json");

const SHARED_ROOTS = new Set([
  "cpolar.io",
  "github.io",
  "gitlab.io",
  "vercel.app",
  "netlify.app",
  "pages.dev",
  "workers.dev",
  "herokuapp.com",
  "railway.app",
  "render.com",
  "fly.dev",
  "qzz.io",
  "pp.ua",
  "de5.net",
  "xyz",
]);

const GENERIC_NAMES = new Set(["api", "co", "ai", "free", "cheap", "new", "pro", "plus", "openai"]);

const FEATURE_DEFS = [
  { id: "checkin", re: /签到|打卡领|每日领|领通用余额|签到送|签到领/ },
  { id: "gift", re: /注册送|新用户.{0,8}送|赠送.{0,8}(余额|额度|刀)|送\s*\d+\s*(刀|元|额度)|试用额度|免费额度|新人额度/ },
  { id: "invite", re: /邀请|返利|推广奖励/ },
  { id: "pay", re: /支付宝|微信支付|微信充值/ },
  { id: "crypto", re: /USDT|加密货币|钱包充值/ },
  { id: "cheaprate", re: /低倍率|0\.0\d+|0\.[12]\s*[x×X倍]|倍率\s*0\.[12]/ },
];

const MODEL_DEFS = [
  { id: "gpt", label: "GPT", re: /gpt|openai|chatgpt|codex/i },
  { id: "claude", label: "Claude", re: /claude|anthropic|\bcc\b|sonnet|opus/i },
  { id: "gemini", label: "Gemini", re: /gemini|谷歌/i },
  { id: "grok", label: "Grok", re: /grok|xai/i },
  { id: "deepseek", label: "DeepSeek", re: /deepseek/i },
  { id: "kimi", label: "Kimi", re: /kimi|moonshot/i },
  { id: "qwen", label: "Qwen", re: /qwen|通义|千问/i },
  { id: "glm", label: "GLM", re: /glm|智谱/i },
  { id: "image", label: "生图", re: /生图|绘图|image|flux|banana|imagine|midjourney|dall/i },
  { id: "video", label: "视频", re: /视频|video|sora|runway|kling/i },
];

function request(url, { maxRedirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const go = (target, left) => {
      const lib = target.startsWith("http://") ? http : https;
      const req = lib.get(
        target,
        {
          headers: {
            "User-Agent": UA,
            Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
          },
        },
        (res) => {
          const loc = res.headers.location;
          if (loc && left > 0 && res.statusCode >= 300 && res.statusCode < 400) {
            res.resume();
            return go(new URL(loc, target).href, left - 1);
          }
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () =>
            resolve({
              status: res.statusCode || 0,
              body: Buffer.concat(chunks).toString("utf8"),
              url: target,
            })
          );
        }
      );
      req.on("error", reject);
      req.setTimeout(25000, () => req.destroy(new Error("timeout " + target)));
    };
    go(url, maxRedirects);
  });
}

function decode(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(block, name) {
  const m = block.match(new RegExp("data-" + name + '="([^"]*)"', "i"));
  return m ? decode(m[1]) : "";
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function rootHost(h) {
  const parts = String(h || "")
    .toLowerCase()
    .split(".")
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const two = parts.slice(-2).join(".");
  if (/^(com|net|org|edu|gov|co|ac)\.[a-z]{2}$/i.test(two) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return two;
}

function relatedHost(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.endsWith("." + b) || b.endsWith("." + a);
}

function isSharedRoot(h) {
  const root = rootHost(h);
  return SHARED_ROOTS.has(root) || SHARED_ROOTS.has(h);
}

function cleanUrl(raw) {
  if (!raw || !/^https?:\/\//i.test(raw)) return "";
  try {
    const u = new URL(raw);
    ["aff", "ref", "invite", "inviter", "code", "from"].forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return raw;
  }
}

function pickUrl(hrefs) {
  const skip = /github\.com|qm\.qq\.com|t\.me|telegram|discord\.com|twitter\.com|x\.com|linux\.do|ldcstore|status\.|docs\.|cloudflare|baipiao\.org/i;
  const abs = hrefs.filter((u) => /^https?:\/\//i.test(u) && !skip.test(u));
  return cleanUrl(abs[0] || "");
}

function shortSummary(text, name) {
  let s = decode(text)
    .replace(/通过本页\s*aff[^。！]*[。！]?/gi, "")
    .replace(/我[这]?[两天]?[才]?摸到的[^。]*。/g, "")
    .replace(/，这种[^。]*见过。?/g, "。")
    .replace(/我目前[^。！]*[。！]?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return `${name} 是公开目录里的公益 API 站点，额度与可用性以对方页面为准。`;
  const first = s.split(/[。！]/)[0].trim();
  if (first && first.length >= 10 && first.length <= 160) return first + "。";
  if (s.length <= 160) return s;
  return s.slice(0, 156).replace(/[,，、\s]+$/, "") + "…";
}

function inferModels(text) {
  const hay = String(text || "");
  return MODEL_DEFS.filter((def) => def.re.test(hay)).map((def) => ({
    id: def.id,
    label: def.label,
    rate: null,
    mentioned: true,
  }));
}

function inferFeatures(site) {
  const text = `${site.name || ""} ${site.description || ""} ${site.tag || ""}`;
  return FEATURE_DEFS.filter((def) => def.re.test(text)).map((def) => def.id);
}

function addCat(site, id) {
  site.categories = [...new Set([...(site.categories || []), id])];
  site.features = [...new Set([...(site.features || []), id])];
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/公益站|免费站|镜像站|中转站|api/g, "")
    .replace(/[\s_\-()（）·]/g, "");
}

function parseCharityHtml(html) {
  const parts = html.split(/<div class="ccard(?: dead)?"/);
  const items = [];
  const seen = new Set();
  for (const part of parts.slice(1)) {
    const block = '<div class="ccard"' + part.slice(0, 12000);
    const slug = attr(block, "entry-id") || attr(block, "name");
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const name = decode((block.match(/<a class="cname"[^>]*>([\s\S]*?)<\/a>/) || [])[1] || "") || attr(block, "name");
    const summary =
      decode((block.match(/<p class="csum"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "") || attr(block, "summary");
    const hrefs = [...block.matchAll(/href="([^"]+)"/g)].map((x) => x[1]);
    const url = pickUrl(hrefs);
    const status = attr(block, "status") || "active";
    const pin = Number(attr(block, "pinned-weight") || 0) || 0;
    items.push({
      slug,
      name,
      summary,
      tags: attr(block, "tags"),
      url,
      domain: hostOf(url),
      status,
      pin,
      dead: status !== "active",
    });
  }
  return items;
}

async function fillMissingUrls(items) {
  const missing = items.filter((it) => !it.url);
  for (const it of missing) {
    try {
      const res = await request("https://baipiao.org/charity/" + encodeURIComponent(it.slug) + "/");
      if (res.status !== 200) continue;
      const hrefs = [...res.body.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
      it.url = pickUrl(hrefs);
      it.domain = hostOf(it.url);
    } catch {
      /* keep empty */
    }
  }
}

function findMatch(item, stations) {
  const domain = item.domain;
  if (domain) {
    const exact = stations.filter((s) => {
      const d = String(s.domain || "").toLowerCase();
      const u = hostOf(s.url || "");
      return d === domain || u === domain;
    });
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      const named = exact.find((s) => normName(s.name) && normName(s.name) === normName(item.name));
      return named || exact[0];
    }

    if (!isSharedRoot(domain)) {
      const related = stations.filter((s) => {
        const d = String(s.domain || "").toLowerCase();
        const u = hostOf(s.url || "");
        return (d && relatedHost(d, domain)) || (u && relatedHost(u, domain));
      });
      if (related.length === 1) return related[0];
      if (related.length > 1) {
        const named = related.find((s) => normName(s.name) && normName(s.name) === normName(item.name));
        if (named) return named;
      }
    }
  }

  const n = normName(item.name);
  if (!n || n.length < 4 || GENERIC_NAMES.has(n)) return null;
  const named = stations.filter((s) => normName(s.name) === n);
  if (named.length === 1) return named[0];
  return null;
}

function nextCharityId(stations, prevMap) {
  const used = new Set(stations.map((s) => Number(s.id)).filter((n) => n > 0));
  for (const id of Object.values(prevMap || {})) used.add(Number(id));
  let n = CHARITY_ID_BASE + 1;
  while (used.has(n)) n += 1;
  return n;
}

function makeCharityStation(item, id) {
  const description = shortSummary(item.summary, item.name);
  const site = {
    id,
    name: item.name,
    url: item.url,
    domain: item.domain,
    logo: "",
    tag: "公益站",
    description,
    categories: ["charity"],
    features: ["charity"],
    promoted: false,
    rank: 0,
    createdAt: "",
    votes: { up: 0, down: 0 },
    status: {
      online: item.dead ? false : null,
      ms: null,
      uptime: null,
      avgMs: null,
      checkedAt: "",
    },
    models: inferModels(`${item.name} ${item.summary} ${item.tags}`),
    checks: [],
    charitySlug: item.slug,
    charityPin: item.pin || 0,
  };
  const feats = inferFeatures(site);
  site.features = [...new Set(["charity", ...feats])];
  site.categories = [...new Set(["charity", ...feats])];
  return site;
}

function applyCharityToPayload(payload, items, prevIds) {
  const stations = payload.stations || [];
  const bySlug = new Map();
  for (const s of stations) {
    if (s.charitySlug) bySlug.set(s.charitySlug, s);
  }
  const matched = new Set();
  const idMap = { ...(prevIds || {}) };
  let tagged = 0;
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.url || !item.domain) {
      skipped += 1;
      continue;
    }
    let site = bySlug.get(item.slug);
    if (!site && idMap[item.slug]) {
      site = stations.find((s) => Number(s.id) === Number(idMap[item.slug]));
    }
    if (!site) site = findMatch(item, stations);
    if (site && matched.has(site.id)) site = null;

    if (site) {
      addCat(site, "charity");
      site.charitySlug = item.slug;
      if (item.pin) site.charityPin = item.pin;
      if (Number(site.id) > CHARITY_ID_BASE) {
        site.name = item.name || site.name;
        site.url = item.url || site.url;
        site.domain = item.domain || site.domain;
        site.description = shortSummary(item.summary, item.name);
        site.tag = "公益站";
      }
      matched.add(site.id);
      idMap[item.slug] = site.id;
      tagged += 1;
      continue;
    }

    const id = Number(idMap[item.slug]) > CHARITY_ID_BASE ? Number(idMap[item.slug]) : nextCharityId(stations, idMap);
    const next = makeCharityStation(item, id);
    stations.push(next);
    bySlug.set(item.slug, next);
    matched.add(id);
    idMap[item.slug] = id;
    created += 1;
  }

  const drop = [];
  for (const site of stations) {
    if (Number(site.id) > CHARITY_ID_BASE && site.charitySlug && !items.some((it) => it.slug === site.charitySlug)) {
      drop.push(site.id);
    }
  }
  if (drop.length) {
    payload.stations = stations.filter((s) => !drop.includes(s.id));
  } else {
    payload.stations = stations;
  }

  const cats = payload.categories || [];
  if (!cats.some((c) => c.id === "charity")) {
    const at = cats.findIndex((c) => c.id === "new");
    const row = { id: "charity", name: "公益站" };
    if (at >= 0) cats.splice(at + 1, 0, row);
    else cats.push(row);
  }
  payload.categories = cats;
  payload.charityUpdatedAt = new Date().toISOString();
  payload.charitySource = SOURCE;
  return { tagged, created, skipped, dropped: drop.length, idMap, total: items.length };
}

function writeStations(payload) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(JS_PATH, "window.__STATIONS_DATA__ = " + JSON.stringify(payload) + ";\n", "utf8");
}

async function loadCharityItems() {
  console.log("拉取公益站列表…");
  const page = await request(SOURCE);
  if (page.status !== 200) throw new Error("charity HTTP " + page.status);
  const items = parseCharityHtml(page.body);
  await fillMissingUrls(items);
  return items;
}

async function mergeCharityIntoPayload(payload) {
  let prevIds = {};
  try {
    const prev = JSON.parse(fs.readFileSync(CHARITY_PATH, "utf8"));
    for (const it of prev.items || []) {
      if (it.slug && it.stationId) prevIds[it.slug] = it.stationId;
    }
  } catch {
    /* first run */
  }
  const items = await loadCharityItems();
  const stats = applyCharityToPayload(payload, items, prevIds);
  fs.writeFileSync(
    CHARITY_PATH,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        source: SOURCE,
        items: items.map((it) => ({
          slug: it.slug,
          name: it.name,
          url: it.url,
          domain: it.domain,
          summary: it.summary,
          tags: it.tags,
          status: it.status,
          pin: it.pin,
          stationId: stats.idMap[it.slug] || null,
        })),
      },
      null,
      2
    ),
    "utf8"
  );
  return stats;
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const stats = await mergeCharityIntoPayload(payload);
  writeStations(payload);
  console.log(
    `公益站 ${stats.total}：已有目录打标 ${stats.tagged}，新补 ${stats.created}，无入口跳过 ${stats.skipped}，下架 ${stats.dropped}`
  );
}

module.exports = {
  parseCharityHtml,
  applyCharityToPayload,
  mergeCharityIntoPayload,
  writeStations,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
