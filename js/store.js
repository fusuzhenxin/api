const STORE_KEY = "xiantan.user.v1";
const THEME_KEY = "xiantan.theme";
const VOTER_KEY = "xiantan.voter";

function voterId() {
  let id = localStorage.getItem(VOTER_KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || "v" + Date.now().toString(16) + Math.random().toString(16).slice(2);
    localStorage.setItem(VOTER_KEY, id);
  }
  return id;
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultUser() {
  return {
    balance: 0,
    streak: 0,
    lastCheckin: "",
    favorites: [],
    viewed: [],
  };
}

function loadUser() {
  try {
    return { ...defaultUser(), ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch {
    return defaultUser();
  }
}

function saveUser(user) {
  localStorage.setItem(STORE_KEY, JSON.stringify(user));
  return user;
}

function checkinReward(streak) {
  return Number((0.25 + Math.min(streak, 10) * 0.05).toFixed(2));
}

function canCheckin(user = loadUser()) {
  return user.lastCheckin !== todayKey();
}

function doCheckin() {
  const user = loadUser();
  if (!canCheckin(user)) return { user, added: 0, already: true };
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const keepStreak = user.lastCheckin === todayKey(yesterday);
  user.streak = keepStreak ? user.streak + 1 : 1;
  const added = checkinReward(user.streak);
  user.balance = Number((user.balance + added).toFixed(2));
  user.lastCheckin = todayKey();
  saveUser(user);
  return { user, added, already: false };
}

function spendBalance(amount) {
  const user = loadUser();
  if (user.balance < amount) return { user, ok: false };
  user.balance = Number((user.balance - amount).toFixed(2));
  saveUser(user);
  return { user, ok: true };
}

function toggleFav(id) {
  const user = loadUser();
  const key = Number(id);
  if (user.favorites.includes(key)) user.favorites = user.favorites.filter((x) => x !== key);
  else user.favorites.unshift(key);
  saveUser(user);
  return user;
}

function isFav(id) {
  return loadUser().favorites.includes(Number(id));
}

function rememberView(id) {
  const user = loadUser();
  const key = Number(id);
  user.viewed = [key, ...user.viewed.filter((x) => x !== key)].slice(0, 20);
  saveUser(user);
}

function systemTheme() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "light" || saved === "dark" ? saved : systemTheme();
}

function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  return next;
}

function toggleTheme() {
  return applyTheme(loadTheme() === "light" ? "dark" : "light");
}
