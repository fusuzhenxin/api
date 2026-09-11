const PREVIEW_SIZE = 6;
const MORE_STEP = 12;
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
const TYPE_SECTIONS = HOME_SECTIONS;
const CAT_PAGE_SIZE = 24;
const FEATURE_CHIPS = ["charity", "checkin", "gift", "cheaprate", "fast", "pay", "invite", "crypto", "invoice"];
const NAV_CATS = [
  "all",
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
  "fav",
];
const FALLBACK_MODELS = [
  { id: "gpt", label: "GPT" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "grok", label: "Grok" },
  { id: "kimi", label: "Kimi" },
];

const MODEL_CHIPS = [
  { id: "gpt", label: "GPT" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
  { id: "grok", label: "Grok" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "kimi", label: "Kimi" },
  { id: "qwen", label: "Qwen" },
  { id: "glm", label: "GLM" },
  { id: "image", label: "生图" },
  { id: "video", label: "视频" },
];

const CATEGORY_LABEL = {
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
  charity: "公益站",
  other: "更多收录",
  online: "当前在线",
  fav: "我的收藏",
};

const state = {
  data: null,
  query: "",
  category: "all",
  model: "",
  page: 1,
  officialTab: "",
  expanded: {},
  sort: "",
  scrollTo: "",
  spyLock: 0,
  localVotes: {},
  myVotes: {},
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(s) {
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
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function avatar(site, large) {
  const cls = large ? "avatar-lg" : "avatar";
  if (site.logo && /^https?:/i.test(site.logo)) {
    return `<div class="${cls}"><img src="${escapeHtml(site.logo)}" alt="" referrerpolicy="no-referrer"></div>`;
  }
  return `<div class="${cls}">${escapeHtml(initials(site.name))}</div>`;
}

function toast(text) {
  const n = $("#toast");
  n.textContent = text;
  n.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => n.classList.remove("show"), 2200);
}

function route() {
  if (location.protocol === "file:") return parseRoute(location.hash.replace(/^#/, "") || "/");
  const r = parseRoute(location.pathname);
  if (r.name === "home" && location.hash) return parseRoute(location.hash.replace(/^#/, "") || "/");
  return r;
}

function jumpToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function go(path) {
  const next = String(path || "/").replace(/^#/, "");
  const url = next.startsWith("/") ? next : "/" + next;
  if (location.protocol === "file:") {
    location.hash = url;
    return;
  }
  if (location.pathname + location.search === url) {
    render();
    return;
  }
  history.pushState({}, "", url);
  render();
}

function paintSeo(r) {
  const ctx = { total: state.data && state.data.stations ? state.data.stations.length : 0 };
  if (r.name === "site" && state.data) ctx.station = state.data.stations.find((s) => s.id === r.id);
  if (r.name === "official" && state.data) ctx.official = ((state.data.official) || []).find((x) => x.provider === r.provider);
  if (r.name === "cat" && state.data) {
    const list = stationsByCategory(r.id);
    ctx.stations = r.id === "charity" ? list : [];
    ctx.count = list.length;
  }
  applySeo(seoFor(r, ctx));
}

function themeGlyph(light) {
  return light
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 14.3A9 9 0 0 1 9.7 3 7.2 7.2 0 1 0 21 14.3z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
}

function refreshThemeBtn() {
  const light = document.documentElement.getAttribute("data-theme") === "light";
  const btn = $("#themeBtn");
  if (btn) {
    btn.textContent = light ? "深色" : "浅色";
    btn.setAttribute("aria-label", light ? "切换到深色" : "切换到浅色");
  }
  const fab = $("#fabThemeBtn");
  if (fab) {
    fab.innerHTML = themeGlyph(light);
    fab.setAttribute("aria-label", light ? "切换到深色" : "切换到浅色");
    fab.setAttribute("title", light ? "切换到深色" : "切换到浅色");
  }
}

function refreshToTop() {
  const btn = $("#toTopBtn");
  if (btn) btn.classList.toggle("show", window.scrollY > 360);
}

function refreshWallet() {
  const el = $("#balance");
  if (el) el.textContent = loadUser().balance.toFixed(2);
  refreshThemeBtn();
}

function applySharedFilters(list) {
  if (state.model) list = list.filter((s) => (s.models || []).some((m) => m.id === state.model));
  const q = state.query.trim().toLowerCase();
  if (q) {
    list = list.filter((s) => {
      const bag = [s.name, s.domain, s.tag, s.description, ...(s.models || []).map((m) => m.label), ...(s.features || []).map((f) => CATEGORY_LABEL[f] || f)]
        .join(" ")
        .toLowerCase();
      return bag.includes(q);
    });
  }
  return list;
}

function stationsByModel(id) {
  let list = state.data.stations.filter((s) => (s.models || []).some((m) => m.id === id));
  const q = state.query.trim().toLowerCase();
  if (q) {
    list = list.filter((s) => {
      const bag = [s.name, s.domain, s.tag, s.description, ...(s.models || []).map((m) => m.label)]
        .join(" ")
        .toLowerCase();
      return bag.includes(q);
    });
  }
  return sortStations(list);
}

function stationsByCategory(cat) {
  if (cat === "other") return sortStations(otherStations());
  const user = loadUser();
  let list = state.data.stations.slice();
  if (cat === "online") list = list.filter((s) => s.status && s.status.online);
  else if (cat === "fav") list = list.filter((s) => user.favorites.includes(s.id));
  else if (cat && cat !== "all") list = list.filter((s) => (s.categories || []).includes(cat));
  return sortStations(applySharedFilters(list));
}

function siteLatencyMs(site) {
  const n = site && site.status && (site.status.avgMs || site.status.ms);
  const v = Number(n);
  return n > 0 && !Number.isNaN(v) ? v : null;
}

function sortStations(list) {
  const copy = list.slice();
  if (state.sort === "uptime") {
    copy.sort((a, b) => (b.status && b.status.uptime != null ? b.status.uptime : 0) - (a.status && a.status.uptime != null ? a.status.uptime : 0));
  } else if (state.sort === "latency") {
    const ms = (s) => {
      const n = s.status && (s.status.avgMs || s.status.ms);
      return n > 0 ? n : 9e9;
    };
    copy.sort((a, b) => ms(a) - ms(b));
  } else if (!state.sort && list.length && list.every((s) => (s.categories || []).includes("charity"))) {
    copy.sort((a, b) => (b.charityPin || 0) - (a.charityPin || 0) || String(a.name || "").localeCompare(String(b.name || ""), "zh"));
  }
  return copy;
}

function filteredStations() {
  return stationsByCategory(state.category);
}

function otherStations() {
  const tagged = new Set();
  for (const site of state.data.stations) {
    if ((site.categories || []).some((c) => TYPE_SECTIONS.includes(c))) tagged.add(site.id);
  }
  return applySharedFilters(state.data.stations.filter((s) => !tagged.has(s.id)));
}

function shownCount(key, total, base) {
  const floor = base || PREVIEW_SIZE;
  const v = state.expanded[key];
  if (v === true) return total;
  if (typeof v === "number") return Math.min(total, Math.max(floor, v));
  return Math.min(floor, total);
}

function moreButton(key, total, shown, mode) {
  if (mode === "page") return "";
  if (total <= shown) return "";
  if (mode === "link") {
    return `<a class="btn more-btn" href="${catPath(key)}">查看全部</a>`;
  }
  return `<button class="btn more-btn" type="button" data-more="${escapeHtml(key)}">查看更多（还有 ${total - shown}）</button>`;
}

function scrollSentinelHtml(shown, total) {
  if (!total) return "";
  const text = shown < total ? "下滑加载更多" : "已显示全部 " + total + " 站";
  return `<div class="scroll-more" id="scrollSentinel">${text}</div>`;
}

function pageListKey() {
  const r = route();
  if (r.name === "cat") return "page:" + r.id;
  if (r.name === "model") return "model:" + r.id;
  return "";
}

function paintScrollSentinel(shown, total) {
  const el = $("#scrollSentinel");
  if (!el) return;
  el.textContent = shown < total ? "下滑加载更多" : "已显示全部 " + total + " 站";
}

function loadMoreIfNeeded() {
  const key = pageListKey();
  if (!key || state.loadingMore) return;
  const list = listForMoreKey(key);
  const shown = shownCount(key, list.length, CAT_PAGE_SIZE);
  if (shown >= list.length) {
    paintScrollSentinel(shown, list.length);
    return;
  }
  state.loadingMore = true;
  const next = Math.min(list.length, shown + CAT_PAGE_SIZE);
  state.expanded[key] = next >= list.length ? true : next;
  const grid = document.querySelector("#grid .grid");
  if (grid) grid.insertAdjacentHTML("beforeend", list.slice(shown, next).map(cardHtml).join(""));
  const meta = document.querySelector("#grid .type-actions span");
  if (meta) meta.textContent = next + "/" + list.length + " 站";
  paintScrollSentinel(next, list.length);
  state.loadingMore = false;
  requestAnimationFrame(() => {
    const el = $("#scrollSentinel");
    if (el && el.getBoundingClientRect().top < window.innerHeight + 120) loadMoreIfNeeded();
  });
}

function observeScrollSentinel() {
  if (!bindInfiniteScroll._io) return;
  bindInfiniteScroll._io.disconnect();
  const el = $("#scrollSentinel");
  if (el) bindInfiniteScroll._io.observe(el);
}

function bindInfiniteScroll() {
  if (bindInfiniteScroll._io) return;
  bindInfiniteScroll._io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMoreIfNeeded();
    },
    { rootMargin: "320px 0px" }
  );
  observeScrollSentinel();
}

function renderSideNav() {
  if ($("#cats")) {
    $("#cats").innerHTML = NAV_CATS.map(
      (id) =>
        `<button class="filter${id === (state.category || "all") ? " active" : ""}" data-cat="${id}" type="button">${catIcon(id)}<span>${escapeHtml(CATEGORY_LABEL[id] || id)}</span></button>`
    ).join("");
  }
  if ($("#modelFilters")) {
    $("#modelFilters").innerHTML = MODEL_CHIPS.map(
      (m) =>
        `<button class="filter${state.model === m.id ? " active" : ""}" data-model="${escapeHtml(m.id)}" type="button">${modelIcon(m.id)}<span>${escapeHtml(m.label)}</span></button>`
    ).join("");
  }
}

function voteKey(id) {
  return String(id);
}

function myVote(id) {
  return state.myVotes[voteKey(id)] || "";
}

function extraVotes(id) {
  return state.localVotes[voteKey(id)] || { up: 0, down: 0 };
}

function applyLocalVotes() {
  if (!state.data || !state.data.stations) return;
  for (const site of state.data.stations) {
    if (!site._baseVotes) {
      site._baseVotes = {
        up: (site.votes && site.votes.up) || 0,
        down: (site.votes && site.votes.down) || 0,
      };
    }
    const extra = extraVotes(site.id);
    site.votes = {
      up: site._baseVotes.up + (extra.up || 0),
      down: site._baseVotes.down + (extra.down || 0),
    };
  }
}

function rememberLocalTally(id, data) {
  state.localVotes[voteKey(id)] = { up: data.up || 0, down: data.down || 0 };
  if (data.mine) state.myVotes[voteKey(id)] = data.mine;
  else delete state.myVotes[voteKey(id)];
  applyLocalVotes();
}

function optimisticVote(id, dir) {
  const extra = extraVotes(id);
  const prev = myVote(id);
  let up = extra.up || 0;
  let down = extra.down || 0;
  let mine = "";
  if (prev === dir) {
    if (dir === "up") up = Math.max(0, up - 1);
    else down = Math.max(0, down - 1);
  } else {
    if (prev === "up") up = Math.max(0, up - 1);
    if (prev === "down") down = Math.max(0, down - 1);
    if (dir === "up") up += 1;
    else down += 1;
    mine = dir;
  }
  return { up, down, mine };
}

function refreshVoteButtons() {
  applyLocalVotes();
  document.querySelectorAll("[data-vote-wrap]").forEach((box) => {
    const id = box.getAttribute("data-vote-wrap");
    const site = state.data && state.data.stations.find((s) => Number(s.id) === Number(id));
    if (site) box.outerHTML = votePairHtml(site);
  });
}

async function loadVotes() {
  try {
    const res = await fetch("/api/votes?voter=" + encodeURIComponent(voterId()), { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    state.localVotes = data.stations || {};
    state.myVotes = data.mine || {};
    refreshVoteButtons();
  } catch {
    /* file:// or vote store offline */
  }
}

function votePairHtml(site) {
  const votes = site.votes || {};
  const mine = myVote(site.id);
  return `
    <div class="vote-pair" data-vote-wrap="${site.id}">
      <button class="vote-btn${mine === "up" ? " on" : ""}" type="button" data-vote="up" data-id="${site.id}" aria-pressed="${mine === "up"}" title="点赞">
        ${voteIcon("up")}<b>${votes.up || 0}</b>
      </button>
      <button class="vote-btn${mine === "down" ? " on" : ""}" type="button" data-vote="down" data-id="${site.id}" aria-pressed="${mine === "down"}" title="点踩">
        ${voteIcon("down")}<b>${votes.down || 0}</b>
      </button>
    </div>`;
}

function paintVotes(id) {
  const site = state.data.stations.find((s) => Number(s.id) === Number(id));
  if (!site) return;
  document.querySelectorAll(`[data-vote-wrap="${id}"]`).forEach((box) => {
    box.outerHTML = votePairHtml(site);
  });
  const metric = $("#detail .metric[data-metric=votes] strong");
  if (metric && route().name === "site" && Number(route().id) === Number(id)) {
    const up = (site.votes && site.votes.up) || 0;
    const down = (site.votes && site.votes.down) || 0;
    metric.innerHTML = `<em>${up}</em><i>/</i><em>${down}</em>`;
  }
}

async function castVote(id, dir) {
  const prev = { extra: extraVotes(id), mine: myVote(id) };
  rememberLocalTally(id, optimisticVote(id, dir));
  paintVotes(id);
  try {
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(id), dir, voter: voterId() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "vote failed");
    rememberLocalTally(id, data);
    paintVotes(id);
    toast(data.mine === "up" ? "已点赞" : data.mine === "down" ? "已点踩" : "已取消投票");
  } catch (err) {
    console.warn(err);
    rememberLocalTally(id, { up: prev.extra.up || 0, down: prev.extra.down || 0, mine: prev.mine || "" });
    paintVotes(id);
    toast("投票没记下，请稍后再试");
  }
}

function catExtraHtml(cat, count) {
  if (typeof catBodyHtml === "function") {
    const html = catBodyHtml(cat, { esc: escapeHtml, includeHeading: false, includeToc: false, count });
    return html ? `<article class="seo-article">${html}</article>` : "";
  }
  return "";
}

function typeBlock(cat, list) {
  const shown = list.slice(0, PREVIEW_SIZE);
  const href = cat === "other" ? "" : catPath(cat);
  const title = `${catIcon(cat)}<span>${escapeHtml(CATEGORY_LABEL[cat] || cat)}</span>`;
  return `
    <section class="type-block" id="type-${escapeHtml(cat)}">
      <div class="type-head">
        <h2>${href ? `<a class="type-jump" href="${href}">${title}</a>` : title}</h2>
        <div class="type-actions">
          <span>${shown.length}/${list.length} 站</span>
          ${moreButton(cat, list.length, shown.length, "link")}
        </div>
      </div>
      <div class="grid">${shown.map(cardHtml).join("")}</div>
    </section>`;
}

function listForMoreKey(key) {
  if (key === "other" || key === "page:other") return otherStations();
  if (String(key).startsWith("model:")) return stationsByModel(key.slice(6));
  if (String(key).startsWith("page:")) return stationsByCategory(key.slice(5));
  return stationsByCategory(key);
}

function toggleMore(key) {
  if (!key) return;
  const total = listForMoreKey(key).length;
  const paged = String(key).startsWith("page:") || String(key).startsWith("model:");
  const base = paged ? CAT_PAGE_SIZE : PREVIEW_SIZE;
  const cur = shownCount(key, total, base);
  if (cur >= total) state.expanded[key] = base;
  else {
    const next = Math.min(total, cur + (paged ? CAT_PAGE_SIZE : MORE_STEP));
    state.expanded[key] = next >= total ? true : next;
  }
  const r = route();
  if (r.name === "cat") renderCatPage(r.id);
  else if (r.name === "model") renderModelPage(r.id);
  else renderHome();
}

function highlightModel(id) {
  const box = $("#modelFilters");
  if (!box) return;
  [...box.querySelectorAll("[data-model]")].forEach((n) => n.classList.toggle("active", !!id && n.dataset.model === id));
}

function highlightCat(cat) {
  const id = NAV_CATS.includes(cat) ? cat : "all";
  const box = $("#cats");
  if (!box) return;
  [...box.querySelectorAll("[data-cat]")].forEach((n) => n.classList.toggle("active", n.dataset.cat === id));
  revealCatInSidebar(id);
}

function revealCatInSidebar(cat) {
  const side = $(".sidebar");
  const btn = $("#cats") && $("#cats").querySelector(`[data-cat="${cat}"]`);
  if (!side || !btn) return;
  const sideRect = side.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const pad = 10;
  if (btnRect.top < sideRect.top + pad) side.scrollTop += btnRect.top - sideRect.top - pad;
  else if (btnRect.bottom > sideRect.bottom - pad) side.scrollTop += btnRect.bottom - sideRect.bottom + pad;
}

function currentSectionFromScroll() {
  const blocks = [...document.querySelectorAll("#grid .type-block[id]")];
  if (!blocks.length) return "all";
  const probe = 88;
  let current = "all";
  for (const el of blocks) {
    if (el.getBoundingClientRect().top <= probe) current = el.id.replace(/^type-/, "");
    else break;
  }
  return NAV_CATS.includes(current) ? current : current === "other" ? "all" : current;
}

function syncCatFromScroll() {
  if (route().name !== "home") return;
  if (Date.now() < (state.spyLock || 0)) return;
  const cat = currentSectionFromScroll();
  if (cat === state.category) return;
  state.category = cat;
  highlightCat(cat);
}

function bindScrollSpy() {
  if (bindScrollSpy._on) return;
  let tick = 0;
  const bump = () => {
    if (tick) return;
    tick = requestAnimationFrame(() => {
      tick = 0;
      syncCatFromScroll();
    });
  };
  window.addEventListener("scroll", bump, { passive: true });
  window.addEventListener("resize", bump);
  bindScrollSpy._on = true;
}

function scrollToCategory(cat) {
  state.spyLock = Date.now() + 900;
  state.category = cat || "all";
  highlightCat(cat || "all");
  if (!cat || cat === "all") {
    const top = $("#grid");
    if (top) top.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const el = document.getElementById("type-" + cat);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  go("/cat/" + cat);
}

function goHomeAndScroll(cat) {
  state.model = "";
  highlightModel("");
  if (route().name !== "home") {
    state.scrollTo = cat || "all";
    go("/");
    return;
  }
  if (!$("#grid") || !$("#grid").querySelector(".type-block")) renderHome();
  requestAnimationFrame(() => scrollToCategory(cat));
}

function officialDot(item) {
  if (item.online == null || item.level === "unknown") return "unknown";
  if (item.level === "minor") return "warn";
  if (item.online && item.level === "none") return "on";
  return "";
}

function officialUptime(item) {
  const ups = (item.components || []).map((c) => c.uptime).filter((n) => n != null);
  if (!ups.length) return null;
  return Number((ups.reduce((a, b) => a + b, 0) / ups.length).toFixed(2));
}

function officialShort(item) {
  if (item.level === "unknown") return "未知";
  if (item.level === "minor") return "降级";
  if (item.level === "major") return "故障";
  if (item.online) return "正常";
  return "异常";
}

function componentStatusText(status) {
  return (
    {
      operational: "正常",
      degraded_performance: "性能下降",
      partial_outage: "部分中断",
      major_outage: "严重中断",
      under_maintenance: "维护中",
      unknown: "未知",
    }[status] || status || "未知"
  );
}

function componentDot(status) {
  if (status === "operational") return "on";
  if (status === "degraded_performance" || status === "under_maintenance") return "warn";
  if (status === "unknown") return "unknown";
  return "";
}

function uptimeBar(days) {
  const list = days && days.length ? days : [];
  return `<div class="uptime-bar">${list
    .map((d) => `<i class="u ${d.level || "ok"}" title="${escapeHtml(d.date || "")}"></i>`)
    .join("")}</div>`;
}

function rangeLabel() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (90 - 1));
  return `${start.getFullYear()}年${start.getMonth() + 1}月 - ${end.getFullYear()}年${end.getMonth() + 1}月`;
}

function officialChip(item, active) {
  const up = officialUptime(item);
  const dot = officialDot(item);
  return `<a class="off-chip ${dot}${active ? " active" : ""}" href="${officialPath(item.provider)}">
    <span class="dot ${dot}"></span>
    <span>${escapeHtml(item.label)}</span>
    <strong>${up != null ? up.toFixed(2) + "%" : "—"}</strong>
    <small>${escapeHtml(officialShort(item))}</small>
  </a>`;
}

function officialBoard(item) {
  const comps = item.components || [];
  const rows = comps
    .map((c) => {
      const ok = c.status === "operational";
      return `
      <li class="svc-row">
        <span class="svc-check ${componentDot(c.status)}">${ok ? "✓" : "!"}</span>
        <span class="svc-name">${escapeHtml(c.label || c.name)}</span>
        ${uptimeBar(c.days)}
        <em class="${componentDot(c.status)}">${c.uptime != null ? c.uptime.toFixed(2) + "% 可用性" : componentStatusText(c.status)}</em>
      </li>`;
    })
    .join("");
  const events = (item.incidents || [])
    .map(
      (ev) => `
      <li>
        <span class="badge ${ev.open ? "bad" : "ok"}">${escapeHtml(ev.status)}</span>
        <div>
          <b>${escapeHtml(ev.title)}</b>
          <p>${escapeHtml(fmtTime(ev.date))} · ${escapeHtml(ev.desc || "")}</p>
        </div>
      </li>`
    )
    .join("");
  return `
    <article class="off-board">
      <div class="off-banner ${officialDot(item)}">
        <span class="svc-check ${officialDot(item)}">${item.level === "none" ? "✓" : "!"}</span>
        <div>
          <strong>${escapeHtml(item.status || "状态未知")}</strong>
          <p>${escapeHtml(item.sub || item.raw || "")}</p>
        </div>
      </div>
      <div class="svc-head">
        <h4>系统状态</h4>
        <span>${rangeLabel()}</span>
      </div>
      <ul class="svc-list">${rows || `<li class="svc-row">暂无组件数据</li>`}</ul>
      <h4>近期事件</h4>
      <ul class="event-list">${events || `<li>近期没有公开事件</li>`}</ul>
    </article>`;
}

function renderOfficial() {
  const box = $("#official");
  const list = (state.data && state.data.official) || [];
  const liveAt = state.data && state.data.officialUpdatedAt;
  if ($("#officialMeta")) {
    $("#officialMeta").textContent = liveAt
      ? "已同步官方订阅 · " + fmtTime(liveAt)
      : "正在同步官方状态…";
  }
  if (!box) return;
  if (!list.length) {
    box.innerHTML = `<div class="empty">还没有官方状态</div>`;
    return;
  }
  box.innerHTML = list.map((x) => officialChip(x, false)).join("");
}

function renderOfficialPage(provider) {
  const page = $("#officialPage");
  const list = (state.data && state.data.official) || [];
  const item = list.find((x) => x.provider === provider) || list[0];
  $("#home").hidden = true;
  $("#detail").hidden = true;
  page.hidden = false;
  if (!item) {
    page.innerHTML = `<a class="back" href="/">← 返回</a><div class="empty">还没有这家的官方状态</div>`;
    return;
  }
  window.scrollTo(0, 0);
  const up = officialUptime(item);
  const extra = (typeof OFFICIAL_SEO !== "undefined" && OFFICIAL_SEO[item.provider]) || {};
  const modelHint = (item.models || []).map((id) => (typeof MODEL_LABEL !== "undefined" && MODEL_LABEL[id]) || id).join("、") || item.label;
  page.innerHTML = `
    <nav class="crumbs"><a href="/">首页</a><span>/</span><span>${escapeHtml(item.label)} 官方状态</span></nav>
    <section class="detail-hero">
      <div>
        <h1>${escapeHtml(item.label)} 官方状态 · 模型实况</h1>
        <p class="card-sub">${escapeHtml(item.status || "状态未知")} · 近 90 天可用率 ${up != null ? up.toFixed(2) + "%" : "—"}</p>
      </div>
    </section>
    <p class="seo-lead">${escapeHtml(extra.desc || item.label + "官方状态对照，充值 API 中转前先看上游是否降级。")} 上游异常时，多数${escapeHtml(modelHint)}中转也会一起抖。</p>
    <div class="off-tabs">${list.map((x) => officialChip(x, x.provider === item.provider)).join("")}</div>
    ${officialBoard(item)}
    <section class="panel">
      <h2>常见问题</h2>
      <dl class="seo-faq">
        <dt>${escapeHtml(item.label)} 官方异常，中转站还能用吗？</dt>
        <dd>上游降级或故障时，很多第三方 ${escapeHtml(modelHint)} 中转会一起受影响。建议先看本页，再决定要不要充值。</dd>
        <dt>本站会链到官方状态站吗？</dt>
        <dd>不会。本页只在站内对照公开状态，方便和目录里的 API 中转站一起看。</dd>
      </dl>
    </section>
  `;
}

function officialForModel(model) {
  const list = (state.data && state.data.official) || [];
  const label = String(model.label || "").toLowerCase();
  const id = String(model.id || "").toLowerCase();
  return list.find(
    (item) =>
      String(item.label || "").toLowerCase() === label ||
      String(item.provider || "").toLowerCase() === id ||
      (item.models || []).includes(model.id)
  );
}

function renderHome() {
  const g = state.data.global || {};
  $("#home").hidden = false;
  $("#detail").hidden = true;
  if ($("#officialPage")) $("#officialPage").hidden = true;
  const sections = HOME_SECTIONS.slice();
  if (stationsByCategory("fav").length) sections.push("fav");
  const blocks = sections.map((cat) => ({ cat, list: stationsByCategory(cat) })).filter((row) => row.list.length);
  const rest = otherStations();
  const total = applySharedFilters(state.data.stations.slice()).length;
  $("#resultMeta").innerHTML = `全部类型 <b>${total}</b> 站 · 全库 ${state.data.stations.length} · 探测在线 ${g.online || "—"}`;
  const parts = [];
  blocks.forEach((row) => {
    parts.push(typeBlock(row.cat, row.list));
  });
  if (rest.length) parts.push(typeBlock("other", rest));
  $("#grid").innerHTML = parts.length ? parts.join("") : `<div class="empty">没有符合条件的中转站</div>`;
  $("#pager").innerHTML = "";
  if (state.scrollTo) {
    const id = state.scrollTo;
    state.scrollTo = "";
    requestAnimationFrame(() => scrollToCategory(id));
  } else {
    requestAnimationFrame(() => syncCatFromScroll());
  }
}

function keepStaticCards() {
  return !!($("#grid") && $("#grid").querySelector(".card"));
}

function renderCatPage(cat) {
  const g = state.data.global || {};
  $("#home").hidden = false;
  $("#detail").hidden = true;
  if ($("#officialPage")) $("#officialPage").hidden = true;
  highlightCat(cat);
  const list = stationsByCategory(cat);
  if (!list.length && keepStaticCards()) return;
  const key = "page:" + cat;
  const shownN = shownCount(key, list.length, CAT_PAGE_SIZE);
  const slice = list.slice(0, shownN);
  const extra = (typeof CAT_SEO !== "undefined" && CAT_SEO[cat]) || {};
  const label = CATEGORY_LABEL[cat] || cat;
  const h1 = extra.h1 || label;
  const blurb = extra.desc || `${label}分类下的 API 中转站，对照 ChatGPT、Claude、DeepSeek 可用性与延迟。`;
  $("#resultMeta").innerHTML = `${escapeHtml(label)} <b>${list.length}</b> 站 · 探测在线 ${g.online || "—"}`;
  $("#grid").innerHTML = `
    <p class="cat-back crumbs"><a href="/">首页</a><span>/</span><a href="${catPath(cat)}">${escapeHtml(label)}</a></p>
    <section class="type-block" id="type-${escapeHtml(cat)}">
      <div class="type-head">
        <h1>${catIcon(cat)}<span>${escapeHtml(h1)}</span></h1>
      </div>
      <p class="seo-lead">${escapeHtml(blurb)} 本页 ${list.length} 站。</p>
      ${catExtraHtml(cat, list.length)}
      <div class="type-head">
        <h2 class="related-title">${escapeHtml(label)}站点列表</h2>
        <div class="type-actions">
          <span>${shownN}/${list.length} 站</span>
          ${moreButton(key, list.length, shownN, "page")}
        </div>
      </div>
      <div class="grid">${slice.map(cardHtml).join("")}</div>
      ${scrollSentinelHtml(shownN, list.length)}
    </section>
    ${slice.length ? "" : `<div class="empty">这个分类里还没有站点</div>`}`;
  $("#pager").innerHTML = "";
  observeScrollSentinel();
}

function renderModelPage(id) {
  const g = state.data.global || {};
  $("#home").hidden = false;
  $("#detail").hidden = true;
  if ($("#officialPage")) $("#officialPage").hidden = true;
  highlightCat("all");
  highlightModel(id);
  const list = stationsByModel(id);
  if (!list.length && keepStaticCards()) return;
  const key = "model:" + id;
  const shownN = shownCount(key, list.length, CAT_PAGE_SIZE);
  const slice = list.slice(0, shownN);
  const extra = (typeof MODEL_SEO !== "undefined" && MODEL_SEO[id]) || {};
  const label = (typeof MODEL_LABEL !== "undefined" && MODEL_LABEL[id]) || id;
  const h1 = extra.h1 || label + " API中转站推荐";
  const blurb = extra.desc || `本站收录支持 ${label} 的 API 中转站，对照可用性与延迟后再充值。`;
  $("#resultMeta").innerHTML = `${escapeHtml(label)} <b>${list.length}</b> 站 · 探测在线 ${g.online || "—"}`;
  $("#grid").innerHTML = `
    <p class="cat-back crumbs"><a href="/">首页</a><span>/</span><span>${escapeHtml(label)} 中转</span></p>
    <section class="type-block" id="model-${escapeHtml(id)}">
      <div class="type-head">
        <h1>${modelIcon(id)}<span>${escapeHtml(h1)}</span></h1>
      </div>
      <p class="seo-lead">${escapeHtml(blurb)} 本页 ${list.length} 站。也可按<a href="${catPath("charity")}">公益站</a>、<a href="${catPath("cheaprate")}">低倍率</a>、<a href="${catPath("checkin")}">签到送余额</a>、<a href="${catPath("pay")}">国内支付</a>。</p>
      <ol class="pick-tips">
        <li>先看探测在线和延迟，再看投票。</li>
        <li>便宜不等于每个模型都通，先小额实测。</li>
        <li>详情页顶部有「相对稳 / 一般 / 慎充」结论，不是官方鉴定。</li>
      </ol>
      <div class="type-head">
        <h2 class="related-title">支持 ${escapeHtml(label)} 的站点</h2>
        <div class="type-actions">
          <span>${shownN}/${list.length} 站</span>
          ${moreButton(key, list.length, shownN, "page")}
        </div>
      </div>
      <div class="grid">${slice.map(cardHtml).join("")}</div>
      ${scrollSentinelHtml(shownN, list.length)}
    </section>
    ${slice.length ? "" : `<div class="empty">还没有标明该模型的站点</div>`}`;
  $("#pager").innerHTML = "";
  observeScrollSentinel();
}

function featChips(site) {
  const feats = site.features || (site.categories || []).filter((c) => FEATURE_CHIPS.includes(c));
  return feats
    .filter((id) => FEATURE_CHIPS.includes(id))
    .map((id) => `<span class="feat">${catIcon(id)}${escapeHtml(CATEGORY_LABEL[id] || id)}</span>`)
    .join("");
}

function cardHtml(site) {
  const known = site.status && site.status.online != null;
  const online = site.status && site.status.online;
  const models = (site.models || [])
    .slice(0, 5)
    .map((m) => `<span class="model">${escapeHtml(m.label)}${m.rate ? " " + m.rate + "x" : ""}</span>`)
    .join("");
  return `
    <article class="card">
      <a class="card-link" href="${sitePath(site)}">
        <div class="card-head">
          ${avatar(site)}
          <div class="card-id">
            <h3 class="card-title">${escapeHtml(site.name)}</h3>
            <p class="card-sub">${escapeHtml(site.domain || site.tag || "第三方中转")}${site.promoted ? " · 精选" : ""}</p>
          </div>
          <span class="badge ${known ? (online ? "ok" : "bad") : "wait"}">${known ? (online ? "在线" : "异常") : "待测"}</span>
        </div>
        <p class="desc">${escapeHtml(site.description || "暂无简介，进去看整站状态和模型探测。")}</p>
        <div class="models">${featChips(site)}${models || `<span class="model">未标明模型</span>`}</div>
      </a>
      <div class="card-metrics">
        <span><small>可用</small><b>${site.status && site.status.uptime != null ? site.status.uptime + "%" : "—"}</b></span>
        <span><small>延迟</small><b>${fmtMs(site.status && (site.status.avgMs || site.status.ms))}</b></span>
        <span class="vote-cell"><small>投票</small>${votePairHtml(site)}</span>
      </div>
    </article>`;
}

function modelRows(site) {
  const mentioned = site.models && site.models.length ? site.models : FALLBACK_MODELS.map((m) => ({ ...m, mentioned: false }));
  return mentioned.map((m) => {
    const up = officialForModel(m);
    const siteOn = site.status && site.status.online;
    let label = "未标明";
    let cls = "";
    if (!siteOn) {
      label = "整站异常";
      cls = "bad";
    } else if (m.mentioned) {
      label = "已标明可用";
      cls = "ok";
    } else if (siteOn) {
      label = "整站在线";
      cls = "ok";
    }
    if (up && up.online === false) {
      label = up.level === "minor" ? "上游降级" : "上游异常";
      cls = "bad";
    }
    const ms = (up && up.ms) || (site.status && (site.status.avgMs || site.status.ms));
    const width = Math.max(8, Math.min(100, 100 - Number(ms || 800) / 40));
    return `
      <div class="model-row">
        <b>${escapeHtml(m.label)}</b>
        <span class="badge ${cls}">${label}</span>
        <span>${m.rate ? m.rate + "x 倍率" : "倍率未标明"}</span>
        <div>
          <div class="bar"><i style="width:${width}%"></i></div>
          <small>${fmtMs(ms)}</small>
        </div>
      </div>`;
  }).join("");
}

function splitSiteDesc(text) {
  const raw = String(text || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  if (!raw) return [];
  const emoji = /\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*/gu;
  const lines = [];
  for (const chunk of raw.split(/\n+/)) {
    const rest = chunk.replace(/^\s*[-•·]+\s*/, "").trim();
    if (!rest) continue;
    const marks = [];
    emoji.lastIndex = 0;
    let m;
    while ((m = emoji.exec(rest))) marks.push(m.index);
    if (!marks.length) {
      lines.push(rest.replace(/\s+/g, " ").trim());
      continue;
    }
    if (marks[0] > 0) {
      const lead = rest.slice(0, marks[0]).replace(/^\s*[-•·]+\s*/, "").trim();
      if (lead) lines.push(lead.replace(/\s+/g, " "));
    }
    for (let i = 0; i < marks.length; i++) {
      const end = i + 1 < marks.length ? marks[i + 1] : rest.length;
      const piece = rest
        .slice(marks[i], end)
        .replace(/^\s*[-•·]+\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (piece) lines.push(piece);
    }
  }
  return lines.filter(Boolean);
}

function decorateDescLine(line) {
  return escapeHtml(line).replace(
    /(7\s*[×xX]\s*24|\d+(?:\.\d+)?\s*%|\$\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:美元|刀|元)|¥\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*[x×X](?!\s*24)|\d+\s*ms|\d+(?:\.\d+)?\s*[sS]|CN2(?:\s*GIA)?|k8s|K8s)/g,
    '<b class="desc-num">$1</b>'
  );
}

function siteDescHtml(text) {
  const lines = splitSiteDesc(text);
  if (!lines.length) {
    return `<p class="article">这份公开简介比较短，详情以对方站点为准。</p>`;
  }
  return `<div class="site-desc">${lines.map((line) => `<p>${decorateDescLine(line)}</p>`).join("")}</div>`;
}

function metricTone(kind, site) {
  const st = site.status || {};
  if (kind === "up") {
    if (typeof st.uptime !== "number") return "";
    if (st.uptime >= 95) return "good";
    if (st.uptime < 80) return "bad";
    return "mid";
  }
  if (kind === "avg" || kind === "ms") {
    const ms = kind === "avg" ? st.avgMs : st.ms;
    if (ms == null || Number.isNaN(Number(ms))) return "";
    if (Number(ms) < 2000) return "good";
    if (Number(ms) >= 4000) return "bad";
    return "mid";
  }
  if (kind === "votes") {
    const up = (site.votes && site.votes.up) || 0;
    const down = (site.votes && site.votes.down) || 0;
    if (!up && !down) return "";
    if (down >= 3 && down > up) return "bad";
    if (up > down) return "good";
    return "mid";
  }
  return "";
}

function metricGridHtml(site) {
  const st = site.status || {};
  const up = st.uptime != null ? st.uptime + "%" : "待测";
  const upVotes = (site.votes && site.votes.up) || 0;
  const downVotes = (site.votes && site.votes.down) || 0;
  return `
    <div class="metric-grid">
      <div class="metric ${metricTone("up", site)}">
        <span>可用性</span>
        <strong>${escapeHtml(up)}</strong>
        <small>整站探测</small>
      </div>
      <div class="metric ${metricTone("avg", site)}">
        <span>平均延迟</span>
        <strong>${fmtMs(st.avgMs)}</strong>
        <small>多次平均</small>
      </div>
      <div class="metric ${metricTone("ms", site)}">
        <span>最近延迟</span>
        <strong>${fmtMs(st.ms)}</strong>
        <small>最近一次</small>
      </div>
      <div class="metric ${metricTone("votes", site)}" data-metric="votes">
        <span>投票</span>
        <strong><em>${upVotes}</em><i>/</i><em>${downVotes}</em></strong>
        <small>赞 / 踩</small>
      </div>
    </div>`;
}

function relatedStations(site, n) {
  const cats = site.features || site.categories || [];
  const cat = cats.includes("charity") ? "charity" : cats.find((c) => c !== "online") || cats[0];
  const pool = state.data.stations.filter((s) => s.id !== site.id && (!cat || (s.categories || []).includes(cat)));
  return sortStations(pool).slice(0, n || 6);
}

function renderDetail(id) {
  const site = state.data.stations.find((s) => s.id === id);
  $("#home").hidden = true;
  $("#detail").hidden = false;
  if (!site) {
    $("#detail").innerHTML = `<a class="back" href="/">← 返回</a><div class="empty">没有这个站点</div>`;
    return;
  }
  rememberView(id);
  const online = site.status && site.status.online;
  const fav = isFav(id);
  const checks = site.checks || [];
  const models = modelNames(site);
  const modelText = models.slice(0, 6).join("、") || "未标明具体模型";
  const cats = site.features || site.categories || [];
  const cat = cats.includes("charity") ? "charity" : cats[0];
  const catLabel = CATEGORY_LABEL[cat] || "API中转";
  const related = relatedStations(site, 6);
  const verdict = siteVerdict(site);
  const notes = verdict.notes || [];
  const cardUrl = ogPath(site);
  $("#detail").innerHTML = `
    <nav class="crumbs"><a href="/">首页</a><span>/</span>${cat ? `<a href="${catPath(cat)}">${escapeHtml(catLabel)}</a><span>/</span>` : ""}<span>${escapeHtml(site.name)}</span></nav>
    <aside class="verdict ${escapeHtml(verdict.id)}">
      <p class="verdict-kicker">本站结论 · 按探测和投票，不是官方鉴定</p>
      <strong>${escapeHtml(verdict.label)}</strong>
      <p>${escapeHtml(verdict.sentence)}</p>
      ${metricGridHtml(site)}
      ${notes.length ? `<p class="verdict-note">${notes.map((n) => escapeHtml(n)).join(" · ")}</p>` : ""}
    </aside>
    <section class="detail-hero">
      ${avatar(site, true)}
      <div>
        <h1>${escapeHtml(site.name)}${(site.categories || []).includes("charity") ? "（公益站）" : ""}</h1>
        <div class="models">
          <span class="badge ${site.status && site.status.online != null ? (online ? "ok" : "bad") : "wait"}">${site.status && site.status.online != null ? (online ? "整站在线" : "整站异常") : "尚未探测"}</span>
          ${site.promoted ? `<span class="badge">精选</span>` : ""}
          <span class="badge">${escapeHtml(site.tag || "第三方中转")}</span>
          ${(site.features || site.categories || []).map((c) => `<a class="model" href="${catPath(c)}">${catIcon(c)}${escapeHtml(CATEGORY_LABEL[c] || c)}</a>`).join("")}
          ${(site.models || []).slice(0, 6).map((m) => `<a class="model" href="${modelPath(m.id)}">${escapeHtml(m.label)}${m.rate ? " " + m.rate + "x" : ""}</a>`).join("")}
        </div>
        <p class="card-sub">${escapeHtml(site.domain || "")} · 最近探测 ${fmtTime(site.status && site.status.checkedAt)}</p>
      </div>
      <div class="detail-actions">
        ${votePairHtml(site)}
        <button class="btn" data-fav="${site.id}">${fav ? "已收藏" : "收藏"}</button>
        <button class="btn" type="button" data-share="link">复制链接</button>
        <a class="btn" href="${cardUrl}" target="_blank" rel="noopener noreferrer">分享图</a>
        ${site.url ? `<a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="${escapeHtml(site.url)}">访问站点</a>` : ""}
      </div>
    </section>
    <section class="panel">
      <h2>${escapeHtml(site.name)} 是什么中转站？</h2>
      <p class="article">${escapeHtml(site.name)}（${escapeHtml(site.domain || "第三方域名")}）是本站收录的 ${ (site.categories || []).includes("charity") ? "公益 API 站" : "API 中转站"}，常见用途是对接 ChatGPT、Claude、DeepSeek、Gemini 等模型。当前探测${site.status && site.status.online != null ? (online ? "在线" : "异常") : "尚未探测"}。页面里的模型与倍率来自站点简介，不代替官方渠道。</p>
    </section>
    <section class="panel">
      <h2>模型与倍率</h2>
      <p class="card-sub" style="margin-bottom:12px">简介里提到：${escapeHtml(modelText)}。再叠加整站探测和官方上游状态。未写明的模型按整站状态估算，充值前建议小额实测。</p>
      <div class="model-table">${modelRows(site)}</div>
    </section>
    ${
      checks.length
        ? `<section class="panel"><h2>近 24 小时探测</h2><div class="timeline">${checks
            .map((c) => `<i class="seg ${c.online ? "on" : "off"}" title="${escapeHtml(fmtTime(c.checkedAt))} · ${fmtMs(c.ms)}"></i>`)
            .join("")}</div></section>`
        : ""
    }
    <section class="panel">
      <h2>站点说明</h2>
      ${siteDescHtml(site.description)}
    </section>
    <section class="panel">
      <h2>常见问题</h2>
      <dl class="seo-faq">
        <dt>${escapeHtml(site.name)} 支持哪些模型？</dt>
        <dd>${escapeHtml(modelText)}。具体以对方控制台为准，本站按简介提取标签。</dd>
        <dt>延迟和可用性怎么看？</dt>
        <dd>可用率来自整站探测，延迟是最近几次访问耗时。在线不等于每个模型都通，ChatGPT 中转、Claude API 仍建议先小额测试。</dd>
        <dt>${(site.categories || []).includes("charity") ? escapeHtml(site.name) + " 是公益站吗？" : "怎么充值更稳妥？"}</dt>
        <dd>${
          (site.categories || []).includes("charity")
            ? `本站把它归在<a href="${catPath("charity")}">公益站</a>/免费API。额度以对方页面为准，可能随时关停，请勿压测囤号。本站不代收、不保证额度。`
            : `先看本页探测和投票，再去对方站小额充值。${cat ? `同类还可看<a href="${catPath(cat)}">${escapeHtml(catLabel)} API中转站</a>。` : ""}本站不代收、不保证额度。`
        }</dd>
      </dl>
    </section>
    ${
      related.length
        ? `<section><h2 class="related-title">${(site.categories || []).includes("charity") ? "同类公益站" : "同类 API 中转站"}</h2><div class="grid">${related.map(cardHtml).join("")}</div></section>`
        : ""
    }
  `;
}

function render() {
  const seoStatic = $("#seoStatic");
  if (seoStatic) seoStatic.remove();
  refreshWallet();
  if (location.protocol !== "file:" && /^\/rank(\/|$)/i.test(location.pathname)) {
    history.replaceState({}, "", "/");
  }
  const r = route();
  const key = r.name + ":" + (r.id || r.provider || "");
  const routeChanged = render._route !== key;
  render._route = key;
  if (routeChanged) state.loadingMore = false;
  const officialPage = $("#officialPage");
  if ($("#home")) {
    $("#home").classList.toggle("is-cat", r.name === "cat" || r.name === "model");
  }
  if (r.name === "site") {
    if (officialPage) officialPage.hidden = true;
    highlightModel("");
    renderDetail(r.id);
  } else if (r.name === "official") {
    highlightModel("");
    renderOfficialPage(r.provider);
  } else if (r.name === "cat") {
    if (officialPage) officialPage.hidden = true;
    highlightModel("");
    renderCatPage(r.id);
  } else if (r.name === "model") {
    if (officialPage) officialPage.hidden = true;
    state.model = r.id;
    renderModelPage(r.id);
  } else {
    if (officialPage) officialPage.hidden = true;
    if (location.protocol !== "file:") {
      const q = new URLSearchParams(location.search).get("q") || "";
      state.query = q;
      if ($("#q")) $("#q").value = q;
    }
    state.model = "";
    highlightModel("");
    renderHome();
  }
  paintSeo(r);
  if (routeChanged && r.name !== "home") {
    jumpToTop();
    requestAnimationFrame(jumpToTop);
  }
}

function openCheckin() {
  const user = loadUser();
  const reward = checkinReward(user.lastCheckin === todayKey() ? user.streak : user.streak + 1 || 1);
  $("#drawerMask").classList.add("show");
  $("#drawerBody").innerHTML = `
    <h3>我的</h3>
    <p>本站探币只记在这台电脑上。中转站自己的签到送余额，请看左侧「签到送余额」分类，那才是对方站给的额度。</p>
    <p>当前余额 <span class="balance">${user.balance.toFixed(2)}</span> · 连续 <span class="streak">${user.streak}</span> 天</p>
    <p>${canCheckin(user) ? `今日可领约 ${reward.toFixed(2)} 探币` : "今天已经签过了，明天再来。"}</p>
    <div class="wallet">
      <button class="btn btn-primary" id="doCheckin" ${canCheckin(user) ? "" : "disabled"}>立刻签到</button>
      <button class="btn" id="closeDrawer">关闭</button>
    </div>
  `;
}

function bind() {
  if ($("#contactTop")) {
    $("#contactTop").addEventListener("click", (e) => {
      e.preventDefault();
      const el = $("#contact");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.query = $("#q").value.trim();
    state.page = 1;
    state.expanded = {};
    go(state.query ? "/?q=" + encodeURIComponent(state.query) : "/");
  });
  $("#randomBtn").addEventListener("click", () => {
    const list = filteredStations();
    if (!list.length) return toast("当前筛选下没有站点");
    const pick = list[Math.floor(Math.random() * list.length)];
    go(sitePath(pick));
  });
  if ($("#checkinSitesBtn")) {
    $("#checkinSitesBtn").addEventListener("click", () => {
      state.category = "checkin";
      goHomeAndScroll("checkin");
    });
  }
  if ($("#meBtn")) $("#meBtn").addEventListener("click", openCheckin);
  if ($("#sorts")) {
    $("#sorts").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sort]");
      if (!btn) return;
      state.sort = btn.dataset.sort || "";
      [...$("#sorts").querySelectorAll("[data-sort]")].forEach((n) => n.classList.toggle("active", n === btn));
      const r = route();
      if (r.name === "cat") renderCatPage(r.id);
      else if (r.name === "model") renderModelPage(r.id);
      else renderHome();
    });
  }
  const onToggleTheme = () => {
    toggleTheme();
    refreshThemeBtn();
  };
  if ($("#themeBtn")) $("#themeBtn").addEventListener("click", onToggleTheme);
  if ($("#fabThemeBtn")) $("#fabThemeBtn").addEventListener("click", onToggleTheme);
  if ($("#toTopBtn")) {
    $("#toTopBtn").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }
  window.addEventListener("scroll", refreshToTop, { passive: true });
  refreshToTop();
  if ($("#officialRefresh")) {
    $("#officialRefresh").addEventListener("click", () => refreshOfficialStatus());
  }
  $("#cats").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    state.category = btn.dataset.cat;
    state.page = 1;
    goHomeAndScroll(btn.dataset.cat);
  });
  $("#modelFilters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-model]");
    if (!btn) return;
    const id = btn.dataset.model;
    state.page = 1;
    state.expanded = {};
    if (route().name === "model" && route().id === id) {
      state.model = "";
      go("/");
      return;
    }
    state.model = id;
    go(modelPath(id));
  });
  $("#grid").addEventListener("click", (e) => {
    const vote = e.target.closest("[data-vote]");
    if (vote) {
      e.preventDefault();
      castVote(vote.dataset.id, vote.dataset.vote);
      return;
    }
    const btn = e.target.closest("[data-more]");
    if (!btn) return;
    toggleMore(btn.dataset.more);
  });
  $("#pager").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-more]");
    if (!btn) return;
    toggleMore(btn.dataset.more);
  });
  $("#detail").addEventListener("click", (e) => {
    const vote = e.target.closest("[data-vote]");
    if (vote) {
      castVote(vote.dataset.id, vote.dataset.vote);
      return;
    }
    const share = e.target.closest("[data-share]");
    if (share && share.dataset.share === "link") {
      const url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          () => toast("链接已复制"),
          () => toast(url)
        );
      } else {
        toast(url);
      }
      return;
    }
    const btn = e.target.closest("[data-fav]");
    if (!btn) return;
    toggleFav(btn.dataset.fav);
    render();
    toast(isFav(btn.dataset.fav) ? "已加入收藏" : "已取消收藏");
  });
  $("#drawerMask").addEventListener("click", (e) => {
    if (e.target.id === "drawerMask" || e.target.id === "closeDrawer") {
      $("#drawerMask").classList.remove("show");
    }
    if (e.target.id === "doCheckin") {
      const res = doCheckin();
      refreshWallet();
      $("#drawerMask").classList.remove("show");
      toast(res.already ? "今天已经签过了" : `签到成功，+${res.added} 探币`);
    }
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("popstate", render);
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("//") || href.startsWith("/api/") || href.startsWith("mailto:")) return;
    if (!href.startsWith("/")) return;
    if (/\.(xml|json|txt|png|ico|svg|css|js|jpe?g|webp)$/i.test(href)) return;
    e.preventDefault();
    go(href);
  });
  bindScrollSpy();
  bindInfiniteScroll();
}

