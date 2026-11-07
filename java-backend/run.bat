@echo off
echo =====================================
echo  Mejwani Spring Boot Backend Starter
echo =====================================

:: Set JAVA_HOME
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot

:: Set Maven path
set PATH=%USERPROFILE%\tools\apache-maven-3.9.6\bin;%JAVA_HOME%\bin;%PATH%

echo Starting Mejwani Java Backend on port 8080...
echo Make sure MySQL is running and 'mejwani_db' database password is configured in application.properties

cd /d "%~dp0"
mvn spring-boot:run

pause
