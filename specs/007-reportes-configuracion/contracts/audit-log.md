# Contrato: Bitácora de acciones sensibles (Sprint 7)

Relacionado: FR-022 a FR-024, US10, CA-20, CA-21, D-12, RN-14, RN-15.

Módulo nuevo (`server/routes/audit.routes.js`). **Solo lectura y solo ADMIN**: no existe ninguna ruta para crear, editar ni borrar registros; los registros los escribe el sistema desde los servicios (CA-20).

## `GET /api/audit-log`

| Parámetro | Tipo | Reglas |
|-----------|------|--------|
| `from` / `to` | `YYYY-MM-DD` | rango inclusivo por fecha del registro; opcionales |
| `userId` | number | id del usuario que actuó |
| `action` | string | una de las acciones del catálogo |
| `page` / `pageSize` | number | por omisión 1 y 50; `pageSize` máximo 200 |

Orden: más reciente primero.

**Respuesta 200**:

```json
{
  "ok": true,
  "data": {
    "page": 1, "pageSize": 50, "total": 128,
    "items": [
      { "id": 311, "createdAt": "2026-11-24T10:12:00", "userId": 1, "actor": "admin",
        "action": "PART_PRICE_CHANGED", "entityType": "PART", "entityId": 3,
        "detail": "Precio de venta: 450.00 → 480.00" }
    ]
  }
}
```

## Acciones registradas (catálogo cerrado)

| Acción | Cuándo | `detail` (lista blanca) |
|--------|--------|--------------------------|
| `LOGIN_FAILED` | inicio de sesión fallido | identificador intentado (≤ 100) |
| `ACCOUNT_LOCKED` | la cuenta se bloquea por intentos fallidos | minutos de bloqueo |
| `USER_CREATED` | alta de usuario | rol |
| `USER_UPDATED` | cambio de rol, baja o reactivación | campo y valores anterior y nuevo (rol o estado) |
| `SETTINGS_UPDATED` | cambio de configuración | clave, valor anterior y nuevo |
| `PART_PRICE_CHANGED` | cambio del precio de compra o de venta | precio anterior y nuevo |
| `ORDER_PART_PRICE_CORRECTED` | corrección administrativa de precio de una línea | precio anterior y nuevo |
| `PAYMENT_CANCELLED` | pago cancelado por una persona o por el sistema (pendiente cuyo importe ya no coincide con el total; actor `sistema`) | id de la orden, método, importe y, si lo cancela el sistema, motivo |
| `TERMS_PUBLISHED` | nueva versión de términos | número de versión |

**Nunca** contienen contraseñas, hashes, tokens ni datos de tarjeta (CA-21); una prueba recorre cada acción y verifica el contenido.

## Errores

- 400 `VALIDATION_ERROR`: fecha inválida, `to` < `from`, `action` fuera del catálogo, `page` o `pageSize` inválidos.
- 403 `FORBIDDEN`: rol distinto de ADMIN.
