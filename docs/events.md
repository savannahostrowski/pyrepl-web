# Events

The component emits bubbling events as it starts. Attach listeners before the component initializes so you don’t miss them.

## Lifecycle reference

| Event | When it fires |
| --- | --- |
| `pyrepl-terminal-ready` | The terminal is rendered. Python may still be loading. |
| `pyrepl-pyodide-ready` | The shared Pyodide runtime is initialized. Packages and startup scripts may still be loading. |
| `pyrepl-ready` | The REPL session is initialized. An editable REPL is ready for input. |
| `pyrepl-pygments-ready` | Syntax highlighting is available after the first user input. |

Read-only sessions also emit `pyrepl-ready`, but do not accept input. They do not start highlighting in response to input.

## Show a loading message

Place the listener before the component script:

```html
<p id="status" role="status">Starting Python…</p>
<py-repl id="playground"></py-repl>

<script>
  const repl = document.getElementById('playground');
  const status = document.getElementById('status');

  repl.addEventListener('pyrepl-ready', (event) => {
    status.textContent = 'Python is ready';
    console.log(`Ready in ${event.detail.duration.toFixed(0)} ms`);
  }, { once: true });
</script>
<script src="https://cdn.jsdelivr.net/npm/pyrepl-web/dist/pyrepl.js"></script>
```

## Measure startup

Each event’s `detail` contains two numbers, in milliseconds:

- `timestamp`: the value of `performance.now()` when the event fired.
- `duration`: elapsed time since this REPL began initializing.

Multiple REPLs share the Pyodide runtime, so later instances may have a shorter runtime initialization period. Measure `pyrepl-ready` when you care about the complete startup, including packages and startup scripts.

The [startup benchmark](/benchmark) compares these timings in the local development site.
