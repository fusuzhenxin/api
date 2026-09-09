(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis, function () {
  const DEFAULT_ORIGIN = "https://www.veridrop.cn";
  const KEYWORDS = [
    "API中转",
    "API中转站",
    "API中转站推荐",
    "ChatGPT中转",
    "GPT API",
    "Claude中转",
    "Claude API",
    "DeepSeek API",
    "Gemini API",
    "Grok API",
    "便宜API",
    "低倍率API",
    "国内支付API",
    "新用户赠额",
    "签到送余额",
    "OpenAI中转",
    "ChatGPT中转站",
    "GPT-4o API",
    "Claude中转站",
    "DeepSeek中转",
    "Gemini中转",
  ];

  const CAT_LABEL = {
    all: "全部中转",
    checkin: "签到送余额",
    gift: "新用户赠额",
    cheaprate: "低倍率",
    fast: "低延迟",
    pay: "国内支付",
    invite: "邀请返利",
    crypto: "加密充值",
    invoice: "可开发票",
    highup: "高可用",
    stable: "稳定企业向",
    cheap: "便宜个人向",
    special: "小有特色",
    new: "新站上榜",
    other: "更多收录",
    online: "当前在线",
    fav: "我的收藏",
  };

  const CAT_SEO = {
    checkin: {
      title: "签到送余额API中转站推荐_每日领额度",
      desc: "本站整理支持签到送余额、每日领Token的API中转站，对照可用性与延迟，适合想少充值先试用ChatGPT、Claude、DeepSeek的用户。",
      keys: "签到送余额,签到送Token,每日额度,API中转站推荐",
    },
    gift: {
      title: "新用户赠额API中转站_注册送额度推荐",
      desc: "新用户赠额、注册送余额的API中转站合集。本站对照GPT、Claude、DeepSeek中转是否在线，方便先领额度再决定充哪家。",
      keys: "新用户赠额,注册送额度,API中转新人优惠",
    },
    cheaprate: {
      title: "低倍率API中转站_便宜GPT/Claude接口",
      desc: "低倍率、便宜GPT API和Claude API中转站列表。本站按探测延迟和可用性排序，帮你找更省的ChatGPT中转。",
      keys: "低倍率API,便宜GPT,便宜Claude,低价API中转",
    },
    fast: {
      title: "低延迟API中转站_速度快的GPT接口",
      desc: "低延迟API中转站导航。看探测耗时再选ChatGPT、Claude、DeepSeek中转，减少对话卡顿。",
      keys: "低延迟API,API速度快,GPT低延迟",
    },
    pay: {
      title: "国内支付API中转站_支付宝微信充值",
      desc: "支持国内支付的API中转站推荐，方便用支付宝、微信给ChatGPT中转、Claude中转充值。先看本站探测再付款。",
      keys: "国内支付API,支付宝充值API,微信充值中转站",
    },
    invite: {
      title: "邀请返利API中转站_拉新返佣推荐",
      desc: "有邀请返利的API中转站合集。对照站点在线状态后，再看返佣规则是否适合自己。",
      keys: "邀请返利,API中转返佣",
    },
    crypto: {
      title: "加密充值API中转站_USDT充值接口",
      desc: "支持加密货币、USDT充值的API中转站。本站提供可用性与延迟对照，充值前建议小额测试。",
      keys: "USDT充值API,加密充值中转",
    },
    invoice: {
      title: "可开发票API中转站_企业报销接口",
      desc: "可开发票的API中转站，方便企业对接GPT、Claude并报销。请以对方站点开票说明为准。",
      keys: "API开发票,企业API中转",
    },
    highup: {
      title: "高可用API中转站_稳定GPT接口推荐",
      desc: "高可用API中转站列表，按探测在线和可用性筛选，适合对ChatGPT、Claude稳定性更敏感的用法。",
      keys: "高可用API,稳定API中转",
    },
    stable: {
      title: "稳定企业向API中转站推荐",
      desc: "偏企业、稳定性要求更高的API中转站。本站对照可用性，充值前请自行核实合同与售后。",
      keys: "企业API中转,稳定中转站",
    },
    cheap: {
      title: "便宜个人向API中转站_低价GPT推荐",
      desc: "面向个人、价格更友好的API中转站。覆盖便宜GPT、DeepSeek等，先看延迟再充值。",
      keys: "便宜API中转,个人GPT接口",
    },
    special: {
      title: "有特色的API中转站_小众接口推荐",
      desc: "有特色玩法或模型组合的API中转站。本站只做对照，特色以对方站点介绍为准。",
      keys: "特色API中转,小众GPT接口",
    },
    new: {
      title: "新站上榜API中转_最新收录站点",
      desc: "本站新收录的API中转站。新站波动可能更大，建议先看探测、小额测试再决定。",
      keys: "新API中转站,新站推荐",
    },
    online: {
      title: "当前在线API中转站_可用GPT接口",
      desc: "当前探测在线的API中转站。在线不等于模型一定可用，充值前仍建议小额实测。",
      keys: "在线API中转,可用GPT接口",
    },
    other: {
      title: "更多API中转站收录",
      desc: "尚未归入常用标签的API中转站，可在本站继续按模型或关键词筛选。",
      keys: "API中转站大全",
    },
    fav: {
      title: "我收藏的API中转站",
      desc: "你在这台设备上收藏的API中转站，方便对比常用ChatGPT、Claude中转。",
      keys: "收藏的中转站",
    },
  };

  const MODEL_LABEL = {
    gpt: "GPT / ChatGPT",
    claude: "Claude",
    gemini: "Gemini",
    grok: "Grok",
    deepseek: "DeepSeek",
    kimi: "Kimi",
    qwen: "Qwen",
    glm: "GLM",
    image: "生图",
    video: "视频",
  };

  const MODEL_SEO = {
    gpt: {
      title: "ChatGPT中转站推荐_GPT API接口对照",
      desc: "ChatGPT中转、GPT API、OpenAI中转站合集。本站对照可用性与延迟，覆盖GPT-4o等常见接口，充值前先看模型是否活着。",
      keys: "ChatGPT中转,ChatGPT中转站,GPT API,OpenAI中转,GPT-4o API",
      h1: "ChatGPT / GPT API 中转站推荐",
    },
    claude: {
      title: "Claude中转站推荐_Claude API接口对照",
      desc: "Claude中转、Claude API中转站列表。本站对照Anthropic上游状态和站点延迟，方便选更稳的Claude接口。",
      keys: "Claude中转,Claude中转站,Claude API,Anthropic中转",
      h1: "Claude API 中转站推荐",
    },
    gemini: {
      title: "Gemini中转站推荐_Gemini API接口",
      desc: "Gemini API、Gemini中转站对照。看探测延迟和可用性，再决定去哪家充值Google模型接口。",
      keys: "Gemini中转,Gemini API,Google Gemini接口",
      h1: "Gemini API 中转站推荐",
    },
    grok: {
      title: "Grok中转站推荐_Grok API接口",
      desc: "Grok API、xAI中转站列表。本站对照可用性，充值前建议小额实测。",
      keys: "Grok中转,Grok API,xAI中转",
      h1: "Grok API 中转站推荐",
    },
    deepseek: {
      title: "DeepSeek中转站推荐_DeepSeek API对照",
      desc: "DeepSeek API、DeepSeek中转站合集。对照延迟和可用性，适合找便宜或稳定的DeepSeek接口。",
      keys: "DeepSeek中转,DeepSeek API,DeepSeek接口",
      h1: "DeepSeek API 中转站推荐",
    },
    kimi: {
      title: "Kimi中转站推荐_月之暗面API接口",
      desc: "Kimi / 月之暗面 API 中转站对照，看探测状态再充值。",
      keys: "Kimi中转,Kimi API,月之暗面API",
      h1: "Kimi API 中转站推荐",
    },
    qwen: {
      title: "通义千问中转站_Qwen API接口推荐",
      desc: "Qwen / 通义千问 API 中转站列表。本站对照可用性与延迟。",
      keys: "Qwen中转,通义千问API,千问接口",
      h1: "Qwen / 通义千问中转站推荐",
    },
    glm: {
      title: "智谱GLM中转站_GLM API接口推荐",
      desc: "GLM / 智谱 API 中转站对照，看探测再决定充哪家。",
      keys: "GLM中转,智谱API,ChatGLM接口",
      h1: "GLM / 智谱中转站推荐",
    },
    image: {
      title: "AI生图API中转站_绘图接口推荐",
      desc: "支持生图、绘图接口的API中转站。本站对照整站可用性，具体模型以对方控制台为准。",
      keys: "生图API,AI绘图接口,文生图中转",
      h1: "AI 生图 API 中转站推荐",
    },
    video: {
      title: "AI视频API中转站_视频生成接口",
      desc: "支持视频生成接口的API中转站。充值前先看本站探测，并小额实测对方模型。",
      keys: "视频API,AI视频接口,文生视频中转",
      h1: "AI 视频 API 中转站推荐",
    },
  };

  const OFFICIAL_SEO = {
    openai: { title: "OpenAI官方状态_ChatGPT模型实况", desc: "OpenAI官方状态对照，看ChatGPT、GPT接口是否降级，再决定去哪家API中转充值。", keys: "OpenAI状态,ChatGPT官方状态" },
    anthropic: { title: "Claude官方状态_Anthropic模型实况", desc: "Claude官方状态对照，排查Claude API是否异常，避免盲目给中转站充值。", keys: "Claude状态,Anthropic状态" },
    google: { title: "Gemini官方状态_Google模型实况", desc: "Gemini官方状态对照，查看Google模型是否可用。", keys: "Gemini状态" },
    xai: { title: "Grok官方状态_xAI模型实况", desc: "Grok / xAI官方状态对照，查看Grok接口是否正常。", keys: "Grok状态,xAI状态" },
    deepseek: { title: "DeepSeek官方状态_模型实况", desc: "DeepSeek官方状态对照，查看DeepSeek API是否可用。", keys: "DeepSeek状态" },
    moonshot: { title: "Kimi官方状态_月之暗面实况", desc: "Kimi官方状态对照，查看月之暗面接口是否正常。", keys: "Kimi状态" },
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function slugify(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/https?:\/\//, "")
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  function sitePath(site) {
    if (!site) return "/";
    const slug = slugify(site.domain || site.name || "");
    return slug ? "/site/" + site.id + "-" + slug : "/site/" + site.id;
  }

  function catPath(id) {
    return "/cat/" + id;
  }

  function officialPath(provider) {
    return "/official/" + provider;
  }

  function modelPath(id) {
    return "/model/" + id;
  }

  function rankPath(id) {
    if (!id || id === "hub") return "/rank";
    return "/rank/" + id;
  }

  const RANK_SEO = {
    hub: {
      title: "API中转站排行榜_最稳最快推荐【API中转站导航】",
      desc: "本站中转站排行榜按整站探测和站内投票排列，分最稳榜与最快榜。不是官方鉴定，充值前仍建议小额实测。",
      keys: "API中转站排行榜,中转站排行榜,API中转推荐,最稳中转,低延迟中转",
      h1: "API中转站排行榜，先看最稳和最快",
      lead: "按整站探测和站内投票排，不是官方鉴定。最稳看出线率和投票，最快看测到的延迟。",
    },
    stable: {
      title: "最稳API中转站排行榜_高可用推荐【API中转站导航】",
      desc: "本站最稳榜：整站探测在线、可用性至少95%、赞不少于踩，且不在新站观察期。按可用率和投票排列，不是官方鉴定。",
      keys: "最稳API中转,高可用中转站,API中转站排行榜,稳定中转推荐",
      h1: "最稳 API 中转站排行榜",
      lead: "在线、可用性≥95%、赞不少于踩，新站不进榜。按可用性、赞踩差、延迟排列。按探测和投票，不是官方鉴定。",
    },
    fast: {
      title: "最快API中转站排行榜_低延迟推荐【API中转站导航】",
      desc: "本站最快榜：有测到延迟、整站在线、可用性不低于80%。按平均延迟从低到高排，不是官方鉴定。",
      keys: "最快API中转,低延迟中转,API中转站排行榜,低延迟API",
      h1: "最快 API 中转站排行榜",
      lead: "必须测到延迟、整站在线，可用性低于80%的不进。按平均延迟从低到高，并列再看可用性。按探测和投票，不是官方鉴定。",
    },
  };

  function originFrom(extra) {
    if (extra && extra.origin) return String(extra.origin).replace(/\/$/, "");
    if (typeof location !== "undefined" && location.protocol !== "file:") {
      const host = String(location.hostname || "");
      if (host === "veridrop.cn" || host === "www.veridrop.cn") return DEFAULT_ORIGIN;
      return location.origin;
    }
    return DEFAULT_ORIGIN;
  }

  function abs(origin, path) {
    if (!origin) return path;
    return origin + path;
  }

  function modelNames(site) {
    return ((site && site.models) || []).map((m) => m.label || m.id).filter(Boolean);
  }

  function clip(s, n) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }

  function fmtMs(ms) {
    if (ms == null || Number.isNaN(Number(ms))) return "—";
    const n = Number(ms);
    return n >= 1000 ? (n / 1000).toFixed(1) + "s" : Math.round(n) + "ms";
  }

  function ogPath(site) {
    return site && site.id ? "/og/site/" + site.id + ".jpg" : "/img/og.png";
  }

  function siteVerdict(site) {
    if (!site) {
      return { id: "watch", label: "待看", sentence: "目录里没有这个站。", notes: [] };
    }
    const st = site.status || {};
    const online = !!st.online;
    const up = st.uptime;
    const ms = st.avgMs || st.ms;
    const upVotes = (site.votes && site.votes.up) || 0;
    const downVotes = (site.votes && site.votes.down) || 0;
    const isNew = ((site.categories || []).indexOf("new") >= 0);
    const notes = [];
    if (isNew) notes.push("还在新站观察期，样本还少");

    if (!online) {
      return {
        id: "caution",
        label: "慎充",
        sentence: site.name + " 当前整站探测异常，先别充值，等恢复后再小额试。",
        notes,
      };
    }
    if (typeof up === "number" && up < 80) {
      return {
        id: "caution",
        label: "慎充",
        sentence: site.name + " 可用性只有 " + up + "%，波动偏大，充值前建议先看探测、只小额试。",
        notes,
      };
    }
    if (downVotes >= 3 && downVotes > upVotes) {
      return {
        id: "caution",
        label: "慎充",
        sentence: site.name + " 站内踩的比赞多，先对照探测，不要一把充太多。",
        notes,
      };
    }
    if (isNew && (typeof up !== "number" || up < 95)) {
      return {
        id: "watch",
        label: "一般",
        sentence: site.name + " 还是新站，探测能用但样本少，建议小额实测再决定。",
        notes,
      };
    }
    if (typeof up === "number" && up >= 95 && (ms == null || Number(ms) < 2000) && upVotes >= downVotes) {
      return {
        id: "ok",
        label: "相对稳",
        sentence: site.name + " 探测可用、延迟正常，看起来比较稳，仍建议先小额确认模型再充。",
        notes,
      };
    }
    return {
      id: "watch",
      label: "一般",
      sentence: site.name + " 能打开，但还没到很稳。先看延迟和投票，小额试过再加钱。",
      notes,
    };
  }

  function ogPayload(site) {
    const v = siteVerdict(site);
    const st = (site && site.status) || {};
    const votes = (site && site.votes) || {};
    return {
      name: (site && site.name) || "未命名",
      domain: (site && site.domain) || "",
      verdict: v.label,
      verdict_id: v.id,
      sentence: v.sentence,
      uptime: st.uptime != null ? st.uptime + "%" : "待测",
      latency: fmtMs(st.avgMs || st.ms),
      votes: (votes.up || 0) + " / " + (votes.down || 0),
      online: !!st.online,
    };
  }

  function homeSeo(ctx) {
    const n = (ctx.total != null ? ctx.total : 4000) + "+";
    const title = "API中转站导航_ChatGPT/Claude/DeepSeek中转推荐";
    const description =
      "本站收录" +
      n +
      "家API中转站，实时对照ChatGPT中转、Claude API、DeepSeek API的可用性与延迟。按低倍率、签到送余额、国内支付筛选，充值前先看模型活着。";
    return pack({
      title,
      description,
      keywords: KEYWORDS.join(","),
      h1: "API中转站导航，先看 ChatGPT / Claude / DeepSeek 再充值",
      lead: description,
      path: "/",
      image: "/img/og.png",
      origin: ctx.origin,
      graph: [
        {
          "@type": "WebSite",
          name: "API中转站导航",
          url: abs(ctx.origin, "/"),
          description,
          potentialAction: {
            "@type": "SearchAction",
            target: abs(ctx.origin, "/?q={search_term_string}"),
            "query-input": "required name=search_term_string",
          },
        },
        {
          "@type": "Organization",
          name: "API中转站导航",
          url: abs(ctx.origin, "/"),
          logo: abs(ctx.origin, "/img/icon-512.png"),
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "什么是API中转站？",
              acceptedAnswer: {
                "@type": "Answer",
                text: "API中转站是第三方把 ChatGPT、Claude、DeepSeek 等模型接口聚合后出售额度的网站。本站只做导航对照，不是官方渠道。",
              },
            },
            {
              "@type": "Question",
              name: "怎么选便宜又稳的GPT中转？",
              acceptedAnswer: {
                "@type": "Answer",
                text: "先看低倍率、国内支付、高可用这些分类，再对照探测延迟和投票，最后小额充值实测。便宜不等于每个模型都通。",
              },
            },
            {
              "@type": "Question",
              name: "签到送余额和探币是一回事吗？",
              acceptedAnswer: {
                "@type": "Answer",
                text: "不是。签到送余额是中转站自己给的额度；探币只记在这台电脑上，不能用来给对方站充值。",
              },
            },
          ],
        },
      ],
    });
  }

  function modelSeo(id, ctx) {
    const extra = MODEL_SEO[id] || {};
    const label = MODEL_LABEL[id] || id;
    const title = (extra.title || label + "中转站") + "【API中转站导航】";
    const description = extra.desc || "本站收录支持" + label + "的API中转站，对照可用性与延迟后再充值。";
    const keywords = [label, extra.keys, "API中转", "API中转站推荐"].filter(Boolean).join(",");
    return pack({
      title,
      description,
      keywords,
      h1: extra.h1 || label + " API中转站推荐",
      lead: description,
      path: modelPath(id),
      image: "/img/og.png",
      origin: ctx.origin,
      graph: [
        {
          "@type": "CollectionPage",
          name: title,
          description,
          url: abs(ctx.origin, modelPath(id)),
          isPartOf: { "@type": "WebSite", name: "API中转站导航", url: abs(ctx.origin, "/") },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "API中转站导航", item: abs(ctx.origin, "/") },
            { "@type": "ListItem", position: 2, name: label, item: abs(ctx.origin, modelPath(id)) },
          ],
        },
      ],
    });
  }

  function catSeo(id, ctx) {
    const label = CAT_LABEL[id] || id;
    const extra = CAT_SEO[id] || {};
    const title = (extra.title || label + "API中转站") + "【API中转站导航】";
    const description = extra.desc || "「" + label + "」分类下的API中转站，对照ChatGPT、Claude、DeepSeek可用性与延迟。";
    const keywords = [label, extra.keys, KEYWORDS.slice(0, 8).join(",")].filter(Boolean).join(",");
    return pack({
      title,
      description,
      keywords,
      h1: label + " API中转站推荐",
      lead: description,
      path: catPath(id),
      image: "/img/og.png",
      origin: ctx.origin,
      graph: [
        {
          "@type": "CollectionPage",
          name: title,
          description,
          url: abs(ctx.origin, catPath(id)),
          isPartOf: { "@type": "WebSite", name: "API中转站导航", url: abs(ctx.origin, "/") },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "API中转站导航", item: abs(ctx.origin, "/") },
            { "@type": "ListItem", position: 2, name: label, item: abs(ctx.origin, catPath(id)) },
          ],
        },
      ],
    });
  }

  function siteSeo(site, ctx) {
    if (!site) {
      return pack({
        title: "未找到该API中转站【API中转站导航】",
        description: "这个API中转站不在本站目录里。",
        keywords: KEYWORDS.join(","),
        h1: "未找到该API中转站",
        lead: "这个API中转站不在本站目录里。",
        path: "/",
        image: "/img/og.png",
        origin: ctx.origin,
        graph: [],
      });
    }
    const models = modelNames(site);
    const modelText = models.slice(0, 4).join("/") || "GPT/Claude";
    const up = site.status && site.status.uptime != null ? site.status.uptime + "%" : "待测";
    const verdict = siteVerdict(site);
    const title = site.name + " API中转测评_" + modelText + "倍率延迟【API中转站导航】";
    const description = clip(
      verdict.sentence + " 支持" + modelText + "，可用性" + up + "，延迟" + fmtMs(site.status && (site.status.avgMs || site.status.ms)) + "。",
      160
    );
    const keywords = [site.name, site.domain, modelText, "API中转", "ChatGPT中转", "Claude中转"].filter(Boolean).join(",");
    const path = sitePath(site);
    const faqQ1 = site.name + " 支持哪些模型？";
    const faqA1 = "简介里提到：" + (modelText || "未标明") + "。具体以对方控制台为准，本站按简介提取标签。";
    const faqQ2 = site.name + " 延迟和可用性怎么样？";
    const faqA2 = "探测可用性" + up + "。在线不等于每个模型都通，ChatGPT、Claude 接口建议先小额测试。";
    return pack({
      title,
      description,
      keywords,
      h1: site.name + " API中转站测评",
      lead: verdict.sentence,
      verdict,
      path,
      image: ogPath(site),
      origin: ctx.origin,
      graph: [
        {
          "@type": "SoftwareApplication",
          name: site.name + " API中转",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web",
          url: abs(ctx.origin, path),
          description,
          offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "API中转站导航", item: abs(ctx.origin, "/") },
            { "@type": "ListItem", position: 2, name: site.name, item: abs(ctx.origin, path) },
          ],
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: faqQ1, acceptedAnswer: { "@type": "Answer", text: faqA1 } },
            { "@type": "Question", name: faqQ2, acceptedAnswer: { "@type": "Answer", text: faqA2 } },
            {
              "@type": "Question",
              name: "怎么给" + site.name + "充值更稳妥？",
              acceptedAnswer: {
                "@type": "Answer",
                text: "先看本页探测和投票，再去对方站小额充值。本站不代收、不保证额度。",
              },
            },
          ],
        },
      ],
    });
  }

  function officialSeo(provider, item, ctx) {
    const extra = OFFICIAL_SEO[provider] || {};
    const label = (item && item.label) || provider;
    const title = (extra.title || label + "官方模型实况") + "【API中转站导航】";
    const description = extra.desc || label + "官方状态对照，充值API中转前先看上游是否降级。";
    return pack({
      title,
      description,
      keywords: extra.keys || label + "状态,API中转",
      h1: label + " 官方状态 · 模型实况",
      lead: description,
      path: officialPath(provider),
      image: "/img/og.png",
      origin: ctx.origin,
      graph: [
        {
          "@type": "WebPage",
          name: title,
          description,
          url: abs(ctx.origin, officialPath(provider)),
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: label + "官方异常，中转站还能用吗？",
              acceptedAnswer: {
                "@type": "Answer",
                text: "上游降级或故障时，很多第三方中转会一起受影响。建议先看官方状态，再决定要不要充值。",
              },
            },
            {
              "@type": "Question",
              name: "本站会跳到官方状态站吗？",
              acceptedAnswer: {
                "@type": "Answer",
                text: "不会。本页只在站内对照公开状态，方便和目录里的API中转站一起看。",
              },
            },
          ],
        },
      ],
    });
  }

  function pack(seo) {
    const origin = originFrom({ origin: seo.origin });
    const canonical = abs(origin, seo.path || "/");
    const image = seo.image && /^https?:/i.test(seo.image) ? seo.image : abs(origin, seo.image || "/img/og.png");
    return {
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords,
      h1: seo.h1 || seo.title,
      lead: seo.lead || seo.description,
      verdict: seo.verdict || null,
      path: seo.path,
      canonical,
      image,
      jsonld: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": seo.graph || [],
      }),
    };
  }

  function seoFor(route, ctx) {
    const extra = { origin: originFrom(ctx || {}), total: ctx && ctx.total };
    if (!route || route.name === "home") return homeSeo(extra);
    if (route.name === "cat") return catSeo(route.id, extra);
    if (route.name === "model") return modelSeo(route.id, extra);
    if (route.name === "site") return siteSeo(ctx && ctx.station, extra);
    if (route.name === "official") return officialSeo(route.provider, ctx && ctx.official, extra);
    return homeSeo(extra);
  }

  function rankSeo(id, ctx) {
    const key = RANK_SEO[id] ? id : "hub";
    const extra = RANK_SEO[key];
    const path = rankPath(key === "hub" ? "hub" : key);
    return pack({
      title: extra.title,
      description: extra.desc,
      keywords: extra.keys + "," + KEYWORDS.slice(0, 6).join(","),
      h1: extra.h1,
      lead: extra.lead,
      path,
      image: "/img/og.png",
      origin: ctx.origin,
      graph: [
        {
          "@type": "CollectionPage",
          name: extra.title,
          description: extra.desc,
          url: abs(ctx.origin, path),
          isPartOf: { "@type": "WebSite", name: "API中转站导航", url: abs(ctx.origin, "/") },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "API中转站导航", item: abs(ctx.origin, "/") },
            { "@type": "ListItem", position: 2, name: "排行榜", item: abs(ctx.origin, "/rank") },
          ].concat(
            key === "hub"
              ? []
              : [{ "@type": "ListItem", position: 3, name: extra.h1, item: abs(ctx.origin, path) }]
          ),
        },
      ],
    });
  }

  function injectSeoHtml(html, seo, route) {
    const next = seo || homeSeo({ origin: "" });
    const name = route && route.name;
    let out = String(html)
      .replace(/<title>[\s\S]*?<\/title>/, "<title>" + esc(next.title) + "</title>")
      .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(next.description) + '">')
      .replace(/<meta name="keywords" content="[^"]*">/, '<meta name="keywords" content="' + esc(next.keywords) + '">')
      .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + esc(next.canonical) + '">')
      .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(next.title) + '">')
      .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(next.description) + '">')
      .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + esc(next.canonical) + '">')
      .replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + esc(next.image) + '">')
      .replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(next.title) + '">')
      .replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(next.description) + '">')
      .replace(/<meta name="twitter:image" content="[^"]*">/, '<meta name="twitter:image" content="' + esc(next.image) + '">')
      .replace(
        /<script type="application\/ld\+json" id="seo-jsonld">[\s\S]*?<\/script>/,
        '<script type="application/ld+json" id="seo-jsonld">' + next.jsonld + "</script>"
      );
    if (name !== "site" && name !== "official") {
      out = out
        .replace(/<h1>[\s\S]*?<\/h1>/, "<h1>" + esc(next.h1) + "</h1>")
        .replace(/<p class="seo-lead">[\s\S]*?<\/p>/, '<p class="seo-lead">' + esc(next.lead) + "</p>");
    }
    if (name === "cat" || name === "model") {
      out = out
        .replace('id="home" class="home-shell"', 'id="home" class="home-shell is-cat"')
        .replace(/<section class="seo-home"[\s\S]*?<\/section>/, "");
    }
    const ssr =
      '<nav class="crumbs"><a href="/">首页</a><span>/</span><span>' +
      esc(next.h1) +
      "</span></nav><h1>" +
      esc(next.h1) +
      '</h1><p class="seo-lead">' +
      esc(next.lead) +
      "</p>";
    if (name === "site" || name === "official") {
      out = out
        .replace('<main id="home" class="home-shell">', '<main id="home" class="home-shell" hidden>')
        .replace(/<main id="home"[\s\S]*?<h1>[\s\S]*?<\/h1>/, (m) => m.replace(/<h1>[\s\S]*?<\/h1>/, ""));
    }
    if (name === "site") {
      const v = next.verdict;
      const box = v
        ? '<aside class="verdict ' +
          esc(v.id) +
          '"><p class="verdict-kicker">本站结论 · 按探测和投票，不是官方鉴定</p><strong>' +
          esc(v.label) +
          "</strong><p>" +
          esc(v.sentence) +
          "</p></aside>"
        : "";
      out = out.replace(
        '<main id="detail" class="detail" hidden></main>',
        '<main id="detail" class="detail">' + box + ssr + "</main>"
      );
    }
    if (name === "official") {
      out = out.replace(
          '<main id="officialPage" class="detail official-page" hidden></main>',
          '<main id="officialPage" class="detail official-page">' + ssr + "</main>"
        );
    }
    return out;
  }

  function setMeta(name, content) {
    let el = document.querySelector('meta[name="' + name + '"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content || "");
  }

  function setProp(prop, content) {
    let el = document.querySelector('meta[property="' + prop + '"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("property", prop);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content || "");
  }

  function applySeo(seo) {
    if (typeof document === "undefined" || !seo) return seo;
    document.title = seo.title;
    setMeta("description", seo.description);
    setMeta("keywords", seo.keywords);
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = seo.canonical;
    setProp("og:title", seo.title);
    setProp("og:description", seo.description);
    setProp("og:url", seo.canonical);
    setProp("og:image", seo.image);
    setMeta("twitter:title", seo.title);
    setMeta("twitter:description", seo.description);
    setMeta("twitter:image", seo.image);
    const box = document.getElementById("seo-jsonld");
    if (box) box.textContent = seo.jsonld;
    return seo;
  }

  function parseRoute(pathname, hash) {
    const raw = String(pathname || "")
      .replace(/\/$/, "")
      .replace(/^#/, "");
    const fromHash = String(hash || "").replace(/^#/, "");
    const path = raw && raw !== "" ? raw : fromHash || "/";
    const site = path.match(/^\/site\/(\d+)/);
    if (site) return { name: "site", id: Number(site[1]) };
    const official = path.match(/^\/official\/([a-z0-9_-]+)/i);
    if (official) return { name: "official", provider: official[1] };
    const model = path.match(/^\/model\/([a-z0-9_-]+)/i);
    if (model) return { name: "model", id: model[1] };
    const cat = path.match(/^\/cat\/([a-z0-9_-]+)/i);
    if (cat) return { name: "cat", id: cat[1] };
    return { name: "home" };
  }

  return {
    KEYWORDS,
    CAT_LABEL,
    CAT_SEO,
    OFFICIAL_SEO,
    MODEL_LABEL,
    MODEL_SEO,
    sitePath,
    catPath,
    officialPath,
    modelPath,
    rankPath,
    RANK_SEO,
    ogPath,
    siteVerdict,
    ogPayload,
    slugify,
    seoFor,
    injectSeoHtml,
    applySeo,
    parseRoute,
    modelNames,
  };
});
