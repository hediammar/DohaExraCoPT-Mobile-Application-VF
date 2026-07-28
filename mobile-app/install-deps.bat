@echo off
echo Cleaning up old installation...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

echo Installing dependencies...
npm install

echo.
echo Installation complete!
echo You can now run: npm run build:android
pause
