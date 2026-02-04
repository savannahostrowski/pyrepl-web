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
        self.term.write("\x1b[2J\x1b[3J\x1b[H")
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
        else:
            char_str = char
        raw = char_str.encode(self.encoding)
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
    import traceback

    def default_displayhook(value):
        """Default displayhook that writes to the terminal."""
        if value is not None:
            repl_globals["_"] = value
            browser_console.term.write(repr(value) + "\r\n")

    def default_excepthook(exc_type, exc_value, exc_tb):
        """Default excepthook that writes to the terminal in red."""
        # Format the traceback
        lines = traceback.format_exception(exc_type, exc_value, exc_tb)
        for line in lines:
            browser_console.term.write(f"\x1b[31m{line}\x1b[0m".replace("\n", "\r\n"))

    # Set our defaults as the current hooks and save as __displayhook__/__excepthook__
    # so user code can call sys.__excepthook__(type, value, tb) like in CPython
    sys.displayhook = default_displayhook
    sys.excepthook = default_excepthook
    sys.__displayhook__ = default_displayhook
    sys.__excepthook__ = default_excepthook

    async def read_line(prompt="", initial="", history=None, highlight=None, 
                        complete=None, on_ctrl_l=None, on_tab=None, on_enter=None):
        """
        Async readline with cursor movement, history, and optional syntax highlighting.
        Used by both input() and the REPL.
        
        Args:
            prompt: The prompt string to display
            initial: Initial content of the line
            history: Optional list of history entries (modified in place if provided)
            highlight: Optional function to syntax-highlight the line for display
            complete: Optional function(word) -> list of completions
            on_ctrl_l: Optional callback for Ctrl+L (clear screen)
            on_tab: Optional callback(line, cursor_pos) -> (new_line, new_cursor_pos) or None
                    If provided, overrides default tab completion behavior
            on_enter: Optional callback(line) -> (new_line, new_cursor_pos) or None
                    If returns tuple, update line and continue editing (no newline)
                    If returns None, proceed with normal Enter behavior (return line)
        
        Returns:
            The entered line (without trailing newline)
        
        Raises:
            KeyboardInterrupt: If Ctrl+C is pressed
        """
        if highlight is None:
            highlight = lambda x: x
        
        current_line = initial
        cursor_pos = len(current_line)
        history_index = len(history) if history else 0
        
        browser_console.term.write(prompt + highlight(current_line))
        if cursor_pos < len(current_line):
            browser_console.term.write(f"\x1b[{len(current_line) - cursor_pos}D")
        
        while True:
            event = await browser_console.get_event(block=True)
            if event is None:
                continue
            
            char = event.data
            
            if char == "\x03":
                # Ctrl+C - raise KeyboardInterrupt
                browser_console.term.write("^C\r\n")
                raise KeyboardInterrupt()
            
            if char == "\x0c":
                # Ctrl+L - clear screen
                if on_ctrl_l:
                    on_ctrl_l()
                    browser_console.term.write(prompt + highlight(current_line))
                    if cursor_pos < len(current_line):
                        browser_console.term.write(f"\x1b[{len(current_line) - cursor_pos}D")
                continue
            
            if char == "\r" or char == "\n":
                # Check on_enter callback first
                if on_enter:
                    result = on_enter(current_line)
                    if result is not None:
                        # Stay on same line with updated content
                        current_line, cursor_pos = result
                        output = "\r\x1b[K" + prompt + highlight(current_line)
                        if cursor_pos < len(current_line):
                            output += f"\x1b[{len(current_line) - cursor_pos}D"
                        browser_console.term.write(output)
                        continue
                # Normal Enter - return the line
                browser_console.term.write("\r\n")
                return current_line
            
            if char == "\t":
                # Tab completion
                if on_tab:
                    # Custom tab handler (for REPL with multi-match display)
                    result = on_tab(current_line, cursor_pos)
                    if result:
                        current_line, cursor_pos = result
                        output = "\r\x1b[K" + prompt + highlight(current_line)
                        if cursor_pos < len(current_line):
                            output += f"\x1b[{len(current_line) - cursor_pos}D"
                        browser_console.term.write(output)
                elif complete:
                    # Simple completion (for input())
                    word = ""
                    match = re.search(r"[\w.]*$", current_line[:cursor_pos])
                    if match:
                        word = match.group(0)
                    if word:
                        completions = complete(word)
                        if len(completions) == 1:
                            before = current_line[:cursor_pos - len(word)]
                            after = current_line[cursor_pos:]
                            current_line = before + completions[0] + after
                            cursor_pos = len(before) + len(completions[0])
                            output = "\r\x1b[K" + prompt + highlight(current_line)
                            if cursor_pos < len(current_line):
                                output += f"\x1b[{len(current_line) - cursor_pos}D"
                            browser_console.term.write(output)
                continue
            
            if char == "\x1b":
                # Escape sequence
                await asyncio.sleep(0.01)
                if not browser_console.event_queue:
                    # Bare ESC - clear line and return empty
                    browser_console.term.write("\r\x1b[K" + prompt)
                    current_line = ""
                    cursor_pos = 0
                    if history is not None:
                        history_index = len(history)
                    continue
                
                event2 = await browser_console.get_event(block=False)
                if event2 is None:
                    continue
                if event2.data == "[":
                    event3 = await browser_console.get_event(block=True)
                    if event3:
                        if event3.data == "A" and history:
                            # Up arrow
                            history_index = max(0, history_index - 1)
                            browser_console.term.write("\r\x1b[K")
                            hist_entry = history[history_index]
                            current_line = hist_entry.split("\n")[0] if "\n" in hist_entry else hist_entry
                            cursor_pos = len(current_line)
                            browser_console.term.write(prompt + highlight(current_line))
                        elif event3.data == "B" and history:
                            # Down arrow
                            history_index = min(len(history), history_index + 1)
                            browser_console.term.write("\r\x1b[K")
                            if history_index < len(history):
                                hist_entry = history[history_index]
                                current_line = hist_entry.split("\n")[0] if "\n" in hist_entry else hist_entry
                            else:
                                current_line = ""
                            cursor_pos = len(current_line)
                            browser_console.term.write(prompt + highlight(current_line))
                        elif event3.data == "C":
                            # Right arrow
                            if cursor_pos < len(current_line):
                                cursor_pos += 1
                                browser_console.term.write("\x1b[C")
                        elif event3.data == "D":
                            # Left arrow
                            if cursor_pos > 0:
                                cursor_pos -= 1
                                browser_console.term.write("\x1b[D")
                        elif event3.data == "H":
                            # Home key
                            if cursor_pos > 0:
                                browser_console.term.write(f"\x1b[{cursor_pos}D")
                                cursor_pos = 0
                        elif event3.data == "F":
                            # End key
                            if cursor_pos < len(current_line):
                                move = len(current_line) - cursor_pos
                                browser_console.term.write(f"\x1b[{move}C")
                                cursor_pos = len(current_line)
                continue
            
            if char == "\x7f" or char == "\x08":
                # Backspace
                if cursor_pos > 0:
                    current_line = current_line[:cursor_pos - 1] + current_line[cursor_pos:]
                    cursor_pos -= 1
                    output = "\r\x1b[K" + prompt + highlight(current_line)
                    if cursor_pos < len(current_line):
                        output += f"\x1b[{len(current_line) - cursor_pos}D"
                    browser_console.term.write(output)
                continue
            
            # Regular character - insert at cursor
            if len(char) == 1 and ord(char) >= 32:
                current_line = current_line[:cursor_pos] + char + current_line[cursor_pos:]
                cursor_pos += 1
                output = "\r\x1b[K" + prompt + highlight(current_line)
                if cursor_pos < len(current_line):
                    output += f"\x1b[{len(current_line) - cursor_pos}D"
                browser_console.term.write(output)

    # Try to use run_sync, fall back to browser prompt() on iOS/Safari
    _run_sync_works = False
    try:
        from pyodide.ffi import run_sync
        # Test if run_sync actually works (requires JSPI support)
        async def _test_coro():
            return True
        run_sync(_test_coro())
        _run_sync_works = True
    except ImportError:
        pass
    except Exception:
        # run_sync imported but doesn't work (no JSPI) - will use prompt() fallback
        pass

    def sync_input(prompt=""):
        """Synchronous input() - uses run_sync if available, else browser prompt()."""
        sys.stdout.flush()
        sys.stderr.flush()
        
        if _run_sync_works:
            return run_sync(read_line(prompt))
        
        # Fallback: use browser's prompt() dialog
        result = js.prompt(prompt)
        if result is None:
            raise KeyboardInterrupt()  # User cancelled
        return result

    def exec_with_redirect(code, globals_dict):
        try:
            with (
                contextlib.redirect_stdout(term_writer),
                contextlib.redirect_stderr(term_writer),
            ):
                exec(code, globals_dict)
        except SystemExit:
            raise  # Let SystemExit propagate
        except:
            # Use the current excepthook (may be user-overridden)
            sys.excepthook(*sys.exc_info())

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
        "input": sync_input,
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

    # Expose a helper function to call Python functions and return JSON results
    def pyrepl_call(func_name, *args):
        """Call a function from repl_globals and return JSON result."""
        import json
        import io
        if func_name not in repl_globals:
            return json.dumps({"error": f"Function '{func_name}' not found"})
        func = repl_globals[func_name]
        if not callable(func):
            return json.dumps({"error": f"'{func_name}' is not callable"})
        
        # Capture stdout in case function prints instead of returning
        old_stdout = sys.stdout
        sys.stdout = capture = io.StringIO()
        try:
            result = func(*args)
            output = capture.getvalue()
            
            if result is not None:
                return json.dumps({"result": result}, default=str)
            elif output:
                # Function printed instead of returning
                return json.dumps({"output": output})
            else:
                return json.dumps({"result": None})
        except Exception as e:
            return json.dumps({"error": str(e)})
        finally:
            sys.stdout = old_stdout

    js.pyreplCall = create_proxy(pyrepl_call)

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

    lines = []
    history = []

    def handle_tab(current_line, cursor_pos):
        """Handle tab completion, returns (new_line, new_cursor_pos) or None."""
        word = get_word_to_complete(current_line[:cursor_pos])
        if not word:
            return None
        
        completions = get_completions(word)
        if len(completions) == 1:
            # Single match - complete it
            before = current_line[:cursor_pos - len(word)]
            after = current_line[cursor_pos:]
            new_line = before + completions[0] + after
            new_cursor = len(before) + len(completions[0])
            return (new_line, new_cursor)
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
            # Return same line/cursor - read_line will redraw
            return (current_line, cursor_pos)
        return None

    def handle_enter(current_line):
        """Handle Enter key - check for de-indent in multiline mode."""
        # Only de-indent when in multiline mode with just whitespace
        if len(lines) > 0 and not current_line.strip():
            current_indent = len(current_line)
            if current_indent > 0:
                # De-indent by 4 spaces, stay on same line
                new_indent = max(0, current_indent - 4)
                return (" " * new_indent, new_indent)
        # Normal enter - proceed with newline
        return None

    while True:
        prompt = PS1 if len(lines) == 0 else PS2
        initial = ""
        
        # Calculate initial indent for continuation lines
        if lines:
            prev_line = lines[-1]
            initial = " " * (len(prev_line) - len(prev_line.lstrip()))
            if prev_line.rstrip().endswith(":"):
                initial += "    "
        
        try:
            current_line = await read_line(
                prompt=prompt,
                initial=initial,
                history=history if len(lines) == 0 else None,  # Only use history on first line
                highlight=syntax_highlight,
                on_ctrl_l=clear,
                on_tab=handle_tab,
                on_enter=handle_enter,
            )
        except KeyboardInterrupt:
            # Ctrl+C - cancel and restart
            lines = []
            browser_console.term.write(PS1)
            continue
        
        lines.append(current_line)
        source = "\n".join(lines)
        
        if not source.strip():
            lines = []
            continue
        
        # If in multiline mode and user entered empty line at indent 0, execute
        if len(lines) > 1 and not current_line.strip():
            # At indent level 0 with empty line - execute the code
            while lines and not lines[-1].strip():
                lines.pop()
            source = "\n".join(lines)
            try:
                code = compile(source, "<console>", "single")
                exec_with_redirect(code, repl_globals)
                history.append(source)
            except SystemExit:
                pass
            except SyntaxError as e:
                with contextlib.redirect_stdout(term_writer), contextlib.redirect_stderr(term_writer):
                    sys.excepthook(type(e), e, e.__traceback__)
            lines = []
            continue
        
        try:
            code = compile_command(source, "<console>", "single")
            if code is None:
                # Incomplete — need more input (will auto-indent on next iteration)
                continue
            else:
                # Complete code, execute it
                if source.strip():
                    history.append(source)
                exec_with_redirect(code, repl_globals)
                lines = []
        except SyntaxError as e:
            with contextlib.redirect_stdout(term_writer), contextlib.redirect_stderr(term_writer):
                sys.excepthook(type(e), e, e.__traceback__)
            lines = []
        except Exception as e:
            with contextlib.redirect_stdout(term_writer), contextlib.redirect_stderr(term_writer):
                sys.excepthook(type(e), e, e.__traceback__)
            lines = []
