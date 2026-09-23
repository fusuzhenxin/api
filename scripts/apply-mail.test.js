const assert = require("assert");
const { validateApply, mailText } = require("../lib/apply-mail");

const good = {
  name: "示例中转",
  url: "example.com",
  api: "https://api.example.com/v1",
  kind: "paid",
  models: ["GPT", "不存在", "Claude"],
  features: ["低倍率"],
  applicant: "张三",
  email: "owner@example.com",
  contact: "微信 example",
  intro: "打开首页即可注册，按量计费，支持国内支付。",
};

const checked = validateApply(good);
assert.strictEqual(checked.ok, true);
assert.strictEqual(checked.fields.url, "https://example.com/");
assert.deepStrictEqual(checked.fields.models, ["GPT", "Claude"]);
const letter = mailText(checked.fields);
assert.ok(letter.indexOf("联系邮箱：owner@example.com") >= 0);
assert.ok(letter.indexOf("类型：付费中转") >= 0);

assert.strictEqual(validateApply({ company: "spam" }).ignored, true);
assert.strictEqual(validateApply(Object.assign({}, good, { url: "javascript:alert(1)" })).ok, false);
assert.strictEqual(validateApply(Object.assign({}, good, { url: "https://user:pass@example.com" })).ok, false);
assert.strictEqual(validateApply(Object.assign({}, good, { email: "nope" })).ok, false);
assert.strictEqual(validateApply(Object.assign({}, good, { intro: "太短" })).ok, false);
assert.strictEqual(validateApply(Object.assign({}, good, { kind: "charity" })).fields.kind, "charity");

console.log("apply-mail tests passed");
