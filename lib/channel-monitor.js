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
  if (url.protocol !== "https:" || url.username || url.password || url.hash) return "";
  if (url.pathname === "/api/v1/channel-monitors" && !url.search) return url.href;
  if (url.pathname === "/api/status" && !url.search) return url.href;
  const keys = [...url.searchParams.keys()];
  if (
    url.pathname === "/api/status" &&
    url.searchParams.get("period") === "7d" &&
    url.searchParams.get("board") === "all" &&
    keys.length === 2
  ) {
    return url.href;
  }
  return "";
}

const PULSE_SERVICE = {
  cc: "Claude",
  cx: "Codex",
  gm: "Gemini",
  gemini: "Gemini",
  grok: "Grok",
  gpt: "GPT",
  openai: "OpenAI",
  deepseek: "DeepSeek",
};

function pulseStatus(value) {
  const n = Number(value);
  if (n === 1) return "operational";
  if (n === 2) return "degraded";
  if (n === 0) return "down";
  return "missing";
}

const OWN_PLATFORM = {
  claude: "Claude",
  anthropic: "Claude",
  openai: "OpenAI",
  gpt: "GPT",
  gemini: "Gemini",
  grok: "Grok",
  deepseek: "DeepSeek",
  codex: "Codex",
};

function wordStatus(value) {
  const s = String(value || "").toLowerCase();
  if (["operational", "ok", "normal", "up", "healthy", "available"].includes(s)) return "operational";
  if (["degraded", "warning", "slow", "partial"].includes(s)) return "degraded";
  if (["missing", "unknown", "nodata", "no_data", "pending"].includes(s)) return "missing";
  if (!s) return "missing";
  return "down";
}

function normalizeOwnBoard(payload) {
  const items = [];
  for (const group of payload.groups) {
    if (!group || (!group.name && !group.model)) continue;
    const platform = String(group.platform || group.provider || "").toLowerCase();
    const recent = Array.isArray(group.recent) ? group.recent : [];
    const pct = Number(group.availability7d);
    items.push({
      name: group.name || group.model,
      provider: OWN_PLATFORM[platform] || group.platform || group.provider || "",
      primary_model: group.model || "",
      primary_status: wordStatus(group.status),
      primary_latency_ms: group.latencyMs != null ? group.latencyMs : null,
      primary_ping_latency_ms: group.pingMs != null ? group.pingMs : null,
      availability_7d: Number.isFinite(pct) ? pct : null,
      timeline: recent.slice(-60).map((point) => ({
        status: wordStatus(point.status),
        latency_ms: point.latencyMs,
        ping_latency_ms: point.pingMs,
        checked_at: point.at || point.time || "",
      })),
    });
  }
  return { code: 0, data: { items } };
}

function normalizePulse(payload) {
  const groups = payload && Array.isArray(payload.groups) ? payload.groups : [];
  const items = [];
  for (const group of groups) {
    const layers = Array.isArray(group.layers) ? group.layers.slice() : [];
    layers.sort((a, b) => (a.layer_order || 0) - (b.layer_order || 0));
    const layer = layers[0];
    if (!group.channel || !layer) continue;
    const points = Array.isArray(layer.timeline) ? layer.timeline : [];
    const avgs = points
      .filter((point) => [0, 1, 2].includes(Number(point.status)))
      .map((point) => Number(point.availability))
      .filter((n) => Number.isFinite(n) && n >= 0);
    const current = layer.current_status || {};
    const service = String(group.service || "").toLowerCase();
    const modelName = layer.request_model || layer.model || "";
    items.push({
      name: group.channel_name || group.channel,
      provider: group.service_name || PULSE_SERVICE[service] || group.service || "",
      primary_model: /^newapi$/i.test(modelName) ? "" : modelName,
      primary_status: pulseStatus(current.status != null ? current.status : group.current_status),
      primary_latency_ms: current.latency != null ? current.latency : null,
      availability_7d: avgs.length ? avgs.reduce((sum, n) => sum + n, 0) / avgs.length : null,
      timeline: points.map((point) => ({
        status: pulseStatus(point.status),
        latency_ms: point.latency,
        checked_at: point.time || "",
      })),
    });
  }
  return { code: 0, data: { items } };
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
  const directItems = payload && payload.data && payload.data.items;
  const groups = payload && Array.isArray(payload.groups) ? payload.groups : null;
  const normalized = Array.isArray(directItems)
    ? payload
    : groups && groups.some((group) => group && Array.isArray(group.layers))
      ? normalizePulse(payload)
      : groups && groups.some((group) => group && (group.availability7d != null || Array.isArray(group.recent)))
        ? normalizeOwnBoard(payload)
        : null;
  const items = normalized && normalized.data && normalized.data.items;
  if (res.status !== 200 || !normalized || !Array.isArray(items)) {
    return { status: 502, payload: { error: "unavailable" } };
  }
  const value = { status: 200, payload: normalized };
  cache.set(api, { until: Date.now() + TTL_MS, value });
  return value;
}

module.exports = { proxyChannelMonitor };
