# Contrato: Refacciones de una orden (`/api/service-orders/{id}/parts`)

Relacionado: FR-003, FR-004, FR-010, FR-013, US1, US2, US4, US5, CA-3, CA-10,
D-01/D-03, D-05, D-10, R-06, RN-15.

**Lectura**: ADMIN, RECEPTIONIST y MECHANIC (el mecánico solo las suyas, R-07) ·
**Alta**: solo MECHANIC dueño de la orden · **Corrección de precio**: solo ADMIN.

Objeto uso-de-refacción en respuestas (cambios de este sprint en **negrita**) :

```json
{ "id": 31, "orderId": 12, "partId": 4, "partCode": "FUS-004",
  "name": "Filtro de combustible", "quantity": 2,
  "unitPrice": "85.00", "createdBy": 3, "createdAt": "2026-11-03T10:00:00" }
```

- **`unitPrice` (nuevo)**: instantánea del precio de venta que la refacción tenía
  al agregarse (FR-003), cadena con exactamente 2 decimales. Los cambios
  posteriores del catálogo no lo modifican (SC-001).
- **Proyección por rol (FR-010, D-10)**:
  - ADMIN: recibe `unitPrice` y, si se usaron, `priceCorrectionReason`,
    `priceCorrectedBy`, `priceCorrectedAt` (nuevos, solo administrador).
  - RECEPTIONIST: recibe `unitPrice`; no recibe los campos de corrección.
  - MECHANIC: **no recibe `unitPrice` ni campos de corrección** (ningún precio).

## GET /api/service-orders/{id}/parts (existente)

**200** `data.parts` (más antiguo primero; objeto de arriba) · **404**
`SERVICE_ORDER_NOT_FOUND` · **403** `FORBIDDEN` (mechanic ajeno a la orden, como hoy).

Cambio: el elemento **omite `unitPrice`** cuando quien consulta es MECHANIC; los
demás roles lo reciben. No cambia el resto de la forma.

## POST /api/service-orders/{id}/parts (existente, guarda la instantánea)

```json
{ "partId": 4, "quantity": 2 }
```

Sin cambios de forma ni de errores (`400 PART_REQUIRED`, `400 STOCK_INSUFFICIENT`,
`400 ORDER_DELIVERED`, `404 PART_NOT_FOUND`, `403 FORBIDDEN`, `404
SERVICE_ORDER_NOT_FOUND`, `400 VALIDATION_ERROR`).

Comportamiento nuevo: en la misma transacción del alta, el backend guarda
`unit_price = sale_price` vigente de la refacción (FR-003, D-01/D-03 para las
filas ya existentes mediante backfill). La respuesta es el objeto uso con la
proyección del rol (el mecánico no ve `unitPrice`; para verificarlo se consulta
como ADMIN).

## PATCH /api/service-orders/{id}/parts/{partRowId}/price (NUEVO, solo ADMIN)

Corrige el precio capturado mal en una línea de una orden abierta (D-05, US4
escenario 4). Es la única mutación admitida sobre `order_parts` (R-06 sigue sin
DELETE).

```json
{ "unitPrice": "85.00", "reason": "Precio capturado de otra pieza" }
```

| Campo | Reglas |
|-------|--------|
| `unitPrice` | Obligatorio; formato de precio: ≥ 0, hasta 2 decimales, tope `$99,999.99` (D-08) |
| `reason` | Obligatorio; 10 a 200 caracteres, queda registrado (D-05) |

Comportamiento: actualiza `unit_price` y registra motivo, autor y fecha en la
misma fila; no toca stock ni estados; el total de la orden cambia en la
siguiente consulta por ser derivado (RN-10). Siempre en transacción.

**200** `data.orderPart` con el objeto uso ya corregido (incluye `unitPrice` nuevo y los campos
`priceCorrection*`, proyección ADMIN) ·

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data` | 400 `VALIDATION_ERROR` | Precio fuera de formato o tope, o `reason` menor a 10 caracteres |
| | 403 `FORBIDDEN` | Rol distinto de ADMIN |
| | 404 `SERVICE_ORDER_NOT_FOUND` | Orden inexistente |
| | 404 `ORDER_ITEM_NOT_FOUND` | La fila no existe o no pertenece a la orden |
| | 400 `ORDER_DELIVERED` | La orden ya fue entregada (historial intacto, RN-9) |
| | 400 `ORDER_ALREADY_PAID` | La orden ya tiene un pago `PAID`; no se altera dinero cobrado |
