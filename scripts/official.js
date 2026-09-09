/**
 * 拉取各家官方状态 RSS / Statuspage，写入本地。
 * 用法：node scripts/official.js
 */
const fs = require("fs");
const path = require("path");
const { fetchOfficialLive } = require("../js/official.js");

const ROOT = path.resolve(__dirname, "..");

async function main() {
  const officialPath = path.join(ROOT, "data", "official.json");
  let prev = [];
  if (fs.existsSync(officialPath)) {
    try {
      prev = JSON.parse(fs.readFileSync(officialPath, "utf8")).official || [];
    } catch (err) {
      prev = [];
    }
  }
  const official = await fetchOfficialLive(prev);
  for (const row of official) {
    console.log("官方", row.label, row.status, (row.components || []).length + " 个组件", (row.incidents || []).length + " 条事件");
  }
  const dataPath = path.join(ROOT, "data", "stations.json");
  const jsPath = path.join(ROOT, "js", "stations-data.js");
  fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
  fs.writeFileSync(officialPath, JSON.stringify({ updatedAt: new Date().toISOString(), official }, null, 2), "utf8");
  if (fs.existsSync(dataPath)) {
    const payload = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    payload.official = official;
    payload.officialUpdatedAt = new Date().toISOString();
    fs.writeFileSync(dataPath, JSON.stringify(payload, null, 2), "utf8");
    fs.writeFileSync(jsPath, "window.__STATIONS_DATA__ = " + JSON.stringify(payload) + ";\n", "utf8");
  }
  console.log("已写入 data/official.json");
}

module.exports = { fetchOfficialStatuses: fetchOfficialLive };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
