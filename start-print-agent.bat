@echo off
title Mejwani Local Print Agent
echo Starting Mejwani Print Agent...
cd /d "%~dp0"
node print-agent.js
pause
