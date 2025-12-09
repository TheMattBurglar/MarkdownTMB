# MarkdownTMB

A personal Markdown text editor designed for creative writing.

MarkdownTMB is a distraction-free, customizable editor that focuses on what matters most: your words. Built with **Go** and **Webview**, it combines a native backend with a modern web-based frontend.

## Features

*   **Distraction-Free Writing**: A minimal interface that gets out of your way. By default, the editor starts in "Edit" mode with a streamlined toolbar.
*   **Creative Writing Focused**:
    *   **Custom Toolbar**: Removed rarely used formatting options to reduce visual clutter.
    *   **Cheatsheet**: A handy built-in reference for Markdown syntax.
    *   **Spellcheck**: Integrated spellchecking (via `typo.js`).
*   **Dark Mode**: A fully custom dark theme.
*   **Dual Mode**: Switch seamlessly between a raw Markdown "Edit" view and a live "Split" preview.

## Installation / Building

To build this project from source, you will need [Go](https://go.dev/) (1.18+) and [Node.js](https://nodejs.org/en/) installed.

**Linux Requirements:**
You may need to install WebKit2GTK identifiers:
`sudo dnf install webkit2gtk3-devel` (Fedora) or `sudo apt install libwebkit2gtk-4.0-dev` (Debian/Ubuntu).

1.  Clone the repository:
    ```bash
    git clone https://github.com/TheMattBurglar/MarkdownTMB.git
    cd MarkdownTMB
    ```

2.  Build the application:
    ```bash
    ./build.sh
    ```
    This script will compile the binary to `build/bin/markdown-tmb`.

## License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

Copyright (C) 2025 TheMattBurglar
