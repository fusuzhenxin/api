(function () {
  if (window.__vdVisit) return;
  window.__vdVisit = 1;
  if (location.protocol === "file:") return;
  if (navigator.webdriver) return;

  var ua = navigator.userAgent || "";
  if (/ahrefs|mj12bot|bingbot|yandex|shapbot|bytespider|baiduspider|spider|crawler|\bbot\b/i.test(ua)) return;

  function dayKey() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch (err) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function kind() {
    var path = location.pathname || "/";
    if (path.length > 1 && path.charAt(path.length - 1) === "/") path = path.slice(0, -1);
    if (path === "/" || path === "") return "home";
    if (path === "/check" || path.indexOf("/check/") === 0) return "check";
    if (path.indexOf("/cat/") === 0) return "cat";
    if (path.indexOf("/site/") === 0) return "site";
    if (path.indexOf("/model/") === 0) return "model";
    if (path.indexOf("/official/") === 0) return "official";
    if (path === "/apply") return "apply";
    return "other";
  }

  function visitorId() {
    var key = "vd-visit-id";
    try {
      var existing = localStorage.getItem(key) || "";
      if (/^[a-z0-9]{16,48}$/.test(existing)) return existing;
      var bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      var alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
      var id = "";
      for (var i = 0; i < bytes.length; i += 1) id += alphabet[bytes[i] % alphabet.length];
      localStorage.setItem(key, id);
      return id;
    } catch (err) {
      return "";
    }
  }

  function send() {
    var today = dayKey();
    var seen = "vd-visit-day";
    try {
      if (localStorage.getItem(seen) === today) return;
    } catch (err) {
      return;
    }
    var id = visitorId();
    if (!id) return;
    try {
      localStorage.setItem(seen, today);
    } catch (err) {
      return;
    }
    fetch("/api/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: id, kind: kind() }),
      keepalive: true,
    }).catch(function () {});
  }

  var opts = { capture: true, passive: true };
  function once(ev) {
    if (!ev || ev.isTrusted === false) return;
    window.removeEventListener("pointerdown", once, true);
    window.removeEventListener("keydown", once, true);
    window.removeEventListener("scroll", once, opts);
    send();
  }
  window.addEventListener("pointerdown", once, true);
  window.addEventListener("keydown", once, true);
  window.addEventListener("scroll", once, opts);
})();
