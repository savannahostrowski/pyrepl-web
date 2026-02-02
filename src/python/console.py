from codeop import compile_command
import sys
from _pyrepl.console import Console, Event
from collections import deque
import js
from pyodide.ffi import create_proxy

# ANSI color codes
ANSI_COLORS = {
    "black": "30",
    "red": "31",
    "green": "32",
    "yellow": "33",
    "blue": "34",
    "magenta": "35",
    "cyan": "36",
    "white": "37",
}


def color_to_ansi(color):
    """Convert a color name or hex value to ANSI escape sequence."""
    if color.startswith("#"):
        # Parse hex color (supports #RGB and #RRGGBB)
        hex_val = color[1:]
        if len(hex_val) == 3:
            r = int(hex_val[0] * 2, 16)
            g = int(hex_val[1] * 2, 16)
            b = int(hex_val[2] * 2, 16)
        elif len(hex_val) == 6:
            r = int(hex_val[0:2], 16)
            g = int(hex_val[2:4], 16)
            b = int(hex_val[4:6], 16)
        else:
            return "32"  # Fall back to green
        # Use 24-bit true color: \x1b[38;2;R;G;Bm
        return f"38;2;{r};{g};{b}"
    else:
        return ANSI_COLORS.get(color, "32")


class BrowserConsole(Console):
    def __init__(self, term):
        # term is the xterm.js Terminal instance passed from JS
        self.term = term
        self.event_queue = deque()
        self.encoding = "utf-8"
        self.screen = []
        self.posxy = (0, 0)
        self.height, self.width = self.getheightwidth()
        self._resolve_input = None

    def getheightwidth(self):
        return self.term.rows, self.term.cols

    def refresh(self, screen, xy):
        pass

    def prepare(self):
        pass

    def restore(self):
        pass

    def move_cursor(self, x, y):
        self.term.write(f"\x1b[{y + 1};{x + 1}H")
        self.posxy = (x, y)

    def set_cursor_vis(self, visible):
        self.term.write("\x1b[?25h" if visible else "\x1b[?25l")

    def beep(self):
        self.term.write("\x07")

    def clear(self):
        self.term.write("\x1b[2J\x1b[H")
        self.screen = []
        self.posxy = (0, 0)

    def flushoutput(self):
        pass  # xterm.js writes immediately

    def finish(self):
        pass

    def forgetinput(self):
        self.event_queue.clear()

    def push_char(self, char):
        self.event_queue.append(char)

        if self._resolve_input:
            resolve = self._resolve_input
            self._resolve_input = None
            resolve()

    def getpending(self):
        data = ""
        raw = b""
        while self.event_queue:
            c = self.event_queue.popleft()
            if isinstance(c, bytes):
                raw += c
                data += c.decode(self.encoding, errors="replace")
            else:
                raw += bytes([c])
                data += chr(c)
        return Event("key", data, raw)

    def wait(self, timeout=None):
        return len(self.event_queue) > 0

    async def get_event(self, block=True):
        if not block and not self.event_queue:
            return None

        while not self.event_queue:
            promise = js.Promise.new(
                create_proxy(
                    lambda resolve, reject: setattr(self, "_resolve_input", resolve)
                )
            )
            await promise

        char = self.event_queue.popleft()
        if isinstance(char, int):
            char_str = chr(char)
            raw = bytes([char])
        else:
            char_str = char
            raw = char.encode(self.encoding)
        event = Event("key", char_str, raw)
        return event

    def repaint(self):
        pass


