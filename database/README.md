# Base de datos de Motorix

Esquema de MySQL **local** para el MVP. Motor InnoDB, codificación `utf8mb4`.

## Estructura

- `migrations/` — scripts SQL numerados e inmutables (`001_create_users.sql`,
  `002_create_clients.sql`, `003_create_vehicles.sql`, `004_create_appointments.sql`,
  `005_create_service_orders.sql`, `006_create_order_services.sql`,
  `007_create_order_labor.sql`, `008_create_maintenance.sql`,
  `009_create_parts.sql`, `010_create_inventory_movements.sql`,
  `011_create_order_parts.sql`, `012_create_payments.sql`,
  `013_create_tickets.sql`, `014_order_parts_price.sql`, `015_notifications.sql`,
  `016_settings_reports_security.sql`, …). Los cambios de esquema
  se agregan como **nuevos** scripts; NUNCA se editan scripts de sprints ya
  aplicados.
- `scripts/` — utilidades de entorno:
  - `crear-entorno.ps1`: crea las bases `motorix` y `motorix_test` y el usuario
    dedicado `motorix_app` (nunca `root`).
  - `aplicar-migraciones.ps1`: aplica los scripts pendientes de `migrations/` de
    forma idempotente y los registra en la tabla `schema_migrations`
    (`version`, `applied_at`, `checksum`). Si el checksum de un script ya
    aplicado cambió, lo reporta como error (los scripts son inmutables).
- `data/` — directorio de datos de MySQL si se usa uno dentro del proyecto;
  está en `.gitignore` y NO se versiona.

Los datos de ejemplo ejecutables no viven en esta carpeta: son
`server/scripts/seed.js` (cuentas, clientes, vehículos, citas, órdenes con
servicios y mano de obra; del Sprint 3: refacciones con movimientos `IN`, un
mantenimiento vencido y el uso de una refacción en la orden `FINISHED`; del
Sprint 4: un pago en efectivo `PAID` con su ticket `TCK-…` sobre la primera
orden terminada y una segunda orden terminada sin pago para demostrar el
cobro — idempotente por orden) y `server/scripts/create-admin.js` (cuentas
iniciales, idempotente).

## Flujo de instalación desde cero

```powershell
database/scripts/crear-entorno.ps1
database/scripts/aplicar-migraciones.ps1
# completar .env a partir de .env.example (en la raíz del proyecto)
cd server; npm run seed
```

La base puede recrearse desde cero con estos pasos (CA-6) y la instalación es
repetible: migraciones y seeds se pueden ejecutar varias veces sin duplicar
datos ni dejar la base vacía (SC-004).

Las pruebas (`npm test`) usan siempre `motorix_test`, nunca la base principal.

## Convención de nombres y orden de aplicación

Los scripts se numeran en orden de aplicación y se ejecutan en ese orden
(migraciones 004–007 del Sprint 2, 008–011 del Sprint 3, 012–013 del
Sprint 4, 014 del Sprint 5, 015 del Sprint 6 y 016 del Sprint 7 dependen de las tablas de los
sprints anteriores):

| Script | Tabla | Depende de |
|--------|-------|------------|
| `001_create_users.sql` | `users` | — |
| `002_create_clients.sql` | `clients` | — |
| `003_create_vehicles.sql` | `vehicles` | `clients` |
| `004_create_appointments.sql` | `appointments` | `clients`, `vehicles` |
| `005_create_service_orders.sql` | `service_orders` | `clients`, `vehicles`, `users` |
| `006_create_order_services.sql` | `order_services` | `service_orders` |
| `007_create_order_labor.sql` | `order_labor` | `service_orders` |
| `008_create_maintenance.sql` | `maintenance` | `vehicles`, `users` |
| `009_create_parts.sql` | `parts` | `users` |
| `010_create_inventory_movements.sql` | `inventory_movements` | `parts`, `users`, `service_orders` (opcional) |
| `011_create_order_parts.sql` | `order_parts` | `service_orders`, `parts`, `users` |
| `012_create_payments.sql` | `payments` | `service_orders`, `users` |
| `013_create_tickets.sql` | `tickets` | `service_orders`, `users` |
| `014_order_parts_price.sql` | `order_parts` (columnas nuevas), `parts` (CHECK) | `order_parts`, `parts`, `users` |
| `015_notifications.sql` | `notification_reads`, `client_notices` | `users`, `clients` |
| `016_settings_reports_security.sql` | `settings`, `service_types`, `terms_versions`, `terms_acceptances`, `audit_log` (nuevas) y 12 columnas en `maintenance`, `order_services`, `order_parts`, `service_orders`, `tickets` y `users` | `users` y las tablas modificadas |

La `014_order_parts_price.sql` (Sprint 5) agrega a `order_parts` la columna
`unit_price`, con el precio de venta **guardado al agregar la refacción a la
orden** (instantánea D-01/D-03; hace backfill con el precio vigente de `parts`
para las líneas existentes), junto con las columnas de la corrección
administrativa de precio (`price_correction_reason`, `price_corrected_by`,
`price_corrected_at`, D-05, única mutación admitida sobre la tabla). Incluye el
CHECK de tope `unit_price <= 99999.99` (D-08) y los CHECK equivalentes de tope
sobre `parts.purchase_price` y `parts.sale_price`.

La `015_notifications.sql` (Sprint 6) crea las dos tablas nuevas de las
notificaciones internas: `notification_reads` (una fila por usuario y clave de
aviso leído, con `UNIQUE (user_id, notification_key)` y `user_id` en
`ON DELETE CASCADE`) y `client_notices` (registro del aviso de recepción a un
cliente con `UNIQUE (client_id, notice_type, source_id)` para garantizar
«una vez por hecho», D-07, y `notified_by`/`notified_at` de quién y cuándo).
Los avisos en sí NO se almacenan: se calculan en cada consulta (RN-10).

La `016_settings_reports_security.sql` (Sprint 7) es aditiva y sin migración
inversa. Crea cinco tablas: `settings` (pares clave-valor del taller; nace
vacía y, si falta una clave, rige el valor de respaldo del código),
`service_types` (catálogo con intervalo en días o kilómetros; se desactiva, no
se borra), `terms_versions` (términos y aviso de privacidad versionados; la
migración inserta la versión 1 con una plantilla en español, de forma
idempotente), `terms_acceptances` (constancia de aceptación con
`UNIQUE (user_id, terms_version_id)`) y `audit_log` (bitácora de solo
inserción). Agrega 12 columnas:

- `maintenance.warn_days` y `maintenance.warn_km` pasan a admitir `NULL`, que
  significa «usar el valor del taller» (D-16); los valores capturados a mano se
  conservan.
- `order_services.service_type_id` (enlace opcional al catálogo).
- `order_parts.unit_cost` (costo congelado por línea, con CHECK de tope).
- `service_orders.finished_at` y `finished_at_estimated` (fecha de terminación y
  marca de que es una aproximación).
- `tickets.workshop_name`, `workshop_address`, `workshop_phone`,
  `next_service_date` y `next_service_mileage` (instantánea al emitir).
- `users.last_activity_at` (cierre por inactividad).

Aproximaciones de los rellenos: los mantenimientos con 30 días o 500 km (el
valor predeterminado histórico) quedan en `NULL`; `order_parts.unit_cost` toma
el `purchase_price` vigente solo cuando es mayor que 0 y queda en `NULL` en el
resto («sin costo registrado»); `finished_at` de las órdenes ya `FINISHED` o
`DELIVERED` es su `updated_at` y se marcan con `finished_at_estimated = 1`.

El registro en `schema_migrations` usa el nombre del archivo como `version`.
