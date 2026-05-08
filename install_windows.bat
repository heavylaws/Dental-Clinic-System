@echo off
echo ===================================================
echo ClinicSystem Windows Setup Script
echo ===================================================
echo.
echo Please ensure you have manually installed:
echo 1. Node.js (https://nodejs.org/)
echo 2. PostgreSQL (https://www.postgresql.org/download/windows/)
echo.
echo Make sure the PostgreSQL 'postgres' user has the password 'postgres'
echo and that 'psql' and 'pg_restore' are in your system PATH.
echo.
pause

echo Setting up database...
set PGPASSWORD=postgres
psql -U postgres -c "CREATE DATABASE dentalclinic OWNER postgres;"

if exist "dentalclinic.dump" (
    echo Restoring database dump...
    pg_restore -U postgres -d dentalclinic -1 "dentalclinic.dump"
) else (
    echo Warning: dentalclinic.dump not found. Skipping database restore.
)

echo.
echo Installing Node.js dependencies...
call npm install

echo.
echo Starting the ClinicSystem server...
call npm run dev
