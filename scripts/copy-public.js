#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUB = path.join(ROOT, "public");

const FILES = [
  "index.html",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
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
console.log("public ready");
