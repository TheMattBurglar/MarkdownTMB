package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"os/exec"

	"markdown-tmb/webview"

	"github.com/sqweek/dialog"
)

//go:embed frontend/*
var assets embed.FS

func main() {
	// Create a new webview
	// debug=true to enable developer tools (F12)
	w := webview.New(true)
	defer w.Destroy()

	w.SetTitle("Markdown TMB")
	w.SetSize(1024, 768, webview.HintNone)

	// Bind Go functions to JS
	w.Bind("saveFile", func(filename, content string) error {
		return os.WriteFile(filename, []byte(content), 0644)
	})

	w.Bind("readFile", func(filename string) (string, error) {
		content, err := os.ReadFile(filename)
		if err != nil {
			return "", err
		}
		return string(content), nil
	})

	w.Bind("openFileDialog", func() (string, error) {
		filename, err := dialog.File().Filter("Markdown files", "md", "markdown").Load()
		if err != nil {
			if err == dialog.ErrCancelled {
				return "", nil
			}
			return "", err
		}
		return filename, nil
	})

	w.Bind("saveFileDialog", func() (string, error) {
		filename, err := dialog.File().Filter("Markdown files", "md", "markdown").Save()
		if err != nil {
			if err == dialog.ErrCancelled {
				return "", nil
			}
			return "", err
		}
		return filename, nil
	})

	w.Bind("openExternalLink", func(url string) error {
		// Linux specific
		return exec.Command("xdg-open", url).Start()
	})

	// Serve static assets
	// We need to strip the "frontend" prefix because embed keeps the directory structure
	fsys, err := fs.Sub(assets, "frontend")
	if err != nil {
		panic(err)
	}

	// Start a local HTTP server to serve the assets
	// This is often more reliable than data URIs for complex apps with relative paths (like libs/)
	go func() {
		http.Handle("/", http.FileServer(http.FS(fsys)))
		if err := http.ListenAndServe("127.0.0.1:8080", nil); err != nil {
			fmt.Println("Server error:", err)
		}
	}()

	// Navigate to the local server
	w.Navigate("http://127.0.0.1:8080/index.html")

	w.Run()
}
