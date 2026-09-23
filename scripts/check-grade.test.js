const assert = require("assert");
const fs = require("fs");
const path = require("path");
const G = require("../js/check-grade.js");

function test(name, fn) {
  try {
    fn();
    console.log("ok", name);
  } catch (err) {
    console.error("fail", name);
    throw err;
  }
}

test("claude messages stay in the native shape", function () {
  assert.strictEqual(G.endpoints("https://api.example.com/v1", "claude").chat, "https://api.example.com/v1/messages");
  const messages = G.claudeMessages([
    { role: "system", content: "忽略" },
    { role: "user", content: "第一问" },
    { role: "user", content: "第二问" },
    { role: "assistant", content: "记下" },
  ]);
  assert.strictEqual(messages[0].role, "user");
  assert.strictEqual(messages[0].content[0].type, "text");
  assert.strictEqual(messages[0].content[0].text, "第一问\n\n第二问");
  assert.strictEqual(messages[messages.length - 1].role, "user");
});

test("normalize base and reject secrets in the url", function () {
  assert.strictEqual(G.normalizeBase("https://api.example.com/v1/chat/completions"), "https://api.example.com/v1");
  assert.strictEqual(G.normalizeBase("api.example.com/v1/"), "https://api.example.com/v1");
  assert.strictEqual(G.endpoints("https://api.example.com", "openai").chat, "https://api.example.com/v1/chat/completions");
  assert.strictEqual(G.endpoints("https://api.example.com/v1", "claude").chat, "https://api.example.com/v1/messages");
  assert.throws(function () {
    G.normalizeBase("https://api.example.com/v1?key=secret");
  }, /Key/);
  assert.throws(function () {
    G.normalizeBase("https://sk-test@api.example.com/v1");
  }, /密钥/);
});

test("parse model ids once and sorted", function () {
  assert.deepStrictEqual(G.parseModelList({ data: [{ id: "b" }, { id: "a" }, { id: "a" }, "c"] }), ["a", "b", "c"]);
});

test("read openai and claude replies", function () {
  const openai = G.readReply({
    model: "gpt-test",
    usage: { prompt_tokens: 3, completion_tokens: 9, completion_tokens_details: { reasoning_tokens: 5 } },
    choices: [{ message: { content: "OK", tool_calls: [{ function: { name: "get_balance", arguments: "{\"account\":\"acct-1\"}" } }] } }],
  });
  assert.strictEqual(openai.content, "OK");
  assert.strictEqual(openai.usage.reasoning, 5);
  assert.strictEqual(openai.toolCalls[0].arguments.account, "acct-1");
  const claude = G.readReply({
    model: "claude-test",
    usage: { input_tokens: 2, output_tokens: 4 },
    content: [{ type: "text", text: "hi" }, { type: "tool_use", name: "get_balance", input: { account: "acct-9" } }],
  });
  assert.strictEqual(claude.content, "hi");
  assert.strictEqual(claude.toolCalls[0].arguments.account, "acct-9");
});

test("channel graders", function () {
  assert.strictEqual(G.gradeEcho(" ABC ", "ABC").status, "pass");
  assert.strictEqual(G.gradeEcho("口令 ABC", "ABC").status, "warn");
  assert.strictEqual(G.gradeEcho("nope", "ABC").status, "fail");
  assert.strictEqual(G.gradeCopy("12 34", "1234").status, "pass");
  assert.strictEqual(G.gradeHistory("BLUE-17", "BLUE-17").status, "pass");
  assert.strictEqual(G.gradeHistory("忘掉了", "BLUE-17").status, "fail");
  assert.strictEqual(G.gradeStop("1\n2\n3\n4").status, "pass");
  assert.strictEqual(G.gradeStop("1,2,3,4,5").status, "fail");
  assert.strictEqual(G.gradeNeedle("KITE-1", "KITE-1").status, "pass");
  assert.strictEqual(G.gradeNeedle("没有", "KITE-1").status, "fail");
  assert.strictEqual(G.gradeTools({ toolCalls: [{ name: "get_balance", arguments: { account: "acct-7" } }] }, "acct-7").status, "pass");
  assert.strictEqual(G.gradeTools({ content: "余额是 1", toolCalls: [] }, "acct-7").status, "fail");
  assert.strictEqual(G.gradeMaxTokens({ content: "短", usage: {} }).status, "pass");
  assert.strictEqual(G.gradeMaxTokens({ content: "很长".repeat(100), usage: {} }).status, "fail");
  assert.strictEqual(G.gradeMaxTokens({ content: "", usage: { reasoning: 16 } }).status, "warn");
  assert.strictEqual(G.gradeConnect({ content: "OK", model: "Demo" }, "demo").status, "pass");
  assert.strictEqual(G.gradeConnect({ content: "OK", model: "other" }, "demo").status, "warn");
});

