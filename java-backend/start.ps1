# Mejwani Spring Boot Startup Script (PowerShell)
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
$env:PATH = "$env:USERPROFILE\tools\apache-maven-3.9.6\bin;$env:JAVA_HOME\bin;$env:PATH"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " Mejwani Spring Boot Backend" -ForegroundColor Cyan  
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Make sure MySQL is running!" -ForegroundColor Yellow
Write-Host "Starting on http://localhost:8080 ..." -ForegroundColor Green

Set-Location $PSScriptRoot
mvn spring-boot:run
