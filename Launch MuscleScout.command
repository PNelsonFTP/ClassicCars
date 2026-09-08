#!/bin/zsh
cd -- "${0:A:h}" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 24 LTS, then reopen MuscleScout."
  read -k 1
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm install || exit 1
fi
npm run setup || exit 1
npm run dev
