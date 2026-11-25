# Contratos — Sprint 7: Reportes, configuración, términos y seguridad

Cada contrato define la interfaz JSON autoritativa de su módulo **para este sprint**. Las respuestas usan el sobre estándar `{ "ok": true, "data": { … } }` y los errores `{ "ok": false, "error": { "code", "message", "details"? } }` con el código HTTP apropiado, igual que en los Sprints 1–6.

| Contrato | Endpoints | Roles |
|----------|-----------|-------|
| [settings.md](settings.md) | `GET /api/settings`, `PATCH /api/settings` | solo ADMIN |
| [service-types.md](service-types.md) | `GET/POST /api/service-types`, `PATCH /api/service-types/:id`, `GET /api/service-types/lookup` | catálogo: ADMIN; lookup: los tres roles |
| [reports.md](reports.md) | `GET /api/reports/income`, `/services`, `/productivity`, `/parts-margin`, `/inventory-rotation` (con `?format=csv`) | solo ADMIN |
| [terms.md](terms.md) | `GET /api/terms/current`, `POST /api/terms/accept`, `POST /api/terms`, `GET /api/terms/acceptances` | vigente y aceptar: cualquier usuario autenticado (exentos del bloqueo); publicar y aceptaciones: ADMIN |
| [audit-log.md](audit-log.md) | `GET /api/audit-log` | solo ADMIN |
| [changes-to-existing.md](changes-to-existing.md) | cambios a `POST /api/maintenances`, `GET /api/maintenances`, `GET /api/maintenances/suggestion`, servicios de la orden, tickets, `auth` y las rutas autenticadas | según el módulo |

## Convenciones compartidas (heredadas, sin cambios)

- **Autenticación**: `Authorization: Bearer <token>`; sin token o token inválido → 401 `UNAUTHORIZED`; rol no permitido → 403 `FORBIDDEN`.
- **Validación**: cuerpo o consulta inválidos → 400 `VALIDATION_ERROR` con `details` por campo y mensajes en español.
- **No encontrado**: recurso inexistente → 404 `NOT_FOUND` (o el código específico existente).
- **Importes**: cadenas con 2 decimales (`"1234.50"`), calculadas en centavos enteros; igual que pagos y tickets.

## Códigos de error nuevos del sprint

| Código | HTTP | Cuándo |
|--------|------|--------|
| `TERMS_NOT_ACCEPTED` | 403 | el usuario no aceptó la versión vigente de los términos y pide algo distinto de las rutas exentas (CA-19) |
| `SESSION_IDLE` | 401 | pasaron más de 30 minutos sin actividad (CA-23); el cliente cierra la sesión |
| `SERVICE_TYPE_NAME_TAKEN` | 409 | ya existe un tipo de servicio con ese nombre |
| `TERMS_UNCHANGED` | 400 | se intentó publicar un texto vacío o idéntico al vigente |

El resto reutiliza los existentes (`VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `UNAUTHORIZED`, `WEAK_PASSWORD`).

## Rutas exentas del bloqueo por términos (CA-19)

Solo estas cuatro funcionan sin aceptación vigente: `GET /api/terms/current`, `POST /api/terms/accept`, `GET /api/auth/me` y `POST /api/auth/logout`. `POST /api/auth/login` no requiere token. Todas las demás rutas autenticadas responden 403 `TERMS_NOT_ACCEPTED`.
