# Modelo de datos — Sprint 6: Notificaciones internas

**Fecha**: 2026-11-05 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Investigación**: [research.md](research.md)

Fase 1 de `/speckit.plan`. Describe solo lo que este sprint agrega o cambia; el resto del esquema (Sprints 1–5) se conserva sin modificaciones. La fuente autoritativa del esquema son los scripts de `database/migrations/`; este documento los interpreta. **Los avisos no son una entidad persistida**: se calculan en cada consulta (RN-10, P-1). Este sprint agrega dos tablas.

## Entidades nuevas

### notification_reads (lectura de un aviso por usuario)

Tabla nueva creada por `015_notifications.sql`. Es un hecho de usuario: **no se borra** (la identidad de lectura es estable, D-04).

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED PK AUTO_INCREMENT | — |
| `user_id` | INT UNSIGNED NOT NULL | FK → `users.id` (`ON DELETE CASCADE` — al borrar el usuario pierde sus lecturas, que solo tienen sentido para él) |
| `notification_key` | VARCHAR(100) NOT NULL | clave `TIPO:id:ESTADO` (P-4); formato validado en zod, longitud acotada |
| `read_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | momento de la lectura |

- **Clave única**: `UNIQUE KEY uq_notification_reads_user_key (user_id, notification_key)` — hace idempotente el `POST /api/notifications/read` (upsert) y permite saber «leído» con un `EXISTS`.
- **Índice**: la única clave cubre todas las consultas (por `user_id`).
- **Sin FK ni columnas de aviso**: la tabla no guarda tipo, estado ni objeto del aviso; solo «este usuario leyó esta clave». El aviso activo se recalcula siempre (P-1).

### client_notices (aviso ya entregado a un cliente)

Tabla nueva creada por `015_notifications.sql`. Registra que una persona avisó a un cliente (CA-11): **no envía nada por sí misma**, es el registro del hecho manual. Sin DELETE (evento constancia).

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED PK AUTO_INCREMENT | — |
| `client_id` | INT UNSIGNED NOT NULL | FK → `clients.id` (`ON DELETE RESTRICT`) |
| `notice_type` | VARCHAR(40) NOT NULL | `ORDER_READY`, `APPOINTMENT_TOMORROW`, `MAINTENANCE_UPCOMING`, `MAINTENANCE_OVERDUE` (P-9; validado en zod) |
| `source_id` | INT UNSIGNED NOT NULL | id del hecho que motivó el aviso: orden, cita o mantenimiento (no es FK — es polymorphic; el servicio valida que exista antes de insertar) |
| `notes` | VARCHAR(300) NULL | nota opcional del responsable (default de D-07) |
| `notified_by` | INT UNSIGNED NOT NULL | FK → `users.id` (`RESTRICT`): quién dio el aviso («ya lo hablé por teléfono») |
| `notified_at` | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | cuándo |

- **Clave única**: `UNIQUE KEY uq_client_notices_source (client_id, notice_type, source_id)` — garantiza estructuralmente «una vez por hecho» (CA-11/D-07, P-8) y hace idempotente el `POST` (201 al crear, 200 si ya existía).
- **Índice**: `KEY idx_client_notices_client (client_id)` para el JOIN de exclusión y el histórico por cliente.
- **NOT NULL en todo** salvo `notes`: no existen avisos «en blanco».

## Entidades existentes de solo lectura (los datos de los que se calculan los avisos)

Ninguna cambia. Este sprint solo las consulta:

| Tabla | Uso en el sprint | Campos relevantes |
|-------|------------------|-------------------|
| `maintenance` | avisos UPCOMING/OVERDUE y motivos de la lista por avisar | `vehicle_id`, `next_due_date`, `next_due_mileage`, `warn_days` (def. 30), `warn_km` (def. 500) — estado **sin columna**: se calcula (P-14/D-06, RN-11) |
| `appointments` | citas de hoy (campana, D-02) y citas de mañana (lista por avisar) | `appointment_date`, `appointment_time`, `status` (`PENDING/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELED`); índice `(appointment_date, appointment_time)` ya existe |
| `parts` | stock bajo/agotado | `stock_current`, `stock_min` — aviso si `stock_current <= stock_min` (mismo filtro `low=true`); `LOW` o `OUT` según `stock_current = 0` |
| `service_orders` | órdenes detenidas (D-01) y órdenes terminadas sin entregar (lista por avisar) | `status` (`RECEIVED/DIAGNOSIS/IN_REPAIR/WAITING_PART/FINISHED/DELIVERED`), `mechanic_id` (filtro del mecánico, D-08), `updated_at` (proxy de «sin actividad», P-3); índice por `status` ya existe |
| `clients` | teléfono y nombre en la lista por avisar | `name`, `phone` (`VARCHAR(20) NOT NULL`, índice `idx_clients_phone`); visible solo para ADMIN/RECEPTIONIST (mismos roles que hoy lo consultan) |
| `users` | `notified_by` y autenticación | `id`, `full_name`, `role` |

**Nota sobre `order_status_history`**: el insumo del sprint la supone consultable para detectar órdenes detenidas; **no existe en ninguna migración** (verificado 2026-11-05). El criterio D-01 se aplica sobre `service_orders.updated_at` (P-3).

## Relaciones

```text
users 1 ─── * notification_reads        (user_id, CASCADE)
users 1 ─── * client_notices             (notified_by, RESTRICT)
clients 1 ── * client_notices            (client_id, RESTRICT)
(client_id, notice_type, source_id) ──► hecho en orders / appointments / maintenance
                                         (source_id polymorphic, validado en servicio)

