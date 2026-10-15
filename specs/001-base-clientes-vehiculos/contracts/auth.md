# Contrato: Autenticación (`/api/auth`)

Relacionado: FR-001, FR-002, FR-004, FR-005, SC-002.

## POST /api/auth/login

Abre sesión con usuario **o** correo en un mismo campo (RN-16).

**Público**

```json
{ "identifier": "admin | recepcion@taller.mx", "password": "Admin2026!" }
```

| Campo | Tipo | Obligatorio | Reglas |
|-------|------|-------------|--------|
| `identifier` | string | Sí | Nombre de usuario o correo; si contiene `@` se busca por correo |
| `password` | string | Sí | Sin validar política (es la contraseña existente) |

**201 Respuesta (éxito)**

```json
{
  "ok": true,
  "data": {
    "token": "<jwt>",
    "expiresIn": 28800,
    "user": { "id": 1, "username": "admin", "name": "Administrador",
              "email": "admin@motorix.local", "role": "ADMIN" }
  }
}
```

| Error | Código | Condición |
|-------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Faltan `identifier` o `password` |
| 401 | `INVALID_CREDENTIALS` | Usuario inexistente o contraseña incorrecta (mensaje genérico, no revela cuál falló) |
| 403 | `ACCOUNT_DISABLED` | Credenciales correctas pero `active = 0` |
| 423 | `ACCOUNT_LOCKED` | 5 intentos fallidos consecutivos; `data.retryAfterMinutes` indica los minutos restantes (15 en total) |

**Efecto**: un login fallido incrementa `failed_login_attempts`; al llegar a 5 se
fija `locked_until` (+15 min). Un login correcto reinicia el contador.

## GET /api/auth/me

**Protegida** — devuelve el usuario de la sesión actual (la interfaz la usa para el
header: nombre, rol y estado).

**200**: `{"ok": true, "data": {"user": {...}}}` · **401**: `TOKEN_INVALID` ·
**403**: `ACCOUNT_DISABLED`

## POST /api/auth/logout

**Protegida** — confirma el cierre; la interfaz descarta el token (R-13, sin lista de
negros en el servidor).

**200**: `{"ok": true, "data": {"message": "Sesión cerrada"}}`

## POST /api/auth/change-password

**Protegida** — cambia la contraseña del usuario autenticado (FR-005, RN-17).

```json
{ "currentPassword": "Admin2026!", "newPassword": "Nueva2026!" }
```

| Regla de `newPassword` | Detalle |
|------------------------|---------|
| 8 caracteres mínimo | incluye espacios si los hubiera |
| Al menos 1 mayúscula, 1 minúscula y 1 número | política mínima del MVP |

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `PASSWORD_UPDATED` en `data.message` | 400 `WEAK_PASSWORD` | No cumple la política; `details` indica el requisito faltante |
| | 401 `INVALID_CREDENTIALS` | `currentPassword` incorrecta |

La contraseña se guarda hasheada (nunca en texto plano) y el siguiente login usa la
nueva.
