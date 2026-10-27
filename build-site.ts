import { cpSync, mkdirSync, rmSync } from "node:fs";

// Keep the generated website separate from the npm package in dist/.
const output = "out/site";
rmSync(output, { recursive: true, force: true });
mkdirSync(`${output}/benchmark`, { recursive: true });
cpSync("examples/index.html", `${output}/index.html`);
cpSync("benchmark.html", `${output}/benchmark/index.html`);
cpSync("dist", `${output}/dist`, { recursive: true });
cpSync("site", `${output}/docs`, { recursive: true });
console.log(`Built website in ${output}`);
