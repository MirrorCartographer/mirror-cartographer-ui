import fs from "node:fs";
const epoch = Number(process.env.SOURCE_DATE_EPOCH);
const message = fs.readFileSync("input/message.txt", "utf8").trim();
fs.mkdirSync("out", { recursive: true });
fs.writeFileSync("out/metadata.json", JSON.stringify({ message, epoch, timezone: process.env.TZ, locale: process.env.LANG }) + "\n");
