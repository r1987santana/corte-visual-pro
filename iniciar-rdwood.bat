@echo off
setlocal

title RD Wood System - Iniciar
cd /d "%~dp0"

echo ==========================================
echo        RD Wood System - Iniciando
echo ==========================================
echo.

if not exist "package.json" (
  echo ERROR: No se encontro package.json en esta carpeta.
  echo Carpeta actual: %cd%
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no esta en el PATH.
  echo Instala Node.js y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm.cmd no esta disponible.
  echo Reinstala Node.js o revisa el PATH de Windows.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo No se encontro node_modules. Instalando dependencias...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo ERROR: No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
)

echo.
echo Servidor: http://localhost:3000/dashboard-ceo
echo El servidor se abrira en otra ventana.
echo.

start "RD Wood Dev Server" cmd /k "npm.cmd run dev"
call npm.cmd run warmup
start "" "http://localhost:3000/dashboard-ceo"

pause
