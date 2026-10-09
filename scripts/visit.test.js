const assert = require("assert");
const visits = require("../lib/visits");

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(function () {
      console.log("ok", name);
    })
    .catch(function (err) {
      console.error("fail", name);
      throw err;
    });
}

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

async function main() {
  await test("named crawlers are not visitors", function () {
    assert.strictEqual(visits.isBotUa("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"), true);
    assert.strictEqual(visits.isBotUa("Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)"), true);
    assert.strictEqual(
      visits.isBotUa(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36"
      ),
      true
    );
    assert.strictEqual(visits.isBotUa("Mozilla/5.0 (Macintosh) local-mirror"), true);
    assert.strictEqual(visits.isBotUa(""), true);
    assert.strictEqual(visits.isBotUa(CHROME), false);
  });

  await test("id and page kind stay inside the allowed set", function () {
    assert.strictEqual(visits.normalizeId("abc123xyz4567890"), "abc123xyz4567890");
    assert.strictEqual(visits.normalizeId("short"), "");
    assert.strictEqual(visits.normalizeId("has-dash-1234567890"), "");
    assert.strictEqual(visits.normalizeKind("check"), "check");
    assert.strictEqual(visits.normalizeKind("site/1"), "");
  });

  await test("the same browser counts once per Shanghai day", async function () {
    process.env.VISIT_STATS_KEY = "local-visit-key-16";
    visits.setForceMemory(true);
    const body = JSON.stringify({ id: "abc123xyz4567890", kind: "home" });
    await visits.recordVisit({ ua: CHROME, body: body });
    await visits.recordVisit({ ua: CHROME, body: body });
    await visits.recordVisit({
      ua: "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
      body: JSON.stringify({ id: "ahrefsbotvisitor1", kind: "site" }),
    });
    await visits.recordVisit({
      ua: CHROME,
      body: JSON.stringify({ id: "secondbrowser0001", kind: "check" }),
    });
    const denied = await visits.readVisits({ key: "nope-nope-nope-no", format: "json" });
    assert.strictEqual(denied.status, 404);
    const report = await visits.readVisits({ key: "local-visit-key-16", format: "json" });
    const data = JSON.parse(report.body);
    assert.strictEqual(data.days[0].date, visits.shanghaiDate());
    assert.strictEqual(data.days[0].total, 2);
    assert.strictEqual(data.days[0].kinds.home, 1);
    assert.strictEqual(data.days[0].kinds.check, 1);
    assert.strictEqual(data.days[0].kinds.site, 0);
    const page = await visits.readVisits({ key: "local-visit-key-16", format: "" });
    assert.ok(page.body.indexOf("近 30 天合计 2 人") >= 0);
    assert.ok(page.body.indexOf("local-visit-key-16") < 0);
  });
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
