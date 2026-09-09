const OFFICIAL_PROVIDERS = [
  {
    provider: "openai",
    label: "OpenAI",
    models: ["gpt"],
    rss: "https://status.openai.com/history.rss",
    api: "https://status.openai.com/api/v2/summary.json",
    kind: "statuspage",
    seeds: ["Responses", "Codex API", "Images", "Embeddings", "Realtime", "Batch", "Fine-tuning", "Sora", "Audio", "Files"],
  },
  {
    provider: "anthropic",
    label: "Claude",
    models: ["claude"],
    rss: "https://status.claude.com/history.rss",
    api: "https://status.claude.com/api/v2/summary.json",
    kind: "statuspage",
    seeds: ["claude.ai", "Claude API (api.anthropic.com)", "Claude Code", "Claude Console (platform.claude.com)"],
  },
  {
    provider: "gemini",
    label: "Gemini",
    models: ["gemini"],
    rss: "https://status.cloud.google.com/en/feed.atom",
    rssFallbacks: ["https://aistudio.google.com/status"],
    api: "https://status.cloud.google.com/incidents.json",
    kind: "google",
    seeds: ["Gemini API", "Multimodal Live API", "Google AI Studio"],
  },
  {
    provider: "deepseek",
    label: "DeepSeek",
    models: ["deepseek"],
    rss: "https://status.deepseek.com/feed.rss",
    rssFallbacks: ["https://status.deepseek.com/feed.atom"],
    kind: "rss",
    seeds: [
      "DeepSeek V4 Pro API服务(API Service)",
      "DeepSeek V4 Flash API服务(API Service)",
      "DeepSeek-V4-Flash-Vision-Exp API服务(API Service)",
      "对话服务(Chat Service)",
      "快速模式(Instant Mode)",
      "专家模式(Expert Mode)",
      "识图模式(Vision Mode)",
      "上传文件服务(File Upload Service)",
      "搜索服务(Search Service)",
    ],
  },
  {
    provider: "moonshot",
    label: "Kimi",
    models: ["kimi"],
    rss: "https://status.moonshot.cn/history.rss",
    api: "https://status.moonshot.cn/api/v2/summary.json",
    kind: "statuspage",
    seeds: ["Open API", "API Service", "Text Model", "Vision Model", "Thinking Model", "K2 Model", "File uploads"],
  },
  {
    provider: "xai",
    label: "Grok",
    models: ["grok"],
    rss: "https://status.x.ai/feed.xml",
    rssFallbacks: ["https://status.x.ai/history.rss", "https://status.x.ai/history.atom"],
    api: "https://status.x.ai/api/v2/summary.json",
    kind: "rss",
    seeds: ["API", "Grok", "Imagine"],
  },
];

const DAY_COUNT = 90;

function decodeXml(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#xA;/g, "\n");
}

function tagText(block, name) {
  const m = block.match(new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">", "i"));
  return decodeXml(m ? m[1] : "").trim();
}

