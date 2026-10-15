# Modelo de Datos — Sprint 2: Citas y órdenes de servicio

**Fecha**: 2026-10-14
**Rama**: `002-citas-ordenes-servicio`

Base: MySQL local, motor InnoDB, codificación `utf8mb4`, esquema versionado en
`database/migrations/` con registro en `schema_migrations`. Las migraciones son
numeradas e inmutables; este sprint agrega **nuevos** scripts (nunca edita los ya
aplicados del Sprint 1):

| Script | Tabla |
|--------|-------|
| `004_create_appointments.sql` | `appointments` |
| `005_create_service_orders.sql` | `service_orders` |
| `006_create_order_services.sql` | `order_services` |
| `007_create_order_labor.sql` | `order_labor` |

Las tablas `users`, `clients`, `vehicles` y `schema_migrations` del Sprint 1 no
cambian (solo se leen y, en el caso de `vehicles.current_mileage`, se actualizan).

## Entidades

### `appointments`

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `client_id` | INT UNSIGNED | NOT NULL, FK → `clients.id`, `RESTRICT` | Cliente de la cita |
| `vehicle_id` | INT UNSIGNED | NOT NULL, FK → `vehicles.id`, `RESTRICT` | Vehículo de la cita |
| `appointment_date` | DATE | NOT NULL | Día de la cita (`YYYY-MM-DD`) |
| `appointment_time` | TIME | NOT NULL | Hora de la cita (`HH:MM`) |
| `reason` | VARCHAR(150) | NOT NULL | Motivo de la visita |
| `notes` | NULL, VARCHAR(500) | NULL | Observaciones opcionales |
| `status` | ENUM('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELED') | NOT NULL, DEFAULT 'PENDING' | Ciclo de vida de la cita |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

**Índices**: `client_id`, `vehicle_id`, `status`, y compuesto
`(appointment_date, appointment_time)` para la consulta diaria de la agenda.

**Sin columna `appointment_id` en ninguna parte**: las citas **no** se vinculan con
órdenes en este sprint (Q3).

### `service_orders`

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `client_id` | INT UNSIGNED | NOT NULL, FK → `clients.id`, `RESTRICT` | Debe coincidir con el dueño del vehículo |
| `vehicle_id` | INT UNSIGNED | NOT NULL, FK → `vehicles.id`, `RESTRICT` | RN-2: vehículo obligatorio y existente |
| `mechanic_id` | INT UNSIGNED | NOT NULL, FK → `users.id`, `RESTRICT` | Asignación **manual** (Q2); rol MECHANIC validado en backend |
| `entry_mileage` | INT UNSIGNED | NOT NULL | RN-3: kilometraje de entrada obligatorio ≥ 0 |
| `mileage_correction_reason` | VARCHAR(200) | NULL | Solo ADMIN puede forzar kilometraje menor (RN-4); guarda el motivo |
| `reported_problem` | VARCHAR(500) | NOT NULL | Problema reportado al recibir el vehículo |
| `diagnosis` | VARCHAR(1000) | NULL | Lo registra el mecánico |
| `observations` | VARCHAR(1000) | NULL | Observaciones del mecánico |
| `recommendations` | VARCHAR(1000) | NULL | Recomendaciones al cliente |
| `status` | ENUM('RECEIVED','DIAGNOSIS','IN_REPAIR','WAITING_PART','FINISHED','DELIVERED') | NOT NULL, DEFAULT 'RECEIVED' | Estado del trabajo (CA-5) |
| `waiting_origin` | ENUM('DIAGNOSIS','IN_REPAIR') | NULL | Origen al entrar en espera de refacción; al salir se regresa aquí (Q1) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

**Índices**: `client_id`, `vehicle_id`, `mechanic_id` (listado del mecánico, CA-3),
`status`, `created_at`.

**Sin columna `appointment_id`**: el vínculo cita↔orden no existe en este sprint (Q3).
**Sin columna de eliminación lógica**: no hay endpoint de borrado (RN-9).

### `order_services`

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, `RESTRICT` | Varías filas por orden |
| `description` | VARCHAR(200) | NOT NULL | Servicio realizado |
| `unit_price` | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Precio unitario capturado ≥ 0 (sin cálculo de totales en este sprint) |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**Índice**: `order_id`.

### `order_labor`

| Campo | Tipo | Restricciones | Observaciones |
|-------|------|---------------|---------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, `RESTRICT` | Varías filas por orden |
| `concept` | VARCHAR(200) | NOT NULL | Concepto de mano de obra |
| `hours` | DECIMAL(6,2) | NOT NULL | Horas > 0 |
| `hourly_rate` | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Tarifa por hora ≥ 0 |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**Índice**: `order_id`.

## Relaciones

```text
clients 1 ──── N appointments      (appointments.client_id  → clients.id)
vehicles 1 ──── N appointments     (appointments.vehicle_id → vehicles.id)
clients 1 ──── N service_orders    (service_orders.client_id → clients.id)
vehicles 1 ──── N service_orders   (service_orders.vehicle_id → vehicles.id)
users 1 ──── N service_orders      (service_orders.mechanic_id → users.id, rol MECHANIC)
service_orders 1 ──── N order_services   (order_services.order_id → service_orders.id)
service_orders 1 ──── N order_labor      (order_labor.order_id    → service_orders.id)
appointments ── (sin relación) ── service_orders
```

