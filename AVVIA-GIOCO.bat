@echo off
rem Avvio del gioco ITS Olivetti Quest con un doppio clic (Windows).
rem Controlla Node.js, installa le librerie la prima volta, accende il server
rem e apre il gioco nel browser. Per spegnere il gioco chiudete questa finestra.

title ITS Olivetti Quest
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js non e' installato su questo computer.
  echo  Scaricatelo da https://nodejs.org ^(versione LTS^), installatelo
  echo  e poi fate di nuovo doppio clic su AVVIA-GIOCO.bat
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo Prima installazione delle librerie, attendere...
  call npm install
  if errorlevel 1 (
    echo.
    echo  Installazione non riuscita: controllate la connessione a internet e riprovate.
    pause
    exit /b 1
  )
)

echo.
echo  Il gioco si apre nel browser: http://localhost:3000
echo  Modalita' admin: scrivete la parola segreta come nome della squadra
echo  NON chiudete questa finestra finche' state giocando.
echo.

rem apre il browser dopo 2 secondi, il tempo che il server parta
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
node server.js

echo.
echo  Il server si e' fermato.
pause
