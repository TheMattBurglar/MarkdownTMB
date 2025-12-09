#!/bin/bash

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "Error: Go is not installed. Please install Go 1.18+ first."
    exit 1
fi


# Build the application
go build -o build/bin/markdown-tmb

if [ $? -eq 0 ]; then
    echo "Build success! Binary is in build/bin/markdown-tmb"
else
    echo "Build failed."
    exit 1
fi