maintenance / appointments / parts / service_orders ──► solo lectura para el cálculo
```

## Cálculos autoritativos

### Avisos del centro (`GET /api/notifications`)

```text
leídas(user)        = SELECT notification_key FROM notification_reads WHERE user_id = user
base(rol)           = mantenimientos (UPCOMING/OVERDUE, orden de urgencia, listarMantenimientos)
                    + citas con appointment_date = CURDATE() (cualquier estado, D-02)
                    + partes con stock_current <= stock_min  (solo ADMIN, CA-4)
                    + órdenes con status NOT IN ('FINISHED','DELIVERED')
                      AND updated_at <= NOW() - INTERVAL 2 DAY  (D-01, N=2)
                      → para MECHANIC, solo con mechanic_id = user (D-08)
                      → para RECEPTIONIST, todas (sin stock)
clave(item)         = TIPO:id:ESTADO (P-4)
unreadCount         = |{ item ∈ base(rol) : clave(item) ∉ leídas(user) }|
```

### Clientes por avisar (`GET /api/client-notices`)

```text
motivos = ORDER_READY           : service_orders.status = 'FINISHED'
        + APPOINTMENT_TOMORROW  : appointment_date = CURDATE()+1
                                  AND status NOT IN ('COMPLETED','CANCELED')
        + MAINTENANCE_UPCOMING/OVERDUE : estado calculado del mantenimiento (CA-5)
pendientes = motivos LEFT JOIN client_notices
                  ON (client_id, notice_type, source_id) → solo los sin aviso
orden = por tipo y luego por nombre de cliente (presentación estable)
```

## Validaciones (derivadas de los requisitos)

| Regla | Origen | Dónde se aplica |
|-------|--------|-----------------|
| La clave de lectura tiene formato `TIPO:id:ESTADO` y ≤ 100 caracteres | D-04 | zod `notificationKeySchema` (400 `VALIDATION_ERROR`) |
| Registrar lectura es idempotente y por usuario autenticado | D-04/RN-15 | clave única + `user_id` del token, nunca del cuerpo |
| La lista por avisar es solo ADMIN/RECEPTIONIST (MECHANIC 403) | CA-10/FR-010 | `authorize("ADMIN","RECEPTIONIST")` |
| El motivo y el `source_id` del aviso deben corresponder a un hecho existente | CA-11 | servicio valida existencia antes de insertar (404 `NOT_FOUND` si no) |
| Un hecho solo se avisa una vez | CA-11/D-07 | clave única `(client_id, notice_type, source_id)` + upsert |
| `notice_type` ∈ dominio de cuatro valores | P-9 | zod (400 `VALIDATION_ERROR`) |
| `note` opcional, ≤ 300 caracteres | D-07 | zod |
| Stock bajo solo para ADMIN | CA-4 | filtro del servicio por rol |
| Sin consulta automática en segundo plano | D-03 | el cliente solo llama en login/panel/navegación (sin infraestructura de polling) |

## Transiciones de estado

No hay estados propios: `notification_reads` y `client_notices` son eventos que solo se agregan (sin UPDATE de negocio ni DELETE). El «estado» de un aviso (leído/no leído, avisado/no avisado) es derivado: existe mientras el hecho de origen exista y no tenga su fila (CA-6: si el hecho desaparece, el aviso no se muestra).

## Migración y semillas

- **`015_notifications.sql`**: `CREATE TABLE IF NOT EXISTS` de las dos tablas con sus FKs e índices; aditiva, sin tocar tablas existentes; registro idempotente en `schema_migrations`. Actualiza `database/README.md`.
- **`server/scripts/seed.js`** (ampliado, idempotente, P-12): garante ≥1 caso por tipo de aviso (CA-12) — cita con fecha de hoy, cita de mañana para la lista por avisar, orden no terminal con `updated_at` retrotraído 3 días (marcador propio), al menos un mantenimiento UPCOMING/OVERDUE y una refacción con `stock_current <= stock_min` (re-verificados los que ya traían los seeds del Sprint 3/4). Segunda corrida: 0 registros nuevos.
