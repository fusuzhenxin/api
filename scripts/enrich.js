/**
 * 不重爬目录，只根据简介/搜索结果补分类。
 * 用法：node scripts/enrich.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const dataPath = path.join(ROOT, "data", "stations.json");
const jsPath = path.join(ROOT, "js", "stations-data.js");

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "XianTanNav/1.0", Accept: "application/json" } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

const FEATURE_DEFS = [
  { id: "checkin", re: /签到|打卡领|每日领|领通用余额|签到送|签到领/ },
  { id: "gift", re: /注册送|新用户.{0,8}送|赠送.{0,8}(余额|额度|刀)|送\s*\d+\s*(刀|元|额度)|试用额度|免费额度/ },
  { id: "invite", re: /邀请|返利|推广奖励/ },
  { id: "pay", re: /支付宝|微信支付|微信充值/ },
  { id: "crypto", re: /USDT|加密货币|钱包充值/ },
  { id: "cheaprate", re: /低倍率|0\.0\d+|0\.[12]\s*[x×X倍]|倍率\s*0\.[12]/ },
  { id: "invoice", re: /发票|专票|普票/ },
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

async function main() {
  const payload = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const byId = new Map(payload.stations.map((s) => [s.id, s]));
  const queries = ["签到", "注册送", "送额度", "支付宝", "低倍率", "邀请", "USDT", "发票"];
  for (const q of queries) {
    try {
      const json = await getJson("https://www.zuiquanapi.com/api/search?q=" + encodeURIComponent(q));
      for (const raw of json.results || []) {
        const cur = byId.get(raw.id);
        if (!cur) continue;
        if ((raw.description || "").length > (cur.description || "").length) cur.description = raw.description;
        if (raw.url && !cur.url) cur.url = raw.url;
      }
      console.log("搜索", q, (json.results || []).length);
    } catch (err) {
      console.warn("搜索失败", q, err.message);
    }
  }
  const counts = {};
  for (const site of payload.stations) {
    const keep = (site.categories || []).filter((c) => ["stable", "cheap", "special", "new", "charity"].includes(c));
    const feats = inferFeatures(site);
    if (keep.includes("charity") && !feats.includes("charity")) feats.push("charity");
    site.features = feats;
    site.categories = [...new Set([...keep, ...feats])];
    for (const f of site.categories) counts[f] = (counts[f] || 0) + 1;
  }
  payload.categories = [
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
  ];
  payload.featuresUpdatedAt = new Date().toISOString();
  fs.writeFileSync(dataPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(jsPath, "window.__STATIONS_DATA__ = " + JSON.stringify(payload) + ";\n", "utf8");
  console.log("分类计数", counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
