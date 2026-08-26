@echo off
REM factory-add.bat — add a website order to the 24/7 factory queue.
REM Usage:
REM   factory-add.bat "Build a premium site for a vegan restaurant in Cluj"
REM
REM The order is appended to docs/orders.json (PENDING) and the factory
REM picks it up automatically on its next pass. No technical knowledge needed.

cd /d "%~dp0"
if "%~1"=="" (
  echo Usage: factory-add.bat "describe the site you want"
  echo Example: factory-add.bat "Site premium pentru un salon de infrumusetare din Bucuresti"
  pause
  exit /b 1
)

node -e "const fs=require('fs');const f='docs/orders.json';const d=JSON.parse(fs.readFileSync(f,'utf8'));const n=d.orders.length+1;const id='ORD-'+String(n).padStart(3,'0');d.orders.push({id,order:process.argv[1],status:'PENDING',maxIter:3,attempts:0,budgetTier:'tier1',decision:null,finalOutput:null,error:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});fs.writeFileSync(f,JSON.stringify(d,null,2)+'\n');console.log('Added '+id+' to the factory queue.');" %1
echo The factory will build it automatically. Check logs\factory.log for progress.
timeout /t 3 >nul
