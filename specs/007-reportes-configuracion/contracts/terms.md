# Contrato: Términos y condiciones y aviso de privacidad (Sprint 7)

Relacionado: FR-018 a FR-021 y FR-032, US9, CA-16 a CA-19, D-10, D-11, RN-14, RN-15.

Módulo nuevo (`server/routes/terms.routes.js`).

## `GET /api/terms/current` (cualquier usuario autenticado; **exento** del bloqueo)

```json
{ "ok": true, "data": { "version": 2, "termsText": "…", "privacyText": "…", "publishedAt": "2026-11-24T10:00:00", "accepted": false } }
```

`accepted` indica si el usuario del token ya aceptó **esta** versión.

## `POST /api/terms/accept` (cualquier usuario autenticado; **exento**)

**Cuerpo**: `{ "version": 2 }`. Solo se acepta la versión vigente.

- **201**: primera aceptación de esa versión por el usuario; guarda usuario, versión y fecha.
- **200**: repetir la aceptación no duplica (idempotente).
- 400 `VALIDATION_ERROR`: `version` no es la vigente (por ejemplo, se publicó otra mientras el usuario leía); la pantalla recarga la versión nueva.

**Respuesta**: `{ "ok": true, "data": { "version": 2, "acceptedAt": "2026-11-24T10:05:00" } }`.

## `POST /api/terms` (ADMIN): publicar una versión nueva

**Cuerpo**: `{ "termsText": "…", "privacyText": "…" }` (cada uno de 1 a 20,000 caracteres).

- **201**: se crea la versión `MAX + 1`, se vuelve la vigente y queda en la bitácora (`TERMS_PUBLISHED`). Las versiones anteriores y las aceptaciones guardadas **no se modifican**.
- 400 `TERMS_UNCHANGED`: textos vacíos o idénticos a los de la versión vigente.
- 403 `FORBIDDEN`: rol distinto de ADMIN.

## `GET /api/terms/acceptances` (ADMIN)

Parámetros: `?version=<n>` (por omisión la vigente) y `?page=1&pageSize=50` (máximo 200).

```json
{
  "ok": true,
  "data": {
    "version": 2, "page": 1, "pageSize": 50, "total": 3,
    "items": [ { "userId": 1, "username": "admin", "name": "Administrador", "acceptedAt": "2026-11-24T10:05:00" } ],
    "pendingUsers": [ { "userId": 2, "username": "recepcion", "name": "Recepción" } ]
  }
}
```

`pendingUsers` lista a los usuarios activos que aún no aceptan esa versión.

## Bloqueo en el backend (CA-19)

Sin aceptación vigente, **toda** ruta autenticada responde 403 `TERMS_NOT_ACCEPTED` salvo las cuatro exentas (ver el README de contratos). El mensaje, en español, indica que debe aceptar los términos; el cliente muestra la pantalla de aceptación.
