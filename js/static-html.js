(function (root, factory) {
  const api = factory(
    typeof require === "function" ? require("./seo.js") : root,
    typeof require === "function" ? require("./icons.js") : root
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis, function (seo, icons) {
  const HOME_SECTIONS = [
    "charity",
    "stable",
    "cheap",
    "special",
    "new",
    "online",
    "checkin",
    "gift",
    "cheaprate",
    "fast",
    "pay",
    "invite",
    "crypto",
    "invoice",
    "highup",
  ];
  const FEATURE_CHIPS = ["charity", "checkin", "gift", "cheaprate", "fast", "pay", "invite", "crypto", "invoice"];
  const PREVIEW_SIZE = 6;
  const CARD_CAP = 80;
  const CAT_LABEL = seo.CAT_LABEL || {};
  const CAT_SEO = seo.CAT_SEO || {};
  const MODEL_LABEL = seo.MODEL_LABEL || {};
  const MODEL_SEO = seo.MODEL_SEO || {};
  const sitePath = seo.sitePath;
  const catPath = seo.catPath;
  const modelPath = seo.modelPath;
  const officialPath = seo.officialPath;
  const siteVerdict = seo.siteVerdict;
  const modelNames = seo.modelNames;
  const ogPath = seo.ogPath;
  const catBodyHtml = seo.catBodyHtml;
  const catIcon = icons.catIcon || function () { return ""; };
  const modelIcon = icons.modelIcon || function () { return ""; };
  const voteIcon = icons.voteIcon || function () { return ""; };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initials(name) {
    const t = String(name || "?").replace(/\s+/g, "");
    return t.slice(0, 2).toUpperCase();
  }

  function fmtMs(ms) {
    if (ms == null || Number.isNaN(Number(ms))) return "—";
    const n = Number(ms);
    return n >= 1000 ? (n / 1000).toFixed(1) + "s" : Math.round(n) + "ms";
  }

  function fmtTime(v) {
    if (!v) return "尚未探测";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function avatar(site, large) {
    const cls = large ? "avatar-lg" : "avatar";
    if (site.logo && /^https?:/i.test(site.logo)) {
      return `<div class="${cls}"><img src="${esc(site.logo)}" alt="" referrerpolicy="no-referrer"></div>`;
    }
    return `<div class="${cls}">${esc(initials(site.name))}</div>`;
  }

  function sortStations(list) {
    const copy = list.slice();
    if (copy.length && copy.every((s) => (s.categories || []).includes("charity"))) {
      copy.sort((a, b) => (b.charityPin || 0) - (a.charityPin || 0) || String(a.name || "").localeCompare(String(b.name || ""), "zh"));
    }
    return copy;
  }

  function byCategory(data, cat) {
    const list = data.stations || [];
    if (cat === "online") return sortStations(list.filter((s) => s.status && s.status.online));
    if (cat === "other") {
      const tagged = new Set();
      list.forEach((s) => {
        if ((s.categories || []).some((c) => HOME_SECTIONS.includes(c))) tagged.add(s.id);
      });
      return sortStations(list.filter((s) => !tagged.has(s.id)));
    }
    return sortStations(list.filter((s) => (s.categories || []).includes(cat)));
  }

  function byModel(data, id) {
    return sortStations((data.stations || []).filter((s) => (s.models || []).some((m) => m.id === id)));
  }

  function featChips(site) {
    const feats = site.features || (site.categories || []).filter((c) => FEATURE_CHIPS.includes(c));
    return feats
      .filter((id) => FEATURE_CHIPS.includes(id))
      .map((id) => `<span class="feat">${catIcon(id)}${esc(CAT_LABEL[id] || id)}</span>`)
      .join("");
  }

  function votePairHtml(site) {
    const votes = site.votes || {};
    return `<div class="vote-pair" data-vote-wrap="${site.id}">
      <span class="vote-btn">${voteIcon("up")}<b>${votes.up || 0}</b></span>
      <span class="vote-btn">${voteIcon("down")}<b>${votes.down || 0}</b></span>
    </div>`;
  }

  function cardHtml(site) {
    const known = site.status && site.status.online != null;
    const online = site.status && site.status.online;
    const models = (site.models || [])
      .slice(0, 5)
      .map((m) => `<span class="model">${esc(m.label)}${m.rate ? " " + m.rate + "x" : ""}</span>`)
      .join("");
    return `<article class="card">
      <a class="card-link" href="${sitePath(site)}">
        <div class="card-head">
          ${avatar(site)}
          <div class="card-id">
            <h3 class="card-title">${esc(site.name)}</h3>
            <p class="card-sub">${esc(site.domain || site.tag || "第三方中转")}${site.promoted ? " · 精选" : ""}</p>
          </div>
          <span class="badge ${known ? (online ? "ok" : "bad") : "wait"}">${known ? (online ? "在线" : "异常") : "待测"}</span>
        </div>
        <p class="desc">${esc(site.description || "暂无简介，进去看整站状态和模型探测。")}</p>
        <div class="models">${featChips(site)}${models || `<span class="model">未标明模型</span>`}</div>
      </a>
      <div class="card-metrics">
        <span><small>可用</small><b>${site.status && site.status.uptime != null ? site.status.uptime + "%" : "—"}</b></span>
        <span><small>延迟</small><b>${fmtMs(site.status && (site.status.avgMs || site.status.ms))}</b></span>
        <span class="vote-cell"><small>投票</small>${votePairHtml(site)}</span>
      </div>
    </article>`;
  }

  function tocHtml(list) {
    if (!list.length) return "";
    return `<h2>全部收录</h2><p>本页 ${list.length} 站，名称可点进对照页。</p><ul class="seo-toc">${list
      .map((s) => `<li><a href="${sitePath(s)}">${esc(s.name)}</a></li>`)
      .join("")}</ul>`;
  }

  function cardsAndToc(list) {
    const shown = list.slice(0, CARD_CAP);
    return `<div class="grid">${shown.map(cardHtml).join("")}</div>${
      list.length > shown.length ? tocHtml(list) : list.length ? "" : `<div class="empty">这个分类里还没有站点</div>`
    }`;
  }

  function typeBlock(cat, list, preview) {
    const shown = list.slice(0, preview || PREVIEW_SIZE);
    const href = cat === "other" ? "" : catPath(cat);
    const title = `${catIcon(cat)}<span>${esc(CAT_LABEL[cat] || cat)}</span>`;
    const more =
      href && list.length > shown.length
        ? `<a class="btn" href="${href}">查看全部 ${list.length} 站</a>`
        : "";
    return `<section class="type-block" id="type-${esc(cat)}">
      <div class="type-head">
        <h2>${href ? `<a class="type-jump" href="${href}">${title}</a>` : title}</h2>
        <div class="type-actions"><span>${shown.length}/${list.length} 站</span>${more}</div>
      </div>
      <div class="grid">${shown.map(cardHtml).join("")}</div>
    </section>`;
  }

  function homeGrid(data) {
    const parts = [];
    HOME_SECTIONS.forEach((cat) => {
      const list = byCategory(data, cat);
      if (list.length) parts.push(typeBlock(cat, list, PREVIEW_SIZE));
    });
    const rest = byCategory(data, "other");
    if (rest.length) parts.push(typeBlock("other", rest, PREVIEW_SIZE));
    return parts.join("") || `<div class="empty">没有符合条件的中转站</div>`;
  }

  function officialChips(data) {
    return ((data && data.official) || [])
      .map((item) => {
        const up = ((item.components || []).map((c) => c.uptime).filter((n) => n != null));
        const avg = up.length ? (up.reduce((a, b) => a + b, 0) / up.length).toFixed(2) + "%" : "—";
        let short = "异常";
        if (item.level === "unknown") short = "未知";
        else if (item.level === "minor") short = "降级";
        else if (item.level === "major") short = "故障";
        else if (item.online) short = "正常";
        const dot = item.level === "minor" ? "warn" : item.online && item.level === "none" ? "on" : item.level === "unknown" ? "unknown" : "";
        return `<a class="off-chip ${dot}" href="${officialPath(item.provider)}"><span class="dot ${dot}"></span><span>${esc(item.label)}</span><strong>${avg}</strong><small>${esc(short)}</small></a>`;
      })
      .join("");
  }

  function catGrid(id, data) {
    const list = byCategory(data, id);
    const extra = CAT_SEO[id] || {};
    const label = CAT_LABEL[id] || id;
    const h1 = extra.h1 || label;
    const blurb = extra.desc || `${label}分类下的第三方 API 中转，先看探测再决定去哪家。`;
    const article = catBodyHtml
      ? catBodyHtml(id, { esc, includeHeading: false, includeToc: false, count: list.length })
      : "";
    return `<p class="cat-back crumbs"><a href="/">首页</a><span>/</span><a href="${catPath(id)}">${esc(label)}</a></p>
    <section class="type-block" id="type-${esc(id)}">
      <div class="type-head"><h1>${catIcon(id)}<span>${esc(h1)}</span></h1></div>
      <p class="seo-lead">${esc(blurb)} 本页 ${list.length} 站。</p>
      ${article ? `<article class="seo-article">${article}</article>` : ""}
      <div class="type-head"><h2 class="related-title">${esc(label)}站点列表</h2><div class="type-actions"><span>${Math.min(CARD_CAP, list.length)}/${list.length} 站</span></div></div>
      ${cardsAndToc(list)}
    </section>`;
  }

  function modelGrid(id, data) {
    const list = byModel(data, id);
    const extra = MODEL_SEO[id] || {};
    const label = MODEL_LABEL[id] || id;
    const h1 = extra.h1 || label;
    const blurb = extra.desc || `本站收录支持 ${label} 的 API 中转站，对照可用性与延迟后再充值。`;
    return `<p class="cat-back crumbs"><a href="/">首页</a><span>/</span><span>${esc(label)} 中转</span></p>
    <section class="type-block" id="model-${esc(id)}">
      <div class="type-head"><h1>${modelIcon(id)}<span>${esc(h1)}</span></h1></div>
      <p class="seo-lead">${esc(blurb)} 本页 ${list.length} 站。</p>
      <div class="type-head"><h2 class="related-title">支持 ${esc(label)} 的站点</h2><div class="type-actions"><span>${Math.min(CARD_CAP, list.length)}/${list.length} 站</span></div></div>
      ${cardsAndToc(list)}
    </section>`;
  }

  function siteDescHtml(text) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return `<p class="article">这份公开简介比较短，详情以对方站点为准。</p>`;
    return `<div class="site-desc"><p>${esc(raw)}</p></div>`;
  }

  function metricGridHtml(site) {
    const st = site.status || {};
    const up = st.uptime != null ? st.uptime + "%" : "待测";
    const upVotes = (site.votes && site.votes.up) || 0;
    const downVotes = (site.votes && site.votes.down) || 0;
    return `<div class="metric-grid">
      <div class="metric"><span>可用性</span><strong>${esc(up)}</strong><small>整站探测</small></div>
      <div class="metric"><span>平均延迟</span><strong>${fmtMs(st.avgMs)}</strong><small>多次平均</small></div>
      <div class="metric"><span>最近延迟</span><strong>${fmtMs(st.ms)}</strong><small>最近一次</small></div>
      <div class="metric"><span>投票</span><strong><em>${upVotes}</em><i>/</i><em>${downVotes}</em></strong><small>赞 / 踩</small></div>
    </div>`;
  }

  function modelRows(site) {
    const mentioned = site.models && site.models.length ? site.models : [];
    if (!mentioned.length) return `<p class="card-sub">简介未标明具体模型。</p>`;
    return mentioned
      .map((m) => {
        const siteOn = site.status && site.status.online;
        let label = "未标明";
        let cls = "";
        if (site.status && site.status.online == null) label = "待测";
        else if (!siteOn) {
          label = "整站异常";
          cls = "bad";
        } else {
          label = "已标明";
          cls = "ok";
        }
        return `<div class="model-row"><b>${esc(m.label)}</b><span class="badge ${cls}">${label}</span><span>${m.rate ? m.rate + "x 倍率" : "倍率未标明"}</span><small>${fmtMs(site.status && (site.status.avgMs || site.status.ms))}</small></div>`;
      })
      .join("");
  }

  function relatedStations(data, site, n) {
    const cats = site.categories || [];
    const cat = cats.includes("charity") ? "charity" : cats.find((c) => c !== "online") || cats[0];
    const pool = (data.stations || []).filter((s) => s.id !== site.id && (!cat || (s.categories || []).includes(cat)));
    return sortStations(pool).slice(0, n || 6);
  }

  function sitePage(site, data) {
    if (!site) return `<a class="back" href="/">← 返回</a><div class="empty">没有这个站点</div>`;
    const online = site.status && site.status.online;
    const models = modelNames(site);
    const modelText = models.slice(0, 6).join("、") || "未标明具体模型";
    const cats = site.categories || [];
    const cat = cats.includes("charity") ? "charity" : cats[0];
    const catLabel = CAT_LABEL[cat] || "API中转";
    const related = relatedStations(data, site, 6);
    const verdict = siteVerdict(site);
    const notes = verdict.notes || [];
    const isCharity = cats.includes("charity");
    return `<nav class="crumbs"><a href="/">首页</a><span>/</span>${
      cat ? `<a href="${catPath(cat)}">${esc(catLabel)}</a><span>/</span>` : ""
    }<span>${esc(site.name)}</span></nav>
    <aside class="verdict ${esc(verdict.id)}">
      <p class="verdict-kicker">本站结论 · 按探测和投票，不是官方鉴定</p>
      <strong>${esc(verdict.label)}</strong>
      <p>${esc(verdict.sentence)}</p>
      ${metricGridHtml(site)}
      ${notes.length ? `<p class="verdict-note">${notes.map((n) => esc(n)).join(" · ")}</p>` : ""}
    </aside>
    <section class="detail-hero">
      ${avatar(site, true)}
      <div>
        <h1>${esc(site.name)}${isCharity ? "（公益站）" : ""}</h1>
        <div class="models">
          <span class="badge ${site.status && site.status.online != null ? (online ? "ok" : "bad") : "wait"}">${
            site.status && site.status.online != null ? (online ? "整站在线" : "整站异常") : "尚未探测"
          }</span>
          <span class="badge">${esc(site.tag || "第三方中转")}</span>
          ${cats.map((c) => `<a class="model" href="${catPath(c)}">${esc(CAT_LABEL[c] || c)}</a>`).join("")}
          ${(site.models || []).slice(0, 6).map((m) => `<a class="model" href="${modelPath(m.id)}">${esc(m.label)}</a>`).join("")}
        </div>
        <p class="card-sub">${esc(site.domain || "")} · 最近探测 ${fmtTime(site.status && site.status.checkedAt)}</p>
      </div>
      <div class="detail-actions">
        ${votePairHtml(site)}
        ${site.url ? `<a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="${esc(site.url)}">访问站点</a>` : ""}
      </div>
    </section>
    <section class="panel">
      <h2>${esc(site.name)} 是什么中转站？</h2>
      <p class="article">${esc(site.name)}（${esc(site.domain || "第三方域名")}）是本站收录的 ${
        isCharity ? "公益 API 站" : "API 中转站"
      }。当前探测${site.status && site.status.online != null ? (online ? "在线" : "异常") : "尚未探测"}。模型与倍率来自站点简介，不代替官方渠道。</p>
    </section>
    <section class="panel">
      <h2>模型与倍率</h2>
      <p class="card-sub" style="margin-bottom:12px">简介里提到：${esc(modelText)}。以对方控制台为准。</p>
      <div class="model-table">${modelRows(site)}</div>
    </section>
    <section class="panel">
      <h2>站点说明</h2>
      ${siteDescHtml(site.description)}
    </section>
    ${
      related.length
        ? `<section><h2 class="related-title">${isCharity ? "同类公益站" : "同类 API 中转站"}</h2><div class="grid">${related
            .map(cardHtml)
            .join("")}</div></section>`
        : ""
    }`;
  }

  function officialPage(item, data) {
    if (!item) return `<a class="back" href="/">← 返回</a><div class="empty">还没有这家的官方状态</div>`;
    const list = (data && data.official) || [];
    const comps = (item.components || [])
      .map((c) => `<li class="svc-row"><span class="svc-name">${esc(c.label || c.name)}</span><em>${c.uptime != null ? c.uptime.toFixed(2) + "%" : esc(c.status || "未知")}</em></li>`)
      .join("");
    const events = (item.incidents || [])
      .slice(0, 8)
      .map((ev) => `<li><b>${esc(ev.title)}</b><p>${esc(ev.status || "")} · ${esc(ev.desc || "")}</p></li>`)
      .join("");
    return `<nav class="crumbs"><a href="/">首页</a><span>/</span><span>${esc(item.label)} 官方状态</span></nav>
    <section class="detail-hero"><div>
      <h1>${esc(item.label)} 官方状态 · 模型实况</h1>
      <p class="card-sub">${esc(item.status || "状态未知")}</p>
    </div></section>
    <p class="seo-lead">本页对照公开状态，不是官方站点。上游异常时，很多第三方中转会一起受影响。</p>
    <div class="off-tabs">${officialChips({ official: list })}</div>
    <article class="off-board">
      <div class="off-banner"><strong>${esc(item.status || "状态未知")}</strong><p>${esc(item.sub || item.raw || "")}</p></div>
      <h4>系统状态</h4>
      <ul class="svc-list">${comps || "<li>暂无组件数据</li>"}</ul>
      <h4>近期事件</h4>
      <ul class="event-list">${events || "<li>近期没有公开事件</li>"}</ul>
    </article>`;
  }

  function resultMeta(data, kind, id) {
    const g = (data && data.global) || {};
    const total = (data.stations || []).length;
    if (kind === "home") return `全部类型 <b>${total}</b> 站 · 探测在线 ${g.online || "—"}`;
    if (kind === "cat") {
      const n = byCategory(data, id).length;
      return `${esc(CAT_LABEL[id] || id)} <b>${n}</b> 站 · 探测在线 ${g.online || "—"}`;
    }
    if (kind === "model") {
      const n = byModel(data, id).length;
      return `${esc(MODEL_LABEL[id] || id)} <b>${n}</b> 站 · 探测在线 ${g.online || "—"}`;
    }
    return "";
  }

  function officialMeta(data) {
    return data && data.officialUpdatedAt ? "已同步官方订阅 · " + fmtTime(data.officialUpdatedAt) : "官方状态以公开订阅为准";
  }

  return {
    HOME_SECTIONS,
    PREVIEW_SIZE,
    CARD_CAP,
    byCategory,
    byModel,
    cardHtml,
    homeGrid,
    catGrid,
    modelGrid,
    sitePage,
    officialPage,
    officialChips,
    resultMeta,
    officialMeta,
  };
});
