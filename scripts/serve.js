const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { parseRoute, seoFor, injectSeoHtml, ogPayload } = require("../js/seo.js");
const { dump: dumpVotes, getOne: getVote, vote: castVote } = require("../lib/votes");
const { acceptApply } = require("../lib/apply-mail");
const { fetchOfficialFeed } = require("../lib/official-feed");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".rss": "application/rss+xml; charset=utf-8",
  ".atom": "application/atom+xml; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function send(res, code, type, body) {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }).end(body);
}

function sendJson(res, code, payload) {
  send(res, code, "application/json; charset=utf-8", JSON.stringify(payload));
}

function readBody(req, limit = 65536) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function serveVotes(req, res, parsed) {
  try {
    if (req.method === "GET") {
      const voter = parsed.searchParams.get("voter") || "";
      const id = parsed.searchParams.get("id") || "";
      sendJson(res, 200, id ? await getVote(id, voter) : await dumpVotes(voter));
      return;
    }
    if (req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      sendJson(res, 200, await castVote(body.id, body.dir, body.voter));
      return;
    }
    sendJson(res, 405, { error: "method not allowed" });
  } catch (err) {
    sendJson(res, 400, { error: String(err.message || err) });
  }
}

let catalogCache = null;
function catalog() {
  if (!catalogCache) {
    catalogCache = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "stations.json"), "utf8"));
  }
  return catalogCache;
}

function requestOrigin(req) {
  if (process.env.SITE_ORIGIN) return process.env.SITE_ORIGIN.replace(/\/$/, "");
  const host = String(req.headers.host || "");
  if (/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host)) {
    return (req.headers["x-forwarded-proto"] || "http") + "://" + host;
  }
  return "https://www.veridrop.cn";
}

function isSpaPath(url) {
  const p = String(url || "/").replace(/\/$/, "") || "/";
  return (
    p === "/" ||
    /^\/site\/\d+/.test(p) ||
    /^\/cat\/[a-z0-9_-]+$/i.test(p) ||
    /^\/model\/[a-z0-9_-]+$/i.test(p) ||
    /^\/official\/[a-z0-9_-]+$/i.test(p) ||
    p === "/rank" ||
    /^\/rank\/(stable|fast)$/i.test(p)
  );
}

function runPythonOg(payload) {
  const script = path.join(ROOT, "scripts", "og_card.py");
  const attempts = [];
  if (process.env.PYTHON) attempts.push([process.env.PYTHON, [script]]);
  attempts.push(["python", [script]]);
  attempts.push(["py", ["-3", script]]);
  const body = JSON.stringify(payload);

  function tryOne(i) {
    if (i >= attempts.length) return Promise.reject(new Error("python not found"));
    const [bin, argv] = attempts[i];
    return new Promise((resolve, reject) => {
      const child = spawn(bin, argv, { cwd: ROOT, windowsHide: true });
      const chunks = [];
      let err = "";
      child.stdout.on("data", (d) => chunks.push(d));
      child.stderr.on("data", (d) => {
        err += d;
      });
      child.on("error", () => resolve(tryOne(i + 1)));
      child.on("close", (code) => {
        const buf = Buffer.concat(chunks);
        if (code !== 0 || buf.length < 80) {
          if (i + 1 < attempts.length) return resolve(tryOne(i + 1));
          return reject(new Error((err || "og failed").trim()));
        }
        resolve(buf);
      });
      child.stdin.end(body);
    });
  }
  return tryOne(0);
}

