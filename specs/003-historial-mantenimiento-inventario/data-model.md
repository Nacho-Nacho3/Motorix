# Modelo de Datos — Sprint 3: Historial, mantenimiento e inventario

**Fecha**: 2026-10-14
**Rama**: `003-historial-mantenimiento-inventario`

Base: MySQL local, motor InnoDB, codificación `utf8mb4`, esquema versionado en
`database/migrations/` con registro en `schema_migrations`. Las migraciones son
numeradas e inmutables; este sprint agrega **nuevos** scripts (nunca edita los ya
aplicados de los Sprints 1–2):

| Script | Tabla |
|--------|-------|
| `008_create_maintenance.sql` | `maintenance` |
| `009_create_parts.sql` | `parts` |
| `010_create_inventory_movements.sql` | `inventory_movements` |
| `011_create_order_parts.sql` | `order_parts` |

Las tablas `users`, `clients`, `vehicles`, `appointments`, `service_orders`,
`order_services` y `order_labor` no cambian: este sprint las **lee** (historial,
kilometraje actual del vehículo) y **referencia** desde las tablas nuevas. El
historial del vehículo **no** es una tabla: se calcula en consulta (Q3, R-02).

## Entidades

### `maintenance`

Un único registro vigente por vehículo (índice único en `vehicle_id`; registrar
otro lo reemplaza — supuesto del spec).

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `vehicle_id` | INT UNSIGNED | NOT NULL, UNIQUE, FK → `vehicles.id`, `RESTRICT` | Uno por vehículo (R-03) |
| `next_due_date` | DATE | NULL | Objetivo por fecha (`YYYY-MM-DD`); RN-11 |
| `next_due_mileage` | INT UNSIGNED | NULL | Objetivo por kilometraje; RN-11 |
| `warn_days` | INT UNSIGNED | NOT NULL, DEFAULT 30 | Antelación en días para el estado Próximo (Q4) |
| `warn_km` | INT UNSIGNED | NOT NULL, DEFAULT 500 | Antelación en kilómetros (Q4) |
| `recommendations` | VARCHAR(1000) | NULL | Recomendaciones del mecánico |
| `registered_by` | INT UNSIGNED | NOT NULL, FK → `users.id`, `RESTRICT` | Quién lo registró/actualizó |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

**Restricción**: `CHECK (next_due_date IS NOT NULL OR next_due_mileage IS NOT NULL)`
— al menos un objetivo (RN-11: fecha, kilometraje o ambos).

**Índices**: `vehicle_id` (único), `next_due_date`.

**Sin columna de estado**: `NORMAL | UPCOMING | OVERDUE` se calcula en cada lectura
(R-04); no hay endpoint de borrado.

### `parts`

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `part_code` | VARCHAR(50) | NOT NULL, UNIQUE | Código o número de parte único |
| `name` | VARCHAR(100) | NOT NULL | Nombre comercial |
| `category` | VARCHAR(50) | NOT NULL | Categoría |
| `brand` | VARCHAR(50) | NULL | Marca opcional |
| `stock_current` | INT | NOT NULL, DEFAULT 0, `CHECK (>= 0)` | Saldo autoritativo (RN-8, Q1) |
| `stock_min` | INT UNSIGNED | NOT NULL | Alerta cuando `stock_current <= stock_min` (CA-7) |
| `purchase_price` | DECIMAL(10,2) | NOT NULL, DEFAULT 0, `>= 0` | Precio de compra (dato; sin cálculo de costos) |
| `sale_price` | DECIMAL(10,2) | NOT NULL, DEFAULT 0, `>= 0` | Precio de venta (dato) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

**Índices**: `uq_parts_part_code` (`part_code`).

**Sin columna de eliminación lógica ni endpoint `DELETE`**: las refacciones con
movimientos u órdenes asociadas no se eliminan (caso límite del spec).

