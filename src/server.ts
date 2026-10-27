import { resolve, sep } from "node:path";

const docsRoot = resolve("site");

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response(Bun.file("examples/index.html"));
    }

    if (url.pathname === "/docs") {
      url.pathname = "/docs/";
      return Response.redirect(url, 302);
    }

    if (url.pathname.startsWith("/docs/")) {
      let relativePath: string;
      try {
        relativePath = decodeURIComponent(url.pathname.slice("/docs/".length));
      } catch {
        return new Response("Invalid path", { status: 400 });
      }
      if (relativePath.includes("\0")) {
        return new Response("Invalid path", { status: 400 });
      }
      const path = resolve(docsRoot, relativePath);
      if (path !== docsRoot && !path.startsWith(docsRoot + sep)) {
        return new Response("Not found", { status: 404 });
      }
      if (url.pathname.endsWith("/")) {
        const index = Bun.file(resolve(path, "index.html"));
        if (await index.exists()) return new Response(index);
      } else {
        const index = Bun.file(resolve(path, "index.html"));
        if (await index.exists()) {
          url.pathname += "/";
          return Response.redirect(url, 302);
        }
        const file = Bun.file(path);
        if (await file.exists()) return new Response(file);
      }
      return new Response("Not found", { status: 404 });
    }

    if (url.pathname === "/benchmark") {
      return new Response(Bun.file("benchmark.html"));
    }

    if (url.pathname === "/embed.js") {
      const build = await Bun.build({
        entrypoints: ["src/embed.ts"],
      });
      return new Response(build.outputs[0], {
        headers: { "Content-Type": "application/javascript" },
      });
    }

    if (url.pathname === "/python/console.py") {
      return new Response(Bun.file("src/python/console.py"), {
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Serve files from dist directory
    if (url.pathname.startsWith("/dist/")) {
      const file = Bun.file(url.pathname.slice(1));
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "application/javascript" },
        });
      }
    }

    // Serve .py files from examples directory
    if (url.pathname.endsWith(".py")) {
      const file = Bun.file(`examples${url.pathname}`);
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "text/plain" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`http://localhost:${server.port}`);
