/**
 * 从 zuiquanapi.com 公开页面/接口同步中转站目录到本地。
 * 用法：node scripts/scrape.js
 *
 * 写出：
 *   data/stations.json
 *   js/stations-data.js   （方便直接打开 index.html）
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = "https://www.zuiquanapi.com";
const UA = "XianTanNav/1.0 (local catalog sync)";
const { fetchOfficialStatuses } = require("./official");
const { mergeCharityIntoPayload } = require("./scrape-charity");

const CATEGORY_MAP = {
  "premium-stable": { id: "stable", name: "稳定企业向" },
  "ultra-cheap": { id: "cheap", name: "便宜个人向" },
  "special-featured": { id: "special", name: "小有特色" },
  new: { id: "new", name: "新站上榜" },
  all: { id: "all", name: "全部收录" },
};

const FEATURE_DEFS = [
  { id: "checkin", label: "签到送余额", re: /签到|打卡领|每日领|领通用余额|签到送|签到领/ },
  { id: "gift", label: "新用户赠额", re: /注册送|新用户.{0,8}送|赠送.{0,8}(余额|额度|刀)|送\s*\d+\s*(刀|元|额度)|试用额度|免费额度/ },
  { id: "invite", label: "邀请返利", re: /邀请|返利|推广奖励/ },
  { id: "pay", label: "国内支付", re: /支付宝|微信支付|微信充值/ },
  { id: "crypto", label: "加密充值", re: /USDT|加密货币|钱包充值/ },
  { id: "cheaprate", label: "低倍率", re: /低倍率|0\.0\d+|0\.[12]\s*[x×X倍]|倍率\s*0\.[12]/ },
  { id: "invoice", label: "可开发票", re: /发票|专票|普票/ },
];

function inferFeatures(site) {
  const text = `${site.name || ""} ${site.description || ""} ${site.tag || ""}`;
  const feats = [];
  for (const def of FEATURE_DEFS) {
    if (def.re.test(text)) feats.push(def.id);
  }
  const up = site.status && site.status.uptime;
  const ms = site.status && (site.status.avgMs || site.status.ms);
  if (site.status && site.status.online && up >= 99.8) feats.push("highup");
  if (ms > 0 && ms < 400) feats.push("fast");
  return [...new Set(feats)];
}

function applyFeatures(site) {
  const feats = inferFeatures(site);
  site.features = feats;
  site.categories = [...new Set([...(site.categories || []), ...feats])];
  return site;
}

const MODEL_DEFS = [
  { id: "gpt", label: "GPT", re: /gpt|openai|chatgpt|codex/i },
  { id: "claude", label: "Claude", re: /claude|anthropic|\bcc\b|sonnet|opus|fable/i },
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
          if (res.statusCode >= 300 && res.statusCode < 400 && loc && left > 0) {
            const next = new URL(loc, target).href;
            res.resume();
            go(next, left - 1);
            return;
          }
          if (res.statusCode >= 300 && res.statusCode < 400 && loc) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: "",
              url: target,
              location: new URL(loc, target).href,
            });
            res.resume();
            return;
          }
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            resolve({
              status: res.statusCode || 0,
              headers: res.headers,
              body: Buffer.concat(chunks).toString("utf8"),
              url: target,
            });
          });
        }
      );
      req.on("error", reject);
      req.setTimeout(25000, () => {
        req.destroy(new Error("timeout " + target));
      });
    };
    go(url, maxRedirects);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractBalanced(str, start) {
  const open = str[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return "";
}

function tryParseJson(raw) {
  if (!raw) return null;
  const attempts = [
    () => JSON.parse(raw),
    () => JSON.parse(raw.replace(/\\"/g, '"')),
    () => JSON.parse(JSON.parse('"' + raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"')),
  ];
  for (const fn of attempts) {
    try {
      const value = fn();
      if (value) return value;
    } catch {
      /* next */
    }
  }
  return null;
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function inferModels(text) {
  const hay = String(text || "");
  const models = [];
  for (const def of MODEL_DEFS) {
    if (!def.re.test(hay)) continue;
    let rate = null;
    const escaped = def.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hit = hay.match(
      new RegExp(
        "(?:" + def.id + "|" + escaped + ")(?:-\\d+(?:\\.\\d+)?)?[^0-9]{0,16}(0\\.\\d+)(?:\\s*[x×X倍])?",
        "i"
      )
    );
    if (hit && Number(hit[1]) <= 1.5) rate = Number(hit[1]);
    models.push({ id: def.id, label: def.label, rate, mentioned: true });
  }
  return models;
}

