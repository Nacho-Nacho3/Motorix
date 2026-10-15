# Contrato: Pagos de una orden (`/api/service-orders/{id}/payments`)

Relacionado: FR-001 a FR-008, FR-015, US1, US2, US4, CA-1, CA-2, CA-3, CA-7,
RN-13, RN-14, RN-15, Q1.

**Lectura y escritura**: ADMIN y RECEPTIONIST · **MECHANIC**: 403 en todos los
endpoints de este contrato (matriz R-08). Todo pago pertenece a una orden
(RN-13): no existe `POST /api/payments` de nivel superior ni pagos huérfanos.

Objeto pago en respuestas:

```json
{ "id": 7, "orderId": 12, "amount": "3150.00", "method": "CASH",
  "status": "PAID", "externalReference": null, "createdBy": 2,
  "createdByName": "Recepción", "createdAt": "2026-10-14T12:00:00",
  "updatedAt": "2026-10-14T12:00:00" }
```

- `externalReference` solo se llena en `MERCADO_PAGO` (referencia de la
  preferencia del proveedor). Nunca hay datos de tarjeta (RN-14).
- Estados y transiciones: máquina de estados de `data-model.md` (manual →
  `PAID`; MP → `PENDING` y luego `PAID`/`REJECTED`/`CANCELLED`).

## GET /api/service-orders/{id}/total

Desglose que alimenta el formulario de pago y el ticket (cálculo único, R-03).

**200**

```json
{ "ok": true, "data": { "orderId": 12, "servicesSubtotal": "850.00",
                        "laborSubtotal": "600.00", "partsSubtotal": "1700.00",
                        "total": "3150.00" } }
```

- Subtotales: servicios (`Σ unit_price`), mano de obra (`Σ hours × hourly_rate`)
  y refacciones (`Σ quantity × sale_price` vigente).
- Sin filas en ninguna tabla → subtotales y total `"0.00"`.

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.total` | 404 `SERVICE_ORDER_NOT_FOUND` | Orden inexistente |
| | 403 `FORBIDDEN` | Rol MECHANIC |

## GET /api/service-orders/{id}/payments

**200** con `data.payments` (más recientes primero) y `data.total` (suma de los
pagos `PAID`, `"0.00"` si no hay) · **404** `SERVICE_ORDER_NOT_FOUND` ·
**403** `FORBIDDEN` para MECHANIC.

## POST /api/service-orders/{id}/payments

```json
{ "method": "CASH", "amount": "3150.00" }
{ "method": "MERCADO_PAGO" }
```

| Campo | Reglas |
|-------|--------|
| `method` | Obligatorio; solo `CASH`, `CARD`, `TRANSFER` o `MERCADO_PAGO` (Q1/CA-2) |
| `amount` | Opcional (defecto: total calculado de la orden); si viene, debe serlo **exactamente** el total con hasta 2 decimales (Q1: sin parciales) |

Comportamiento:

- `CASH`/`CARD`/`TRANSFER`: el pago se crea directamente como `PAID`.
- `MERCADO_PAGO`: el pago se crea como `PENDING` y se genera la preferencia de
  sandbox; la respuesta incluye `initPoint` (URL de pago del proveedor) para
  abrirla en el navegador (R-04).

**201**

```json
{ "ok": true, "data": { "payment": { /* objeto pago */ },
                        "initPoint": "https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=ABC123" } }
```

`initPoint` es `null` para los métodos manuales.

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.payment` | 404 `SERVICE_ORDER_NOT_FOUND` | Orden inexistente |
| | 400 `VALIDATION_ERROR` | Método faltante o no soportado |
| | 400 `ORDER_NOT_PAYABLE` | Orden no está `FINISHED`/`DELIVERED` |
| | 400 `PAYMENT_AMOUNT_MISMATCH` | `amount` ≠ total de la orden |
| | 400 `ORDER_ALREADY_PAID` | La orden ya tiene un pago `PAID` |
| | 409 `PENDING_PAYMENT_EXISTS` | Hay un pago MP `PENDING`; sincronizar o cancelarlo primero |
| | 409 `MERCADO_PAGO_NOT_CONFIGURED` | `MERCADO_PAGO` sin credenciales en el entorno |
| | 403 `FORBIDDEN` | Rol MECHANIC |

- Alta y validaciones corren en **transacción con bloqueo de fila de la orden:
  dos cobros simultáneos nunca crean dos pagos `PAID`.

## POST /api/service-orders/{id}/payments/{paymentId}/sync

Consulta al proveedor el resultado del pago MP y aplica la transición
(`approved → PAID`, `rejected → REJECTED`; en proceso permanece `PENDING`).

**200** con `data.payment` actualizado · **404** `SERVICE_ORDER_NOT_FOUND` o
`PAYMENT_NOT_FOUND` (pago que no pertenece a la orden) · **409**
`INVALID_PAYMENT_TRANSITION` (método distinto de `MERCADO_PAGO` o estado distinto
de `PENDING`) · **409** `MERCADO_PAGO_NOT_CONFIGURED` · **502**
`MERCADO_PAGO_ERROR` (el proveedor no respondió; el pago no cambia) · **403**
`FORBIDDEN` para MECHANIC.

## POST /api/service-orders/{id}/payments/{paymentId}/cancel

Cancela un pago MP `PENDING` que el cliente abandonó (no hay reembolsos en el
MVP: un pago `PAID` no se cancela).

**200** con `data.payment` (`status: "CANCELLED"`) · **404**
`SERVICE_ORDER_NOT_FOUND` o `PAYMENT_NOT_FOUND` · **409**
`INVALID_PAYMENT_TRANSITION` (método manual o estado distinto de `PENDING`) ·
**403** `FORBIDDEN` para MECHANIC. La cancelación no requiere confirmación del
proveedor (es un abandono local); deja libre la orden para un nuevo intento (Q1).

> **No existe `DELETE` ni `PATCH` de pagos**: el libro de cobros es auditoría y su
> estado solo cambia por `sync` o `cancel`.
