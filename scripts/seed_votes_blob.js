const fs = require("fs");
const path = require("path");

const envFile = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const i = line.indexOf("=");
      if (i < 1 || line.startsWith("#")) return;
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    });
}

const { dump } = require("../lib/votes");

dump("")
  .then((data) => {
    console.log("vote-store-ok", Object.keys(data.stations || {}).length);
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
