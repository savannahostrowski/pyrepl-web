import type { PyodideInterface } from "pyodide";

// Re-export Terminal type for use throughout the file
type Terminal = import("@xterm/xterm").Terminal;

// Simplified theme interface - users only need to specify what they want to customize
export interface PyreplTheme {
  // Required: basic colors
  background: string;
  foreground: string;
  // Optional: header colors (defaults derived from background/foreground)
  headerBackground?: string;
  headerForeground?: string;
  // Optional: prompt color - hex or ANSI name (default: green)
  promptColor?: string;
  // Optional: custom syntax highlighting styles (Pygments token -> color)
  pygmentsStyle?: Record<string, string>;
}

// Internal full theme with all xterm.js colors resolved
interface FullTheme extends PyreplTheme {
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
}

// Global theme registry that users can add to
declare global {
  interface Window {
    pyreplThemes?: Record<string, PyreplTheme>;
  }
  // Globals exposed to Python via Pyodide
  var term: Terminal;
  var pyreplTheme: string;
  var pyreplPygmentsFallback: string;
  var pyreplInfo: string;
  var pyreplStartupScript: string | undefined;
  var pyreplReadonly: boolean;
  var pyreplPromptColor: string;
  var pyreplPygmentsStyle: Record<string, string> | undefined;
  var pyreplSrcOutput: boolean;
  var pyreplStartupMessage: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: Python console from Pyodide
  var currentBrowserConsole: any;
}

let pyodidePromise: Promise<PyodideInterface> | null = null;
let consoleCodePromise: Promise<string> | null = null;

// Queue to serialize REPL initialization (they share globals)
let initQueue: Promise<void> = Promise.resolve();

// Full builtin themes with all ANSI colors
const builtinThemes: Record<string, FullTheme> = {
  "catppuccin-mocha": {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    cursorAccent: "#1e1e2e",
    selectionBackground: "#585b70",
    black: "#45475a",
    red: "#f38ba8",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    blue: "#89b4fa",
    magenta: "#f5c2e7",
    cyan: "#94e2d5",
    white: "#bac2de",
    brightBlack: "#585b70",
    brightRed: "#f38ba8",
    brightGreen: "#a6e3a1",
    brightYellow: "#f9e2af",
    brightBlue: "#89b4fa",
    brightMagenta: "#f5c2e7",
    brightCyan: "#94e2d5",
    brightWhite: "#a6adc8",
    headerBackground: "#181825",
    headerForeground: "#6c7086",
  },
  "catppuccin-latte": {
    background: "#eff1f5",
    foreground: "#4c4f69",
    cursor: "#dc8a78",
    cursorAccent: "#eff1f5",
    selectionBackground: "#acb0be",
    black: "#5c5f77",
    red: "#d20f39",
    green: "#40a02b",
    yellow: "#df8e1d",
    blue: "#1e66f5",
    magenta: "#ea76cb",
    cyan: "#179299",
    white: "#acb0be",
    brightBlack: "#6c6f85",
    brightRed: "#d20f39",
    brightGreen: "#40a02b",
    brightYellow: "#df8e1d",
    brightBlue: "#1e66f5",
    brightMagenta: "#ea76cb",
    brightCyan: "#179299",
    brightWhite: "#bcc0cc",
    headerBackground: "#dce0e8",
    headerForeground: "#8c8fa1",
  },
};

const defaultTheme = "catppuccin-mocha";

