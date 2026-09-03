#!/bin/bash
# 雙擊此檔案即可封裝 macOS 版本（在此開發機上跑起來驗證用），
# 產出於 release/mac-smoketest/。實際隨身碟部署仍以 build-win.bat 為主。
set -e
cd "$(dirname "$0")"

echo "============================================================"
echo " TeachSYS macOS 封裝"
echo "============================================================"

npm install
npm run build:exe:mac

echo
echo "[OK] 封裝完成：release/mac-smoketest/"
read -n 1 -s -r -p "按任意鍵關閉視窗..."
echo
