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

const CHECK_PAGES = {
  detect: {
    title: "模型检测结果_中转降智与基础分_API中转站导航",
    description: "汇总 API 中转基础分、耗时和降智判断。这一页不连接中转站，只展示已经跑过的基础检测、糖果测试和鹈鹕骑车。Key 不经过本站。",
    keywords: "模型检测,GPT降智,中转站降智,API中转检测,糖果测试,鹈鹕骑车,模型自测",
    crumb: "检测结果",
  },
  basic: {
    title: "API中转基础检测_OpenAI兼容与Claude_API中转站导航",
    description: "检测 OpenAI 兼容接口和 Claude Messages：协议、流式、上下文、工具调用和用量。GPT 中转、Claude 中转、DeepSeek API 都能填。不支持的项跳过，不直接当成降智。",
    keywords: "API中转检测,OpenAI兼容接口,Claude中转,GPT中转,DeepSeek API,中转站降智,模型自测",
    crumb: "基础测试",
  },
  candy: {
    title: "糖果测试_GPT降智逻辑题_API中转站导航",
    description: "糖果测试用 20 道固定选择题看这一次 API 中转调用会不会做错逻辑题。可选 5、10、15 或 20 道，做完给出正确率、对错，以及迷惑辨析、数量关系、约束求解、演绎四项得分。Key 不经过本站。",
    keywords: "糖果测试,GPT降智,ChatGPT降智,逻辑题,模型降智测试,中转站降智,API中转检测",
    crumb: "糖果测试",
  },
  pelican: {
    title: "鹈鹕骑车_SVG动画HTML检测_API中转站导航",
    description: "鹈鹕骑车用固定提示词让模型交回 SVG 动画 HTML，跑完可以播放和下载。用来看 GPT、Claude 中转这一次的画功，不是问答题。Key 不经过本站。",
    keywords: "鹈鹕骑车,鹈鹕骑自行车,GPT降智,ChatGPT降智,模型降智测试,API中转检测",
    crumb: "鹈鹕骑车",
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
  if (!seo.crumb) return out;
  return out.replace(/<script type="application\/ld\+json" id="seo-jsonld">([\s\S]*?)<\/script>/, function (_all, json) {
    const data = JSON.parse(json);
    const graph = data["@graph"];
    if (!Array.isArray(graph)) return _all;
    const crumbId = url + "#breadcrumb";
    const page = graph.find((node) => node["@type"] === "WebPage" && node.url === url);
    if (page) {
      page.description = seo.description;
      page.breadcrumb = { "@id": crumbId };
    }
    graph.push({
      "@type": "BreadcrumbList",
      "@id": crumbId,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "API中转站导航", item: "https://www.veridrop.cn/" },
        { "@type": "ListItem", position: 2, name: "模型检测", item: "https://www.veridrop.cn/check" },
        { "@type": "ListItem", position: 3, name: seo.crumb, item: url },
      ],
    });
    if (name === "candy") {
      graph.push({
        "@type": "FAQPage",
        "@id": url + "#faq",
        mainEntity: [
          {
            "@type": "Question",
            name: "能用来判断中转站降智吗？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "只能看这一次调用。答错说明这题没做对，不能据此判断整站，也不能当成官方原厂鉴定。降智还要连着鹈鹕骑车一起看。",
            },
          },
          {
            "@type": "Question",
            name: "Key 会留在这个网站吗？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "不会。请求从浏览器直接发到你填写的地址。Key 默认只留在当次页面，勾选后才写进这台浏览器。",
            },
          },
        ],
      });
    }
    return '<script type="application/ld+json" id="seo-jsonld">' + JSON.stringify(data) + "</script>";
  });
}

function renderCheckPage(html, name) {
  const seo = CHECK_PAGES[name];
  return seo ? checkPage(html, name, seo) : html;
}

module.exports = { renderCheckPage, CHECK_PAGES };

if (require.main === module) {
  if (fs.existsSync(PUB)) fs.rmSync(PUB, { recursive: true, force: true });
  fs.mkdirSync(PUB, { recursive: true });
  FILES.forEach(copyFile);
  DIRS.forEach(copyDir);
  const checkHtml = fs.readFileSync(path.join(PUB, "check.html"), "utf8");
  const checkDir = path.join(PUB, "check");
  fs.mkdirSync(checkDir, { recursive: true });
  Object.keys(CHECK_PAGES).forEach(function (name) {
    fs.writeFileSync(path.join(checkDir, name + ".html"), renderCheckPage(checkHtml, name), "utf8");
  });
  console.log("public ready");
}
