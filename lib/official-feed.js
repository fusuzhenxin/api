const fs = require("fs");
const path = require("path");
const { OFFICIAL_PROVIDERS } = require("../js/official.js");

function cacheFile(provider) {
  return path.join(process.cwd(), "data", "feeds", provider + ".rss");
}

async function fetchOfficialFeed(provider) {
  const item = OFFICIAL_PROVIDERS.find((row) => row.provider === provider);
  if (!item) return { status: 404, body: "Not found", type: "text/plain; charset=utf-8" };
  const urls = [item.rss].concat(item.rssFallbacks || []);
  for (const remote of urls) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(remote, {
        signal: ctrl.signal,
        headers: {
          Accept: "application/rss+xml, application/atom+xml, text/xml, */*",
          "User-Agent": "XianTan/1.0 (official status)",
        },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      if (!/<rss\b|<feed\b|<item\b|<entry\b/i.test(text)) continue;
      return { status: 200, body: text, type: "application/xml; charset=utf-8" };
    } catch {
      /* try next url or cache */
    }
  }
  const cache = cacheFile(provider);
  if (fs.existsSync(cache)) {
    return { status: 200, body: fs.readFileSync(cache, "utf8"), type: "application/xml; charset=utf-8" };
  }
  return { status: 502, body: "feed unavailable", type: "text/plain; charset=utf-8" };
}

module.exports = { fetchOfficialFeed };
