# Contratos — Sprint 6: Notificaciones internas

Cada contrato define la interfaz JSON autoritativa de su módulo **para este sprint**. Las respuestas usan el sobre estándar `{ "ok": true, "data": { … } }` y los errores el sobre `{ "ok": false, "error": { "code", "message" } }` con el código HTTP apropiado. Todos los endpoints exigen `Authorization: Bearer <token>` y validan el rol en el backend (RN-15, CA-4).

| Contrato | Endpoints | Roles |
|----------|-----------|-------|
| [notifications.md](notifications.md) | `GET /api/notifications`, `POST /api/notifications/read` | campana/panel: los tres roles, con la matriz de grupos del contrato; lectura: cualquier rol autenticado |
| [client-notices.md](client-notices.md) | `GET /api/client-notices`, `POST /api/client-notices` | solo ADMIN y RECEPTIONIST; MECHANIC 403 |

Convenciones compartidas (heredadas de los Sprints 1–5, sin cambios):

- **Autenticación**: `Authorization: Bearer <token>`; sin token → 401 `UNAUTHORIZED`; token inválido → 401 `UNAUTHORIZED`; rol no permitido → 403 `FORBIDDEN`.
- **Validación**: cuerpo/consulta inválidos → 400 `VALIDATION_ERROR` con mensaje en español.
- **No encontrado**: recurso inexistente → 404 `NOT_FOUND` (código genérico existente en `server/middlewares/errorHandler.js`).
- **Idempotencia**: `POST .../read` y `POST /api/client-notices` se pueden repetir sin error ni duplicados (contrato documenta 200 en la repetición).
- **Sin paginación**: los volúmenes del MVP devuelven el arreglo completo (mismo criterio que listados existentes).
