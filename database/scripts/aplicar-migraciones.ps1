<#
.SYNOPSIS
  Aplica las migraciones pendientes de database/migrations de forma idempotente.
.DESCRIPTION
  - Crea la tabla de control schema_migrations si no existe.
  - Aplica los scripts .sql numerados que aún no se hayan aplicado.
  - Verifica el SHA-256 de los scripts ya aplicados: si cambió, falla (son inmutables).
  - Lee los datos de conexión de los parámetros o de .env en la raíz.
.EXAMPLE
  database/scripts/aplicar-migraciones.ps1
  database/scripts/aplicar-migraciones.ps1 -Database motorix -User motorix_app
#>
param(
  [string]$Database = "",
  [string]$DbHost = "",
  [string]$DbPort = "",
  [string]$User = "",
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$migracionesDir = Join-Path $raiz "database\migrations"
$envFile = Join-Path $raiz ".env"

function Leer-Env([string]$ruta) {
  $valores = @{}
  if (Test-Path $ruta) {
    foreach ($linea in Get-Content $ruta) {
      if ($linea -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $valores[$Matches[1]] = $Matches[2].Trim()
      }
    }
  }
  return $valores
}

if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
  throw "No se encontró 'mysql' en el PATH."
}
if (-not (Test-Path $migracionesDir)) {
  throw "No existe la carpeta de migraciones: $migracionesDir"
}

$envVals = Leer-Env $envFile
if (-not $Database) { $Database = if ($envVals["DB_NAME"]) { $envVals["DB_NAME"] } else { "motorix" } }
if (-not $DbHost) { $DbHost = if ($envVals["DB_HOST"]) { $envVals["DB_HOST"] } else { "localhost" } }
if (-not $DbPort) { $DbPort = if ($envVals["DB_PORT"]) { $envVals["DB_PORT"] } else { "3306" } }
if (-not $User) { $User = if ($envVals["DB_USER"]) { $envVals["DB_USER"] } else { "root" } }
if (-not $Password) { $Password = $envVals["DB_PASSWORD"] }

$crearTabla = @"
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(100) NOT NULL UNIQUE,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"@

$env:MYSQL_PWD = $Password
try {
  $crearTabla | & mysql --host=$DbHost --port=$DbPort --user=$User --default-character-set=utf8mb4 $Database
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo conectar a la base '$Database' con el usuario '$User' (host ${DbHost}:${DbPort})."
  }

  $archivos = Get-ChildItem -Path $migracionesDir -Filter *.sql | Sort-Object Name
  if ($archivos.Count -eq 0) {
    Write-Host "No hay scripts de migración en $migracionesDir"
  }

  foreach ($archivo in $archivos) {
    $checksum = (Get-FileHash -Algorithm SHA256 -Path $archivo.FullName).Hash.ToLower()
    $registrada = & mysql --host=$DbHost --port=$DbPort --user=$User --default-character-set=utf8mb4 -N -B $Database -e "SELECT checksum FROM schema_migrations WHERE version='$($archivo.Name)'"
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo consultar schema_migrations para '$($archivo.Name)'."
    }

    if ($registrada) {
      if ($registrada.Trim() -ne $checksum) {
        throw "La migración aplicada '$($archivo.Name)' fue modificada. Los scripts son inmutables: crea un script nuevo numerado."
      }
      Write-Host "  [omitida] $($archivo.Name) ya estaba aplicada"
      continue
    }

    Get-Content -Raw $archivo.FullName | & mysql --host=$DbHost --port=$DbPort --user=$User --default-character-set=utf8mb4 $Database
    if ($LASTEXITCODE -ne 0) {
      throw "Error al aplicar '$($archivo.Name)'."
    }

    & mysql --host=$DbHost --port=$DbPort --user=$User --default-character-set=utf8mb4 $Database -e "INSERT INTO schema_migrations (version, checksum) VALUES ('$($archivo.Name)', '$checksum')"
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo registrar '$($archivo.Name)' en schema_migrations."
    }
    Write-Host "  [aplicada] $($archivo.Name)" -ForegroundColor Green
  }

  Write-Host "Migraciones al día para la base '$Database'." -ForegroundColor Green
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
