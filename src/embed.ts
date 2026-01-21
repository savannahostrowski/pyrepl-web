import type { PyodideInterface } from "pyodide";
import { loadPyodide } from "pyodide";
import { Terminal } from '@xterm/xterm';

// Theme interface for full customization
export interface PyreplTheme {
  // Terminal colors
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
  // Header colors (optional - will derive from terminal colors if not provided)
  headerBackground?: string;
  headerTitle?: string;
  // Box shadow (optional)
  shadow?: string;
}

// Global theme registry that users can add to
declare global {
  interface Window {
    pyreplThemes?: Record<string, PyreplTheme>;
  }
  // Globals exposed to Python via Pyodide
  var term: Terminal;
  var pyreplTheme: string;
  var pyreplInfo: string;
  var pyreplStartupScript: string | undefined;
  var pyreplReadonly: boolean;
  var browserConsole: any;
}

let pyodidePromise: Promise<PyodideInterface> | null = null;

let currentOutput: Terminal | null = null;

const builtinThemes: Record<string, PyreplTheme> = {
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
    headerBackground: '#181825',
    headerTitle: '#6c7086',
    shadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
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
    headerBackground: '#dce0e8',
    headerTitle: '#8c8fa1',
    shadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
  },
};

const defaultTheme = 'catppuccin-mocha';

// SVG icons for header buttons
const icons = {
  copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  clear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`,
};

// Configuration parsed from data attributes
interface PyreplConfig {
  theme: PyreplTheme;
  themeName: string;
  showHeader: boolean;
  showButtons: boolean;
  title: string;
  packages: string[];
  src: string | null;
  readonly: boolean;
}

// Parse all configuration from container data attributes
function parseConfig(container: HTMLElement): PyreplConfig {
  // Resolve theme
  let theme: PyreplTheme;
  let themeName: string;

  const inlineConfig = container.dataset.themeConfig;
  if (inlineConfig) {
    try {
      theme = JSON.parse(inlineConfig) as PyreplTheme;
      themeName = 'custom';
    } catch (e) {
      console.warn('pyrepl-web: invalid data-theme-config JSON, falling back to default');
      theme = builtinThemes[defaultTheme]!;
      themeName = defaultTheme;
    }
  } else {
    themeName = container.dataset.theme || defaultTheme;
    theme = window.pyreplThemes?.[themeName]
      || builtinThemes[themeName]
      || builtinThemes[defaultTheme]!;

    if (!window.pyreplThemes?.[themeName] && !builtinThemes[themeName]) {
      console.warn(`pyrepl-web: unknown theme "${themeName}", falling back to default`);
      themeName = defaultTheme;
    }
  }

  // Parse packages
  const packagesAttr = container.dataset.packages;
  const packages = packagesAttr
    ? packagesAttr.split(',').map(p => p.trim()).filter(Boolean)
    : [];

  return {
    theme,
    themeName,
    showHeader: container.dataset.header !== 'false',
    showButtons: container.dataset.buttons !== 'false',
    title: container.dataset.title || 'python',
    packages,
    src: container.dataset.src || null,
    readonly: container.dataset.readonly === 'true',
  };
}

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
      box-shadow: var(--pyrepl-shadow);
    }

    .pyrepl-header {
      background: var(--pyrepl-header-bg);
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

    .pyrepl-header-dot.red { background: var(--pyrepl-red); }
    .pyrepl-header-dot.yellow { background: var(--pyrepl-yellow); }
    .pyrepl-header-dot.green { background: var(--pyrepl-green); }

    .pyrepl-header-title {
      flex: 1;
      text-align: center;
      color: var(--pyrepl-header-title);
      font-family: monospace;
      font-size: 13px;
    }

    .pyrepl-header-buttons {
      display: flex;
      gap: 4px;
    }

    .pyrepl-header-btn {
      background: transparent;
      border: none;
      color: var(--pyrepl-header-title);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      transition: opacity 0.15s;
    }

    .pyrepl-header-btn:hover {
      opacity: 1;
    }

    .pyrepl-header-btn svg {
      width: 14px;
      height: 14px;
    }

    .pyrepl .xterm {
      padding: 8px 12px 12px 12px;
    }

    .pyrepl .xterm-viewport::-webkit-scrollbar {
      display: none;
    }

    .pyrepl .xterm-viewport {
      scrollbar-width: none;
      background-color: var(--pyrepl-bg) !important;
    }
  `;
  document.head.appendChild(style);
}

