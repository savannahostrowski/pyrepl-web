# Keyboard shortcuts

Click inside the terminal to focus it, then type at the `>>>` prompt.

| Key | Action |
| --- | --- |
| **Enter** | Submit the current line. |
| **Tab** | Complete module, function, and variable names. |
| **↑** / **↓** | Browse command history. |
| **Ctrl+C** | Cancel the current input. |
| **Ctrl+L** | Clear the terminal display. |

## Multiple lines

For a block such as a loop or function, press **Enter** after each line. The REPL indents continuation lines for you. Submit a blank line to finish the block:

```python
for flower in ["daisy", "poppy", "tulip"]:
    print(flower)

```

## Copy and clear

The default header includes buttons to copy the terminal output or clear the display. Hide the buttons with `no-buttons`, or hide the entire header with `no-header`. See [Configuration](configuration.md).
