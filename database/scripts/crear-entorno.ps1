<#
.SYNOPSIS
  Crea las bases de datos y el usuario dedicado de Motorix (nunca usa root para la app).
.DESCRIPTION
  Crea 'motorix' (principal) y 'motorix_test' (pruebas) con utf8mb4, y el usuario
  dedicado motorix_app con privilegios SOLO sobre esas dos bases.
.EXAMPLE
  database/scripts/crear-entorno.ps1 -AdminUser root
#>
param(
  [string]$AdminUser = "root",
  [string]$AdminPassword = "",
  [string]$DbName = "motorix",
  [string]$TestDbName = "motorix_test",
  [string]$AppUser = "motorix_app",
  [string]$AppPassword = "",
  [string]$DbHost = "localhost",
  [string]$DbPort = "3306"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
  throw "No se encontró 'mysql' en el PATH. Instala MySQL localmente y agrega su carpeta bin al PATH."
}

if ([string]::IsNullOrWhiteSpace($AdminPassword)) {
  $AdminPassword = Read-Host "Contraseña del administrador de MySQL ($AdminUser)"
}
if ([string]::IsNullOrWhiteSpace($AppPassword)) {
  $AppPassword = Read-Host "Contraseña para el usuario dedicado ($AppUser)"
}

$AppPasswordSql = $AppPassword -replace "'", "''"

$sql = @"
CREATE DATABASE IF NOT EXISTS $DbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS $TestDbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$AppUser@$DbHost' IDENTIFIED BY '$AppPasswordSql';
ALTER USER '$AppUser@$DbHost' IDENTIFIED BY '$AppPasswordSql';
GRANT ALL PRIVILEGES ON $DbName.* TO '$AppUser@$DbHost';
GRANT ALL PRIVILEGES ON $TestDbName.* TO '$AppUser@$DbHost';
FLUSH PRIVILEGES;
"@

$env:MYSQL_PWD = $AdminPassword
try {
  $sql | & mysql --host=$DbHost --port=$DbPort --user=$AdminUser --default-character-set=utf8mb4
  if ($LASTEXITCODE -ne 0) {
    throw "mysql devolvió el código $LASTEXITCODE al crear el entorno. Verifica la contraseña de $AdminUser."
  }
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

Write-Host "Entorno listo:" -ForegroundColor Green
Write-Host "  - Bases creadas: '$DbName' y '$TestDbName' (utf8mb4, InnoDB)"
Write-Host "  - Usuario dedicado: '$AppUser' (solo esas dos bases)"
Write-Host "Siguiente paso: copia .env.example a .env y completa DB_USER, DB_PASSWORD y JWT_SECRET."
