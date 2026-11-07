@echo off
echo =====================================
echo  Mejwani Java Backend Starting...
echo =====================================

set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot
set PATH=%USERPROFILE%\tools\apache-maven-3.9.6\bin;%JAVA_HOME%\bin;%PATH%

cd /d "%~dp0java-backend"
mvn spring-boot:run

pause