- Una cita pertenece a **1** cliente y **1** vehículo (que deben coincidir entre sí).
- Una orden pertenece a **1** cliente y **1** vehículo con el mismo criterio, y a
  **1** mecánico asignado.
- Una orden tiene **0..N** servicios y **0..N** conceptos de mano de obra.
- Citas y órdenes **no** están relacionadas (Q3): cancelar una cita no toca órdenes.

## Reglas de validación (del spec)

### Citas

- **VA-01**: `clientId`, `vehicleId`, `date`, `time` y `reason` obligatorios →
  error 400 `VALIDATION_ERROR` con detalle por campo.
- **VA-02**: `clientId` y `vehicleId` deben existir → 404 `CLIENT_NOT_FOUND` /
  `VEHICLE_NOT_FOUND`; ausentes → 400 `CLIENT_REQUIRED` / `VEHICLE_REQUIRED`.
- **VA-03**: el vehículo debe pertenecer al cliente indicado → 400
  `VEHICLE_CLIENT_MISMATCH`.
- **VA-04**: cambios de estado válidos según la máquina de abajo → 400
  `INVALID_STATUS_TRANSITION`; la cancelación exige confirmación en la interfaz
  (FR-004) y solo aplica desde estados activos.
- **VA-05**: una cita COMPLETED o CANCELED no se reabre ni se edita su datos → 400
  `APPOINTMENT_CLOSED`; no existe endpoint `DELETE` (se conserva el historial).

### Órdenes de servicio

- **VS-01**: `vehicleId` obligatorio y existente (RN-2) → 400 `VEHICLE_REQUIRED` /
  404 `VEHICLE_NOT_FOUND`; `clientId` ausente → 400 `CLIENT_REQUIRED`; inexistente →
  404 `CLIENT_NOT_FOUND`; el vehículo no pertenece al cliente → 400
  `VEHICLE_CLIENT_MISMATCH`.
- **VS-02**: `mechanicId` obligatorio y existente → 400 `MECHANIC_REQUIRED` /
  404 `MECHANIC_NOT_FOUND`; si el usuario no es un mecánico activo → 400
  `INVALID_MECHANIC` (Q2).
- **VS-03**: `entryMileage` obligatorio, entero ≥ 0 (RN-3); si es menor que
  `vehicles.current_mileage` → 400 `MILEAGE_LOWER_THAN_PREVIOUS`, salvo que el
  usuario sea ADMIN y envíe `mileageCorrectionReason` (≥ 10 caracteres) → se guarda
  el motivo y se aplica (RN-4). Al crear la orden, `vehicles.current_mileage` pasa a
  `entry_mileage`.
- **VS-04**: `reportedProblem` obligatorio, hasta 500 caracteres → 400
  `VALIDATION_ERROR`.
- **VS-05**: autorización por rol (FR-017/RN-15, matriz R-06): MECHANIC solo opera
  sus órdenes (id ajeno → 403 `FORBIDDEN`, R-07); RECEPTIONIST no cambia estados ni
  registra trabajo (403); MECHANIC no crea ni reasigna órdenes (403).
- **VS-06**: servicios y mano de obra: `description`/`concept` obligatorios ≤ 200
  caracteres; `unitPrice`/`hourlyRate` ≥ 0; `hours` > 0 → 400 `VALIDATION_ERROR`.
- **VS-07**: una orden DELIVERED no cambia de estado (máquina sin salidas) y solo
  ADMIN puede corregir su trabajo capturado → 400 `ORDER_DELIVERED` para el resto;
  **no existe** endpoint de borrado de la orden (RN-9).
- **VS-08**: no se duplican filas por doble pulsación: la interfaz deshabilita el
  botón mientras guarda (caso límite del spec).

## Transiciones de estado

### Órdenes de servicio (Q1, CA-5)

```text
RECEIVED ──▶ DIAGNOSIS ──▶ IN_REPAIR ──▶ FINISHED ──▶ DELIVERED
                 │             │
                 └──▶ WAITING_PART ◀──┘
                       │ (vuelve a waiting_origin:
                       │  DIAGNOSIS o IN_REPAIR)
                       ▼
                 waiting_origin

DELIVERED: sin salidas (historial inmutable, RN-9)
Sin retrocesos en ningún otro caso (Q1)
```

- Quién cambia: ADMIN (cualquiera) y el MECHANIC asignado (solo su orden).
  RECEPTIONIST recibe 403 (Q1: «recepción solo consulta y crea la orden»).
- Toda transición no permitida → 400 `INVALID_STATUS_TRANSITION` con mensaje en
  español (CA-8 se prueba en `order-transitions.test.js`).

### Citas (FR-004/FR-005, Q3)

```text
PENDING ──▶ CONFIRMED ──▶ IN_PROGRESS ──▶ COMPLETED
   │            │              │
   │            └──────┬───────┘
   └───────────────────┤
                       ▼
                  CANCELED  (desde cualquier estado activo,
                             con confirmación; sin retrocesos)
```

- Quién cambia: ADMIN y RECEPTIONIST. MECHANIC recibe 403 (no gestiona citas).
- COMPLETED y CANCELED son estados finales: sin salidas y sin edición de datos
  (`APPOINTMENT_CLOSED`).

## Supuestos de volumen

- Citas: decenas por semana; órdenes: cientos por instalación (equipo pequeño).
- Sin particionado ni caché: los índices por `appointment_date`, `status`,
  `mechanic_id` y `created_at` cubren los listados del flujo demostrable.
- DECIMAL(10,2) para precios y tarifas basta para montos de taller en MXN.
