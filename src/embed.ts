import type { PyodideInterface } from "pyodide";
import { loadPyodide } from "pyodide";
import { Terminal } from '@xterm/xterm';

let pyodidePromise: Promise<PyodideInterface> | null = null;

let currentOutput: Terminal | null = null;

const themes = {
  'catppuccin-mocha': {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    cursorAccent: '#1e1e2e',
    selectionBackground: '#585b70',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: '#585b70',
    brightRed: '#f38ba8',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#f5c2e7',
    brightCyan: '#94e2d5',
    brightWhite: '#a6adc8',
  },
  'catppuccin-latte': {
    background: '#eff1f5',
    foreground: '#4c4f69',
    cursor: '#dc8a78',
    cursorAccent: '#eff1f5',
    selectionBackground: '#acb0be',
    black: '#5c5f77',
    red: '#d20f39',
    green: '#40a02b',
    yellow: '#df8e1d',
    blue: '#1e66f5',
    magenta: '#ea76cb',
    cyan: '#179299',
    white: '#acb0be',
    brightBlack: '#6c6f85',
    brightRed: '#d20f39',
    brightGreen: '#40a02b',
    brightYellow: '#df8e1d',
    brightBlue: '#1e66f5',
    brightMagenta: '#ea76cb',
    brightCyan: '#179299',
    brightWhite: '#bcc0cc',
  },
};

const defaultTheme = 'catppuccin-mocha';

function getPyodide(): Promise<PyodideInterface> {
    if (!pyodidePromise) {
        pyodidePromise = loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.1/full/",
            stdout: (text) => {
                if (currentOutput) {
                    currentOutput.write(text + "\r\n");
                }
            },
            stderr: (text) => {
                if (currentOutput) {
                    currentOutput.write(text + "\r\n");
                }
            },
        });
    }
    return pyodidePromise;
}

function init() {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setup);
    } else {
        setup();
    }
}

function injectStyles() {
  if (document.getElementById('pyrepl-styles')) return;

  // Inject xterm.js CSS from CDN
  const xtermCss = document.createElement('link');
  xtermCss.rel = 'stylesheet';
  xtermCss.href = 'https://cdn.jsdelivr.net/npm/@xterm/xterm/css/xterm.css';
  document.head.appendChild(xtermCss);

  const style = document.createElement('style');
  style.id = 'pyrepl-styles';
  style.textContent = `
    .pyrepl {
      display: inline-block;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
    }
    
    .pyrepl-header {
      background: #181825;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .pyrepl-header-dots {
      display: flex;
      gap: 6px;
    }
    
    .pyrepl-header-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    
    .pyrepl-header-dot.red { background: #f38ba8; }
    .pyrepl-header-dot.yellow { background: #f9e2af; }
    .pyrepl-header-dot.green { background: #a6e3a1; }
    
    .pyrepl-header-title {
      flex: 1;
      text-align: center;
      color: #6c7086;
      font-family: monospace;
      font-size: 13px;
    }
    
    .pyrepl .xterm {
      padding: 8px 12px 12px 12px;
    }

    .pyrepl .xterm-viewport::-webkit-scrollbar {
      display: none;
    }

    .pyrepl .xterm-viewport {
      scrollbar-width: none;
    }
  `;
  document.head.appendChild(style);
}

async function createRepl(container: HTMLElement) {
    injectStyles();
  
    // Create header
    const header = document.createElement('div');
    header.className = 'pyrepl-header';
    header.innerHTML = `
        <div class="pyrepl-header-dots">
        <div class="pyrepl-header-dot red"></div>
        <div class="pyrepl-header-dot yellow"></div>
        <div class="pyrepl-header-dot green"></div>
        </div>
        <div class="pyrepl-header-title">python</div>
        <div style="width: 48px"></div>
    `;
    container.appendChild(header);
    
    // Create terminal container
    const termContainer = document.createElement('div');
    container.appendChild(termContainer);
    const themeName = container.dataset.theme || defaultTheme;
    const theme = themes[themeName as keyof typeof themes] || themes[defaultTheme];
    const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'monospace',
        theme,

    });
    term.open(termContainer);

    const pyodide = await getPyodide();
    await pyodide.loadPackage("micropip");

    // Preload packages if specified
    const packages = container.dataset.packages;
    const packageList = packages ? packages.split(',').map(p => p.trim()).filter(Boolean) : [];
    if (packageList.length > 0) {
        const micropip = pyodide.pyimport("micropip");
        await micropip.install(packageList);
    }

    // Show loaded message (dim gray)
    const loadedPkgs = packageList.length > 0 ? ` + ${packageList.join(', ')}` : '';
    term.write(`\x1b[90mPython 3.13 (Pyodide${loadedPkgs})\x1b[0m\r\n`);

    // Expose terminal to Python
    (globalThis as any).term = term;
    (globalThis as any).pyreplTheme = themeName;

    // Load the browser console code
    const response = await fetch('/python/console.py');
    const consoleCode = await response.text();
    pyodide.runPython(consoleCode);

    // Start the REPL
    pyodide.runPythonAsync('await start_repl()');

    // Get the BrowserConsole class
    const browserConsole = pyodide.globals.get('browser_console');

    //Keep browserConsole alive
    (globalThis as any).browserConsole = browserConsole;

    term.onData((data) => {
        for (const char of data) {
            browserConsole.push_char(char.charCodeAt(0));
        }
    });
}


async function setup() {
    const containers = document.querySelectorAll<HTMLElement>(".pyrepl");

    if (containers.length === 0) {
        console.warn("pyrepl-web: no .pyrepl elements found");
        return;
    }

    containers.forEach(createRepl);
}

init();

