# Modelo de datos — Sprint 7: Reportes, configuración, términos y seguridad

**Fecha**: 2026-11-24 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Investigación**: [research.md](research.md)

Fase 1 de `/speckit.plan`. Describe solo lo que este sprint agrega o cambia; el resto del esquema (Sprints 1–6) se conserva sin modificaciones. La fuente autoritativa del esquema es el script `database/migrations/016_settings_reports_security.sql`; este documento lo interpreta. Todo es InnoDB `utf8mb4_unicode_ci`, con llaves foráneas `RESTRICT` salvo que se indique.

## Entidades nuevas

### settings (configuración del taller)

Pares clave-valor. Nace vacía: si falta una clave rige el valor de respaldo (P-2).

| Columna | Tipo | Reglas |
|---------|------|--------|
| `setting_key` | VARCHAR(60) PK | claves permitidas: `shop.name`, `shop.address`, `shop.phone`, `maintenance.warn_days`, `maintenance.warn_km` (validadas en zod, no en la base) |
| `setting_value` | VARCHAR(200) NOT NULL | texto; los márgenes se guardan como cadena de entero y se convierten al leer |
| `updated_by` | INT UNSIGNED NOT NULL | FK → `users.id` |
| `updated_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | |

**Valores de respaldo** (en código, no en la tabla): `shop.name = "Motorix"`, `shop.address = null`, `shop.phone = null` (`config/taller.js`), `maintenance.warn_days = 30`, `maintenance.warn_km = 500`.

**Límites**: nombre 1–100 caracteres; dirección ≤ 200 (vacío = sin dirección); teléfono ≤ 30; días 0–365; kilómetros 0–20,000.

### service_types (catálogo de tipos de servicio)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED PK AUTO_INCREMENT | |
| `name` | VARCHAR(100) NOT NULL | `UNIQUE (uq_service_types_name)` |
| `interval_days` | INT UNSIGNED NULL | intervalo en días |
| `interval_km` | INT UNSIGNED NULL | intervalo en kilómetros |
| `active` | TINYINT(1) NOT NULL DEFAULT 1 | desactivar en lugar de borrar |
| `created_by` | INT UNSIGNED NOT NULL | FK → `users.id` |
| `created_at` / `updated_at` | DATETIME | marcas estándar |

- `CHECK chk_service_types_interval`: `(interval_days IS NOT NULL AND interval_days > 0) OR (interval_km IS NOT NULL AND interval_km > 0)`; ningún intervalo puede ser 0 o negativo.
- `CHECK chk_service_types_interval_max`: `interval_days <= 3650` y `interval_km <= 1000000`.
- **Sin DELETE**: no existe ruta ni consulta de borrado (CA-4).

### terms_versions (versiones de los términos y del aviso de privacidad)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED PK AUTO_INCREMENT | |
| `version` | INT UNSIGNED NOT NULL | `UNIQUE`; creciente: la nueva es `MAX(version) + 1` |
| `terms_text` | MEDIUMTEXT NOT NULL | términos y condiciones (no vacío, validado en zod, máx. 20,000 caracteres) |
| `privacy_text` | MEDIUMTEXT NOT NULL | aviso de privacidad (mismos límites) |
| `published_by` | INT UNSIGNED NULL | FK → `users.id`; `NULL` en la versión 1 (plantilla de instalación) |
| `published_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |

- La **versión vigente** es la de mayor `version`. Una versión publicada **no se edita**: cambiar el texto crea otra (FR-032).
- La migración inserta la versión 1 con la plantilla en español (idempotente: `INSERT ... SELECT ... WHERE NOT EXISTS`).

### terms_acceptances (aceptaciones)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED PK AUTO_INCREMENT | |
| `user_id` | INT UNSIGNED NOT NULL | FK → `users.id` (`ON DELETE CASCADE`: la aceptación solo tiene sentido con su usuario) |
| `terms_version_id` | INT UNSIGNED NOT NULL | FK → `terms_versions.id` |
| `accepted_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |

- `UNIQUE (user_id, terms_version_id)`: hace idempotente `POST /api/terms/accept` (201 la primera vez, 200 al repetir).
- **No hay actualización ni borrado**: la aceptación es constancia.

### audit_log (bitácora de acciones sensibles)

Solo inserción (P-13).

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | BIGINT UNSIGNED PK AUTO_INCREMENT | |
| `user_id` | INT UNSIGNED NULL | FK → `users.id` `ON DELETE SET NULL`; `NULL` en intentos sin usuario válido |
| `actor` | VARCHAR(100) NOT NULL | usuario que actuó, o el identificador intentado en un inicio de sesión fallido |
| `action` | VARCHAR(40) NOT NULL | catálogo cerrado (ver abajo; validado en el servicio y en los filtros) |
| `entity_type` | VARCHAR(40) NULL | `USER`, `SETTINGS`, `PART`, `ORDER_PART`, `PAYMENT`, `TERMS`, `SESSION` |
| `entity_id` | INT UNSIGNED NULL | id de la entidad afectada |
| `detail` | VARCHAR(500) NULL | texto breve sin datos reservados |
| `created_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |

