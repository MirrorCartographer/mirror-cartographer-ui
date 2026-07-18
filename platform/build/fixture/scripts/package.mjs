import fs from "node:fs";
const metadata = JSON.parse(fs.readFileSync("out/metadata.json", "utf8"));
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/artifact.json", JSON.stringify({ format: 1, metadata }, Object.keys({ format: 1, metadata }).sort()) + "\n");