// Apply theme CSS variables to a container
function applyThemeVariables(container: HTMLElement, theme: PyreplTheme) {
  // Derive header background from terminal background (slightly darker/lighter)
  const headerBg = theme.headerBackground || theme.black;
  const headerTitle = theme.headerTitle || theme.brightBlack;
  const shadow = theme.shadow || '0 4px 24px rgba(0, 0, 0, 0.3)';

  container.style.setProperty('--pyrepl-bg', theme.background);
  container.style.setProperty('--pyrepl-header-bg', headerBg);
  container.style.setProperty('--pyrepl-header-title', headerTitle);
  container.style.setProperty('--pyrepl-red', theme.red);
  container.style.setProperty('--pyrepl-yellow', theme.yellow);
  container.style.setProperty('--pyrepl-green', theme.green);
  container.style.setProperty('--pyrepl-shadow', shadow);
}

function createHeader(config: PyreplConfig): HTMLElement {
    const header = document.createElement('div');
    header.className = 'pyrepl-header';
    header.innerHTML = `
        <div class="pyrepl-header-dots">
            <div class="pyrepl-header-dot red"></div>
            <div class="pyrepl-header-dot yellow"></div>
            <div class="pyrepl-header-dot green"></div>
        </div>
        <div class="pyrepl-header-title">${config.title}</div>
        ${config.showButtons ? `
        <div class="pyrepl-header-buttons">
            <button class="pyrepl-header-btn" data-action="copy" title="Copy output">${icons.copy}</button>
            <button class="pyrepl-header-btn" data-action="clear" title="Clear terminal">${icons.clear}</button>
        </div>
        ` : '<div style="width: 48px"></div>'}
    `;
    return header;
}

async function createRepl(container: HTMLElement) {
    injectStyles();

    const config = parseConfig(container);

    // Apply theme CSS variables for header styling
    applyThemeVariables(container, config.theme);

    if (config.showHeader) {
        container.appendChild(createHeader(config));
    }

    // Create terminal container
    const termContainer = document.createElement('div');
    container.appendChild(termContainer);
    const term = new Terminal({
        cursorBlink: !config.readonly,
        cursorStyle: config.readonly ? 'bar' : 'block',
        fontSize: 14,
        fontFamily: 'monospace',
        theme: config.theme,
        disableStdin: config.readonly,
    });
    term.open(termContainer);

    const pyodide = await getPyodide();
    await pyodide.loadPackage("micropip");

    // Preload packages if specified
    if (config.packages.length > 0) {
        const micropip = pyodide.pyimport("micropip");
        await micropip.install(config.packages);
    }

    // Show loaded message (dim gray)
    const loadedPkgs = config.packages.length > 0 ? ` (installed packages: ${config.packages.join(', ')})` : '';
    const infoLine = `Python 3.13${loadedPkgs}`;
    term.write(`\x1b[90m${infoLine}\x1b[0m\r\n`);

    // Expose globals to Python
    globalThis.term = term;
    globalThis.pyreplTheme = config.themeName;
    globalThis.pyreplInfo = infoLine;
    globalThis.pyreplReadonly = config.readonly;

    // Pre-fetch startup script if specified (before starting REPL)
    if (config.src) {
        try {
            const response = await fetch(config.src);
            if (response.ok) {
                globalThis.pyreplStartupScript = await response.text();
            } else {
                console.warn(`pyrepl-web: failed to fetch script from ${config.src}`);
            }
        } catch (e) {
            console.warn(`pyrepl-web: error fetching script from ${config.src}`, e);
        }
    }

    // Load and start the Python REPL
    const consoleCode = await fetch('/python/console.py').then(r => r.text());
    pyodide.runPython(consoleCode);
    pyodide.runPythonAsync('await start_repl()');

    // Keep browserConsole reference alive for input handling
    const browserConsole = pyodide.globals.get('browser_console');
    globalThis.browserConsole = browserConsole;

    // Only attach input handler if not readonly
    if (!config.readonly) {
        term.onData((data) => {
            for (const char of data) {
                browserConsole.push_char(char.charCodeAt(0));
            }
        });
    }

    // Set up button handlers
    if (config.showHeader && config.showButtons) {
        const copyBtn = container.querySelector('[data-action="copy"]');
        const clearBtn = container.querySelector('[data-action="clear"]');

        copyBtn?.addEventListener('click', () => {
            // Get all terminal content
            const buffer = term.buffer.active;
            let text = '';
            for (let i = 0; i < buffer.length; i++) {
                const line = buffer.getLine(i);
                if (line) {
                    text += line.translateToString(true) + '\n';
                }
            }
            navigator.clipboard.writeText(text.trimEnd());
        });

        clearBtn?.addEventListener('click', () => {
            term.reset();
            term.write(`\x1b[90m${infoLine}\x1b[0m\r\n`);
            term.write('\x1b[32m>>> \x1b[0m');
        });
    }
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