// Determine if a color is "dark" based on luminance
function isDarkColor(hex: string): boolean {
  // Handle non-hex colors by assuming dark
  if (!hex.startsWith("#")) return true;
  const rgb = hex.slice(1);
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  // Relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

// Resolve a partial theme to a full theme by merging with appropriate base
function resolveTheme(theme: PyreplTheme | FullTheme): FullTheme {
  // If it's already a full theme (has ANSI colors), return as-is
  if ("black" in theme && "red" in theme) {
    return theme as FullTheme;
  }

  // Pick base theme based on background luminance
  const baseThemeName = isDarkColor(theme.background)
    ? "catppuccin-mocha"
    : "catppuccin-latte";
  const base = builtinThemes[baseThemeName] as FullTheme;

  // Merge user theme with base, preserving all base ANSI colors
  const resolved: FullTheme = {
    // All ANSI colors from base
    cursor: base.cursor,
    cursorAccent: base.cursorAccent,
    selectionBackground: base.selectionBackground,
    black: base.black,
    red: base.red,
    green: base.green,
    yellow: base.yellow,
    blue: base.blue,
    magenta: base.magenta,
    cyan: base.cyan,
    white: base.white,
    brightBlack: base.brightBlack,
    brightRed: base.brightRed,
    brightGreen: base.brightGreen,
    brightYellow: base.brightYellow,
    brightBlue: base.brightBlue,
    brightMagenta: base.brightMagenta,
    brightCyan: base.brightCyan,
    brightWhite: base.brightWhite,
    // User-provided colors
    background: theme.background,
    foreground: theme.foreground,
    headerBackground: theme.headerBackground ?? base.headerBackground,
    headerForeground: theme.headerForeground ?? base.headerForeground,
    promptColor: theme.promptColor,
    pygmentsStyle: theme.pygmentsStyle,
  };

  return resolved;
}

// SVG icons for header buttons
const icons = {
  copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  clear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`,
};

// Configuration parsed from data attributes
interface PyreplConfig {
  theme: FullTheme;
  themeName: string;
  showHeader: boolean;
  showButtons: boolean;
  title: string;
  packages: string[];
  src: string | null;
  srcOutput: boolean;
  startupMessage: boolean;
  readonly: boolean;
  fontSize: number;
}

// Parse all configuration from container data attributes
function parseConfig(container: HTMLElement): PyreplConfig {
  // Resolve theme
  let theme: FullTheme;
  let themeName: string;

  const inlineConfig = container.dataset.themeConfig;
  if (inlineConfig) {
    try {
      const parsed = JSON.parse(inlineConfig) as PyreplTheme;
      theme = resolveTheme(parsed);
      themeName = "custom";
    } catch {
      console.warn(
        "pyrepl-web: invalid data-theme-config JSON, falling back to default",
      );
      theme = builtinThemes[defaultTheme] as FullTheme;
      themeName = defaultTheme;
    }
  } else {
    themeName = container.dataset.theme || defaultTheme;
    const rawTheme =
      window.pyreplThemes?.[themeName] ||
      builtinThemes[themeName] ||
      (builtinThemes[defaultTheme] as FullTheme);
    theme = resolveTheme(rawTheme);

    if (!window.pyreplThemes?.[themeName] && !builtinThemes[themeName]) {
      console.warn(
        `pyrepl-web: unknown theme "${themeName}", falling back to default`,
      );
      themeName = defaultTheme;
    }
  }

  // Parse packages
  const packagesAttr = container.dataset.packages;
  const packages = packagesAttr
    ? packagesAttr
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return {
    theme,
    themeName,
    showHeader: container.dataset.header !== "false",
    showButtons: container.dataset.buttons !== "false",
    title: container.dataset.title || "python",
    packages,
    src: container.dataset.src || null,
    srcOutput:
      container.dataset.srcOutput === "true" ||
      container.getAttribute("src-output") === "true",
    startupMessage:
      container.dataset.startupMessage !== "false" &&
      container.getAttribute("startup-message") !== "false",
    readonly: container.dataset.readonly === "true",
    fontSize: Number.parseInt(container.dataset.fontSize || "14", 10),
  };
}

async function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    const { loadPyodide } = await import("pyodide");
    pyodidePromise = loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.2/full/",
      // Suppress Pyodide's internal logging (Loading/Loaded messages)
      stdout: () => {},
      stderr: () => {},
    });
  }
  return await pyodidePromise;
}

function getConsoleCode(): Promise<string> {
  if (!consoleCodePromise) {
    consoleCodePromise = fetch("/python/console.py").then((r) => r.text());
  }
  return consoleCodePromise;
}

export class PyReplEmbed {
  private container: HTMLElement;
  private theme: string;
  private packages: string[];
  private readonly: boolean;
  private src: string | undefined;
  private showHeader: boolean;
  private showButtons: boolean;
  private title: string;

  constructor(config: {
    container: HTMLElement;
    theme?: string;
    packages?: string[];
    readonly?: boolean;
    src?: string;
    showHeader?: boolean;
    showButtons?: boolean;
    title?: string;
  }) {
    this.container = config.container;
    this.theme = config.theme || defaultTheme;
    this.packages = config.packages || [];
    this.readonly = config.readonly || false;
    this.src = config.src;
    this.showHeader =
      config.showHeader !== undefined ? config.showHeader : true;
    this.showButtons =
      config.showButtons !== undefined ? config.showButtons : true;
    this.title = config.title || "python";
  }

  async init() {
    this.container.dataset.theme = this.theme;
    this.container.dataset.packages = this.packages.join(",");
    this.container.dataset.readonly = this.readonly ? "true" : "false";
    if (this.src) {
      this.container.dataset.src = this.src;
    }
    this.container.dataset.header = this.showHeader ? "true" : "false";
    this.container.dataset.buttons = this.showButtons ? "true" : "false";
    this.container.dataset.title = this.title;

    // Create terminal immediately (fast, shows UI)
    const { term, config } = await createTerminal(this.container);

    // Queue the Python REPL initialization to avoid race conditions with shared globals
    initQueue = initQueue.then(() => createRepl(this.container, term, config));
    await initQueue;
  }
}

function init() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
}

function injectStyles() {
  if (document.getElementById("pyrepl-styles")) return;

  // Inject xterm.js CSS from CDN
  const xtermCss = document.createElement("link");
  xtermCss.rel = "stylesheet";
  xtermCss.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm/css/xterm.css";
  document.head.appendChild(xtermCss);

  const style = document.createElement("style");
  style.id = "pyrepl-styles";
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
function applyThemeVariables(container: HTMLElement, theme: FullTheme) {
  const headerBg = theme.headerBackground || theme.black;
  const headerFg = theme.headerForeground || theme.brightBlack;

  container.style.setProperty("--pyrepl-bg", theme.background);
  container.style.setProperty("--pyrepl-header-bg", headerBg);
  container.style.setProperty("--pyrepl-header-title", headerFg);
  container.style.setProperty("--pyrepl-red", theme.red);
  container.style.setProperty("--pyrepl-yellow", theme.yellow);
  container.style.setProperty("--pyrepl-green", theme.green);
  container.style.setProperty(
    "--pyrepl-shadow",
    "0 4px 24px rgba(0, 0, 0, 0.3)",
  );
}

function createHeader(config: PyreplConfig): HTMLElement {
  const header = document.createElement("div");
  header.className = "pyrepl-header";

  // Build header with safe text content (avoid XSS)
  const dots = document.createElement("div");
  dots.className = "pyrepl-header-dots";
  dots.innerHTML = `
    <div class="pyrepl-header-dot red"></div>
    <div class="pyrepl-header-dot yellow"></div>
    <div class="pyrepl-header-dot green"></div>
  `;

  const title = document.createElement("div");
  title.className = "pyrepl-header-title";
  title.textContent = config.title; // Safe: textContent escapes HTML

  header.appendChild(dots);
  header.appendChild(title);

  if (config.showButtons) {
    const buttons = document.createElement("div");
    buttons.className = "pyrepl-header-buttons";
    buttons.innerHTML = `
      <button class="pyrepl-header-btn" data-action="copy" title="Copy output">${icons.copy}</button>
      <button class="pyrepl-header-btn" data-action="clear" title="Clear terminal">${icons.clear}</button>
    `;
    header.appendChild(buttons);
  } else {
    const spacer = document.createElement("div");
    spacer.style.width = "48px";
    header.appendChild(spacer);
  }

  return header;
}

// Create terminal UI without initializing Python (fast, shows background immediately)
async function createTerminal(
  container: HTMLElement,
): Promise<{ term: Terminal; config: PyreplConfig }> {
  injectStyles();

  const config = parseConfig(container);

  // Apply theme CSS variables for header styling
  applyThemeVariables(container, config.theme);

  if (config.showHeader) {
    container.appendChild(createHeader(config));
  }

  // Dynamically import xterm.js only when needed
  const XTerm = await import("@xterm/xterm");

  // Create terminal container
  const termContainer = document.createElement("div");
  termContainer.style.flex = "1";
  termContainer.style.minHeight = "0";
  container.appendChild(termContainer);
  const term = new XTerm.Terminal({
    cursorBlink: !config.readonly,
    cursorStyle: config.readonly ? "bar" : "block",
    fontSize: config.fontSize,
    fontFamily: "monospace",
    theme: config.theme,
    disableStdin: config.readonly,
  });
  term.open(termContainer);

  // Calculate size based on actual rendered character dimensions
  const calculateSize = () => {
    // Get actual character dimensions from xterm's internal renderer
    // biome-ignore lint/suspicious/noExplicitAny: Accessing xterm internals
    const core = (term as any)._core;
    const cellWidth = core._renderService?.dimensions?.css?.cell?.width;
    const cellHeight = core._renderService?.dimensions?.css?.cell?.height;

    if (!cellWidth || !cellHeight) {
      return null; // Not ready yet
    }

    // Get the xterm element and compute available space minus padding
    const xtermElement = termContainer.querySelector(".xterm");
    if (!xtermElement) {
      return null;
    }

    // Get computed padding from the xterm element
    const style = window.getComputedStyle(xtermElement);
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;

    // Use termContainer dimensions and subtract padding
    const availableWidth =
      termContainer.clientWidth - paddingLeft - paddingRight;
    const availableHeight =
      termContainer.clientHeight - paddingTop - paddingBottom;

    const cols = Math.max(20, Math.floor(availableWidth / cellWidth));
    const rows = Math.max(5, Math.floor(availableHeight / cellHeight));

    return { rows, cols };
  };

  // Resize to actual container size after layout
  requestAnimationFrame(() => {
    const size = calculateSize();
    if (size) {
      term.resize(size.cols, size.rows);
    }
  });

  // Re-fit on container resize
  const resizeObserver = new ResizeObserver(() => {
    const size = calculateSize();
    if (size) {
      term.resize(size.cols, size.rows);
    }
  });
  resizeObserver.observe(termContainer);

  return { term, config };
}

async function createRepl(
  replContainer: HTMLElement,
  term: Terminal,
  config: PyreplConfig,
) {
  const pyodide = await getPyodide();
  await pyodide.loadPackage("micropip");

  // Preload packages if specified
  if (config.packages.length > 0) {
    const micropip = pyodide.pyimport("micropip");
    await micropip.install(config.packages);
  }

  // Show loaded message (dim gray) if startup message is enabled
  const loadedPkgs =
    config.packages.length > 0
      ? ` (installed packages: ${config.packages.join(", ")})`
      : "";
  const infoLine = `Python 3.13${loadedPkgs}`;
  if (config.startupMessage) {
    term.write(`\x1b[90m${infoLine}\x1b[0m\r\n`);
  }

  // Expose globals to Python
  globalThis.term = term;
  globalThis.pyreplTheme = config.themeName;
  globalThis.pyreplPygmentsFallback = isDarkColor(config.theme.background)
    ? "catppuccin-mocha"
    : "catppuccin-latte";
  globalThis.pyreplInfo = infoLine;
  globalThis.pyreplReadonly = config.readonly;
  globalThis.pyreplPromptColor = config.theme.promptColor || "green";
  globalThis.pyreplPygmentsStyle = config.theme.pygmentsStyle;
  globalThis.pyreplSrcOutput = config.srcOutput;
  globalThis.pyreplStartupMessage = config.startupMessage;

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
  const consoleCode = await getConsoleCode();
  pyodide.runPython(consoleCode);
  pyodide.runPythonAsync("await start_repl()");

  // Wait for Python to set currentBrowserConsole
  // biome-ignore lint/suspicious/noExplicitAny: Python-set global
  while (!(globalThis as any).currentBrowserConsole) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  // biome-ignore lint/suspicious/noExplicitAny: Python-set global
  const browserConsole = (globalThis as any).currentBrowserConsole;

  // Expose the console on the container element for external access (e.g., virtual keyboard buttons)
  (replContainer as any).pyreplConsole = browserConsole;

  // Clear globals so next REPL starts fresh
  // biome-ignore lint/suspicious/noExplicitAny: Python-set global
  (globalThis as any).currentBrowserConsole = null;
  // biome-ignore lint/suspicious/noExplicitAny: Python-set global
  (globalThis as any).term = null;
  globalThis.pyreplStartupScript = undefined;
  globalThis.pyreplTheme = "";
  globalThis.pyreplPygmentsFallback = "";
  globalThis.pyreplInfo = "";
  globalThis.pyreplReadonly = false;
  globalThis.pyreplPromptColor = "";
  globalThis.pyreplPygmentsStyle = undefined;

  // Only attach input handler if not readonly
  if (!config.readonly) {
    term.onData((data: string) => {
      for (const char of data) {
        browserConsole.push_char(char.charCodeAt(0));
      }
    });

    // Focus the terminal so user can start typing immediately
    term.focus();
  }

  // Set up button handlers
  if (config.showHeader && config.showButtons) {
    const copyBtn = replContainer.querySelector('[data-action="copy"]');
    const clearBtn = replContainer.querySelector('[data-action="clear"]');

    copyBtn?.addEventListener("click", () => {
      // Get all terminal content
      const buffer = term.buffer.active;
      let text = "";
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          text += `${line.translateToString(true)}\n`;
        }
      }
      navigator.clipboard.writeText(text.trimEnd());
    });

    clearBtn?.addEventListener("click", () => {
      term.reset();
      term.write(`\x1b[90m${infoLine}\x1b[0m\r\n`);
      term.write("\x1b[32m>>> \x1b[0m");
    });
  }
}

async function setup() {
  // Find .pyrepl elements that are NOT inside a <py-repl> web component
  // and haven't already been initialized
  const allContainers = document.querySelectorAll<HTMLElement>(".pyrepl");
  const containers = Array.from(allContainers).filter(
    (el) => !el.closest("py-repl") && !el.dataset.pyreplInitialized,
  );

  if (containers.length === 0) {
    return;
  }

  // Mark containers as initialized to prevent double init
  for (const el of containers) {
    el.dataset.pyreplInitialized = "true";
  }

  // Create all terminals first (fast, shows backgrounds immediately)
  const repls = await Promise.all(
    Array.from(containers).map(async (container) => ({
      container,
      ...(await createTerminal(container)),
    })),
  );

  // Queue Python REPL initialization to avoid race conditions with shared globals
  for (const { container, term, config } of repls) {
    initQueue = initQueue.then(() => createRepl(container, term, config));
  }
  await initQueue;
}

init();