async function loadData() {
  if (window.__STATIONS_DATA__) return window.__STATIONS_DATA__;
  const res = await fetch("/data/stations.json", { cache: "no-store" });
  if (!res.ok) throw new Error("missing data");
  return res.json();
}

async function refreshOfficialStatus() {
  if ($("#officialMeta")) $("#officialMeta").textContent = "正在同步官方状态…";
  try {
    const list = await fetchOfficialLive((state.data && state.data.official) || []);
    if (!state.data) state.data = {};
    state.data.official = list;
    state.data.officialUpdatedAt = new Date().toISOString();
    renderOfficial();
    const r = route();
    if (r.name === "site") renderDetail(r.id);
    if (r.name === "official") renderOfficialPage(r.provider);
  } catch (err) {
    if ($("#officialMeta")) $("#officialMeta").textContent = "官方状态同步失败";
    console.warn(err);
  }
}

async function boot() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (location.protocol !== "file:" && /^#\/(site|cat|official|model)/.test(location.hash)) {
    history.replaceState({}, "", location.hash.slice(1));
  }
  const bootQ = new URLSearchParams(location.search).get("q");
  if (bootQ) {
    state.query = bootQ;
    if ($("#q")) $("#q").value = bootQ;
  }
  applyTheme(loadTheme());
  renderSideNav();
  bind();
  try {
    state.data = await loadData();
  } catch {
    $("#app").innerHTML = `<div class="empty">还没有本地数据。在项目目录运行 <code>node scripts/scrape.js</code> 后再打开。</div>`;
    return;
  }
  $("#updatedAt").textContent = "数据更新于 " + fmtTime(state.data.updatedAt);
  renderOfficial();
  render();
  loadVotes();
  refreshOfficialStatus();
}

boot();
