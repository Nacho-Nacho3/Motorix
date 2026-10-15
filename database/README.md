# Base de datos de Motorix

Esquema de MySQL **local** para el MVP. Motor InnoDB, codificación `utf8mb4`.

## Estructura

- `migrations/` — scripts SQL numerados e inmutables (`001_create_users.sql`,
  `002_create_clients.sql`, `003_create_vehicles.sql`, `004_create_appointments.sql`,
  `005_create_service_orders.sql`, `006_create_order_services.sql`,
  `007_create_order_labor.sql`, `008_create_maintenance.sql`,
  `009_create_parts.sql`, `010_create_inventory_movements.sql`,
  `011_create_order_parts.sql`, `012_create_payments.sql`,
  `013_create_tickets.sql`, …). Los cambios de esquema
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
(migraciones 004–007 del Sprint 2, 008–011 del Sprint 3 y 012–013 del
Sprint 4 dependen de las tablas de los sprints anteriores):

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

El registro en `schema_migrations` usa el nombre del archivo como `version`.
