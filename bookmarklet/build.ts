import { build } from "esbuild";
import { mkdirSync, writeFileSync, readFileSync } from "fs";

async function main() {
  mkdirSync("dist", { recursive: true });

  await build({
    entryPoints: ["src/bookmarklet.ts"],
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2022",
    outfile: "dist/bundle.js",
  });

  const bundle = readFileSync("dist/bundle.js", "utf-8").trim();
  const bookmarklet = `javascript:void(${encodeURIComponent(bundle)})`;
  writeFileSync("dist/bookmarklet.js", bookmarklet);

  console.log(`Bookmarklet built (${bookmarklet.length} chars)`);
}

main();
