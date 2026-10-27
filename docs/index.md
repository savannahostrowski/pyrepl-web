# Get started

pyrepl-web is an embeddable Python REPL powered by Pyodide. It runs Python in the browser, with tab completion, command history, and syntax highlighting.

## Add it to a page

Include the script and a `<py-repl>` element in your HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/pyrepl-web/dist/pyrepl.js"></script>

<py-repl></py-repl>
```

Open your page through a web server. The component downloads the Python runtime and shows a `>>>` prompt when it is ready. You don’t need a Python backend.

Type an expression and press **Enter**:

```python
sum(n ** 2 for n in range(10))
```

The result is `285`. You can try this in the [playground](/#demo).

## A complete example

Save this as `index.html` and serve it with your usual development server:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Python playground</title>
    <script src="https://cdn.jsdelivr.net/npm/pyrepl-web/dist/pyrepl.js"></script>
  </head>
  <body>
    <h1>Try some Python</h1>
    <py-repl repl-title="My playground"></py-repl>
  </body>
</html>
```

The first load needs an internet connection to download Pyodide and the component’s assets. Execution happens in the visitor’s browser.

## Make it yours

- [Configuration](configuration.md): component attributes and defaults.
- [Themes](themes.md): built-in themes and custom colors.
- [Packages](packages.md): preload Python libraries.
- [Startup scripts](startup-scripts.md): prepare an example before the prompt appears.
- [Keyboard shortcuts](keyboard-shortcuts.md): editing and navigating the prompt.
