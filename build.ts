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
    /function getConsoleCode\(\): Promise<string> \{\s+if \(!consoleCodePromise\) \{\s+consoleCodePromise = fetch\("\/python\/console\.py"\)\.then\(\(r\) => r\.text\(\)\);\s+\}\s+return consoleCodePromise;\s+\}/,
    `function getConsoleCode(): Promise<string> {\n  if (!consoleCodePromise) {\n    consoleCodePromise = Promise.resolve(CONSOLE_PY);\n  }\n  return consoleCodePromise;\n}`,
  );

// Write temporary file
writeFileSync("src/embed.build.ts", inlinedSource);

// Bundle the ESM module
const result = await Bun.build({
  entrypoints: ["src/embed.build.ts"],
  outdir: "dist",
  naming: "pyrepl.esm.js",
  minify: true,
  splitting: true, // Enable code splitting for dynamic imports
  target: "browser",
  format: "esm", // Use ES modules for better tree-shaking
});

if (result.success) {
  console.log("Built dist/pyrepl.esm.js");
} else {
  console.error("Build failed:", result.logs);
  process.exit(1);
}

// Bundle the wrapper (IIFE format, no code splitting needed)
const wrapperResult = await Bun.build({
  entrypoints: ["src/wrapper.js"],
  outdir: "dist",
  naming: "pyrepl.js",
  minify: true,
  target: "browser",
  format: "iife",
});

if (wrapperResult.success) {
  console.log("Built dist/pyrepl.js (wrapper)");
} else {
  console.error("Wrapper build failed:", wrapperResult.logs);
  process.exit(1);
}

// Clean up temp files
import { unlinkSync } from "fs";

unlinkSync("src/embed.build.ts");
unlinkSync("src/console-code.ts");
