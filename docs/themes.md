# Themes

## Built-in themes

Choose `catppuccin-mocha` for a dark terminal (the default) or `catppuccin-latte` for a light one:

```html
<py-repl theme="catppuccin-latte"></py-repl>
```

## Custom colors

Register your theme on `window.pyreplThemes` **before loading the component script**, then select it with the `theme` attribute.

Only `background` and `foreground` are required. The remaining terminal colors inherit from the dark or light built-in theme, based on your background color.

```html
<script>
  window.pyreplThemes = {
    lavender: {
      background: '#302b3b',
      foreground: '#eee4f3',
      promptColor: '#c0d5b0',
    },
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/pyrepl-web/dist/pyrepl.js"></script>

<py-repl theme="lavender"></py-repl>
```

Use six-digit hex values for the background so the component can determine whether it is dark or light.

## Theme properties

| Property | Description |
| --- | --- |
| `background` | Terminal background color. Required. |
| `foreground` | Default terminal text color. Required. |
| `headerBackground` | Header background; otherwise inherited from the base theme. |
| `headerForeground` | Header title and button color; otherwise inherited from the base theme. |
| `promptColor` | Prompt color as a hex value or an ANSI color name, such as `green` or `cyan`. Defaults to `green`. |
| `pygmentsStyle` | An object mapping Pygments token names to colors. |

## Syntax highlighting

Highlighting loads after the first user input. If your theme name matches a Pygments style, that style is used; otherwise it falls back to the matching dark or light Catppuccin style.

To choose your own syntax colors, add `pygmentsStyle` to your theme:

```javascript
window.pyreplThemes = {
  lavender: {
    background: '#302b3b',
    foreground: '#eee4f3',
    promptColor: '#c0d5b0',
    pygmentsStyle: {
      Keyword: '#dfb1d9',
      String: '#c0d5b0',
      Number: '#e4cf9d',
      Comment: '#b3a3bf',
      'Name.Function': '#b5cee4',
      'Name.Builtin': '#dfb1d9',
    },
  },
};
```
