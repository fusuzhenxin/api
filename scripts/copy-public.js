#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUB = path.join(ROOT, "public");

const FILES = [
  "index.html",
  "check.html",
  "apply.html",
  "404.html",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "sitemap-pages.xml",
  "sitemap-sites.xml",
  "llms.txt",
  "site.webmanifest",
  "BingSiteAuth.xml",
  "c025d4b26bb04ef3be4d77433253be71.txt",
  "d33038435abe486a91d43f5460f51c80.txt",
  "c5a3527e3c5f4abe9102fd37fe26b87a.txt",
];

const DIRS = ["cat", "site", "model", "official", "js", "css", "img"];

function copyFile(name) {
  const src = path.join(ROOT, name);
  if (!fs.existsSync(src)) return;
  fs.copyFileSync(src, path.join(PUB, name));
}

function copyDir(name) {
  const src = path.join(ROOT, name);
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, path.join(PUB, name), { recursive: true });
}

if (fs.existsSync(PUB)) fs.rmSync(PUB, { recursive: true, force: true });
fs.mkdirSync(PUB, { recursive: true });
FILES.forEach(copyFile);
DIRS.forEach(copyDir);

const CHECK_PAGES = {
  detect: {
    title: "模型检测结果_中转降智与基础分_API中转站导航",
    description: "汇总 API 中转基础分、耗时和降智判断。这一页不连接中转站，只展示已经跑过的基础检测、糖果测试和鹈鹕骑车。Key 不经过本站。",
    keywords: "模型检测,GPT降智,中转站降智,API中转检测,糖果测试,鹈鹕骑车,模型自测",
  },
  basic: {
    title: "API中转基础检测_OpenAI兼容与Claude_API中转站导航",
    description: "检测 OpenAI 兼容接口和 Claude Messages：协议、流式、上下文、工具调用和用量。GPT 中转、Claude 中转、DeepSeek API 都能填。不支持的项跳过，不直接当成降智。",
    keywords: "API中转检测,OpenAI兼容接口,Claude中转,GPT中转,DeepSeek API,中转站降智,模型自测",
  },
  candy: {
    title: "糖果测试_GPT降智逻辑题_API中转站导航",
    description: "糖果测试可以从 5、10、15、20 道里选题量。做到哪题展示题目和选项，做完给出分数、对错和分项得分。Key 不经过本站。",
    keywords: "糖果测试,GPT降智,ChatGPT降智,模型降智测试,中转站降智,API中转检测",
  },
  pelican: {
    title: "鹈鹕骑车_SVG动画HTML检测_API中转站导航",
    description: "鹈鹕骑车用固定提示词让模型交回 SVG 动画 HTML，跑完可以播放和下载。用来看 GPT、Claude 中转这一次的画功，不是问答题。Key 不经过本站。",
    keywords: "鹈鹕骑车,鹈鹕骑自行车,GPT降智,ChatGPT降智,模型降智测试,API中转检测",
  },
};

function checkPage(html, name, seo) {
  const url = "https://www.veridrop.cn/check/" + name;
  let out = html.replace(/<section class="mc-view(?: is-on)?" data-view-panel="([^"]+)"/g, function (_all, id) {
    return '<section class="mc-view' + (id === name ? " is-on" : "") + '" data-view-panel="' + id + '"';
  });
  out = out.replace(/<a href="(\/check(?:\/[^"]*)?)" data-view="([^"]+)"(?: class="is-on")?/g, function (_all, href, id) {
    return '<a href="' + href + '" data-view="' + id + '"' + (id === name ? ' class="is-on"' : "");
  });
  out = out.replace(/<title>[^<]*<\/title>/, "<title>" + seo.title + "</title>");
  out = out.replace(/(<meta name="description" content=")[^"]*"/, "$1" + seo.description + '"');
  out = out.replace(/(<meta name="keywords" content=")[^"]*"/, "$1" + seo.keywords + '"');
  out = out.replace(/(<link rel="canonical" href=")[^"]*"/, "$1" + url + '"');
  out = out.replace(/(<meta property="og:title" content=")[^"]*"/, "$1" + seo.title + '"');
  out = out.replace(/(<meta property="og:description" content=")[^"]*"/, "$1" + seo.description + '"');
  out = out.replace(/(<meta property="og:url" content=")[^"]*"/, "$1" + url + '"');
  out = out.replace(/(<meta name="twitter:title" content=")[^"]*"/, "$1" + seo.title + '"');
  out = out.replace(/(<meta name="twitter:description" content=")[^"]*"/, "$1" + seo.description + '"');
  return out;
}

const checkHtml = fs.readFileSync(path.join(PUB, "check.html"), "utf8");
const checkDir = path.join(PUB, "check");
fs.mkdirSync(checkDir, { recursive: true });
Object.keys(CHECK_PAGES).forEach(function (name) {
  fs.writeFileSync(path.join(checkDir, name + ".html"), checkPage(checkHtml, name, CHECK_PAGES[name]), "utf8");
});
console.log("public ready");
