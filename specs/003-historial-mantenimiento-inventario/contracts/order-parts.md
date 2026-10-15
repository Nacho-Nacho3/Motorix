# Contrato: Refacciones utilizadas en una orden (`/api/service-orders/{id}/parts`)

Relacionado: FR-010, FR-011, US7, CA-5, CA-6, RN-6, RN-7, RN-8, Q2, Q5.

**Escritura**: solo MECHANIC, sobre **sus** órdenes que no estén `ENTREGADA` (Q5) ·
**Lectura**: ADMIN, RECEPTIONIST y MECHANIC (solo las suyas, 403 si es ajena).

Objeto refacción de la orden en respuestas:

```json
{ "id": 7, "orderId": 3, "partId": 1, "partCode": "BAL-001",
  "name": "Balatas traseras", "quantity": 2, "createdBy": 3,
  "createdAt": "2026-10-14T12:00:00" }
```

## GET /api/service-orders/{id}/parts

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.parts` (+ `total`) | 404 `SERVICE_ORDER_NOT_FOUND` | Orden inexistente |
| | 403 `FORBIDDEN` | MECHANIC con orden ajena (R-07) |

- Ordenado por `createdAt` ascendente; sin usos → arreglo vacío y `total: 0`.

## POST /api/service-orders/{id}/parts

```json
{ "partId": 1, "quantity": 2 }
```

| Campo | Reglas |
|-------|--------|
| `partId` | Obligatorio → 400 `PART_REQUIRED`; debe existir → 404 `PART_NOT_FOUND` |
| `quantity` | Obligatorio, entero > 0 (VO-02) |

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.orderPart` | 404 `SERVICE_ORDER_NOT_FOUND` | Orden inexistente |
| | 403 `FORBIDDEN` | Rol distinto de MECHANIC o orden ajena (Q5) |
| | 400 `ORDER_DELIVERED` | Orden en estado ENTREGADO: historial inmutable (RN-9, Q5) |
| | 400 `VALIDATION_ERROR` | Sin `partId` o `quantity` inválida |
| | 400 `STOCK_INSUFFICIENT` | `quantity` mayor que `stockCurrent` → **sin efecto**: ni fila, ni salida, ni descuento (RN-8, Q1) |

**Efecto atómico** (RN-7, CA-5): al aceptar, la misma transacción inserta la fila en
`order_parts`, genera el movimiento `OUT` con `orderId` y descuenta
`parts.stockCurrent`. Si stock insuficiente → 400 y no cambia absolutamente nada.

> **No existe `DELETE`** de refacciones de la orden en este sprint (R-06): el uso
> queda como constancia; una corrección de saldo la hace ADMIN con un
> `ADJUSTMENT` desde [inventory.md](inventory.md).
