const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const ALLOW_PATH = path.join(__dirname, "..", "data", "channel-monitors.json");
const TTL_MS = 60 * 1000;
const cache = new Map();

function allowlist() {
  const raw = JSON.parse(fs.readFileSync(ALLOW_PATH, "utf8"));
  return raw && typeof raw === "object" ? raw : {};
}

function allowedApi(id) {
  if (!/^\d+$/.test(String(id || ""))) return "";
  const api = allowlist()[String(id)];
  if (typeof api !== "string") return "";
  let url;
  try {
    url = new URL(api);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return "";
  if (url.pathname !== "/api/v1/channel-monitors") return "";
  return url.href;
}

function requestOnce(target) {
  return new Promise((resolve, reject) => {
    const url = new URL(target);
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "veridrop-directory",
        },
        timeout: 8000,
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 800000) {
            req.destroy();
            reject(new Error("too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            location: String(res.headers.location || ""),
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
        res.on("error", reject);
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.on("error", reject);
    req.end();
  });
}

async function requestFollow(target) {
  let current = target;
  const start = new URL(target);
  for (let i = 0; i < 3; i++) {
    const res = await requestOnce(current);
    if (![301, 302, 303, 307, 308].includes(res.status) || !res.location) return res;
    const next = new URL(res.location, current);
    if (next.host !== start.host || next.protocol !== "https:") {
      throw new Error("redirect");
    }
    current = next.href;
  }
  throw new Error("redirect");
}

async function proxyChannelMonitor(id) {
  const api = allowedApi(id);
  if (!api) return { status: 404, payload: { error: "unknown" } };
  const cached = cache.get(api);
  if (cached && cached.until > Date.now()) return cached.value;
  const res = await requestFollow(api);
  let payload;
  try {
    payload = JSON.parse(res.body);
  } catch {
    return { status: 502, payload: { error: "unavailable" } };
  }
  const items = payload && payload.data && payload.data.items;
  if (res.status !== 200 || !Array.isArray(items)) {
    return { status: 502, payload: { error: "unavailable" } };
  }
  const value = { status: 200, payload };
  cache.set(api, { until: Date.now() + TTL_MS, value });
  return value;
}

module.exports = { proxyChannelMonitor };
