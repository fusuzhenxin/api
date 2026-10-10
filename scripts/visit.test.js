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
const EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.4129.107";

function useMemory() {
  process.env.VISIT_STATS_KEY = "local-visit-key-16";
  visits.setForceMemory(true);
}

async function main() {
  await test("crawlers and ai crawlers are not visitors", function () {
    assert.strictEqual(visits.isBotUa("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"), true);
    assert.strictEqual(visits.isBotUa("Mozilla/5.0 (compatible; MJ12bot/v1.4.8; http://mj12bot.com/)"), true);
    assert.strictEqual(
      visits.isBotUa(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36"
      ),
      true
    );
    assert.strictEqual(visits.isBotUa("Mozilla/5.0 (Macintosh) local-mirror"), true);
    assert.strictEqual(
      visits.isBotUa("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)"),
      true
    );
    assert.strictEqual(
      visits.isBotUa("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)"),
      true
    );
    assert.strictEqual(
      visits.isBotUa(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)"
      ),
      true
    );
    assert.strictEqual(
      visits.isBotUa("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot"),
      true
    );
    assert.strictEqual(visits.isBotUa("CCBot/2.0 (https://commoncrawl.org/faq/)"), true);
    assert.strictEqual(visits.isBotUa(""), true);
    assert.strictEqual(visits.isBotUa(CHROME), false);
    assert.strictEqual(visits.isBotUa(EDGE), false);
  });

  await test("id and page kind stay inside the allowed set", function () {
    assert.strictEqual(visits.normalizeId("abc123xyz4567890"), "abc123xyz4567890");
    assert.strictEqual(visits.normalizeId("short"), "");
    assert.strictEqual(visits.normalizeId("has-dash-1234567890"), "");
    assert.strictEqual(visits.normalizeKind("check"), "check");
    assert.strictEqual(visits.normalizeKind("site/1"), "");
  });

  await test("an old ping without acted counts as an interaction only", async function () {
    useMemory();
    const body = JSON.stringify({ id: "abc123xyz4567890", kind: "home" });
    await visits.recordVisit({ ua: CHROME, body: body });
    await visits.recordVisit({ ua: CHROME, body: body });
    await visits.recordVisit({
      ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
      body: JSON.stringify({ id: "gptbotvisitor0001", kind: "site", acted: false }),
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
    assert.strictEqual(data.days[0].open, 0);
    assert.strictEqual(data.days[0].acted, 2);
    assert.strictEqual(data.days[0].kinds.home, 1);
    assert.strictEqual(data.days[0].kinds.check, 1);
    assert.strictEqual(data.days[0].kinds.site, 0);
    const page = await visits.readVisits({ key: "local-visit-key-16", format: "" });
    assert.ok(page.body.indexOf('id="open-total" class="num">0<') >= 0);
    assert.ok(page.body.indexOf('id="act-total" class="num">2<') >= 0);
    assert.ok(page.body.indexOf("local-visit-key-16") < 0);
    assert.ok(page.body.indexOf("只算有操作") >= 0);
  });

  await test("open and a later action stay on the first page", async function () {
    useMemory();
    await visits.recordVisit({
      ua: EDGE,
      body: JSON.stringify({ id: "abc123xyz4567890", kind: "home", acted: false }),
    });
    await visits.recordVisit({
      ua: EDGE,
      body: JSON.stringify({ id: "abc123xyz4567890", kind: "home", acted: false }),
    });
    await visits.recordVisit({
      ua: EDGE,
      body: JSON.stringify({ id: "abc123xyz4567890", kind: "site", acted: true }),
    });
    await visits.recordVisit({
      ua: CHROME,
      body: JSON.stringify({ id: "secondbrowser0001", kind: "check", acted: false }),
    });
    const report = await visits.readVisits({ key: "local-visit-key-16", format: "json" });
    const data = JSON.parse(report.body);
    assert.strictEqual(data.days[0].open, 2);
    assert.strictEqual(data.days[0].acted, 1);
    assert.strictEqual(data.days[0].kinds.home, 1);
    assert.strictEqual(data.days[0].kinds.site, 0);
    assert.strictEqual(data.days[0].kinds.check, 1);
  });

  await test("a stored string from before this change is an interaction until a real open arrives", async function () {
    useMemory();
    visits.seedLegacyVisit("legacybrowser0001", "site");
    const before = JSON.parse((await visits.readVisits({ key: "local-visit-key-16", format: "json" })).body);
    assert.strictEqual(before.days[0].open, 0);
    assert.strictEqual(before.days[0].acted, 1);
    assert.strictEqual(before.days[0].kinds.site, 1);
    await visits.recordVisit({
      ua: CHROME,
      body: JSON.stringify({ id: "legacybrowser0001", kind: "home", acted: false }),
    });
    const after = JSON.parse((await visits.readVisits({ key: "local-visit-key-16", format: "json" })).body);
    assert.strictEqual(after.days[0].open, 1);
    assert.strictEqual(after.days[0].acted, 1);
    assert.strictEqual(after.days[0].kinds.site, 1);
    assert.strictEqual(after.days[0].kinds.home, 0);
  });
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
