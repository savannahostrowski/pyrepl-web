"""Exercise input redraws without a browser or a Pyodide runtime."""

from pathlib import Path
import runpy
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch


class ConsoleRedrawTests(unittest.TestCase):
    def setUp(self):
        console_module = ModuleType("_pyrepl.console")
        console_module.Console = object
        console_module.Event = object
        ffi = ModuleType("pyodide.ffi")
        ffi.create_proxy = lambda value: value
        ffi.create_once_callable = lambda value: value
        with patch.dict(
            sys.modules,
            {
                "_pyrepl.console": console_module,
                "js": ModuleType("js"),
                "pyodide.ffi": ffi,
            },
        ):
            module = runpy.run_path(
                str(Path(__file__).parents[1] / "src/python/console.py")
            )
        self.writes = []
        self.console = None

        def ready(console, _load_highlighting):
            self.console = console

        module["start_repl"](
            SimpleNamespace(
                term=SimpleNamespace(rows=24, cols=80, write=self.writes.append),
                startupScript=None,
                themeName="catppuccin-mocha",
                pygmentsFallback="catppuccin-mocha",
                infoLine="Python",
                showBanner=False,
                readonly=False,
                promptColor="green",
                pygmentsStyle=None,
                loadMicropip=None,
                onReady=ready,
                onPygmentsReady=lambda: None,
            )
        )
        self.writes.clear()

    def type(self, text):
        self.writes.clear()
        for char in text:
            self.console.push_char(ord(char))

    def assert_redraw(self, text, prompt=">>> "):
        self.assertEqual(self.writes, [f"\r\x1b[32m{prompt}\x1b[0m{text}\x1b[K"])

    def test_typing_and_backspace_replace_line_in_one_write(self):
        self.type("1")
        self.assert_redraw("1")
        self.type("2")
        self.assert_redraw("12")
        self.type("\x7f")
        self.assert_redraw("1")
        self.type("\x7f")
        self.assert_redraw("")

    def test_history_redraws_and_clears_stale_suffix(self):
        self.type("123456\r1\r")
        self.type("\x1b[A")
        self.assert_redraw("1")
        self.type("\x1b[A")
        self.assert_redraw("123456")
        self.type("\x1b[B")
        self.assert_redraw("1")
        self.type("\x1b[B")
        self.assert_redraw("")

    def test_completion_and_continuation_prompt(self):
        self.type("pri")
        self.type("\t")
        self.assert_redraw("print(")
        self.type("\x03for n in range(2):\r")
        self.type("n")
        self.assert_redraw("    n", prompt="... ")


if __name__ == "__main__":
    unittest.main()
