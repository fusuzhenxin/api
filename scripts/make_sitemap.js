#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { sitePath, catPath, officialPath, modelPath, seoFor, injectSeoHtml } = require("../js/seo.js");
const staticHtml = require("../js/static-html.js");

const ROOT = path.resolve(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "stations.json"), "utf8"));
const origin = (process.env.SITE_ORIGIN || "https://www.veridrop.cn").replace(/\/$/, "");
const built = new Date().toISOString().slice(0, 10);
const lastmod = built;
const charityMod = built;

const CAT_IDS = [
  "charity",
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
];

const hubUrls = [{ loc: "/", pri: "1.0", freq: "daily", lastmod: built }];
CAT_IDS.forEach((id) =>
  hubUrls.push({
    loc: catPath(id),
    pri: id === "charity" ? "0.9" : "0.8",
    freq: "daily",
    lastmod: id === "charity" ? charityMod : built,
  })
);

["gpt", "claude", "gemini", "grok", "deepseek", "kimi", "qwen", "glm", "image", "video"].forEach((id) => {
  hubUrls.push({ loc: modelPath(id), pri: "0.9", freq: "daily", lastmod: built });
});

(data.official || []).forEach((item) => {
  hubUrls.push({ loc: officialPath(item.provider), pri: "0.7", freq: "weekly", lastmod: built });
});

const siteUrls = (data.stations || []).map((site) => ({
  loc: sitePath(site),
  pri: site.promoted ? "0.6" : "0.4",
  freq: "weekly",
  lastmod: built,
}));

function locUrl(pathname) {
  return (
    origin +
    String(pathname || "/")
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")
  );
}

function fillMarked(html, name, inner) {
  const start = "<!--STATIC_" + name + "-->";
  const end = "<!--/STATIC_" + name + "-->";
  if (!html.includes(start)) return html;
  return html.replace(new RegExp(start + "[\\s\\S]*?" + end), start + inner + end);
}

function replaceIdText(html, id, text) {
  return html.replace(new RegExp("(<span id=\"" + id + "\">)[\\s\\S]*?(</span>)"), "$1" + text + "$2");
}

function writePage(template, seo, route, parts) {
  let out = injectSeoHtml(template, seo, route);
  if (parts.grid != null) out = fillMarked(out, "GRID", parts.grid);
  if (parts.official != null) out = fillMarked(out, "OFFICIAL", parts.official);
  if (parts.resultMeta) out = replaceIdText(out, "resultMeta", parts.resultMeta);
  if (parts.officialMeta) out = replaceIdText(out, "officialMeta", parts.officialMeta);
  if (parts.detail != null) {
    out = out.replace(
      /<main id="detail" class="detail"[^>]*>[\s\S]*?<\/main>/,
      '<main id="detail" class="detail">' + parts.detail + "</main>"
    );
  }
  if (parts.officialPage != null) {
    out = out.replace(
      /<main id="officialPage"[^>]*>[\s\S]*?<\/main>/,
      '<main id="officialPage" class="detail official-page">' + parts.officialPage + "</main>"
    );
  }
  return out;
}

function emptyDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith(".html")) fs.unlinkSync(path.join(dir, name));
  }
}

