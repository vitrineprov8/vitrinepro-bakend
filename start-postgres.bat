@echo off
REM Script para levantar PostgreSQL con Docker

echo Iniciando PostgreSQL con Docker...
docker compose up -d

if %ERRORLEVEL% == 0 (
    echo.
    echo ====================================
    echo PostgreSQL iniciado exitosamente!
    echo ====================================
    echo Host: localhost
    echo Puerto: 5432
    echo Usuario: postgres
    echo Contraseña: postgres
    echo Base de datos: vitronepro
    echo ====================================
    echo.
    echo Para detener: docker-compose down
) else (
    echo Error al iniciar PostgreSQL. Verifica que Docker esté instalado.
)
