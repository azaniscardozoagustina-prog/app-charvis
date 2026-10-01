@echo off
REM Abre la app Charvis en el navegador (doble clic en este archivo).
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias, puede tardar unos minutos...
  call npm install
)
npx expo start --web
pause