- **Índices**: `idx_audit_created (created_at)`, `idx_audit_user_created (user_id, created_at)` y `idx_audit_action_created (action, created_at)` para los filtros de la consulta.
- **Acciones**: `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `USER_CREATED`, `USER_UPDATED`, `SETTINGS_UPDATED`, `PART_PRICE_CHANGED`, `ORDER_PART_PRICE_CORRECTED`, `PAYMENT_CANCELLED`, `TERMS_PUBLISHED`.
- **Sin contraseñas, hashes, tokens ni datos de tarjeta** (CA-21): `detail` se arma con una lista blanca por acción.

## Cambios a tablas existentes (aditivos)

| Tabla | Cambio | Motivo | Datos existentes |
|-------|--------|--------|------------------|
| `maintenance` | `warn_days` y `warn_km` pasan a `INT UNSIGNED NULL` sin valor por omisión (los `CHECK >= 0` se conservan) | `NULL` = «usar el valor del taller» (P-3, D-16) | Se ponen en `NULL` las filas cuyo valor es 30 (días) o 500 (km), el predeterminado histórico; las demás se conservan |
| `order_services` | `service_type_id INT UNSIGNED NULL`, FK → `service_types.id`, índice `idx_order_services_type` | enlace opcional al catálogo (P-4, D-04) | Quedan en `NULL` |
| `order_parts` | `unit_cost DECIMAL(10,2) NULL` con `CHECK (unit_cost IS NULL OR (unit_cost >= 0 AND unit_cost <= 99999.99))` | costo congelado por línea (P-8, D-05) | `parts.purchase_price` actual si es > 0; `NULL` si es 0 |
| `service_orders` | `finished_at DATETIME NULL`, índice `idx_service_orders_finished_at` | fecha estable de terminación (P-7, D-19) | Órdenes `FINISHED` o `DELIVERED`: su `updated_at`; el resto `NULL` |
| `tickets` | `workshop_name VARCHAR(100) NOT NULL DEFAULT 'Motorix'`, `workshop_address VARCHAR(200) NULL`, `workshop_phone VARCHAR(30) NULL`, `next_service_date DATE NULL`, `next_service_mileage INT UNSIGNED NULL` | instantánea al emitir (P-6, D-03) y próximo servicio (P-5) | `Motorix`, sin dirección ni teléfono y sin próximo servicio: lo que mostraban |
| `users` | `last_activity_at DATETIME NULL` | cierre por inactividad en el backend (P-12) | `NULL` (se trata como activo) |

- **Orden de las sentencias**: primero las tablas nuevas (`service_types` antes del `ALTER` de `order_services`), después los `ALTER` y por último los rellenos de datos y la versión 1 de los términos.
- **Idempotencia**: el script se registra en `schema_migrations` y las tablas nuevas usan `IF NOT EXISTS`, como la 015; los `ALTER` se ejecutan una sola vez gracias al registro (mismo patrón que la 014).
- **Sin migración inversa**: igual que las anteriores; las columnas nuevas admiten `NULL` o tienen valor por omisión, por lo que el código del Sprint 6 seguiría funcionando contra el esquema nuevo.

## Entidades existentes consultadas por los reportes (sin otros cambios)

- `payments` (`PAID`, `updated_at`, `amount`, `method`): ingresos (P-9).
- `service_orders` (`status`, `finished_at`, `mechanic_id`): productividad y periodo de servicios y refacciones.
- `order_services` (`service_type_id`, `description`, `unit_price`) y `service_types`: servicios frecuentes.
- `order_labor` (`hours`, `hourly_rate`): importe de mano de obra por mecánico.
- `order_parts` (`quantity`, `unit_price`, `unit_cost`) y `parts` (`part_code`, `name`): costo y margen.
- `inventory_movements` (`movement_type`, `quantity`, `created_at`) y `parts.stock_current`: rotación.
- `users` (`name`): nombre del mecánico en productividad.

## Transiciones y reglas de estado

- **Orden de servicio**: `cambiarEstado` escribe `finished_at = NOW()` solo en la transición hacia `FINISHED` (incluye la vuelta desde `WAITING_PART`) si todavía es `NULL`; `DELIVERED` no lo modifica. Reabrir una orden no existe en el flujo actual.
- **Tipo de servicio**: `active` 1 ↔ 0 libremente; un tipo inactivo no aparece en el selector pero se sigue mostrando en las líneas que ya lo usan.
- **Términos**: una versión nueva se vuelve la vigente al insertarse; los usuarios con aceptación de una versión anterior quedan «sin aceptación vigente» hasta aceptar la nueva.
- **Sesión**: `last_activity_at` se fija en `login` y se refresca como máximo una vez por minuto; pasados `idleMinutes` sin actividad el siguiente uso responde `401 SESSION_IDLE`.
- **Ticket**: al emitirse (una sola vez por orden, `UNIQUE (order_id)`) se congelan el encabezado del taller y el próximo servicio; reimprimir devuelve lo guardado.