function writeSeoPages() {
  const template = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const total = (data.stations || []).length;
  const official = staticHtml.officialChips(data);
  const officialMeta = staticHtml.officialMeta(data);

  emptyDir(path.join(ROOT, "cat"));
  CAT_IDS.forEach((id) => {
    const stations = staticHtml.byCategory(data, id);
    const seo = seoFor(
      { name: "cat", id },
      { origin, total, stations: id === "charity" ? stations : stations.slice(0, 20), count: stations.length }
    );
    fs.writeFileSync(
      path.join(ROOT, "cat", id + ".html"),
      writePage(template, seo, { name: "cat", id }, {
        grid: staticHtml.catGrid(id, data),
        official,
        officialMeta,
        resultMeta: staticHtml.resultMeta(data, "cat", id),
      }),
      "utf8"
    );
  });

  emptyDir(path.join(ROOT, "model"));
  ["gpt", "claude", "gemini", "grok", "deepseek", "kimi", "qwen", "glm", "image", "video"].forEach((id) => {
    const stations = staticHtml.byModel(data, id);
    const seo = seoFor({ name: "model", id }, { origin, total, count: stations.length });
    fs.writeFileSync(
      path.join(ROOT, "model", id + ".html"),
      writePage(template, seo, { name: "model", id }, {
        grid: staticHtml.modelGrid(id, data),
        official,
        officialMeta,
        resultMeta: staticHtml.resultMeta(data, "model", id),
      }),
      "utf8"
    );
  });

  emptyDir(path.join(ROOT, "official"));
  (data.official || []).forEach((item) => {
    const seo = seoFor({ name: "official", provider: item.provider }, { origin, total, official: item });
    fs.writeFileSync(
      path.join(ROOT, "official", item.provider + ".html"),
      writePage(template, seo, { name: "official", provider: item.provider }, {
        official,
        officialMeta,
        officialPage: staticHtml.officialPage(item, data),
      }),
      "utf8"
    );
  });

  emptyDir(path.join(ROOT, "site"));
  (data.stations || []).forEach((site) => {
    const seo = seoFor({ name: "site", id: site.id }, { origin, total, station: site });
    const rel = sitePath(site).replace(/^\//, "") + ".html";
    const dest = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(
      dest,
      writePage(template, seo, { name: "site" }, { official, officialMeta, detail: staticHtml.sitePage(site, data) }),
      "utf8"
    );
  });

  const home = writePage(template, seoFor({ name: "home" }, { origin, total }), { name: "home" }, {
    grid: staticHtml.homeGrid(data),
    official,
    officialMeta,
    resultMeta: staticHtml.resultMeta(data, "home"),
  });
  const indexFile = path.join(ROOT, "index.html");
  const tmp = indexFile + ".tmp";
  fs.writeFileSync(tmp, home, "utf8");
  fs.copyFileSync(tmp, indexFile);
  fs.unlinkSync(tmp);

  console.log(
    "static pages",
    CAT_IDS.length,
    "cats +",
    10,
    "models +",
    (data.official || []).length,
    "official +",
    total,
    "sites + home"
  );
}

function urlsetXml(list) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    list
      .map(
        (u) =>
          `  <url><loc>${locUrl(u.loc)}</loc><lastmod>${u.lastmod || built}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`
      )
      .join("\n") +
    "\n</urlset>\n"
  );
}

fs.writeFileSync(path.join(ROOT, "sitemap-pages.xml"), urlsetXml(hubUrls));
fs.writeFileSync(path.join(ROOT, "sitemap-sites.xml"), urlsetXml(siteUrls));
fs.writeFileSync(
  path.join(ROOT, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `  <sitemap><loc>${origin}/sitemap-pages.xml</loc><lastmod>${built}</lastmod></sitemap>\n` +
    `  <sitemap><loc>${origin}/sitemap-sites.xml</loc><lastmod>${built}</lastmod></sitemap>\n` +
    "</sitemapindex>\n"
);
fs.writeFileSync(
  path.join(ROOT, "robots.txt"),
  [
    "User-agent: *",
    "Allow: /",
    "Allow: /cat/",
    "Allow: /site/",
    "Allow: /model/",
    "Allow: /official/",
    "Allow: /js/",
    "Allow: /css/",
    "Allow: /img/",
    "Allow: /favicon.ico",
    "Disallow: /api/",
    "Disallow: /data/votes.json",
    "",
    "User-agent: Baiduspider",
    "Allow: /",
    "Allow: /cat/",
    "Allow: /site/",
    "Allow: /model/",
    "Allow: /js/",
    "Allow: /css/",
    "Allow: /img/",
    "Disallow: /api/",
    "",
    "Sitemap: " + origin + "/sitemap.xml",
    "Sitemap: " + origin + "/sitemap-pages.xml",
    "",
  ].join("\n")
);
writeSeoPages();
console.log("sitemap", hubUrls.length, "hub +", siteUrls.length, "sites ->", origin);
