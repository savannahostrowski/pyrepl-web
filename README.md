# pyrepl-web

An embeddable Python REPL, powered by Pyodide.

[Live demo](https://savannah.dev/projects/)

## Getting started

Add a `.pyrepl` div and include the script from a CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/pyrepl-web/dist/pyrepl.js"></script>

<div class="pyrepl"></div>
```

That's it! No install needed.

### Options

Configure via `data-*` attributes:

```html
<!-- Dark theme (default) -->
<div class="pyrepl" data-theme="catppuccin-mocha"></div>

<!-- Light theme -->
<div class="pyrepl" data-theme="catppuccin-latte"></div>

<!-- Preload packages -->
<div class="pyrepl" data-packages="numpy, pandas"></div>

<!-- Combined -->
<div class="pyrepl"
     data-theme="catppuccin-latte"
     data-packages="pydantic, requests">
</div>
```

Supports...

- Python 3.13 running in the browser via WebAssembly
- Syntax highlighting with Pygments
- Tab completion
- Command history (up/down arrows)
- Smart indentation
- Preload any PyPI packages
- Multiple color themes (Catppuccin Mocha/Latte)

### Attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| `data-theme` | Color theme (`catppuccin-mocha` or `catppuccin-latte`) | `catppuccin-mocha` |
| `data-packages` | Comma-separated list of PyPI packages to preload | none |

### Hugo Shortcode

Create `layouts/shortcodes/pyrepl.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/pyrepl-web/dist/pyrepl.js"></script>
<div class="pyrepl" {{ with .Get "theme" }}data-theme="{{ . }}"{{ end }} {{ with .Get "packages" }}data-packages="{{ . }}"{{ end }}></div>
```

Then use it in any markdown file:

```markdown
{{</* pyrepl */>}}
{{</* pyrepl theme="catppuccin-latte" */>}}
{{</* pyrepl packages="numpy, pandas" */>}}
```

## Development

```bash
# Install dependencies
bun install

# Run dev server
bun run src/server.ts

# Build for production
bun run build.ts
```

## How it works

pyrepl-web uses:
- [Pyodide](https://pyodide.org/) - Python compiled to WebAssembly
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [Pygments](https://pygments.org/) - Syntax highlighting
- [Catppuccin](https://github.com/catppuccin/catppuccin) - Color themes