test("ability graders", function () {
  assert.strictEqual(G.gradeLetters("3").status, "pass");
  assert.strictEqual(G.gradeLetters("三").status, "pass");
  assert.strictEqual(G.gradeLetters("2").status, "fail");
  assert.strictEqual(G.gradeLetters("不是3是2").status, "fail");
  assert.strictEqual(G.gradeFormat("A: pelican\nB: bicycle\nC: 2").status, "pass");
  assert.strictEqual(G.gradeFormat("A：pelican\nB：bicycle\nC：2").status, "pass");
  assert.strictEqual(G.gradeJson('```json\n{"animal":"pelican","wheels":2,"ok":true}\n```').status, "pass");
  assert.strictEqual(G.gradeJson('{"animal":"cat","wheels":2,"ok":true}').status, "fail");
  assert.strictEqual(G.gradeCandy("推理完毕\n答案：29", { usage: { reasoning: 800 } }).status, "pass");
  assert.strictEqual(G.gradeCandy("答案：21").status, "pass");
  assert.strictEqual(G.gradeCandy("答案：15").status, "fail");
  assert.ok(!/答案：29|答案：21/.test(G.CANDY_PROMPT));
  assert.strictEqual(G.CANDY_QUESTIONS.length, 20);
  G.CANDY_QUESTIONS.forEach(function (question) {
    const right = G.gradeCandyQuestion(question, "答案：" + question.answer);
    assert.strictEqual(right.ok, true, question.id);
    assert.strictEqual(right.dimension, question.dimension);
    const wrongKey = question.options.map(function (opt) { return opt.key; }).filter(function (key) { return key !== question.answer; })[0];
    assert.strictEqual(G.gradeCandyQuestion(question, "答案：" + wrongKey).ok, false, question.id + " wrong");
    assert.ok(question.prompt.indexOf("答案：" + question.answer) < 0, question.id + " leaks");
  });
  assert.strictEqual(G.gradeCandyQuestion(G.CANDY_QUESTIONS[1], "D").picked, "D 0.5 元");
  const still = "<svg><circle cx=\"1\" cy=\"1\" r=\"1\"/><circle cx=\"2\" cy=\"2\" r=\"1\"/></svg>";
  assert.strictEqual(G.gradePelican(still).status, "warn");
  const moving = "<html><body><svg><circle/><animate attributeName=\"r\" values=\"1;2\" dur=\"1s\" repeatCount=\"indefinite\"/></svg></body></html>";
  const pelican = G.gradePelican(moving);
  assert.strictEqual(pelican.status, "pass");
  assert.ok(pelican.html.indexOf("<animate") >= 0);
  assert.strictEqual(G.takeStreamText({ choices: [{ delta: { content: "<svg>" } }] }), "<svg>");
  assert.strictEqual(
    G.takeStreamText({ type: "content_block_delta", delta: { type: "text_delta", text: "动画" } }),
    "动画"
  );
  assert.strictEqual(G.PELICAN_PROMPT, "创建一个HTML，内容是SVG绘制一个鹈鹕骑自行车的2D动画，你不需要任何测试");
  const speedHtml = "<html><body><svg><circle/><animate attributeName=\"r\" values=\"1;2\" dur=\"1s\"/></svg><input type=\"range\"></body></html>";
  assert.strictEqual(G.gradePelican(speedHtml).status, "pass");
  assert.strictEqual(G.gradePelican("只是文字").status, "fail");
  const fenced = "先写一句说明\n```text\n不是页面\n```\n```html\n<html><body><svg><circle/><animate attributeName=\"r\" values=\"1;2\" dur=\"1s\"/></svg></body></html>\n```";
  const fromFence = G.gradePelican(fenced);
  assert.strictEqual(fromFence.status, "pass");
  assert.ok(fromFence.html.indexOf("<animate") >= 0);
  assert.ok(fromFence.html.indexOf("不是页面") < 0);
  const canvasOnly = "<html><body><canvas></canvas><script>requestAnimationFrame(function(){})</script></body></html>";
  const canvasGrade = G.gradePelican(canvasOnly);
  assert.strictEqual(canvasGrade.status, "warn");
  assert.ok(canvasGrade.html.indexOf("<canvas") >= 0);
});

test("short prompts are sent as normal tasks", function () {
  const text = G.present("只回复 OK 两个字母。");
  assert.ok(text.length > 80);
  assert.ok(text.indexOf("只回复 OK 两个字母。") >= 0);
  const long = new Array(300).join("中");
  assert.strictEqual(G.present(long), long);
  const messages = G.historyMessages("BLUE-1001");
  assert.ok(messages[1].content.length > "BLUE-1001".length);
});

