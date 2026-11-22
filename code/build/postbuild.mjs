/**
 * The content-script bootstrap must be a classic script, but TypeScript marks any
 * file containing `import()` as a module and appends `export {};`. Strip it after
 * every build. Run automatically by `npm run build`.
 */

import { readFileSync, writeFileSync } from "node:fs";

const target = new URL("../dist/content-bootstrap.js", import.meta.url);
const source = readFileSync(target, "utf8");
const cleaned = source.replace(/^export \{\};\s*$/m, "");

if (cleaned === source) {
  console.error("postbuild: `export {};` not found in dist/content-bootstrap.js");
  process.exit(1);
}

writeFileSync(target, cleaned);
console.log("postbuild: stripped module marker from dist/content-bootstrap.js");
