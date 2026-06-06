#!/bin/bash
# Convenience wrapper — delegates to the canonical npm test script.
# Uses project-local jest from node_modules (installed via npm install).
cd "$(dirname "$0")"
npm test -- "$@"
