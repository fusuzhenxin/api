const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const TO = "2201219073@qq.com";

function loadLocalEnv() {
  if (process.env.SMTP_PASS) return;
  const file = path.join(__dirname, "..", ".env");
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    return;
  }
  text.split(/\r?\n/).forEach(function (line) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) return;
    process.env[match[1]] = match[2].trim();
  });
}

const MODELS = ["GPT", "Claude", "Gemini", "Grok", "DeepSeek", "Kimi", "Qwen", "GLM", "生图", "视频"];
const FEATURES = ["签到送余额", "新用户赠额", "低倍率", "国内支付", "邀请返利", "加密充值", "可开发票"];

function clean(value, max) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function httpUrl(raw, label) {
  let text = String(raw || "").trim();
  if (!text) return "";
  if (!/^https?:\/\//i.test(text)) text = "https://" + text;
  let url;
  try {
    url = new URL(text);
  } catch (err) {
    throw new Error(label + "无法解析");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(label + "只支持 http 或 https");
  if (url.username || url.password) throw new Error(label + "里不要写账号或密码");
  if (!url.hostname || url.hostname.indexOf(".") < 0) throw new Error(label + "不像一个域名");
  url.hash = "";
  return url.toString();
}

function picked(list, allowed) {
  const source = Array.isArray(list) ? list : [];
  return allowed.filter(function (item) {
    return source.indexOf(item) >= 0;
  });
}

function validateApply(body) {
  const input = body || {};
  if (String(input.company || "").trim()) return { ok: true, ignored: true };
  const name = clean(input.name, 40);
  const applicant = clean(input.applicant, 40);
  const email = clean(input.email, 80);
  const contact = clean(input.contact, 40);
  const intro = String(input.intro || "").trim().slice(0, 800);
  if (name.length < 2) return { ok: false, error: "请填写站点名称" };
  let url = "";
  let api = "";
  try {
    url = httpUrl(input.url, "网站地址");
    if (!url) return { ok: false, error: "请填写网站地址" };
    api = httpUrl(input.api, "接口地址");
  } catch (err) {
    return { ok: false, error: err.message };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "请填写能联系到你的邮箱" };
  if (intro.length < 8) return { ok: false, error: "请用几句话介绍这个站，至少说明怎么打开、怎么注册" };
  const kind = input.kind === "charity" ? "charity" : "paid";
  return {
    ok: true,
    fields: {
      name: name,
      url: url,
      api: api,
      kind: kind,
      models: picked(input.models, MODELS),
      features: picked(input.features, FEATURES),
      applicant: applicant,
      email: email,
      contact: contact,
      intro: intro,
    },
  };
}

function mailText(fields) {
  return [
    "站点名称：" + fields.name,
    "网站地址：" + fields.url,
    "接口地址：" + (fields.api || "未填"),
    "类型：" + (fields.kind === "charity" ? "公益站" : "付费中转"),
    "支持模型：" + (fields.models.join("、") || "未填"),
    "特点：" + (fields.features.join("、") || "未填"),
    "申请人：" + (fields.applicant || "未填"),
    "联系邮箱：" + fields.email,
    "其他联系方式：" + (fields.contact || "未填"),
    "简介：" + fields.intro,
  ].join("\n");
}

const QQ_SMTP_HOSTS = ["183.47.101.192", "183.47.120.204"];

function mailbox() {
  loadLocalEnv();
  const user = String(process.env.SMTP_USER || TO).trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  return { user: user, pass: pass };
}

function smtpTargets() {
  const host = String(process.env.SMTP_HOST || "smtp.qq.com").replace(/[\s'"]+/g, "");
  if (!host || /qq\.com$/i.test(host)) return QQ_SMTP_HOSTS;
  return [host];
}

async function sendApply(fields) {
  const box = mailbox();
  if (!box.pass) return { ok: false };
  const port = Number(process.env.SMTP_PORT || 465);
  const mail = {
    from: "API中转站导航 <" + box.user + ">",
    to: TO,
    replyTo: fields.email,
    subject: "收录申请：" + fields.name,
    text: mailText(fields),
  };
  let last;
  const targets = smtpTargets();
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    try {
      const transport = nodemailer.createTransport({
        host: target,
        port: port,
        secure: port === 465,
        auth: { user: box.user, pass: box.pass },
        tls: { servername: "smtp.qq.com" },
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 8000,
      });
      await transport.sendMail(mail);
      return { ok: true };
    } catch (err) {
      last = err;
      console.error("apply-smtp-failed", target, err && err.code ? err.code : "", err && err.message ? err.message : err);
    }
  }
  throw last || new Error("smtp-send-failed");
}

async function acceptApply(body) {
  const checked = validateApply(body);
  if (!checked.ok || checked.ignored) return checked;
  try {
    return await sendApply(checked.fields);
  } catch (err) {
    return { ok: false };
  }
}

module.exports = {
  TO: TO,
  MODELS: MODELS,
  FEATURES: FEATURES,
  validateApply: validateApply,
  mailText: mailText,
  acceptApply: acceptApply,
};
