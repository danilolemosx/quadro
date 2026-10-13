#!/bin/bash
# Captura a interface com dados simulados (Tauri falso, 143 cenas), uma imagem por cena, e lista os erros de JavaScript.
# Uso: testes-ui/capturar.sh [pasta-de-saida] [cenas...]
set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
saida="${1:-$raiz/testes-ui/capturas}"
shift || true
cenas="${*:-inicio quadro materiais importar lista roteiro busca vazio plano}"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
trabalho="$(mktemp -d)"
cp -R "$raiz/ui/." "$trabalho/"
cp "$raiz/testes-ui/simulado.js" "$trabalho/"
python3 -I "$raiz/testes-ui/gerar-roteiro.py" "$trabalho/roteiro-teste.pdf"
sed -i.bak 's#<script src="ponte.js"></script>#<script src="simulado.js"></script><script src="ponte.js"></script>#' "$trabalho/index.html"
porta=$((8700 + RANDOM % 200))
python3 -m http.server "$porta" --bind 127.0.0.1 --directory "$trabalho" >/dev/null 2>&1 &
servidor=$!
trap 'kill $servidor 2>/dev/null; rm -rf "$trabalho"' EXIT
sleep 0.7
mkdir -p "$saida"
for cena in $cenas; do
  url="http://127.0.0.1:$porta/index.html?cena=$cena"
  "$chrome" --headless=new --hide-scrollbars --force-device-scale-factor=2 --window-size=1440,900 \
    --virtual-time-budget=6000 --screenshot="$saida/$cena.png" "$url" >/dev/null 2>&1
  erros="$("$chrome" --headless=new --window-size=1440,900 --virtual-time-budget=6000 --dump-dom "$url" 2>/dev/null | grep -o 'data-erros="[^"]*"' | head -1 || true)"
  echo "$cena: ${erros:-sem marca de erros (a página não terminou?)}"
done
