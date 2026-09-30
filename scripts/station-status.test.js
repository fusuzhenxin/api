const assert = require("assert");
const seo = require("../js/seo.js");
const status = require("../lib/station-status.js");

function test(name, fn) {
  try {
    fn();
    console.log("ok", name);
  } catch (err) {
    console.error("fail", name);
    throw err;
  }
}

function station() {
  return {
    id: 3,
    name: "示例站",
    url: "https://example.com/r",
    description: "这是原简介，不要被状态同步改掉。",
    votes: { up: 4, down: 1 },
    checks: [{ online: true, ms: 10, checkedAt: "2026-08-31T10:00:00.000Z" }],
    models: [{ id: "claude", label: "Claude" }],
    categories: ["charity", "highup"],
    features: ["gift", "highup"],
    status: {
      online: true,
      ms: 141,
      uptime: 99.6,
      avgMs: 174,
      checkedAt: "2026-08-31T10:07:02.142Z",
    },
  };
}

test("newer probe updates status and leaves the blurb alone", function () {
  const site = station();
  const changed = seo.applyRemoteStatus([site], {
    3: {
      online: false,
      ms: 151,
      uptime: 100,
      avgMs: 131,
      checkedAt: "2026-09-29T09:07:03.183Z",
      description: "对方接口里不该有的简介",
      url: "https://evil.example/",
      votes: { up: 0, down: 9 },
    },
  });
  assert.strictEqual(changed, 1);
  assert.strictEqual(site.description, "这是原简介，不要被状态同步改掉。");
  assert.strictEqual(site.url, "https://example.com/r");
  assert.strictEqual(site.name, "示例站");
  assert.deepStrictEqual(site.votes, { up: 4, down: 1 });
  assert.strictEqual(site.checks.length, 1);
  assert.strictEqual(site.models[0].label, "Claude");
  assert.strictEqual(site.status.online, false);
  assert.strictEqual(site.status.uptime, 100);
  assert.strictEqual(site.status.avgMs, 131);
  assert.strictEqual(site.status.ms, 151);
  assert.ok(site.categories.includes("charity"));
  assert.ok(!site.categories.includes("highup"));
  assert.ok(site.features.includes("gift"));
});

test("an older or incomplete probe does not blank saved numbers", function () {
  const site = station();
  const older = seo.applyRemoteStatus([site], {
    3: { online: false, ms: 1, uptime: 1, avgMs: 1, checkedAt: "2026-07-08T08:07:02.867Z" },
  });
  assert.strictEqual(older, 0);
  assert.strictEqual(site.status.uptime, 99.6);
  const partial = seo.applyRemoteStatus([site], {
    3: { online: true, ms: 80, uptime: null, avgMs: null, checkedAt: "2026-09-29T09:07:03.183Z" },
  });
  assert.strictEqual(partial, 1);
  assert.strictEqual(site.status.ms, 80);
  assert.strictEqual(site.status.uptime, 99.6);
  assert.strictEqual(site.status.avgMs, 174);
  assert.strictEqual(site.description, "这是原简介，不要被状态同步改掉。");
});

test("low latency joins 低延迟 and a missing station is left alone", function () {
  const site = station();
  site.status.avgMs = 900;
  site.status.ms = 900;
  seo.applyRemoteStatus([site], {
    3: { online: true, ms: 120, uptime: 99.9, avgMs: 200, checkedAt: "2026-09-29T09:07:03.183Z" },
  });
  assert.ok(site.categories.includes("fast"));
  assert.ok(site.categories.includes("highup"));
  const other = station();
  other.id = 9;
  seo.applyRemoteStatus([other], {});
  assert.strictEqual(other.status.uptime, 99.6);
  assert.strictEqual(other.description, site.description);
});

test("bootstrap slimming keeps status fields only", function () {
  const slim = status.slimBootstrap({
    votes: { 3: { up: 1, down: 2 } },
    global: { online: 1 },
    status: {
      3: { online: 1, ms: "20", uptime: 99.5, avgMs: 30, checkedAt: "2026-09-29T09:07:03.183Z" },
      bad: { online: true, checkedAt: "2026-09-29T09:07:03.183Z" },
      4: { online: true },
    },
  });
  assert.deepStrictEqual(slim.stations["3"], {
    online: true,
    ms: 20,
    uptime: 99.5,
    avgMs: 30,
    checkedAt: "2026-09-29T09:07:03.183Z",
  });
  assert.strictEqual(slim.stations.bad, undefined);
  assert.strictEqual(slim.stations["4"], undefined);
  assert.strictEqual(slim.votes, undefined);
  assert.ok(status.isFresh({ fetchedAt: new Date().toISOString(), stations: { 3: {} } }));
  assert.strictEqual(status.isFresh({ fetchedAt: "2026-08-31T10:11:30.322Z", stations: {} }, Date.parse("2026-09-29T00:00:00.000Z")), false);
});

test("cron route rejects a missing or wrong secret in production", function () {
  const prevSecret = process.env.CRON_SECRET;
  const prevVercel = process.env.VERCEL;
  process.env.VERCEL = "1";
  delete process.env.CRON_SECRET;
  assert.strictEqual(status.cronAuthorized("Bearer anything"), false);
  process.env.CRON_SECRET = "local-secret";
  assert.strictEqual(status.cronAuthorized("Bearer local-secret"), true);
  assert.strictEqual(status.cronAuthorized("Bearer other"), false);
  if (prevSecret == null) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = prevSecret;
  if (prevVercel == null) delete process.env.VERCEL;
  else process.env.VERCEL = prevVercel;
});