function stripHtml(html) {
  return decodeXml(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dayKey(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function parseFeed(xml) {
  const items = [];
  const blocks = String(xml || "").match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const block of blocks) {
    const title = tagText(block, "title");
    const rawDesc = tagText(block, "description") || tagText(block, "content") || tagText(block, "summary");
    const desc = stripHtml(rawDesc);
    const dateText = tagText(block, "pubDate") || tagText(block, "updated") || tagText(block, "published");
    const statusHit =
      rawDesc.match(/Status:<\/strong>\s*([a-z]+)/i) ||
      rawDesc.match(/<b>Status:\s*([a-z]+)/i) ||
      rawDesc.match(/Status:\s*<\/?(?:strong|b)>\s*([a-z]+)/i) ||
      rawDesc.match(/<(?:strong|b)>(Resolved|Investigating|Identified|Monitoring|Update|Scheduled)<\/(?:strong|b)>/i);
    let affected = [];
    const inlineAffected = rawDesc.match(/Affected components:<\/strong>\s*([^<]+)/i);
    if (inlineAffected) {
      affected = inlineAffected[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      const listBlock = (rawDesc.match(/Affected components<\/(?:strong|b)>[\s\S]*?<ul[\s\S]*?<\/ul>/i) || [])[0] || "";
      affected = [...listBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((m) =>
          stripHtml(m[1])
            .replace(/\s*\((degraded performance|partial outage|major outage|operational|under maintenance)\)\s*$/i, "")
            .trim()
        )
        .filter(Boolean);
    }
    const blob = (title + " " + desc + " " + (statusHit ? statusHit[1] : "")).toLowerCase();
    const status = String(statusHit ? statusHit[1] : "").toLowerCase();
    const resolved = /resolved|completed|postmortem|已解决|已恢复/.test(blob);
    items.push({
      title,
      desc,
      date: dateText,
      day: dayKey(dateText),
      status: status || (resolved ? "resolved" : ""),
      open: !resolved && /investigating|identified|monitoring|detected|degraded|outage|异常|故障|中断/.test(blob),
      affected,
    });
  }
  return items;
}

function translateBanner(indicator, hasOpen) {
  if (hasOpen) return { banner: "部分系统降级", sub: "部分服务未按预期运行", level: "minor" };
  if (indicator === "minor") return { banner: "部分系统降级", sub: "部分服务出现性能下降", level: "minor" };
  if (indicator === "major" || indicator === "critical") return { banner: "系统存在故障", sub: "部分服务中断", level: "major" };
  return { banner: "一切运行正常", sub: "所有系统均按预期运行", level: "none" };
}

function buildDays(incidents) {
  const days = [];
  const now = new Date();
  for (let i = DAY_COUNT - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const hit = incidents.find((it) => it.day === key);
    days.push({
      date: key,
      level: hit ? (hit.open ? "down" : "warn") : "ok",
    });
  }
  return days;
}

function uptimeOf(days) {
  const bad = days.filter((d) => d.level !== "ok").length;
  return Number((((DAY_COUNT - bad) / DAY_COUNT) * 100).toFixed(2));
}

function parseSummaryComponents(json) {
  if (!json || !json.components) return [];
  return json.components
    .filter((c) => c && !c.group && c.name && c.status)
    .map((c) => ({ name: c.name, status: c.status }));
}

function findLive(liveComps, name) {
  const n = String(name || "").toLowerCase();
  return liveComps.find((c) => {
    const cn = String(c.name || "").toLowerCase();
    return cn === n || cn.includes(n) || n.includes(cn);
  });
}

function assembleOfficial(item, feedXml, extraJson, ms, source) {
  const incidents = parseFeed(feedXml || "").filter((it) => {
    if (item.kind !== "google") return true;
    return /gemini|generative|ai studio|vertex|nano banana|multimodal live/i.test(it.title + " " + it.desc);
  });
  let indicator = "none";
  let liveComps = [];
  if (item.kind === "statuspage" && extraJson && extraJson.status) {
    indicator = extraJson.status.indicator || "none";
    liveComps = parseSummaryComponents(extraJson);
  }
  if (item.kind === "google" && Array.isArray(extraJson)) {
    const open = extraJson.filter((row) => !row.end && /gemini|generative language|vertex gemini|ai studio/i.test(JSON.stringify(row)));
    if (open.length) indicator = "minor";
  }
  const names = [...item.seeds];
  const components = names.map((name) => {
    const related = incidents.filter((it) => {
      if (it.affected.length) {
        return it.affected.some((a) => a.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(a.toLowerCase()));
      }
      const blob = (it.title + " " + it.desc).toLowerCase();
      const n = name.toLowerCase();
      const short = n.split("(")[0].trim();
      return blob.includes(n) || (short.length > 4 && blob.includes(short));
    });
    const live = findLive(liveComps, name);
    const days = buildDays(related);
    return {
      name,
      label: name,
      status: live ? live.status : related.some((it) => it.open) ? "degraded_performance" : "operational",
      uptime: uptimeOf(days),
      days,
    };
  });
  const liveIssue = components.some((c) => c.status && c.status !== "operational" && c.status !== "unknown");
  const hasOpen = incidents.some((it) => it.open) || liveIssue;
  const head = translateBanner(indicator, hasOpen);
  return {
    provider: item.provider,
    label: item.label,
    models: item.models,
    source: source || "official",
    online: head.level === "none",
    level: head.level,
    status: head.banner,
    sub: head.sub,
    raw: head.sub,
    ms,
    components,
    incidents: incidents.slice(0, 10).map((it) => ({
      title: it.title,
      desc: it.desc.slice(0, 160),
      date: it.date,
      status: it.open ? "进行中" : "已恢复",
      open: it.open,
    })),
    checkedAt: new Date().toISOString(),
    hasOpen,
  };
}

function failedOfficial(item, lastErr, ms) {
  return {
    provider: item.provider,
    label: item.label,
    models: item.models,
    source: "official",
    online: null,
    level: "unknown",
    status: "拉取失败",
    sub: lastErr,
    raw: lastErr,
    ms,
    components: item.seeds.map((name) => ({ name, label: name, status: "unknown", uptime: null, days: [] })),
    incidents: [],
    checkedAt: new Date().toISOString(),
  };
}

async function fetchOfficialUrl(url) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: ctrl ? ctrl.signal : undefined,
      cache: "no-store",
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/json, text/xml, text/html, */*",
        "User-Agent": "XianTan/1.0 (official status)",
      },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function cachePath(provider) {
  return "/data/feeds/" + provider + ".rss";
}

async function loadCachedFeed(provider) {
  try {
    if (typeof window !== "undefined") {
      const res = await fetch(cachePath(provider), { cache: "no-store" });
      if (res.ok) return await res.text();
    } else {
      const fs = require("fs");
      const path = require("path");
      const file = path.join(__dirname, "..", "data", "feeds", provider + ".rss");
      if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
    }
  } catch (err) {
    /* ignore missing cache */
  }
  return "";
}

function saveCachedFeed(provider, xml) {
  if (typeof window !== "undefined" || !xml) return;
  try {
    const fs = require("fs");
    const path = require("path");
    const dir = path.join(__dirname, "..", "data", "feeds");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, provider + ".rss"), xml, "utf8");
  } catch (err) {
    /* ignore */
  }
}

