# Contratos — Sprint 3: Historial, mantenimiento e inventario

Contratos de la API para este sprint. Los contratos de los Sprints 1–2 (auth, users,
clients, vehicles, appointments, service-orders) siguen vigentes en
`specs/001-base-clientes-vehiculos/contracts/` y
`specs/002-citas-ordenes-servicio/contracts/`.

## Archivos

| Archivo | Cubre |
|---------|-------|
| [vehicle-history.md](vehicle-history.md) | `GET /api/vehicles/{id}/history` (historial de servicios terminados de un vehículo) |
| [maintenances.md](maintenances.md) | `GET/POST /api/maintenances` (próximo mantenimiento por vehículo con estados calculados) |
| [inventory.md](inventory.md) | `/api/parts` (catálogo, stock, alertas y movimientos de inventario) |
| [order-parts.md](order-parts.md) | `GET/POST /api/service-orders/{id}/parts` (refacciones utilizadas en una orden) |

## Conviciones compartidas

- **Autenticación**: todas las rutas exigen `Authorization: Bearer <JWT>`; sin token
  → 401 `UNAUTHORIZED`. El rol y el estado del usuario se revalidan en cada petición.
- **Sobre JSON**: `{"ok": true, "data": ...}` en éxito; `{"ok": false, "error":
  {"code", "message", "details?"}}` en error (R-14 del Sprint 1).
- **Códigos**: 200/201 éxito, 400 validación o regla de negocio, 403 sin permiso,
  404 inexistente, 500 genérico sin trazas.
- **Idioma**: mensajes de error en español, listos para mostrar al usuario.
- **Fechas**: `YYYY-MM-DD`; kilometrajes y stock como enteros; precios como cadena
  decimal con 2 decimales.

## Códigos de negocio nuevos de este sprint

| Código | HTTP | Condición |
|--------|------|-----------|
| `PART_NOT_FOUND` | 404 | Refacción inexistente |
| `PART_REQUIRED` | 400 | Sin `partId` en la petición |
| `PART_CODE_DUPLICATED` | 400 | `partCode` ya registrado en el catálogo |
| `STOCK_INSUFFICIENT` | 400 | La operación dejaría el stock por debajo de cero (RN-8, Q1) |
| `MAINTENANCE_TARGET_REQUIRED` | 400 | Sin `nextDueDate` ni `nextDueMileage` (RN-11) |
| `ORDER_DELIVERED` | 400 | Agregar refacciones a una orden ENTREGADA (reutilizado del Sprint 2) |

Reutilizados de sprints anteriores: `VALIDATION_ERROR`, `UNAUTHORIZED`,
`FORBIDDEN`, `VEHICLE_REQUIRED`, `VEHICLE_NOT_FOUND`, `SERVICE_ORDER_NOT_FOUND`,
`INTERNAL_ERROR`.

## Matriz de permisos por endpoint (RN-15, R-07)

| Endpoint | ADMIN | RECEPTIONIST | MECHANIC |
|----------|-------|--------------|----------|
| `GET /api/vehicles/{id}/history` | sí | 403 | sí |
| `GET /api/maintenances` | sí | sí | sí |
| `POST /api/maintenances` | sí | 403 | sí |
| `GET /api/parts` (incluye `?low=true`) | sí | 403 | 403 |
| `POST /api/parts`, `PATCH /api/parts/{id}` | sí | 403 | 403 |
| `GET/POST /api/parts/{id}/movements` | sí | 403 | 403 |
| `GET /api/service-orders/{id}/parts` | sí | sí | solo sus órdenes (403 si es ajena) |
| `POST /api/service-orders/{id}/parts` | 403 | 403 | solo sus órdenes no ENTREGADAS (Q5) |
| `DELETE` (de refacciones, movimientos o usos) | **no existe** | — | — |
