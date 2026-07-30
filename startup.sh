#!/bin/sh
set -eu
cd /workspace
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
# Next.js 15: bind all interfaces on 8080 for live preview
npm run dev -- -H 0.0.0.0 -p 8080 >>/tmp/app-startup.log 2>&1 &
