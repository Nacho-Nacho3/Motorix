# Contratos — Sprint 2: Citas y órdenes de servicio

Contratos de la API para este sprint. Los contratos del Sprint 1 (auth, users,
clients, vehicles) siguen vigentes en
`specs/001-base-clientes-vehiculos/contracts/`.

## Archivos

| Archivo | Cubre |
|---------|-------|
| [appointments.md](appointments.md) | `GET/POST /api/appointments`, `GET/PATCH /api/appointments/{id}` (alta, consulta, edición y cancelación de citas) |
| [service-orders.md](service-orders.md) | `/api/service-orders` (alta, consulta, edición, estados, diagnóstico/trabajo, servicios y mano de obra) |

## Conviciones compartidas

- **Autenticación**: todas las rutas exigen `Authorization: Bearer <JWT>`; sin token
  → 401 `UNAUTHORIZED`. El rol y el estado del usuario se revalidan en cada petición.
- **Sobre JSON**: `{"ok": true, "data": ...}` en éxito; `{"ok": false, "error":
  {"code", "message", "details?"}}` en error (R-14 del Sprint 1).
- **Códigos**: 200/201 éxito, 400 validación o regla de negocio, 403 sin permiso,
  404 inexistente, 500 genérico sin trazas.
- **Idioma**: mensajes de error en español, listos para mostrar al usuario.
- **Fechas**: `YYYY-MM-DD` y horas `HH:MM`.

## Códigos de negocio nuevos de este sprint

| Código | HTTP | Condición |
|--------|------|-----------|
| `APPOINTMENT_NOT_FOUND` | 404 | Cita inexistente |
| `SERVICE_ORDER_NOT_FOUND` | 404 | Orden inexistente |
| `ORDER_ITEM_NOT_FOUND` | 404 | Servicio o mano de obra inexistente en la orden |
| `VEHICLE_REQUIRED` | 400 | Sin `vehicleId` en la petición |
| `VEHICLE_CLIENT_MISMATCH` | 400 | El vehículo no pertenece al cliente indicado |
| `MECHANIC_REQUIRED` | 400 | Sin `mechanicId` |
| `MECHANIC_NOT_FOUND` | 404 | `mechanicId` inexistente |
| `INVALID_MECHANIC` | 400 | El usuario asignado no es un mecánico activo |
| `MILEAGE_LOWER_THAN_PREVIOUS` | 400 | `entryMileage` menor que el registrado en el vehículo (RN-4) |
| `INVALID_STATUS_TRANSITION` | 400 | Transición de estado no permitida (CA-5) |
| `APPOINTMENT_CLOSED` | 400 | Edición o reactivación de una cita completada o cancelada |
| `ORDER_DELIVERED` | 400 | Edición de trabajo en una orden entregada por rol distinto de ADMIN |

Reutilizados del Sprint 1: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`,
`CLIENT_REQUIRED`, `CLIENT_NOT_FOUND`, `VEHICLE_NOT_FOUND`, `INTERNAL_ERROR`.

## Matriz de permisos por endpoint (CA-7, R-06)

| Endpoint | ADMIN | RECEPTIONIST | MECHANIC |
|----------|-------|--------------|----------|
| `/api/appointments` (lectura y escritura) | sí | sí | 403 |
| `GET /api/service-orders` | todas | todas | solo las suyas |
| `GET /api/service-orders/{id}` | sí | sí | solo las suyas (403 si es ajena) |
| `POST /api/service-orders` | sí | sí | 403 |
| `PATCH /api/service-orders/{id}` (problema/reasignar) | sí | sí | 403 |
| `PATCH .../{id}/status` | sí | 403 | solo las suyas |
| `PATCH .../{id}/work` | sí | 403 | solo las suyas |
| `POST/DELETE .../{id}/services` y `.../{id}/labor` | sí | 403 | solo las suyas |
| `DELETE /api/service-orders/{id}` | **no existe** (RN-9) | — | — |
