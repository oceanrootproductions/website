#!/bin/sh
# Uploads a demo's asset pack to the website's R2 bucket, where the site serves it from.
# Usage: sh upload-pack.sh <slug> <path to assets.pack>
#   e.g. sh upload-pack.sh peel-cathedral ~/Documents/Lecture2026/Cathedral_Demo_Web/Cathedral-Demo-web-2026-11-14/assets.pack
# The slug matches the build folder (public/builds/<slug>/) and the redirect in public/_redirects.
set -eu
if [ $# -ne 2 ]; then
  echo "usage: sh upload-pack.sh <slug> <path to assets.pack>" >&2
  exit 1
fi
slug="$1"
file="$2"
cd "$(dirname "$0")"
npx wrangler r2 object put "oceanroot-web/$slug/assets.pack" --file "$file" --content-type application/octet-stream --remote