function collectSiteArrays(html) {
  const arrays = [];
  let idx = 0;
  while (true) {
    const key = html.indexOf('"sites":[', idx);
    const keyEsc = html.indexOf('\\"sites\\":[', idx);
    let at = -1;
    let escaped = false;
    if (key >= 0 && (keyEsc < 0 || key < keyEsc)) at = key + '"sites":'.length;
    else if (keyEsc >= 0) {
      at = keyEsc + '\\"sites\\":'.length;
      escaped = true;
    }
    if (at < 0) break;
    const raw = extractBalanced(html, at);
    idx = at + 1;
    let parsed = tryParseJson(raw);
    if (!parsed && escaped) parsed = tryParseJson(raw.replace(/\\"/g, '"'));
    if (Array.isArray(parsed) && parsed.length && parsed[0] && parsed[0].id) {
      arrays.push(parsed);
    }
  }
  return arrays;
}

function parseFeatured(html) {
  const featured = [];
  const re =
    /<a class="group relative flex h-\[400px\][\s\S]*?data-site-id="(\d+)"[\s\S]*?data-analytics-section="([^"]+)"[\s\S]*?data-analytics-position="([^"]+)"[\s\S]*?(?:<img src="([^"]+)"[\s\S]*?)?<p class="m-0 truncate text-\[17px\] font-bold">([^<]+)<\/p>[\s\S]*?<p class="m-0 min-h-0 flex-1[\s\S]*?">([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html))) {
    featured.push({
      id: Number(m[1]),
      section: m[2],
      position: Number(m[3]),
      logo: m[4] && !m[4].startsWith("data:") ? m[4] : "",
      name: decodeEntities(m[5].trim()),
      description: decodeEntities(m[6].replace(/<[^>]+>/g, "").trim()),
    });
  }
  return featured;
}

function parseFeaturedMeta(html) {
  const map = new Map();
  const re =
    /data-site-id="(\d+)"[^>]*data-votable="[^"]*"\s+data-analytics-section="([^"]+)"[^>]*data-analytics-position="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    map.set(Number(m[1]), { section: m[2], position: Number(m[3]) });
  }
  return map;
}

function toNum(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mergeStation(base, extra) {
  const out = { ...base, ...extra };
  if (base.categories || extra.categories) {
    out.categories = [...new Set([...(base.categories || []), ...(extra.categories || [])])];
  }
  if ((extra.description || "").length < (base.description || "").length) {
    out.description = base.description;
  }
  if (base.logo && extra.logo && (extra.logo === "?" || extra.logo.length < 4)) {
    out.logo = base.logo;
  }
  return out;
}

function normalizeSite(raw, extras = {}) {
  const id = Number(raw.id);
  const name = decodeEntities(raw.name || extras.name || "").trim();
  const description = decodeEntities(raw.description || extras.description || "").trim();
  const categories = extras.categories || [];
  const text = `${name} ${description} ${raw.tag || ""}`;
  return {
    id,
    name,
    url: raw.url || "",
    domain: raw.domain || "",
    logo: raw.logo && raw.logo !== "?" ? raw.logo : "",
    tag: raw.tag || "第三方",
    description,
    categories,
    promoted: Boolean(raw.is_promoted || extras.promoted),
    rank: toNum(raw.rank_score) || 0,
    createdAt: raw.created_at || "",
    votes: extras.votes || { up: toNum(raw.up) || 0, down: toNum(raw.down) || 0 },
    status: extras.status || {
      online: raw.online == null ? null : Boolean(Number(raw.online)),
      ms: toNum(raw.avg_ms) || toNum(raw.ms),
      uptime: toNum(raw.uptime),
      avgMs: toNum(raw.avg_ms),
      checkedAt: raw.checked_at || "",
    },
    models: inferModels(text),
    checks: extras.checks || [],
  };
}

async function main() {
  console.log("拉取首页…");
  const home = await request(SOURCE + "/");
  if (home.status !== 200) throw new Error("homepage HTTP " + home.status);

  console.log("拉取 bootstrap 状态…");
  const bootRes = await request(SOURCE + "/api/bootstrap");
  const bootstrap = JSON.parse(bootRes.body);

  const featured = parseFeatured(home.body);
  const featuredMeta = parseFeaturedMeta(home.body);
  console.log("精选卡片", featured.length, "带分类站点", featuredMeta.size);

  const arrays = collectSiteArrays(home.body);
  console.log("RSC sites 数组", arrays.length, "合计", arrays.reduce((n, a) => n + a.length, 0));

  const byId = new Map();
  for (const arr of arrays) {
    for (const raw of arr) {
      const cur = byId.get(raw.id);
      const next = normalizeSite(raw);
      byId.set(raw.id, cur ? mergeStation(cur, next) : next);
    }
  }

  for (const item of featured) {
    const cat = CATEGORY_MAP[item.section];
    const extra = {
      name: item.name,
      description: item.description,
      categories: cat ? [cat.id] : [],
      promoted: true,
    };
    const raw = {
      id: item.id,
      name: item.name,
      description: item.description,
      logo: item.logo || "",
    };
    const cur = byId.get(item.id);
    if (cur) {
      const merged = mergeStation(cur, extra);
      if (!merged.logo && item.logo) merged.logo = item.logo;
      byId.set(item.id, merged);
    } else {
      byId.set(item.id, normalizeSite(raw, extra));
    }
  }

  console.log("拉取搜索接口补全赞助站…");
  try {
    const searchRes = await request(SOURCE + "/api/search");
    const searchJson = JSON.parse(searchRes.body);
    for (const raw of searchJson.results || []) {
      const next = normalizeSite(raw, { promoted: Boolean(raw.is_promoted) });
      const cur = byId.get(raw.id);
      byId.set(raw.id, cur ? mergeStation(cur, next) : next);
    }
  } catch (err) {
    console.warn("search fail", err.message);
  }

  const missingUrl = [...byId.values()].filter((s) => !s.url);
  console.log("补解析跳转", missingUrl.length);
  for (const site of missingUrl) {
    try {
      const res = await request(`${SOURCE}/go/${site.id}`, { maxRedirects: 0 });
      const loc = res.location || "";
      if (loc && !/zuiquanapi\.com/i.test(loc)) {
        site.url = loc;
        try {
          site.domain = new URL(loc).hostname.replace(/^www\./, "");
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.warn("go fail", site.id, err.message);
    }
    await sleep(80);
  }

  for (const [id, meta] of featuredMeta) {
    const cat = CATEGORY_MAP[meta.section];
    if (!cat || cat.id === "all") continue;
    const cur = byId.get(id);
    if (!cur) continue;
    cur.categories = [...new Set([...(cur.categories || []), cat.id])];
  }

  const statusMap = bootstrap.status || {};
  const votesMap = bootstrap.votes || {};
  for (const site of byId.values()) {
    const st = statusMap[String(site.id)];
    if (st) {
      site.status = {
        online: Boolean(st.online),
        ms: st.ms ?? null,
        uptime: st.uptime ?? null,
        avgMs: st.avgMs ?? null,
        checkedAt: st.checkedAt || "",
      };
    }
    const vt = votesMap[String(site.id)];
    if (vt) site.votes = { up: vt.up || 0, down: vt.down || 0 };
    if (!site.models.length) site.models = inferModels(`${site.name} ${site.description}`);
    applyFeatures(site);
  }

  const featuredIds = featured.map((x) => x.id);
  console.log("拉取精选站探测记录…");
  for (const id of featuredIds) {
    try {
      const res = await request(`${SOURCE}/api/site-checks?site_id=${id}`);
      const json = JSON.parse(res.body);
      const site = byId.get(id);
      if (site && Array.isArray(json.checks)) site.checks = json.checks;
    } catch (err) {
      console.warn("checks fail", id, err.message);
    }
    await sleep(120);
  }

  const stations = [...byId.values()].sort((a, b) => {
    if (a.promoted !== b.promoted) return a.promoted ? -1 : 1;
    return (b.rank || 0) - (a.rank || 0);
  });

  console.log("拉取官方模型状态页…");
  const official = await fetchOfficialStatuses();

  const payload = {
    updatedAt: new Date().toISOString(),
    source: SOURCE + "/",
    officialUpdatedAt: new Date().toISOString(),
    global: bootstrap.global || {},
    official,
    categories: [
      { id: "all", name: "全部中转" },
      { id: "checkin", name: "签到送余额" },
      { id: "gift", name: "新用户赠额" },
      { id: "cheaprate", name: "低倍率" },
      { id: "fast", name: "低延迟" },
      { id: "pay", name: "国内支付" },
      { id: "invite", name: "邀请返利" },
      { id: "crypto", name: "加密充值" },
      { id: "invoice", name: "可开发票" },
      { id: "highup", name: "高可用" },
      { id: "stable", name: "稳定企业向" },
      { id: "cheap", name: "便宜个人向" },
      { id: "special", name: "小有特色" },
      { id: "new", name: "新站上榜" },
      { id: "charity", name: "公益站" },
      { id: "online", name: "当前在线" },
      { id: "fav", name: "我的收藏" },
    ],
    stations,
  };

  console.log("合并公益站…");
  try {
    const charity = await mergeCharityIntoPayload(payload);
    console.log(
      `公益站 ${charity.total}：打标 ${charity.tagged}，新补 ${charity.created}，跳过 ${charity.skipped}`
    );
  } catch (err) {
    console.warn("charity merge fail", err.message);
  }

  const dataDir = path.join(ROOT, "data");
  const jsDir = path.join(ROOT, "js");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(jsDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "stations.json"), JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(
    path.join(jsDir, "stations-data.js"),
    "window.__STATIONS_DATA__ = " + JSON.stringify(payload) + ";\n",
    "utf8"
  );

  const online = stations.filter((s) => s.status && s.status.online).length;
  console.log(`完成：${stations.length} 个站点，在线 ${online}，已写入 data/stations.json`);
  console.log("生成静态页…");
  require("child_process").execFileSync(process.execPath, [path.join(__dirname, "make_sitemap.js")], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
