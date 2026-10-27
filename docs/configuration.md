# Configuration

Configure each REPL with HTML attributes. These are read when the component initializes; set them before adding the element to the page.

```html
<py-repl
  theme="catppuccin-latte"
  repl-title="Try the example"
  packages="pandas"
  src="/scripts/setup.py"
  no-banner
></py-repl>
```

## Attributes

| Attribute | What it does | Default |
| --- | --- | --- |
| `theme` | Selects a built-in theme or a name registered in `window.pyreplThemes`. | `catppuccin-mocha` |
| `repl-title` | Sets the title in the header. | `Python REPL` |
| `packages` | Preloads a comma-separated list of Python packages. | No extra packages |
| `src` | Fetches and runs a Python startup script. | No startup script |
| `no-header` | Hides the entire header, including its buttons. | Header visible |
| `no-buttons` | Hides the copy and clear buttons, keeping the header title. | Buttons visible |
| `no-banner` | Hides the Python version banner. | Banner visible |
| `readonly` | Displays output without a prompt or editable input. | Input enabled |

`no-header`, `no-buttons`, `no-banner`, and `readonly` are boolean attributes. Their presence enables them. To disable one, remove it; writing `readonly="false"` still enables read-only mode.

## A minimal embed

Use `no-header` to keep just the terminal:

```html
<py-repl no-header no-banner></py-repl>
```

## Display output without input

Combine `readonly` with a [startup script](startup-scripts.md). Define `setup()` in the script to print the output you want to show:

```html
<py-repl src="/scripts/result.py" readonly no-banner></py-repl>
```

```python title="scripts/result.py"
def setup():
    print("The first five squares:")
    print([n ** 2 for n in range(5)])
```

Read-only mode controls terminal input. The startup script still runs.
