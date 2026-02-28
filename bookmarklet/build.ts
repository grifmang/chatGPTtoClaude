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
  // Don't wrap in void() — esbuild's "use strict"; breaks that syntax.
  // Append void(0) to prevent page navigation from the last expression.
  const bookmarklet = `javascript:${encodeURIComponent(bundle + "void(0);")}`;
  writeFileSync("dist/bookmarklet.js", bookmarklet);

  console.log(`Bookmarklet built (${bookmarklet.length} chars)`);
}

main();
