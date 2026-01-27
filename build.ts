import { readFileSync, unlinkSync, writeFileSync } from "node:fs";

// Read package.json to get Pyodide version
const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const pyodideVersion = pkg.dependencies.pyodide.replace("^", "");

// Update Python pyproject.toml with Pyodide version
function updatePyprojectVersion() {
  const pyprojectPath = "src/python/pyproject.toml";
  const pyproject = readFileSync(pyprojectPath, "utf-8");
  const updatedPyproject = pyproject.replace(
    /pyodide-py>=[\d.]+/,
    `pyodide-py>=${pyodideVersion}`,
  );
  writeFileSync(pyprojectPath, updatedPyproject);
}

// Inject Pyodide version into URLs
function injectPyodideVersion(source: string): string {
  return source.replace(
    /https:\/\/cdn\.jsdelivr\.net\/pyodide\/v[\d.]+\/full\//g,
    `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
  );
}

// Prepare TypeScript source with inlined Python code
function prepareEmbedSource(): string {
  const pythonCode = readFileSync("src/python/console.py", "utf-8");
  writeFileSync(
    "src/console-code.ts",
    `export const CONSOLE_PY = ${JSON.stringify(pythonCode)};`,
  );

  const tsSource = readFileSync("src/embed.ts", "utf-8");
  return (
    `import { CONSOLE_PY } from './console-code';\n` +
    tsSource
      .replace(
        /function getConsoleCode\(\): Promise<string> \{\s+if \(!consoleCodePromise\) \{\s+consoleCodePromise = fetch\("\/python\/console\.py"\)\.then\(\(r\) => r\.text\(\)\);\s+\}\s+return consoleCodePromise;\s+\}/,
        `function getConsoleCode(): Promise<string> {\n  if (!consoleCodePromise) {\n    consoleCodePromise = Promise.resolve(CONSOLE_PY);\n  }\n  return consoleCodePromise;\n}`,
      )
      .replace(
        /https:\/\/cdn\.jsdelivr\.net\/pyodide\/v[\d.]+\/full\//g,
        `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
      )
  );
}

// Prepare wrapper source with Pyodide version
function prepareWrapperSource(): string {
  const wrapperSource = readFileSync("src/wrapper.js", "utf-8");
  return injectPyodideVersion(wrapperSource);
}

function prepareComponentSource(): string {
  const componentSource = readFileSync("src/component.ts", "utf-8");
  // Update import to point to build version of embed
  return componentSource.replace(
    /from ['"]\.\/embed\.js['"]/,
    `from './embed.build.js'`,
  );
}

// Clean up temporary build files
function cleanup() {
  unlinkSync("src/embed.build.ts");
  unlinkSync("src/component.build.ts");
  unlinkSync("src/wrapper.build.js");
  unlinkSync("src/console-code.ts");
}

// Main build process
async function build() {
  // Update Python dependencies
  updatePyprojectVersion();

  // Prepare sources
  const embedSource = prepareEmbedSource();
  writeFileSync("src/embed.build.ts", embedSource);

  const componentSource = prepareComponentSource();
  writeFileSync("src/component.build.ts", componentSource);

  const wrapperSource = prepareWrapperSource();
  writeFileSync("src/wrapper.build.js", wrapperSource);

  // Bundle the ESM module
  const esmResult = await Bun.build({
    entrypoints: ["src/component.build.ts"],
    outdir: "dist",
    naming: "pyrepl.esm.js",
    minify: true,
    splitting: true,
    target: "browser",
    format: "esm",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });

  if (!esmResult.success) {
    console.error("ESM build failed:", esmResult.logs);
    process.exit(1);
  }
  console.log("Built dist/pyrepl.esm.js");

  // Bundle the wrapper
  const wrapperResult = await Bun.build({
    entrypoints: ["src/wrapper.build.js"],
    outdir: "dist",
    naming: "pyrepl.js",
    minify: true,
    target: "browser",
    format: "iife",
  });

  if (!wrapperResult.success) {
    console.error("Wrapper build failed:", wrapperResult.logs);
    process.exit(1);
  }
  console.log("Built dist/pyrepl.js (wrapper)");

  // Clean up
  cleanup();
}

build();
