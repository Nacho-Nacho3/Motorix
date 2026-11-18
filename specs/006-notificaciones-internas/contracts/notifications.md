# Contrato: Campana y centro de avisos (Sprint 6)

Relacionado: FR-001, FR-002, FR-003, FR-004, FR-005, US1, US2, US3, US4, US5, CA-2, CA-4, CA-5, CA-6, CA-13, D-01, D-02, D-03, D-04, D-08, RN-10, RN-15.

Módulo nuevo (`server/routes/notifications.routes.js`): no hay contrato previo del que derivar. Los avisos se calculan en cada respuesta (P-1) y el rol decide qué grupos entran (P-6).

## `GET /api/notifications` — contador y avisos agrupados

- **Roles**: ADMIN, RECEPTIONIST, MECHANIC (el contenido se filtra por rol, tabla del P-6).
- **Uso**: al iniciar sesión, al abrir el panel y al navegar de sección (D-03); **sin** polling.
- **Rendimiento**: < 1000 ms con los datos de ejemplo (CA-13; meta interna < 200 ms p95 local).

**Respuesta 200**:

```json
{
  "ok": true,
  "data": {
    "unreadCount": 4,
    "groups": [
      {
        "type": "MAINTENANCE",
        "label": "Mantenimientos",
        "items": [
          {
            "key": "MAINTENANCE:12:OVERDUE",
            "read": false,
            "title": "Mantenimiento vencido — Toyota Corolla 2015 (ABC123)",
            "detail": "Venció el 2026-10-30 (fecha) · 120.000 km",
            "severity": "OVERDUE",
            "navigation": { "route": "/maintenance", "entityId": 12 }
          }
        ]
      },
      { "type": "APPOINTMENT", "label": "Citas de hoy", "items": [] },
      { "type": "STOCK", "label": "Stock", "items": [] },
      { "type": "ORDER_STOPPED", "label": "Órdenes detenidas", "items": [] }
    ]
  }
}
```

| Campo | Tipo | Reglas |
|-------|------|--------|
| `unreadCount` | number | avisos actuales del rol cuya clave no está en `notification_reads` del usuario; incluye los `read: false` de `groups` |
| `groups[].type` | string | `MAINTENANCE`, `APPOINTMENT`, `STOCK`, `ORDER_STOPPED` |
| `groups[].label` | string | rótulo en español para la UI |
| `groups[].items[].key` | string | `TIPO:id:ESTADO` (D-04, P-4); identidad usada por `POST .../read` |
| `groups[].items[].read` | boolean | `true` si el usuario ya lo leyó; un ítem leído **sigue visible** hasta que el hecho desaparezca (CA-6) |
| `severity` | string | `UPCOMING`/`OVERDUE` (mantenimiento), `TODAY` (cita), `LOW`/`OUT` (stock), estado de la orden (detenida) |
| `navigation` | object | `route` + `entityId` para abrir la pantalla relacionada desde el aviso |

**Reglas de contenido por rol (CA-4/D-08)**:

| Rol | `MAINTENANCE` | `APPOINTMENT` | `STOCK` | `ORDER_STOPPED` |
|-----|---------------|---------------|---------|-----------------|
| ADMIN | ✓ | ✓ | ✓ | ✓ (todas) |
| RECEPTIONIST | ✓ | ✓ | ✗ (grupo vacío) | ✓ (todas) |
| MECHANIC | ✗ (grupo vacío) | ✗ (grupo vacío) | ✗ (grupo vacío) | ✓ (solo `mechanic_id` = usuario) |

Los grupos siempre están presentes (aunque vacíos) para que la UI no cambie de estructura por rol.

**Errores**: 401 `UNAUTHORIZED` (sin/inválido). No hay 403: los tres roles pueden llamar.

## `POST /api/notifications/read` — marcar un aviso como leído

- **Roles**: cualquiera de los tres autenticados; solo escribe las lecturas **del usuario del token** (el cuerpo no puede elegir usuario).
- **Cuerpo**:

```json
{ "key": "STOCK:3:LOW" }
```

| Campo | Tipo | Reglas |
|-------|------|--------|
| `key` | string | requerido, formato `TIPO:id:ESTADO` (letras mayúsculas/dígitos/guion bajo, `:`, id numérico), ≤ 100 caracteres; inválido → 400 `VALIDATION_ERROR` |

**Respuesta 200** (idempotente: repetir devuelve lo mismo y no duplica):

```json
{ "ok": true, "data": { "read": true, "unreadCount": 3 } }
```

- `unreadCount`: contador del usuario **recalculado** tras la lectura (la campana se actualiza en el mismo viaje, D-03).
- Una clave bien formada que hoy no corresponde a un aviso activo se acepta (fila inocua; P-7).

**Errores**: 401 `UNAUTHORIZED`; 400 `VALIDATION_ERROR` (clave mal formada).
