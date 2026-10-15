# Contrato: Inventario de refacciones (`/api/parts`)

Relacionado: FR-008, FR-009, FR-011, FR-012, FR-013, FR-014, FR-015, US5, US6,
US8, CA-4, CA-6, CA-7, RN-7, RN-8.

**Lectura y escritura**: exclusivos de ADMIN · **RECEPTIONIST y MECHANIC**: 403 en
todos los endpoints de este contrato (R-07, US5/US6/US8). Los usos de refacciones
por orden viven en [order-parts.md](order-parts.md).

Objeto refacción en respuestas:

```json
{ "id": 1, "partCode": "BAL-001", "name": "Balatas traseras", "category": "Frenos",
  "brand": "Bosch", "stockCurrent": 4, "stockMin": 5,
  "purchasePrice": "420.00", "salePrice": "850.00", "lowStock": true,
  "updatedAt": "2026-10-14T12:00:00" }
```

- `lowStock` se calcula: `stockCurrent <= stockMin` (CA-7).
- `stockCurrent` **no** es editable por la API: se modifica solo con movimientos
  (R-05); una corrección es un `ADJUSTMENT`.

Objeto movimiento en respuestas:

```json
{ "id": 12, "partId": 1, "movementType": "IN", "quantity": 10, "orderId": null,
  "reason": null, "createdBy": 1, "createdAt": "2026-10-14T12:00:00" }
```

Tipos (Q2): `IN` (reposición manual), `OUT` (generado automáticamente al usar la
refacción en una orden, RN-7) y `ADJUSTMENT` (corrección con signo y motivo, solo
ADMIN).

## GET /api/parts

Query opcional: `?q=<texto>` (código, nombre o categoría), `?low=true` (solo stock
bajo).

**200**

```json
{ "ok": true, "data": { "parts": [ /* objeto refacción */ ], "total": 12,
                        "lowStockCount": 2 } }
```

- `lowStockCount`: total de refacciones con `lowStock: true` (alimenta el contador
  del filtro de la interfaz, CA-7).
- Sin resultados → arreglo vacío, `total: 0`.

## POST /api/parts

```json
{ "partCode": "BAL-001", "name": "Balatas traseras", "category": "Frenos",
  "brand": "Bosch", "stockCurrent": 10, "stockMin": 5,
  "purchasePrice": "420.00", "salePrice": "850.00" }
```

| Campo | Reglas |
|-------|--------|
| `partCode` | Obligatorio, único, hasta 50 caracteres → 400 `PART_CODE_DUPLICATED` si existe |
| `name` | Obligatorio, hasta 100 caracteres |
| `category` | Obligatorio, hasta 50 caracteres |
| `brand` | Opcional, hasta 50 caracteres |
| `stockCurrent` | Opcional (defecto 0), entero ≥ 0 — solo en el alta; genera el `IN` inicial |
| `stockMin` | Obligatorio, entero ≥ 0 |
| `purchasePrice` / `salePrice` | Opcionales (defecto 0), ≥ 0 con hasta 2 decimales |

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.part` | 400 `VALIDATION_ERROR` | Datos faltantes o inválidos |
| | 400 `PART_CODE_DUPLICATED` | Código ya registrado |
| | 403 `FORBIDDEN` | Rol distinto de ADMIN |

## PATCH /api/parts/{id}

Edita `name`, `category`, `brand`, `stockMin`, `purchasePrice` y `salePrice`; **no**
acepta `stockCurrent` ni `partCode` (el stock se mueve con movimientos; el código es
inmutable tras el alta).

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.part` | 404 `PART_NOT_FOUND` | Refacción inexistente |
| | 400 `VALIDATION_ERROR` | Sin campos o datos inválidos |
| | 403 `FORBIDDEN` | Rol distinto de ADMIN |

## POST /api/parts/{id}/movements

```json
{ "movementType": "IN", "quantity": 10, "reason": null }
{ "movementType": "ADJUSTMENT", "quantity": -2, "reason": "Conteo físico de almacén" }
```

| Campo | Reglas |
|-------|--------|
| `movementType` | Obligatorio; solo `IN` o `ADJUSTMENT` (un `OUT` manual → 400 `VALIDATION_ERROR`: las salidas son automáticas, RN-7) |
| `quantity` | Obligatorio, entero ≠ 0; en `ADJUSTMENT` lleva signo (+ suma, − resta) |
| `reason` | Obligatorio ≥ 10 caracteres en `ADJUSTMENT`; prohibido en `IN` |

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.movement` (con `part.stockCurrent` ya actualizado) | 404 `PART_NOT_FOUND` | Refacción inexistente |
| | 400 `VALIDATION_ERROR` | Tipo no permitido o `ADJUSTMENT` sin motivo |
| | 400 `STOCK_INSUFFICIENT` | El ajuste dejaría `stockCurrent < 0` → **sin efecto** (RN-8, Q1) |
| | 403 `FORBIDDEN` | Rol distinto de ADMIN |

- El cambio de stock y el registro del movimiento ocurren en **una sola
  transacción** con bloqueo de fila: dos escrituras simultáneas nunca dejan saldo
  negativo (R-05).

## GET /api/parts/{id}/movements

**200** con `data.movements` (más recientes primero) · **404** `PART_NOT_FOUND` ·
**403** `FORBIDDEN` para roles distintos de ADMIN.

> **No existe `DELETE`** de refacciones ni de movimientos: el libro de movimientos
> es auditoría (FR-015, VI-06).
