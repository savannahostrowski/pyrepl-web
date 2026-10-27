# Startup scripts

Use `src` to load a Python file before showing the prompt. This is useful for preparing data, defining helper functions, or setting up an exercise.

```html
<py-repl src="/scripts/setup.py"></py-repl>
```

Host the file on your site at that URL. A path beginning with `/` is relative to the site root; other relative paths resolve against the page’s URL.

## Define variables and functions

Top-level code populates the REPL’s namespace. Its standard output and standard error streams are suppressed while the startup script runs. Exceptions are reported in the terminal.

Define a `setup()` function if you want to show a welcome message or initial output. The REPL calls it after loading the script, with output visible:

```python title="scripts/setup.py"
flowers = ["daisy", "poppy", "tulip"]

def greet(name):
    return f"Hello, {name}!"

def setup():
    print("Welcome! Try greet('Python') or take a look at flowers.")
```

At the prompt, `flowers` and `greet` are ready to use.

## Include packages

Packages listed in the `packages` attribute are installed before the startup script runs:

```html
<py-repl packages="pandas" src="/scripts/data.py"></py-repl>
```

See [Packages](packages.md) for a complete example.

## Check the file loads

Serve the Python file over HTTP, alongside your page. If it is hosted on another origin, that server must allow the browser to fetch it with CORS.

If your variables are missing, check the browser’s network panel for the `.py` request and confirm the response contains Python source rather than an HTML error page.
