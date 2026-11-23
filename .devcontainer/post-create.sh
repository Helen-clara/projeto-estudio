#!/usr/bin/env bash
# Preparação do Codespace: bibliotecas gráficas do Electron, dependências e .env.
set -euo pipefail

echo "==> Instalando bibliotecas gráficas usadas pelo Electron..."
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 libnss3 libgbm1 libxss1 libxshmfence1 libasound2 libdrm2 libxkbcommon0

echo "==> Instalando dependências do projeto..."
npm install

# O sandbox do Chromium exige que este binário pertença ao root com o bit SUID.
SANDBOX="node_modules/electron/dist/chrome-sandbox"
if [ -f "$SANDBOX" ]; then
  sudo chown root:root "$SANDBOX"
  sudo chmod 4755 "$SANDBOX"
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Criado .env a partir do .env.example: preencha as credenciais do MySQL antes de rodar o app."
fi

echo "==> Pronto! Abra a porta 6080 (aba Portas, senha: vscode) e rode: npm start"