### `inventory_movements`

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `part_id` | INT UNSIGNED | NOT NULL, FK → `parts.id`, `RESTRICT` | Refacción afectada |
| `movement_type` | ENUM('IN','OUT','ADJUSTMENT') | NOT NULL | Catálogo cerrado (Q2) |
| `quantity` | INT | NOT NULL | `IN`/`OUT` > 0; `ADJUSTMENT` ≠ 0 **con signo** (+ sumar, − restar) |
| `order_id` | INT UNSIGNED | NULL, FK → `service_orders.id`, `RESTRICT` | Solo en `OUT` por uso en orden (RN-6) |
| `reason` | VARCHAR(200) | NULL | Obligatorio (≥ 10 caracteres) en `ADJUSTMENT` |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id`, `RESTRICT` | ADMIN en `IN`/`ADJUSTMENT`; mecánico en `OUT` automático |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Libro de auditoría (sin borrado) |

**Índices**: `part_id`, `(part_id, created_at)`, `order_id`.

**Regla de signo**: el signo lo aporta `movement_type` (`IN`/`OUT` siempre
positivos); `ADJUSTMENT` guarda el delta firmado para poder corregir hacia arriba o
hacia abajo (R-05).

### `order_parts`

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, `RESTRICT` | Refacción usada en la orden (RN-6) |
| `part_id` | INT UNSIGNED | NOT NULL, FK → `parts.id`, `RESTRICT` | Pieza del catálogo |
| `quantity` | INT UNSIGNED | NOT NULL, `CHECK (> 0)` | Cantidad utilizada |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id`, `RESTRICT` | Mecánico que la agregó (Q5) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**Índices**: `order_id`, `part_id`.

**Filas múltiples por orden** (sin unicidad): cada agregado es un evento con su
propia salida `OUT` (R-06). No existe `DELETE`.

## Relaciones

```text
vehicles 1 ──── 1 maintenance        (maintenance.vehicle_id → vehicles.id, UNIQUE)
clients  1 ──── N service_orders     (ya existente, Sprint 2)
vehicles 1 ──── N service_orders     (ya existente, Sprint 2)
service_orders 1 ── N order_parts    (order_parts.order_id    → service_orders.id)
parts    1 ──── N order_parts        (order_parts.part_id     → parts.id)
parts    1 ──── N inventory_movements(inventory_movements.part_id → parts.id)
service_orders 1 ── N inventory_movements (inventory_movements.order_id → service_orders.id, solo OUT)
users    1 ──── N maintenance / inventory_movements / order_parts  (registered_by / created_by)
service_orders + order_services + order_labor + order_parts ──(lectura)──▶ historial (sin tabla)
```

- Un vehículo tiene **0..1** registro de mantenimiento vigente; registrar otro lo
  reemplaza (no duplica).
- Una refacción tiene **0..N** movimientos (auditoría) y aparece en **0..N**
  órdenes; una orden tiene **0..N** refacciones usadas.
- Un `OUT` con `order_id` nulo no existe en este sprint: toda salida proviene de un
  uso en orden (RN-7) o es un `ADJUSTMENT` de corrección.

## Reglas de validación (del spec)

### Historial del vehículo

- **VH-01**: el vehículo de la ruta debe existir → 404 `VEHICLE_NOT_FOUND`.
- **VH-02**: solo las órdenes en `FINISHED` o `DELIVERED` entran al historial, en
  orden cronológico (CA-1, RN-10); cada entrada incluye fecha, kilometraje, orden,
  diagnóstico, servicios, mano de obra, refacciones, observaciones y recomendaciones
  leídos de las tablas existentes (sin copias).
- **VH-03**: autorización por rol (R-07): ADMIN y MECHANIC leen; RECEPTIONIST →
  403 `FORBIDDEN`.

### Mantenimientos

- **VM-01**: `vehicleId` obligatorio y existente → 400 `VEHICLE_REQUIRED` /
  404 `VEHICLE_NOT_FOUND`.
- **VM-02**: al menos un objetivo (`nextDueDate` y/o `nextDueMileage`) → 400
  `MAINTENANCE_TARGET_REQUIRED`; `warnDays`/`warnKm` ≥ 0 con defecto 30/500;
  `recommendations` ≤ 1000 caracteres → 400 `VALIDATION_ERROR`.
- **VM-03**: `nextDueDate` en `YYYY-MM-DD` y `nextDueMileage` entero ≥ 0.
- **VM-04**: `POST /api/maintenances` es un **upsert** por `vehicleId`: reemplaza
  el registro vigente sin duplicarlo (índice único; supuesto del spec).
- **VM-05**: autorización (R-07): ADMIN y MECHANIC registran; RECEPTIONIST solo
  consulta (403 en escritura).
- **VM-06**: el cuerpo **no** acepta estado: `NORMAL/UPCOMING/OVERDUE` lo calcula el
  backend en cada lectura (R-04, Q4).

### Inventario y refacciones

- **VI-01**: `partCode` obligatorio y único → 400 `PART_CODE_DUPLICATED` si
  existe; `name`, `category` y `stockMin` obligatorios; precios ≥ 0 → 400
  `VALIDATION_ERROR`.
