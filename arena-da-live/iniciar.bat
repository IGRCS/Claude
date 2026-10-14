@echo off
chcp 65001 >nul
title Arena da Live
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [ERRO] O Node.js nao esta instalado.
  echo  Baixe a versao LTS em https://nodejs.org , instale e abra este arquivo de novo.
  echo.
  start "" https://nodejs.org/pt
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando as dependencias pela primeira vez. Isso leva 1 ou 2 minutos...
  call npm install --omit=dev
  if errorlevel 1 (
    echo [ERRO] Falha ao instalar. Confira sua internet e tente de novo.
    pause
    exit /b 1
  )
)
set ABRIR_PAINEL=1
node src\servidor.js
pause