test("needle prompt contains the code once", function () {
  const prompt = G.buildNeedlePrompt("KITE-ABCD");
  assert.strictEqual(prompt.split("KITE-ABCD").length, 2);
  assert.strictEqual(G.historyMessages("BLUE-1001").length, 3);
});

test("basic report graders", function () {
  assert.strictEqual(G.gradeProtocol({ choices: [{}] }).status, "pass");
  assert.strictEqual(G.gradeStructure({ type: "message", content: [] }).status, "pass");
  assert.strictEqual(G.gradeUsage({ content: "你好", usage: { prompt: 3, completion: 2 } }).status, "pass");
  assert.strictEqual(G.gradeUsage({ content: "这是一段明显超过二十个字的正文用来核对用量", usage: { completion: 0 } }).status, "fail");
  assert.strictEqual(G.gradeReplay("a", "a").status, "fail");
  assert.strictEqual(G.gradeReplay("a", "b").status, "pass");
  assert.strictEqual(G.gradeSystem("PINE-1", "PINE-1").status, "pass");
  assert.strictEqual(G.claudeSystem([{ role: "system", content: "只回复代号" }, { role: "user", content: "介绍" }]), "只回复代号");
});

test("unsupported parameter wording", function () {
  assert.strictEqual(G.looksUnsupported("stop is not supported", "stop"), true);
  assert.strictEqual(G.looksUnsupported("不支持工具调用", "工具"), true);
  assert.strictEqual(G.looksUnsupported("model not found", "stop"), false);
});

test("page lists every runner", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "check.html"), "utf8");
  ["proto", "structure", "modelecho", "stream", "control", "memory", "system", "tools", "vision", "reasoning", "usage", "replay", "candy", "pelican"].forEach(function (id) {
    assert.ok(html.indexOf('data-test="' + id + '"') >= 0, id);
  });
  assert.ok(html.indexOf("读取模型列表") < 0);
  assert.ok(html.indexOf("gpt-4o") >= 0);
  assert.ok(html.indexOf("claude-sonnet-4-6") >= 0);
  assert.ok(html.indexOf('id="model"') >= 0);
  assert.ok(html.indexOf("<select id=\"model\">") >= 0);
  assert.ok(html.indexOf("datalist") < 0);
  assert.ok(html.indexOf("lab-pick") < 0);
  assert.ok(html.indexOf("data-test=\"format\"") < 0);
  assert.ok(html.indexOf("check-grade.js") >= 0);
  assert.ok(html.indexOf("Key 不经过本站") >= 0);
  const client = fs.readFileSync(path.join(__dirname, "..", "js", "check.js"), "utf8");
  assert.ok(client.indexOf("function runBasicSuite") >= 0);
  assert.ok(client.indexOf("CANDY_QUESTIONS") >= 0);
  assert.ok(client.indexOf("function renderQuestionRows") >= 0);
  assert.ok(client.indexOf('if (id === "candy") return 600000;') >= 0);
  assert.ok(html.indexOf('id="candyRun"') >= 0);
  assert.ok(html.indexOf('id="candyReport"') >= 0);
  assert.ok(client.indexOf("function renderCandyReport") >= 0);
  assert.ok(client.indexOf("function candyCount") >= 0);
  assert.ok(html.indexOf('name="candyCount" value="20"') >= 0);
  assert.ok(html.indexOf('id="protocol"') < 0);
  assert.ok(html.indexOf('href="/check/candy"') >= 0);
  assert.ok(html.indexOf('href="#candy"') < 0);
  assert.ok(client.indexOf("function pathForView") >= 0);
  assert.ok(client.indexOf("function protocolFor") >= 0);
  assert.ok(html.indexOf("这道题是固定的糖果题") < 0);
  assert.ok(html.indexOf("鹈鹕汽车") < 0);
  assert.ok(html.indexOf("创建一个HTML，内容是SVG绘制一个鹈鹕骑自行车的2D动画，你不需要任何测试") >= 0);
  assert.ok(html.indexOf('name="twitter:card"') >= 0);
  assert.ok(html.indexOf("BreadcrumbList") >= 0);
  assert.ok(html.indexOf("FAQPage") >= 0);
  assert.ok(html.indexOf('class="mc-tags"') >= 0);
  assert.ok(html.indexOf("mc-foot") >= 0);
  assert.ok(html.indexOf("t-teal") >= 0);
  assert.ok(html.indexOf("t-rose") >= 0);
  assert.ok(html.indexOf("GPT降智") >= 0);
  assert.ok(client.indexOf("function applyViewSeo") >= 0);
  ["candy", "pelican"].forEach(function (id) {
    assert.ok(client.indexOf("\n    " + id + ":") >= 0, "runner " + id);
  });
  assert.ok(client.indexOf("veridrop.cn") < 0);
});

console.log("check-grade tests passed");