- **VI-02**: catálogo, stock, alertas y movimientos son de ADMIN: los demás roles
  → 403 `FORBIDDEN` (R-07, US5/US6/US8).
- **VI-03**: `POST /api/parts/{id}/movements` acepta solo `IN` y `ADJUSTMENT`
  (`OUT` manual → 400 `VALIDATION_ERROR`); `quantity` ≠ 0; `ADJUSTMENT` exige
  `reason` ≥ 10 caracteres.
- **VI-04**: toda modificación de stock corre en transacción con bloqueo de fila:
  si la operación dejaría `stock_current < 0` → 400 `STOCK_INSUFFICIENT` y **sin
  efecto** (RN-8, Q1); la tabla refuerza con `CHECK (stock_current >= 0)`.
- **VI-05**: `GET /api/parts?low=true` devuelve las refacciones con
  `stock_current <= stock_min` (alerta de stock bajo, CA-7).
- **VI-06**: no existe `DELETE` de refacciones ni de movimientos (auditoría).

### Refacciones de una orden

- **VO-01**: la orden debe existir → 404 `SERVICE_ORDER_NOT_FOUND`; solo el
  mecánico **asignado** puede agregar → id ajeno 403 `FORBIDDEN`; orden `DELIVERED`
  → 400 `ORDER_DELIVERED` (Q5, RN-9).
- **VO-02**: `partId` obligatorio y existente → 400 `PART_REQUIRED` /
  404 `PART_NOT_FOUND`; `quantity` > 0 → 400 `VALIDATION_ERROR`.
- **VO-03**: al guardar se valida el stock y, si alcanza, se insertan en la misma
  transacción el `order_parts`, el movimiento `OUT` y el descuento de
  `stock_current` (RN-7, CA-5); stock insuficiente → 400 `STOCK_INSUFFICIENT`
  sin efecto (RN-8).
- **VO-04**: consulta: ADMIN y RECEPTIONIST ven las refacciones de cualquier
  orden; MECHANIC solo de sus órdenes (403 si es ajena).
- **VO-05**: no existe `DELETE` de refacciones de la orden (R-06): una corrección
  de saldo la hace ADMIN con `ADJUSTMENT`.

## Estados y flujos

### Mantenimiento: estados calculados (Q4, R-04)

```text
Registro vigente por vehículo ──(lectura)──▶ cálculo con hoy y vehicles.current_mileage
    │
    ├── OVERDUE  (Vencido):  next_due_date < hoy   O   current_mileage >= next_due_mileage
    ├── UPCOMING (Próximo):  hoy + warn_days alcanza la fecha  O  current_mileage + warn_km alcanza el km
    └── NORMAL   (Normal):   el resto

Si define fecha Y kilometraje, basta con cumplir uno para estar Vencido.
Sin columna de estado y sin proceso programado: se recalcula en cada lectura.
```

### Inventario: flujo de stock (Q1, Q2, RN-7/RN-8)

```text
IN (manual, solo ADMIN) ────────┐
ADJUSTMENT (manual, ADMIN, ±) ──┼──▶ transacción: bloqueo de fila de parts
OUT (automático por uso en orden)┘    → validar stock (RN-8)
                                       → actualizar stock_current
                                       → insertar inventory_movements
                                       → confirmar

stock_current >= 0 SIEMPRE (Q1): la operación que lo rompería se rechaza con
400 STOCK_INSUFFICIENT y no deja ningún efecto (validación + CHECK en BD).
```

### Órdenes: regla de uso de refacciones (Q5)

```text
Agregar refacción: solo MECHANIC, solo sus órdenes, solo si status != DELIVERED
    ├── orden ajena            → 403 FORBIDDEN
    ├── orden ENTREGADA        → 400 ORDER_DELIVERED
    └── stock insuficiente     → 400 STOCK_INSUFFICIENT
```

## Supuestos de volumen

- Refacciones: decenas por instalación; movimientos: cientos por instalación;
  mantenimientos: uno por vehículo activo.
- El historial de un vehículo tiene decenas de entradas como máximo: la consulta con
  JOINs e índice `service_orders.vehicle_id` es suficiente (sin paginación en el MVP;
  si crece, se añade `?page=` sin cambiar el contrato).
- `INT` para stock y kilometrajes basta (un taller no maneja millones de piezas);
  `DECIMAL(10,2)` para precios en MXN, igual que Sprints anteriores.
- Sin particionado ni caché: los índices por `vehicle_id`, `part_id` y `order_id`
  cubren el flujo demostrable.
