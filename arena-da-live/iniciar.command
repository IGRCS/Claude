#!/bin/bash
# Mac: clique duas vezes neste arquivo (na primeira vez pode ser preciso: botão direito > Abrir)
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "O Node.js não está instalado. Baixe a versão LTS em https://nodejs.org"
  open https://nodejs.org/pt
  read -r -p "Aperte Enter para sair"
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Instalando as dependências pela primeira vez..."
  npm install --omit=dev || { read -r -p "Erro ao instalar. Aperte Enter para sair"; exit 1; }
fi
ABRIR_PAINEL=1 node src/servidor.js
