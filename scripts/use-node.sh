#!/usr/bin/env bash

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  echo "请使用: source scripts/use-node.sh"
  exit 1
fi

export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm 未安装，请先安装 nvm。"
  return 1
fi

. "$NVM_DIR/nvm.sh"

if ! nvm ls 22 >/dev/null 2>&1; then
  echo "安装 Node 22..."
  nvm install 22
fi

nvm use 22 >/dev/null

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
