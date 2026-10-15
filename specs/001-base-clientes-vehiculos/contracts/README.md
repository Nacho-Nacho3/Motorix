# Contratos — API REST del Sprint 1

**Fecha**: 2026-10-13 | **Rama**: `001-base-clientes-vehiculos`

Contrato de interfaz entre `client/` (Flutter) y `server/` (Express). Todas las rutas
se sirven bajo `/api` y responden JSON con codificación UTF-8.

## Convenciones comunes

### Autenticación

- `POST /api/auth/login` devuelve un token JWT (vencimiento: 8 horas, R-03).
- Todas las rutas marcadas como **Protegida** exigen el encabezado:
  `Authorization: Bearer <token>`.
- En cada petición protegida el backend revalida token, **rol** y **estado activo**
  del usuario.

### Sobre de respuesta

- Éxito: `{"ok": true, "data": <payload>}`
- Error: `{"ok": false, "error": {"code": "<CODIGO>", "message": "<mensaje en
  español>", "details": [{"field": "...", "message": "..."}]}}` (`details` solo en
  errores de validación)

### Códigos HTTP utilizados

| Código | Uso |
|--------|-----|
| 200 | Operación correcta (lectura o actualización) |
| 201 | Recurso creado |
| 400 | Validación de datos (código `VALIDATION_ERROR` o específico) |
| 401 | Sin token, token inválido o credenciales incorrectas |
| 403 | Sin permiso para la acción o cuenta inactiva |
| 404 | Recurso inexistente |
| 409 | Conflicto de unicidad o duplicado sin confirmar |
| 423 | Cuenta bloqueada por intentos fallidos |
| 500 | Error interno, con mensaje genérico **sin trazas de pila** |

### Matriz de permisos por endpoint

| Recurso | ADMIN | RECEPTIONIST | MECHANIC |
|---------|-------|--------------|----------|
| `/api/auth/*` (login, me, logout, change-password) | Sí | Sí | Sí |
| `/api/users/*` | Sí | 403 | 403 |
| `/api/clients` (GET) | Sí | Sí | Sí (solo lectura) |
| `/api/clients` (POST/PATCH) | Sí | Sí | 403 |
| `/api/vehicles` (GET) | Sí | Sí | Sí (solo lectura) |
| `/api/vehicles` (POST/PATCH) | Sí | Sí | 403 |

## Archivos del contrato

- [auth.md](auth.md) — login, sesión, cambio de contraseña
- [users.md](users.md) — gestión de usuarios y roles (ADMIN)
- [clients.md](clients.md) — registro, consulta y edición de clientes
- [vehicles.md](vehicles.md) — registro, consulta y edición de vehículos
