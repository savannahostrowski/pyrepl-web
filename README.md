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
| `data-theme` | Color theme name (builtin or registered via `window.pyreplThemes`) | `catppuccin-mocha` |
| `data-theme-config` | Inline JSON theme object for full customization | none |
| `data-packages` | Comma-separated list of PyPI packages to preload | none |

### Custom Themes

You can fully customize the theme using two approaches:

#### 1. Register a named theme via JavaScript

```html
<script>
window.pyreplThemes = {
  'my-theme': {
    background: '#282c34',
    foreground: '#abb2bf',
    cursor: '#528bff',
    cursorAccent: '#282c34',
    selectionBackground: '#3e4451',
    black: '#1e2127',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#d19a66',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#d19a66',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
    // Optional header customization
    headerBackground: '#21252b',
    headerTitle: '#5c6370',
  }
};
</script>
<script src="https://cdn.jsdelivr.net/npm/pyrepl-web/dist/pyrepl.js"></script>

<div class="pyrepl" data-theme="my-theme"></div>
```

#### 2. Inline theme via data attribute

```html
<div class="pyrepl" data-theme-config='{
  "background": "#1a1b26",
  "foreground": "#a9b1d6",
  "cursor": "#c0caf5",
  "cursorAccent": "#1a1b26",
  "selectionBackground": "#33467c",
  "black": "#15161e",
  "red": "#f7768e",
  "green": "#9ece6a",
  "yellow": "#e0af68",
  "blue": "#7aa2f7",
  "magenta": "#bb9af7",
  "cyan": "#7dcfff",
  "white": "#a9b1d6",
  "brightBlack": "#414868",
  "brightRed": "#f7768e",
  "brightGreen": "#9ece6a",
  "brightYellow": "#e0af68",
  "brightBlue": "#7aa2f7",
  "brightMagenta": "#bb9af7",
  "brightCyan": "#7dcfff",
  "brightWhite": "#c0caf5"
}'></div>
```

#### Theme Properties

| Property | Description |
|----------|-------------|
| `background` | Terminal background color |
| `foreground` | Default text color |
| `cursor` | Cursor color |
| `cursorAccent` | Cursor text color |
| `selectionBackground` | Text selection highlight |
| `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white` | Standard ANSI colors |
| `brightBlack`, `brightRed`, ... `brightWhite` | Bright ANSI color variants |
| `headerBackground` | (Optional) Header bar background, defaults to `black` |
| `headerTitle` | (Optional) Header title text color, defaults to `brightBlack` |

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
