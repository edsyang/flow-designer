#!/bin/bash
set -euo pipefail

echo "Building all packages..."
pnpm build

echo "Running tests..."
pnpm test

echo ""
echo "All packages built and tested successfully."
echo "To publish, run: pnpm -r publish --access public"
