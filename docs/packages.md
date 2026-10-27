# Packages

Use the `packages` attribute to load Python packages before the REPL becomes ready:

```html
<py-repl packages="pandas" repl-title="Explore a DataFrame"></py-repl>
```

Separate multiple packages with commas:

```html
<py-repl packages="numpy,pandas"></py-repl>
```

The component installs these through Pyodide’s `micropip` before running any startup script. Downloading packages adds to startup time, so preload only what your example needs.

## Prepare an example

Pair packages with a [startup script](startup-scripts.md) to make a dataset available at the prompt:

```html
<py-repl packages="pandas" src="/scripts/data.py"></py-repl>
```

```python title="scripts/data.py"
import pandas as pd

flowers = pd.DataFrame({
    "name": ["daisy", "poppy", "tulip"],
    "height_cm": [25, 60, 40],
})

def setup():
    print("Try flowers.sort_values('height_cm')")
```

The visitor can then inspect `flowers` or change it interactively.

## Compatibility

A package must work in Pyodide’s browser environment. Installing successfully in a desktop Python environment does not guarantee it will work here. Check the package you want to use in the browser before depending on it in an example.

If initialization fails while installing a package, check the browser’s developer console for the installation error. Remove the package from the attribute to check that the basic REPL still loads.
