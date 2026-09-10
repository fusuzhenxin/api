#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { sitePath, catPath, officialPath, modelPath } = require("../js/seo.js");

const ROOT = path.resolve(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "stations.json"), "utf8"));
const origin = (process.env.SITE_ORIGIN || "https://www.veridrop.cn").replace(/\/$/, "");
const lastmod = (data.updatedAt || new Date().toISOString()).slice(0, 10);

const urls = [{ loc: "/", pri: "1.0", freq: "hourly" }];
[
  "checkin",
  "gift",
  "cheaprate",
  "fast",
  "pay",
  "invite",
  "crypto",
  "invoice",
  "highup",
  "stable",
  "cheap",
  "special",
  "new",
  "online",
].forEach((id) => urls.push({ loc: catPath(id), pri: "0.8", freq: "daily" }));

["gpt", "claude", "gemini", "grok", "deepseek", "kimi", "qwen", "glm", "image", "video"].forEach((id) => {
  urls.push({ loc: modelPath(id), pri: "0.9", freq: "daily" });
});

(data.official || []).forEach((item) => {
  urls.push({ loc: officialPath(item.provider), pri: "0.7", freq: "hourly" });
});

(data.stations || []).forEach((site) => {
  urls.push({ loc: sitePath(site), pri: site.promoted ? "0.7" : "0.5", freq: "daily" });
});

function locUrl(pathname) {
  return (
    origin +
    String(pathname || "/")
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")
  );
}

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls
    .map(
      (u) =>
        `  <url><loc>${locUrl(u.loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`
    )
    .join("\n") +
  "\n</urlset>\n";

fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
fs.writeFileSync(
  path.join(ROOT, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /data/votes.json\n\nUser-agent: Baiduspider\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`
);
console.log("sitemap", urls.length, "urls ->", origin);
