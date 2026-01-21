import { readFileSync, writeFileSync } from "fs";

// Read the Python code and write it as a separate module
const pythonCode = readFileSync("src/python/console.py", "utf-8");
writeFileSync(
  "src/console-code.ts",
  `export const CONSOLE_PY = ${JSON.stringify(pythonCode)};`,
);

// Read the TypeScript source
const tsSource = readFileSync("src/embed.ts", "utf-8");

// Create a version that imports the Python code
const inlinedSource =
  `import { CONSOLE_PY } from './console-code';\n` +
  tsSource.replace(
    /const consoleCode = await fetch\('\/python\/console\.py'\)\.then\(r => r\.text\(\)\);/,
    `const consoleCode = CONSOLE_PY;`,
  );

// Write temporary file
writeFileSync("src/embed.build.ts", inlinedSource);

// Bundle it
const result = await Bun.build({
  entrypoints: ["src/embed.build.ts"],
  outdir: "dist",
  naming: "pyrepl.js",
  minify: true,
});

if (result.success) {
  console.log("Built dist/pyrepl.js");
} else {
  console.error("Build failed:", result.logs);
}

// Clean up temp files
import { unlinkSync } from "fs";

unlinkSync("src/embed.build.ts");
unlinkSync("src/console-code.ts");
