# Mejwani Spring Boot Startup Script (PowerShell)
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
$MVN = "C:\Users\tejas\.m2\wrapper\dists\apache-maven-3.10.0\2aaba761688b1a6ea5a46e7e5f4d5406ed7a75ee8da95e5e3079863a23461c9b\bin\mvn.cmd"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " Mejwani Spring Boot Backend" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Make sure MySQL is running!" -ForegroundColor Yellow
Write-Host "Starting on http://localhost:8080 ..." -ForegroundColor Green

Set-Location $PSScriptRoot
& $MVN spring-boot:run
