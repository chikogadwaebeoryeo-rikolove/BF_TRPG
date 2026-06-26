import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "docs");
const keep = new Set(["config.js", "multi.css", "multi.js"]);

function reset(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, filter = () => true) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (!filter(entry, from)) continue;
    if (entry.isDirectory()) copyDir(from, to, filter);
    else if (entry.isFile()) copyFile(from, to);
  }
}

reset(out);
copyFile(path.join(root, "index.html"), path.join(out, "index.html"));
copyFile(path.join(root, "index.html"), path.join(out, "404.html"));
copyDir(path.join(root, "Main"), path.join(out, "Main"));
copyDir(path.join(root, "SoloMode"), path.join(out, "SoloMode"));
copyDir(path.join(root, "MultiMode"), path.join(out, "MultiMode"), (entry) => entry.isDirectory() || keep.has(entry.name));
copyDir(path.join(root, "Data"), path.join(out, "Data"));
copyDir(path.join(root, "cards"), path.join(out, "cards"));
copyDir(path.join(root, "역할카드"), path.join(out, "역할카드"));
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log("docs");