async function serveOgCard(res, id) {
  const site = (catalog().stations || []).find((s) => Number(s.id) === Number(id));
  if (!site) {
    send(res, 404, "text/plain; charset=utf-8", "Not found");
    return;
  }
  const dir = path.join(ROOT, "data", "og");
  fs.mkdirSync(dir, { recursive: true });
  const v = ogPayload(site);
  const cache = path.join(dir, [id, v.verdict_id, v.uptime, v.latency, v.votes].join("-").replace(/[^\w.\-%]+/g, "_") + ".jpg");
  try {
    if (fs.existsSync(cache) && fs.statSync(cache).size > 80) {
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300" }).end(fs.readFileSync(cache));
      return;
    }
    const buf = await runPythonOg(v);
    fs.writeFileSync(cache, buf);
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300" }).end(buf);
  } catch (err) {
    const fallback = path.join(ROOT, "img", "og.png");
    if (fs.existsSync(fallback)) {
      res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" }).end(fs.readFileSync(fallback));
      return;
    }
    send(res, 500, "text/plain; charset=utf-8", String(err.message || err));
  }
}

function serveSpa(req, res, url) {
  const r = parseRoute(url);
  const data = catalog();
  const ctx = { origin: requestOrigin(req), total: (data.stations || []).length };
  if (r.name === "site") ctx.station = (data.stations || []).find((s) => s.id === r.id);
  if (r.name === "official") ctx.official = (data.official || []).find((x) => x.provider === r.provider);
  if (r.name === "cat") {
    const id = r.id;
    let list = data.stations || [];
    if (id === "online") list = list.filter((s) => s.status && s.status.online);
    else if (id !== "all" && id !== "fav") list = list.filter((s) => (s.categories || []).includes(id));
    ctx.stations = id === "charity" ? list : list.slice(0, 40);
    ctx.count = list.length;
  }
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  send(res, 200, "text/html; charset=utf-8", injectSeoHtml(html, seoFor(r, ctx), r));
}

async function serveOfficialFeed(provider, res) {
  const result = await fetchOfficialFeed(provider);
  send(res, result.status, result.type, result.body);
}

http
  .createServer((req, res) => {
    const parsed = new URL(req.url || "/", "http://127.0.0.1");
    const url = decodeURIComponent(parsed.pathname);
    if (url.replace(/\/$/, "") === "/api/votes") {
      serveVotes(req, res, parsed);
      return;
    }
    if (url.replace(/\/$/, "") === "/api/apply") {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: "method not allowed" });
        return;
      }
      readBody(req, 20000)
        .then(function (raw) {
          return acceptApply(JSON.parse(raw || "{}"));
        })
        .then(function (result) {
          if (result.ok) sendJson(res, 200, { ok: true });
          else if (result.error) sendJson(res, 400, { ok: false, error: result.error });
          else sendJson(res, 502, { ok: false });
        })
        .catch(function () {
          sendJson(res, 400, { ok: false, error: "提交内容无法读取" });
        });
      return;
    }
    if (url.startsWith("/api/official/")) {
      serveOfficialFeed(url.slice("/api/official/".length).replace(/\/$/, ""), res);
      return;
    }
    const og = url.match(/^\/og\/site\/(\d+)(?:\.jpe?g)?$/i);
    if (og) {
      serveOgCard(res, og[1]);
      return;
    }
    const clean = url.replace(/\/$/, "") || "/";
    const staticHtml =
      clean === "/"
        ? path.join(ROOT, "index.html")
        : path.join(ROOT, clean.replace(/^[/\\]+/, "") + ".html");
    if (staticHtml.startsWith(ROOT) && fs.existsSync(staticHtml)) {
      send(res, 200, "text/html; charset=utf-8", fs.readFileSync(staticHtml));
      return;
    }
    if (/^\/check\/(detect|basic|candy|pelican)$/.test(clean)) {
      send(res, 200, "text/html; charset=utf-8", fs.readFileSync(path.join(ROOT, "check.html")));
      return;
    }
    if (isSpaPath(url)) {
      try {
        serveSpa(req, res, clean);
      } catch (err) {
        send(res, 500, "text/plain; charset=utf-8", String(err.message || err));
      }
      return;
    }
    let file = path.join(ROOT, url === "/" ? "index.html" : url);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        send(res, 404, "text/plain; charset=utf-8", "Not found");
        return;
      }
      send(res, 200, TYPES[path.extname(file)] || "application/octet-stream", buf);
    });
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log("http://127.0.0.1:" + PORT);
  });
