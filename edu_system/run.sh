#!/usr/bin/env bash
# Dev runner for the draft educational system.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  ./.venv/bin/pip install --quiet --upgrade pip
  ./.venv/bin/pip install --quiet -r requirements.txt
fi

exec ./.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
