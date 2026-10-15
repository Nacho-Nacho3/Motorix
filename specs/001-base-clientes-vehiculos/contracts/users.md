# Contrato: Usuarios (`/api/users`)

Relacionado: FR-013, FR-014, FR-015, HU5, SC-006.

Todas las rutas son **Protegidas y solo ADMIN** (otros roles reciben 403
`FORBIDDEN`).

## GET /api/users

Lista de usuarios. Query opcional: `?role=ADMIN|RECEPTIONIST|MECHANIC`,
`?active=true|false`, `?q=<texto>` (busca por username, nombre o correo).

**200**

```json
{ "ok": true, "data": { "users": [
  { "id": 1, "username": "admin", "name": "Administrador",
    "email": "admin@motorix.local", "role": "ADMIN", "active": true,
    "createdAt": "2026-10-13T10:00:00" } ] } }
```

## GET /api/users/{id}

**200** con `data.user` · **404** `USER_NOT_FOUND`

## POST /api/users

Crea un usuario (FR-013).

```json
{ "username": "ana", "name": "Ana López", "email": "ana@motorix.local",
  "password": "Ana2026!", "role": "RECEPTIONIST" }
```

| Campo | Reglas |
|-------|--------|
| `username` | Obligatorio, único (50 caracteres) |
| `email` | Obligatorio, formato válido, único |
| `password` | Obligatoria; política mínima (8, mayúscula, minúscula, número) |
| `role` | Obligatorio; uno de `ADMIN`, `RECEPTIONIST`, `MECHANIC` |

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.user` (sin `passwordHash`) | 400 `VALIDATION_ERROR` | Datos faltantes o inválidos |
| | 400 `WEAK_PASSWORD` | Contraseña fuera de política |
| | 409 `DUPLICATE_USERNAME` | `username` ya registrado |
| | 409 `DUPLICATE_EMAIL` | `email` ya registrado |

## PATCH /api/users/{id}

Actualiza nombre, correo, rol, estado o contraseña (reset definido por ADMIN).

```json
{ "name": "Ana López", "email": "ana@nuevo.mx", "role": "RECEPTIONIST",
  "active": false, "password": "Otra2026!" }
```

- Todos los campos son opcionales; al menos uno debe enviarse.
- `active: false` desactiva la cuenta: el siguiente login responde 403 y las peticiones
  con su token actual también (rol y estado se revalidan por petición).
- `password` opcional; si viene, aplica la política mínima.

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.user` | 404 `USER_NOT_FOUND` | Id inexistente |
| | 409 `DUPLICATE_USERNAME` / `DUPLICATE_EMAIL` | Choca con otro usuario |
| | 400 `WEAK_PASSWORD` | Contraseña fuera de política |

**Nota**: este sprint no elimina usuarios; la baja es por `active = false`.

## Cuentas iniciales (FR-015)

Los seeds crean `admin` (ADMIN), `recepcion` (RECEPTIONIST) y `mecanico` (MECHANIC)
con las contraseñas del estándar del MVP, guardadas con hash. Tras el primer acceso se
recomienda cambiarlas; las contraseñas del estándar solo existen en entornos locales.
