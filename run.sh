#!/usr/bin/env bash

# Shubh Diwali AI Voice Sales Concierge - Launch Script
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

echo "=========================================================="
echo "🪔 Starting Shubh Diwali AI Voice Sales Agent..."
echo "=========================================================="

# Check if server virtual environment exists
if [ ! -d "$DIR/server/venv" ]; then
    echo "Creating Python virtual environment in server/venv..."
    python3 -m venv "$DIR/server/venv"
    "$DIR/server/venv/bin/pip" install -r "$DIR/server/requirements.txt"
fi

# 1. Start FastAPI backend on port 8000
echo "🚀 Starting FastAPI server on http://localhost:8000..."
"$DIR/server/venv/bin/python" -m uvicorn main:app --app-dir "$DIR/server" --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Trap signals to clean up background processes
trap "echo 'Stopping services...'; kill $BACKEND_PID 2>/dev/null || true; exit" INT TERM EXIT

sleep 2

# 2. Start Next.js frontend on port 3000
echo "✨ Starting Next.js frontend on http://localhost:3000..."
cd "$DIR/client"
npm run dev -- -p 3000

wait
