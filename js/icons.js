function svgIcon(inner, cls) {
  return `<span class="ico ${cls || ""}" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></span>`;
}

const CAT_ICON_PATH = {
  all: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  checkin:
    '<rect x="4" y="5" width="16" height="15" rx="2.4"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/><path d="M8.5 15.2l2.3 2.3 4.8-5"/>',
  gift: '<path d="M4 11h16v9.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5V11z"/><path d="M3.5 7.5h17v3.5h-17z"/><path d="M12 7.5v14.5"/><path d="M12 7.5c0-2.4-1.6-4-3.4-4S6 6 7.2 7.8C8 8.8 10 9.2 12 7.5z"/><path d="M12 7.5c0-2.4 1.6-4 3.4-4S18 6 16.8 7.8C16 8.8 14 9.2 12 7.5z"/>',
  cheaprate:
    '<path d="M4.8 13.2l8.4 8.4a1.4 1.4 0 0 0 2 0l6.2-6.2a1.4 1.4 0 0 0 0-2L13 4.8A2 2 0 0 0 11.6 4H5.5A1.5 1.5 0 0 0 4 5.5v6.1a2 2 0 0 0 .8 1.6z"/><circle cx="8.2" cy="8.2" r="1.2"/>',
  fast: '<path d="M13 3L5.5 13.4h6.2L11 21l7.8-11.2h-6.4L13 3z"/>',
  pay: '<rect x="3" y="6" width="18" height="13" rx="2.2"/><path d="M3 10.5h18"/><path d="M7 15h4"/>',
  invite:
    '<circle cx="9" cy="8" r="3"/><path d="M3.6 18.5c.6-3 2.7-4.7 5.4-4.7s4.8 1.7 5.4 4.7"/><circle cx="17" cy="9" r="2.3"/><path d="M16.2 13.9c2 .3 3.4 1.6 3.9 3.8"/>',
  crypto:
    '<path d="M12 3.2l7.2 4.1v8.4L12 19.8l-7.2-4.1V7.3L12 3.2z"/><path d="M12 8.2v7.6M9.6 10.2c.6-.7 1.4-1 2.4-1 1.6 0 2.6.7 2.6 1.8s-1 1.7-2.6 1.9c1.8.1 2.8.8 2.8 2s-1.2 2-2.8 2c-1.1 0-2-.3-2.6-1"/>',
  invoice:
    '<path d="M7 3.5h7.2L19 8.2V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M14 3.6V8h4.4"/><path d="M9 12.2h6M9 15.6h4.5"/>',
  highup:
    '<path d="M12 3.2l8 3.2v6.1c0 5-3.4 7.8-8 8.7-4.6-.9-8-3.7-8-8.7V6.4l8-3.2z"/><path d="M8.6 12.1l2.4 2.4 4.6-5"/>',
  stable:
    '<path d="M4 20.5h16"/><path d="M6 20.5V9.2L12 4.5l6 4.7v11.3"/><path d="M10 20.5v-5h4v5"/><path d="M9 12h2M13 12h2M9 15.2h2"/>',
  cheap: '<path d="M4 8.5h16v10.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.7V8.5z"/><path d="M4 8.5c0-2.3 3.6-4 8-4s8 1.7 8 4"/><path d="M12 12.2v4.4"/><path d="M10.2 13.2c.4-.6 1-.9 1.8-.9 1.2 0 2 .5 2 1.4s-.8 1.3-2 1.5c1.3.1 2.1.6 2.1 1.5s-1 1.5-2.2 1.5c-.8 0-1.5-.3-1.9-1"/>',
  special:
    '<path d="M12 3.5l1.6 4.6L18.5 9l-3.6 3.1 1.1 4.9L12 14.8 8 17l1.1-4.9L5.5 9l4.9-.9L12 3.5z"/><path d="M18.8 4.2l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z"/>',
  new: '<circle cx="12" cy="12" r="8.2"/><path d="M12 8.4v7.2M8.4 12h7.2"/>',
  charity:
    '<path d="M12 20.4S4.6 15.4 3.2 10.8C2.2 7.6 4 5 6.8 5c1.7 0 2.9 1 3.7 2.3C11.3 6 12.5 5 14.2 5c2.8 0 4.6 2.6 3.6 5.8C16.4 15.4 12 20.4 12 20.4z"/>',
  online:
    '<path d="M5 12a7 7 0 0 1 14 0"/><path d="M8.2 12a3.8 3.8 0 0 1 7.6 0"/><circle cx="12" cy="16.4" r="1.3"/>',
  fav: '<path d="M12 4.4l2.2 4.6 5 .7-3.6 3.5.9 5.1L12 16l-4.5 2.3.9-5.1L4.8 9.7l5-.7L12 4.4z"/>',
  other: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
};