async function readFeedText(item) {
  const urls = [];
  if (typeof location !== "undefined" && /^https?:$/.test(location.protocol)) {
    urls.push("api/official/" + item.provider);
  }
  urls.push(item.rss);
  for (const extra of item.rssFallbacks || []) urls.push(extra);
  let lastErr = "";
  for (const url of urls) {
    try {
      const text = await fetchOfficialUrl(url);
      if (text && /<rss\b|<feed\b|<item\b|<entry\b/i.test(text)) {
        saveCachedFeed(item.provider, text);
        return { text, source: "official", error: "" };
      }
    } catch (err) {
      lastErr = err.message || String(err);
    }
  }
  const cached = await loadCachedFeed(item.provider);
  if (cached) return { text: cached, source: "official-cache", error: lastErr };
  return { text: "", source: "official", error: lastErr };
}

async function fetchOneOfficial(item) {
  const started = Date.now();
  const feed = await readFeedText(item);
  let extraJson = null;
  if (item.api) {
    try {
      extraJson = JSON.parse(await fetchOfficialUrl(item.api));
    } catch (err) {
      if (!feed.error) feed.error = err.message || String(err);
    }
  }
  if (!feed.text && !extraJson) {
    return failedOfficial(item, feed.error || "无订阅数据", Date.now() - started);
  }
  return assembleOfficial(item, feed.text, extraJson, Date.now() - started, feed.source);
}

function mergeOfficial(prev, next) {
  return (next || []).map((row) => {
    if (row.level !== "unknown") return row;
    const old = (prev || []).find((x) => x.provider === row.provider);
    return old && old.level !== "unknown" ? old : row;
  });
}

async function fetchOfficialLive(prev) {
  const next = await Promise.all(OFFICIAL_PROVIDERS.map(fetchOneOfficial));
  return mergeOfficial(prev, next);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { fetchOfficialLive, OFFICIAL_PROVIDERS, mergeOfficial };
}
