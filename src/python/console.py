from codeop import compile_command
import sys
from _pyrepl.console import Console, Event
from _pyrepl.reader import Reader
from collections import deque
import js
from pyodide.ffi import create_proxy



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
        # TODO: redraw screen
        pass

    def prepare(self):
        # TODO: setup
        pass

    def restore(self):
        # TODO: teardown
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


browser_console = BrowserConsole(js.term)


async def start_repl():
    import micropip
    import rlcompleter
    import re

    await micropip.install("catppuccin[pygments]")

    from pygments import highlight
    from pygments.lexers import Python3Lexer
    from pygments.formatters import Terminal256Formatter

    lexer = Python3Lexer()
    theme_name = getattr(js, "pyreplTheme", "catppuccin-mocha")
    formatter = Terminal256Formatter(style=theme_name)

    def syntax_highlight(code):
        if not code:
            return ""
        result = highlight(code, lexer, formatter)
        return result.rstrip('\n')

    class TermWriter:
        def write(self, data):
            browser_console.term.write(data.replace('\n', '\r\n'))
        def flush(self):
            pass
    
    sys.stdout = TermWriter()
    sys.stderr = TermWriter()

    def displayhook(value):
        if value is not None:
            repl_globals['_'] = value
            browser_console.term.write(repr(value) + "\r\n")

    sys.displayhook = displayhook

    def clear():
        browser_console.clear()
        info = getattr(js, "pyreplInfo", "Python 3.13 (Pyodide)")
        browser_console.term.write(f"\x1b[90m{info}\x1b[0m\r\n")

    class Exit:
        def __repr__(self):
            return "exit is not available in the browser"
        def __call__(self):
            browser_console.term.write("exit is not available in the browser\r\n")

    repl_globals = {"__builtins__": __builtins__, "clear": clear, "exit": Exit(), "quit": Exit()}
    completer = rlcompleter.Completer(repl_globals)

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
        match = re.search(r'[\w.]*$', line)
        return match.group(0) if match else ""

    browser_console.term.write("\x1b[32m>>> \x1b[0m")
    lines = []
    current_line = ""

    history = []
    history_index = 0

    while True:
        event = await browser_console.get_event(block=True)
        if event is None:
            continue

        char = event.data
        if char == '\x1b':
            # Might be an arrow key
            event2 = await browser_console.get_event(block=True)
            if event2 and event2.data == '[':
                event3 = await browser_console.get_event(block=True)
                if event3:
                    if event3.data == 'A':
                        # Up arrow
                        if history:
                            history_index = max(0, history_index - 1)
                            # Clear current line
                            browser_console.term.write('\r\x1b[K')
                            hist_entry = history[history_index]
                            # For multiline entries, only show first line
                            current_line = hist_entry.split('\n')[0] if '\n' in hist_entry else hist_entry
                            browser_console.term.write("\x1b[32m>>> \x1b[0m" + syntax_highlight(current_line))
                    elif event3.data == 'B':
                        # Down arrow
                        if history:
                            history_index = min(len(history), history_index + 1)
                            # Clear current line
                            browser_console.term.write('\r\x1b[K')
                            if history_index < len(history):
                                hist_entry = history[history_index]
                                # For multiline entries, only show first line
                                current_line = hist_entry.split('\n')[0] if '\n' in hist_entry else hist_entry
                            else:
                                current_line = ""
                            browser_console.term.write("\x1b[32m>>> \x1b[0m" + syntax_highlight(current_line))
                    # Left and Right arrows can be implemented similarly
            continue

        if char == '\r':
            browser_console.term.write("\r\n")

            lines.append(current_line)
            source = "\n".join(lines)

            if not source.strip():
                lines = []
                current_line = ""
                browser_console.term.write("\x1b[32m>>> \x1b[0m")
                continue

            # If in multiline mode and user entered empty/whitespace line, execute
            if len(lines) > 1 and not current_line.strip():
                # Remove trailing empty lines
                while lines and not lines[-1].strip():
                    lines.pop()
                source = "\n".join(lines)
                try:
                    code = compile(source, "<console>", "single")
                    exec(code, repl_globals)
                    history.append(source)
                    history_index = len(history)
                except SystemExit:
                    pass
                except Exception as e:
                    browser_console.term.write(f"\x1b[31m{type(e).__name__}: {e}\x1b[0m\r\n")
                lines = []
                current_line = ""
                browser_console.term.write("\x1b[32m>>> \x1b[0m")
                continue
            
            try:
                code = compile_command(source, "<console>", "single")
                if code is None:
                    # Incomplete — need more input
                    prev_line = lines[-1] if lines else current_line
                    indent = len(prev_line) - len(prev_line.lstrip())
                    if prev_line.rstrip().endswith(':'):
                        indent += 4
                    browser_console.term.write("\x1b[32m... \x1b[0m" + " " * indent)
                    current_line = " " * indent
                else:
                    # Complete code, execute it
                    if source.strip():
                        history.append(source)
                        history_index = len(history)
                    try:
                        exec(code, repl_globals)
                    except SystemExit:
                        pass
                    except Exception as e:
                        browser_console.term.write(f"\x1b[31m{type(e).__name__}: {e}\x1b[0m\r\n")
                    lines = []
                    current_line = ""
                    browser_console.term.write("\x1b[32m>>> \x1b[0m")
            except SyntaxError as e:
                browser_console.term.write(f"\x1b[31mSyntaxError: {e}\x1b[0m\r\n")
                lines = []
                current_line = ""
                browser_console.term.write("\x1b[32m>>> \x1b[0m")
            except Exception as e:
                browser_console.term.write(f"\x1b[31mError: {e}\x1b[0m\r\n")
                lines = []
                current_line = ""
                browser_console.term.write("\x1b[32m>>> \x1b[0m")
        elif char == '\t':
            # Tab completion
            word = get_word_to_complete(current_line)
            if word:
                completions = get_completions(word)
                if len(completions) == 1:
                    # Single match - complete it
                    completion = completions[0]
                    current_line = current_line[:-len(word)] + completion
                    browser_console.term.write('\r\x1b[K')
                    prompt = "\x1b[32m>>> \x1b[0m" if len(lines) == 0 else "\x1b[32m... \x1b[0m"
                    browser_console.term.write(prompt + syntax_highlight(current_line))
                elif len(completions) > 1:
                    # Multiple matches - show them in columns
                    browser_console.term.write('\r\n')
                    max_len = max(len(c) for c in completions) + 2
                    cols = max(1, browser_console.term.cols // max_len)
                    for i, c in enumerate(completions):
                        browser_console.term.write(c.ljust(max_len))
                        if (i + 1) % cols == 0:
                            browser_console.term.write('\r\n')
                    if len(completions) % cols != 0:
                        browser_console.term.write('\r\n')
                    prompt = "\x1b[32m>>> \x1b[0m" if len(lines) == 0 else "\x1b[32m... \x1b[0m"
                    browser_console.term.write(prompt + syntax_highlight(current_line))
        elif char == "\x7f":
            if current_line:
                current_line = current_line[:-1]
                browser_console.term.write('\r\x1b[K')
                prompt = "\x1b[32m>>> \x1b[0m" if len(lines) == 0 else "\x1b[32m... \x1b[0m"
                browser_console.term.write(prompt + syntax_highlight(current_line))
        else:
            current_line += char
            # Clear line and rewrite with highlighting
            browser_console.term.write('\r\x1b[K')  # Go to start, clear line
            prompt = "\x1b[32m>>> \x1b[0m" if len(lines) == 0 else "\x1b[32m... \x1b[0m"
            browser_console.term.write(prompt + syntax_highlight(current_line))              
