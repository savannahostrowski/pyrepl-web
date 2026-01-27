# pyrepl-web

An embeddable Python REPL, powered by Pyodide.

[Live demo](https://playground.fastapicloud.dev/)

## Getting started

Include the script and use the `<py-repl>` web component:

```html
<script src="https://cdn.jsdelivr.net/npm/pyrepl-web/dist/pyrepl.js"></script>

<py-repl></py-repl>
```

That's it! No install needed.

## Features

- **Python 3.13** in the browser via WebAssembly (Pyodide)
- **Syntax highlighting** powered by Pygments
- **Tab completion** for modules, functions, and variables
- **Command history** with up/down arrows
- **Smart indentation** for multi-line code
- **Keyboard shortcuts**: Ctrl+L (clear), Ctrl+C (cancel)
- **PyPI packages**: preload popular libraries
- **Startup scripts**: run Python on load to set up the environment
- **Theming**: built-in dark/light themes or fully custom

## Attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| `theme` | Color theme name (builtin or registered via `window.pyreplThemes`) | `catppuccin-mocha` |
| `packages` | Comma-separated list of PyPI packages to preload | none |
| `repl-title` | Custom title in the header bar | `Python REPL` |
| `src` | Path to a Python script to preload (runs silently, populates namespace) | none |
| `no-header` | Hide the header bar (boolean attribute) | not set |
| `no-buttons` | Hide copy/clear buttons in header (boolean attribute) | not set |
| `readonly` | Disable input, display only (boolean attribute) | not set |

### Theming

Built-in themes: `catppuccin-mocha` (dark, default) and `catppuccin-latte` (light).

#### Custom Themes

Register custom themes via `window.pyreplThemes` before loading the script. Only `background` and `foreground` are required - everything else is automatically derived:

```html
<script>
window.pyreplThemes = {
  'my-theme': {
    background: '#1a1b26',
    foreground: '#a9b1d6',
  }
};
</script>
<script src="https://cdn.jsdelivr.net/npm/pyrepl-web/dist/pyrepl.js"></script>

<py-repl theme="my-theme"></py-repl>
```

**What gets auto-derived from your background color:**
- Terminal colors (red for errors, green for success, etc.) - from catppuccin-mocha (dark) or catppuccin-latte (light)
- Syntax highlighting - uses the matching catppuccin Pygments style
- Header colors - derived from the base theme

#### Theme Properties

| Property | Description |
|----------|-------------|
| `background` | Terminal background color (required) |
| `foreground` | Default text color (required) |
| `headerBackground` | Header bar background (optional) |
| `headerForeground` | Header title color (optional) |
| `promptColor` | Prompt `>>>` color - hex (`#7aa2f7`) or name (`green`, `cyan`) (optional) |
| `pygmentsStyle` | Custom syntax highlighting (optional, see below) |

#### Syntax Highlighting

Syntax highlighting uses [Pygments](https://pygments.org/). The style is chosen automatically:

1. If your theme name matches a [Pygments style](https://pygments.org/styles/) (e.g., `monokai`, `dracula`), that style is used
2. Otherwise, uses `catppuccin-mocha` for dark backgrounds or `catppuccin-latte` for light backgrounds

For full control, provide a `pygmentsStyle` mapping [Pygments tokens](https://pygments.org/docs/tokens/) to colors:

```html
<script>
window.pyreplThemes = {
  'tokyo-night': {
    background: '#1a1b26',
    foreground: '#a9b1d6',
    promptColor: '#bb9af7',
    pygmentsStyle: {
      'Keyword': '#bb9af7',
      'String': '#9ece6a',
      'Number': '#ff9e64',
      'Comment': '#565f89',
      'Name.Function': '#7aa2f7',
      'Name.Builtin': '#7dcfff',
    }
  }
};
</script>
```

### Legacy API

The legacy `<div class="pyrepl">` API is still supported for backwards compatibility:

```html
<div class="pyrepl"
     data-theme="catppuccin-mocha"
     data-packages="numpy"
     data-title="My REPL"
     data-src="/demo.py"
     data-header="true"
     data-buttons="true"
     data-readonly="false">
</div>
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
- [Pyodide](https://pyodide.org/) - CPython port to WebAssembly
- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [Pygments](https://pygments.org/) - Syntax highlighting
- [Catppuccin](https://github.com/catppuccin/catppuccin) - Color themes
