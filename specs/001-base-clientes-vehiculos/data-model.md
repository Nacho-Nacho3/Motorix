# Modelo de Datos — Sprint 1: Base del sistema, clientes y vehículos

**Fecha**: 2026-10-13
**Rama**: `001-base-clientes-vehiculos`

Base: MySQL local, motor InnoDB, codificación `utf8mb4`, esquema versionado en
`database/migrations/` con registro en `schema_migrations`. Las migraciones son
numeradas e inmutables.

## Entidades

### `users`

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE | Identificador de login |
| `name` | VARCHAR(100) | NOT NULL | Nombre visible |
| `email` | VARCHAR(120) | NOT NULL, UNIQUE | También sirve de login |
| `password_hash` | VARCHAR(100) | NOT NULL | `bcryptjs` costo 10; nunca texto plano |
| `role` | ENUM('ADMIN','RECEPTIONIST','MECHANIC') | NOT NULL | Los 3 roles del MVP |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1 | Desactivado = sin acceso |
| `failed_login_attempts` | INT UNSIGNED | NOT NULL, DEFAULT 0 | Contador de intentos fallidos |
| `locked_until` | DATETIME | NULL | Bloqueo de 15 min tras 5 fallos |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

**Índices**: UNIQUE en `username` y `email`.

### `clients`

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `name` | VARCHAR(100) | NOT NULL | Nombre o razón social |
| `phone` | VARCHAR(20) | NOT NULL | **No único**: duplicado avisa y pide confirmación (R-12) |
| `email` | VARCHAR(120) | NOT NULL | **No único**: puede repetirse (Q2) |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1 | Solo informativo en este sprint; sin flujo de baja (Q4) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Fecha de registro |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

**Índices**: `name` (búsquedas frecuentes), `phone` (aviso de duplicado).

### `vehicles`

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `client_id` | INT UNSIGNED | NOT NULL, FK → `clients.id` | Propietario **obligatorio** (RN-1); restricción `ON DELETE RESTRICT` |
| `brand` | VARCHAR(50) | NOT NULL | Marca |
| `model` | VARCHAR(50) | NOT NULL | Modelo |
| `year` | SMALLINT | NOT NULL | Entre 1900 y el año actual + 1 |
| `license_plate` | VARCHAR(20) | NOT NULL, UNIQUE | Placas únicas (Q2) |
| `vin` | VARCHAR(20) | NULL, UNIQUE | Opcional; único solo si se captura (R-12) |
| `current_mileage` | INT UNSIGNED | NOT NULL, DEFAULT 0 | Kilometraje actual ≥ 0 |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

**Índices**: UNIQUE en `license_plate` y `vin` (permite varios `NULL` en InnoDB),
índice en `client_id`.

### `schema_migrations`

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `version` | VARCHAR(100) | NOT NULL, UNIQUE | Nombre del script, p. ej. `001_inicial` |
| `applied_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| `checksum` | VARCHAR(64) | NOT NULL | SHA-256 del script; detecta edición de un script aplicado |

## Relaciones

```text
clients 1 ──── N vehicles      (vehicles.client_id → clients.id, obligatoria)
users (independiente; no tiene FK con clients ni vehicles en este sprint)
```

- Un cliente puede tener **0..N** vehículos.
- Un vehículo tiene **exactamente 1** cliente (propietario).
- Un usuario no está vinculado a clientes ni vehículos.

## Reglas de validación (del spec)

- **VU-01**: `username` y `email` de usuario obligatorios y únicos → error 409
  `DUPLICATE_USERNAME` / `DUPLICATE_EMAIL`.
- **VU-02**: contraseña nueva: 8 caracteres mínimo, al menos una mayúscula, una
  minúscula y un número (RN-17) → error 400 `WEAK_PASSWORD`.
- **VU-03**: login por `username` o `email` en un solo campo (RN-16); el backend
  detecta si el valor contiene `@`.
- **VC-01**: `name`, `phone`, `email` del cliente obligatorios → error 400
  `VALIDATION_ERROR` con detalle por campo.
- **VC-02**: teléfono de cliente repetido → error 409 `DUPLICATE_PHONE`; la interfaz
  pide confirmación y reintenta con `confirmDuplicatePhone: true`.
- **VV-01**: `client_id` obligatorio y existente → error 400 `CLIENT_REQUIRED` /
  404 `CLIENT_NOT_FOUND` (RN-1).
- **VV-02**: placas únicas → error 409 `DUPLICATE_PLATE`.
- **VV-03**: `vin` único solo cuando se captura → error 409 `DUPLICATE_VIN`.
- **VV-04**: `year` entre 1900 y año actual + 1; `current_mileage` ≥ 0 → error 400.

## Transiciones de estado

### Usuarios

```text
activo ──(ADMIN: PATCH active=false)──▶ inactivo ──(ADMIN: PATCH active=true)──▶ activo
activo ──(5 logins fallidos)──▶ bloqueado (15 min) ──(temporizador)──▶ activo
inactivo o bloqueado: el login responde 403 / 423; el token existente no da acceso
porque rol y estado se revalidan en cada petición (R-03)
```

### Clientes y vehículos

- Sin transiciones de estado en este sprint: `clients.active` es solo informativo
  (aclaración Q4); los vehículos no tienen ciclo de vida hasta el Sprint 2.

## Supuestos de volumen

- Cientos de clientes y vehículos por instalación (equipo pequeño); sin particionado
  ni caché. Los índices de unicidad y `name`/`client_id` cubren las búsquedas del
  flujo demostrable.