async def start_repl():
    # Create a new console for this terminal instance
    browser_console = BrowserConsole(js.term)

    # Capture startup script before JS moves to next REPL and overwrites it
    startup_script = getattr(js, "pyreplStartupScript", None)
    theme_name = getattr(js, "pyreplTheme", "catppuccin-mocha")
    pygments_fallback = getattr(js, "pyreplPygmentsFallback", "catppuccin-mocha")
    info_line = getattr(js, "pyreplInfo", "Python 3.13 (Pyodide)")
    readonly = getattr(js, "pyreplReadonly", False)
    prompt_color = getattr(js, "pyreplPromptColor", None) or "green"
    pygments_style_js = getattr(js, "pyreplPygmentsStyle", None)
    # Whether to show output from startup script
    src_output = getattr(js, "pyreplSrcOutput", False)
    # Whether to show the Python version startup message
    startup_message = getattr(js, "pyreplStartupMessage", True)

    # Build prompt strings with configured color
    color_code = color_to_ansi(prompt_color)
    PS1 = f"\x1b[{color_code}m>>> \x1b[0m"
    PS2 = f"\x1b[{color_code}m... \x1b[0m"

    # Expose to JS so it can send input (signals JS can proceed to next REPL)
    js.currentBrowserConsole = browser_console

    import micropip
    import rlcompleter
    import re
    import asyncio

    # Lazy-load Pygments in background while REPL starts
    pygments_loaded = False
    lexer = None
    formatter = None

    async def load_pygments():
        nonlocal pygments_loaded, lexer, formatter
        try:
            await micropip.install(["pygments", "catppuccin[pygments]"])
            from pygments.lexers import Python3Lexer
            from pygments.formatters import Terminal256Formatter
            from pygments.styles import get_style_by_name
            from pygments.style import Style
            from pygments.token import string_to_tokentype

            lexer = Python3Lexer()

            # Use custom pygmentsStyle if provided
            if pygments_style_js:
                # Convert JS object to Python dict
                custom_styles = dict(pygments_style_js.to_py())

                # Build style class dynamically
                style_dict = {}
                for token_str, color in custom_styles.items():
                    token = string_to_tokentype(token_str)
                    style_dict[token] = color

                CustomStyle = type("CustomStyle", (Style,), {"styles": style_dict})
                formatter = Terminal256Formatter(style=CustomStyle)
            else:
                # Try theme name as Pygments style, fall back based on background
                try:
                    get_style_by_name(theme_name)
                    style = theme_name
                except Exception:
                    style = pygments_fallback
                formatter = Terminal256Formatter(style=style)

            pygments_loaded = True
        except Exception as e:
            browser_console.term.write(f"[ERROR] Pygments load failed: {e}\r\n")

    # Start loading Pygments in background (non-blocking)
    asyncio.create_task(load_pygments())

    def syntax_highlight(code):
        if not code:
            return ""
        if not pygments_loaded or lexer is None or formatter is None:
            # Return unhighlighted code until Pygments loads
            return code
        try:
            from pygments import highlight

            result = highlight(code, lexer, formatter)
            return result.rstrip("\n")
        except Exception:
            return code

    class TermWriter:
        def write(self, data):
            browser_console.term.write(data.replace("\n", "\r\n"))

        def flush(self):
            pass

    term_writer = TermWriter()

    # Custom exec that redirects stdout/stderr to this REPL's terminal
    import contextlib

    def exec_with_redirect(code, globals_dict):
        old_displayhook = sys.displayhook

        def displayhook(value):
            if value is not None:
                globals_dict["_"] = value
                browser_console.term.write(repr(value) + "\r\n")

        sys.displayhook = displayhook
        try:
            with (
                contextlib.redirect_stdout(term_writer),
                contextlib.redirect_stderr(term_writer),
            ):
                exec(code, globals_dict)
        finally:
            sys.displayhook = old_displayhook

    def clear():
        browser_console.clear()
        if startup_message:
            browser_console.term.write(f"\x1b[90m{info_line}\x1b[0m\r\n")

    class Exit:
        def __repr__(self):
            return "exit is not available in the browser"

        def __call__(self):
            browser_console.term.write("exit is not available in the browser\r\n")

    repl_globals = {
        "__builtins__": __builtins__,
        "clear": clear,
        "exit": Exit(),
        "quit": Exit(),
    }
    completer = rlcompleter.Completer(repl_globals)

    # Run startup script if one was provided
    if startup_script:
        try:
            if src_output:
                # Redirect stdout/stderr to the terminal during startup
                with (
                    contextlib.redirect_stdout(term_writer),
                    contextlib.redirect_stderr(term_writer),
                ):
                    exec(startup_script, repl_globals)
            else:
                # Silently execute (suppress stdout/stderr)
                old_stdout, old_stderr = sys.stdout, sys.stderr
                sys.stdout = sys.stderr = type(
                    "null", (), {"write": lambda s, x: None, "flush": lambda s: None}
                )()
                exec(startup_script, repl_globals)
                sys.stdout, sys.stderr = old_stdout, old_stderr
        except Exception as e:
            if not src_output:
                sys.stdout, sys.stderr = old_stdout, old_stderr
            browser_console.term.write(
                f"\x1b[31mStartup script error - {type(e).__name__}: {e}\x1b[0m\r\n"
            )

        # If startup script defined a setup() function, call it with output visible
        if "setup" in repl_globals and callable(repl_globals["setup"]):
            try:
                exec_with_redirect(compile("setup()", "<setup>", "exec"), repl_globals)
            except Exception as e:
                browser_console.term.write(
                    f"\x1b[31msetup() error - {type(e).__name__}: {e}\x1b[0m\r\n"
                )

    def get_completions(text):
        """Get all completions for the given text."""
        completions = []
        i = 0
        while True:
            c = completer.complete(text, i)
            if c is None:
                break
            completions.append(c)
            i += 1
        return completions

    def get_word_to_complete(line):
        """Extract the word to complete from the end of the line."""
        match = re.search(r"[\w.]*$", line)
        return match.group(0) if match else ""

    # In readonly mode, don't show prompt or accept input
    if readonly:
        return

    browser_console.term.write(PS1)
    lines = []
    current_line = ""

    history = []
    history_index = 0

    while True:
        event = await browser_console.get_event(block=True)
        if event is None:
            continue

        char = event.data
        if char == "\x03":
            # Ctrl+C - interrupt/cancel current input
            browser_console.term.write("^C\r\n")
            lines = []
            current_line = ""
            history_index = len(history)
            browser_console.term.write(PS1)
            continue

        if char == "\x0c":
            # Ctrl+L - clear screen
            clear()
            browser_console.term.write(PS1 + syntax_highlight(current_line))
            continue

        if char == "\x1b":
            # Might be an arrow key
            event2 = await browser_console.get_event(block=True)
            if event2 and event2.data == "[":
                event3 = await browser_console.get_event(block=True)
                if event3:
                    if event3.data == "A":
                        # Up arrow
                        if history:
                            history_index = max(0, history_index - 1)
                            # Clear current line
                            browser_console.term.write("\r\x1b[K")
                            hist_entry = history[history_index]
                            # For multiline entries, only show first line
                            current_line = (
                                hist_entry.split("\n")[0]
                                if "\n" in hist_entry
                                else hist_entry
                            )
                            browser_console.term.write(
                                PS1 + syntax_highlight(current_line)
                            )
                    elif event3.data == "B":
                        # Down arrow
                        if history:
                            history_index = min(len(history), history_index + 1)
                            # Clear current line
                            browser_console.term.write("\r\x1b[K")
                            if history_index < len(history):
                                hist_entry = history[history_index]
                                # For multiline entries, only show first line
                                current_line = (
                                    hist_entry.split("\n")[0]
                                    if "\n" in hist_entry
                                    else hist_entry
                                )
                            else:
                                current_line = ""
                            browser_console.term.write(
                                PS1 + syntax_highlight(current_line)
                            )
                    # Left and Right arrows can be implemented similarly
            continue

        if char == "\r":
            browser_console.term.write("\r\n")

            lines.append(current_line)
            source = "\n".join(lines)

            if not source.strip():
                lines = []
                current_line = ""
                browser_console.term.write(PS1)
                continue

            # If in multiline mode and user entered empty/whitespace line, execute
            if len(lines) > 1 and not current_line.strip():
                # Remove trailing empty lines
                while lines and not lines[-1].strip():
                    lines.pop()
                source = "\n".join(lines)
                try:
                    code = compile(source, "<console>", "single")
                    exec_with_redirect(code, repl_globals)
                    history.append(source)
                    history_index = len(history)
                except SystemExit:
                    pass
                except Exception as e:
                    browser_console.term.write(
                        f"\x1b[31m{type(e).__name__}: {e}\x1b[0m\r\n"
                    )
                lines = []
                current_line = ""
                browser_console.term.write(PS1)
                continue

            try:
                code = compile_command(source, "<console>", "single")
                if code is None:
                    # Incomplete — need more input
                    prev_line = lines[-1] if lines else current_line
                    indent = len(prev_line) - len(prev_line.lstrip())
                    if prev_line.rstrip().endswith(":"):
                        indent += 4
                    browser_console.term.write(PS2 + " " * indent)
                    current_line = " " * indent
                else:
                    # Complete code, execute it
                    if source.strip():
                        history.append(source)
                        history_index = len(history)
                    try:
                        exec_with_redirect(code, repl_globals)
                    except SystemExit:
                        pass
                    except Exception as e:
                        browser_console.term.write(
                            f"\x1b[31m{type(e).__name__}: {e}\x1b[0m\r\n"
                        )
                    lines = []
                    current_line = ""
                    browser_console.term.write(PS1)
            except SyntaxError as e:
                browser_console.term.write(f"\x1b[31mSyntaxError: {e}\x1b[0m\r\n")
                lines = []
                current_line = ""
                browser_console.term.write(PS1)
            except Exception as e:
                browser_console.term.write(f"\x1b[31mError: {e}\x1b[0m\r\n")
                lines = []
                current_line = ""
                browser_console.term.write(PS1)
        elif char == "\t":
            # Tab completion
            word = get_word_to_complete(current_line)
            if word:
                completions = get_completions(word)
                if len(completions) == 1:
                    # Single match - complete it
                    completion = completions[0]
                    current_line = current_line[: -len(word)] + completion
                    browser_console.term.write("\r\x1b[K")
                    prompt = PS1 if len(lines) == 0 else PS2
                    browser_console.term.write(prompt + syntax_highlight(current_line))
                elif len(completions) > 1:
                    # Multiple matches - show them in columns
                    browser_console.term.write("\r\n")
                    max_len = max(len(c) for c in completions) + 2
                    cols = max(1, browser_console.term.cols // max_len)
                    for i, c in enumerate(completions):
                        browser_console.term.write(c.ljust(max_len))
                        if (i + 1) % cols == 0:
                            browser_console.term.write("\r\n")
                    if len(completions) % cols != 0:
                        browser_console.term.write("\r\n")
                    prompt = PS1 if len(lines) == 0 else PS2
                    browser_console.term.write(prompt + syntax_highlight(current_line))
        elif char == "\x7f":
            if current_line:
                current_line = current_line[:-1]
                browser_console.term.write("\r\x1b[K")
                prompt = PS1 if len(lines) == 0 else PS2
                browser_console.term.write(prompt + syntax_highlight(current_line))
        else:
            current_line += char
            # Clear line and rewrite with highlighting
            browser_console.term.write("\r\x1b[K")  # Go to start, clear line
            prompt = PS1 if len(lines) == 0 else PS2
            browser_console.term.write(prompt + syntax_highlight(current_line))