const MODEL_ICON_PATH = {
  gpt: '<circle cx="12" cy="12" r="8"/><path d="M8.2 10.2 12 6.8l3.8 3.4M8.2 13.8 12 17.2l3.8-3.4"/>',
  claude: '<path d="M12 4v16M6.2 6.8l11.6 10.4M6.2 17.2 17.8 6.8"/>',
  gemini: '<path d="M12 3.5l1.8 5.2L19 10.5l-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5z"/><path d="M18 15.2l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  grok: '<circle cx="12" cy="12" r="8.2"/><path d="M9 9l6 6M15 9l-6 6"/>',
  deepseek: '<path d="M4 14c2.4-3 4.6-4.4 8-4.4S17.6 11 20 14"/><path d="M4 17.4c2.2-2.2 4.2-3.2 8-3.2s5.8 1 8 3.2"/><circle cx="12" cy="8.4" r="1.3"/>',
  kimi: '<path d="M15.6 5.2a6.6 6.6 0 1 0 3.2 12.2 7.4 7.4 0 0 1-3.2-12.2z"/>',
  qwen: '<path d="M6 7.2h12v10.2a1.6 1.6 0 0 1-1.6 1.6H7.6A1.6 1.6 0 0 1 6 17.4V7.2z"/><path d="M9 4.8h6v2.4H9z"/><path d="M9.5 11.2h5M9.5 14.2h3.4"/>',
  glm: '<path d="M8 8h8v8H8z"/><path d="M5.5 5.5h4v4h-4zM14.5 5.5h4v4h-4zM5.5 14.5h4v4h-4zM14.5 14.5h4v4h-4z"/>',
  image: '<rect x="4" y="5.5" width="16" height="13" rx="2"/><circle cx="9" cy="10" r="1.4"/><path d="M5.2 16.2l4.4-4 3.2 2.6 2.4-2.2 3.6 3.6"/>',
  video: '<rect x="3.5" y="6.5" width="12.5" height="11" rx="2"/><path d="M16 10.2l4.5-2.4v8.4L16 13.8z"/>',
};

function catIcon(id) {
  return svgIcon(CAT_ICON_PATH[id] || CAT_ICON_PATH.all);
}

function modelIcon(id) {
  return svgIcon(MODEL_ICON_PATH[id] || CAT_ICON_PATH.special);
}

function voteIcon(dir) {
  if (dir === "down") {
    return svgIcon('<path d="M7 3v10.2"/><path d="M7 13.2h4.1l1.4 6.2a1.8 1.8 0 0 0 1.8 1.4h.2a1.7 1.7 0 0 0 1.6-2.2L15.2 13.2H19a2 2 0 0 0 2-2.3l-.8-5.2A2 2 0 0 0 18.2 4H7"/>', "vote-ico");
  }
  return svgIcon('<path d="M7 21V10.8"/><path d="M7 10.8h4.1L12.5 4.6A1.8 1.8 0 0 1 14.3 3.2h.2a1.7 1.7 0 0 1 1.6 2.2L15.2 10.8H19a2 2 0 0 1 2 2.3l-.8 5.2A2 2 0 0 1 18.2 20H7"/>', "vote-ico");
}

if (typeof module === "object" && module.exports) {
  module.exports = { svgIcon, catIcon, modelIcon, voteIcon, CAT_ICON_PATH, MODEL_ICON_PATH };
}
