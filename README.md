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
| `src` | Path to a Python startup script (see below) | none |
| `no-header` | Hide the header bar (boolean attribute) | not set |
| `no-buttons` | Hide copy/clear buttons in header (boolean attribute) | not set |
| `readonly` | Disable input, display only (boolean attribute) | not set |
| `no-banner` | Hide the "Python 3.13" startup banner (boolean attribute) | not set |

### Startup Scripts

Use `src` to preload a Python script that sets up the environment:

```html
<py-repl src="/scripts/setup.py" packages="pandas"></py-repl>
```

The script runs silently to populate the namespace. If you define a `setup()` function, it will be called after loading and its output is visible in the terminal:

```python
# setup.py
import pandas as pd

df = pd.DataFrame({'name': ['Alice', 'Bob'], 'age': [30, 25]})

def setup():
    print("DataFrame loaded:")
    print(df)
```

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