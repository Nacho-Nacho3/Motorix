# Contrato: Cobro con precio guardado (Sprint 5)

Relacionado: FR-005, FR-006, FR-008, FR-009, FR-011, US2, US3, CA-5, CA-8,
CA-9, CA-11, D-04, RN-10, RN-13, RN-14.

Delta sobre el contrato [payments.md del Sprint 4](../../004-pagos-tickets-dashboard/contracts/payments.md):
**la forma de las respuestas no cambia** (mismo objeto pago, mismos campos del
total); lo nuevo es el comportamiento descrito abajo. Roles sin cambios: ADMIN y
RECEPTIONIST leen y escriben; MECHANIC 403.

## Efecto nuevo: cancelación del pago pendiente desfasado (D-04, FR-009)

Un pago `PENDING` está **desfasado** cuando su `amount` no es igual al total
vigente de la orden (la línea se corrigió, se agregaron refacciones o se
quitaron servicios después de crear el intento).

Se cancela automáticamente, de forma **idempotente y silenciosa** (no es un
error; una segunda consulta no cambia nada):

1. `GET /api/service-orders/{id}/total`
2. `GET /api/service-orders/{id}/payments`
3. `POST /api/service-orders/{id}/payments` — **dentro de la transacción y antes
   de las reglas VN-04/VN-05**

Reglas:

- Solo se cancela un `PENDING` con importe distinto al total; pasa a `CANCELLED`
  (transición permitida por la máquina R-04). Pagos `PAID` nunca se tocan
  (SC-002).
- Es cancelación local, sin llamada al proveedor y sin reembolsos (igual que el
  `POST .../payments/{paymentId}/cancel` existente).
- Después de cancelar, `POST .../payments` puede crear el cobro nuevo con el
  importe correcto: `409 PENDING_PAYMENT_EXISTS` solo aplica a un pendiente que
  **sí** coincide con el total.

## GET /api/service-orders/{id}/total (existente, misma forma)

```json
{ "ok": true, "data": { "orderId": 12, "servicesSubtotal": "850.00",
                        "laborSubtotal": "600.00", "partsSubtotal": "1700.00",
                        "total": "3150.00" } }
```

- Cambio de fuente: `partsSubtotal` es `Σ quantity × unit_price` **guardado en la
  línea**, no el precio vigente del catálogo (FR-004, SC-001). Con la instantánea
  intacta, el resultado es idéntico al del Sprint 4.
- Efecto colateral documentado arriba (paso 1): puede cancelar un pendiente
  desfasado. El `data` no cambia.
- Errores sin cambios: 404 `SERVICE_ORDER_NOT_FOUND`, 403 `FORBIDDEN` (MECHANIC).

## GET /api/service-orders/{id}/payments (existente, misma forma)

Igual que el Sprint 4 (`data.payments` + `data.total`), con el efecto colateral
(paso 2): un pendiente desfasado aparece ya `CANCELLED`.

## POST /api/service-orders/{id}/payments (existente, misma forma)

```json
{ "method": "CASH", "amount": "3150.00" }
```

Comportamiento nuevo en el orden de la transacción (paso 3):

1. Bloqueo de la fila de la orden (`FOR UPDATE`, ya existente).
2. Cálculo del total con precios guardados.
3. **Cancelación del pendiente desfasado** (si lo hay).
4. Reglas VN-02 a VN-05 (sin cambios) e inserción.

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 (200 si ya existía) | 400 `PAYMENT_AMOUNT_MISMATCH` | `amount` distinto del total (sin cambios) |
| | 409 `PENDING_PAYMENT_EXISTS` | Hay un pendiente **que coincide** con el total |
| | 400 `ORDER_ALREADY_PAID` | Ya hay un pago `PAID` |
| | 400 `ORDER_NOT_PAYABLE` | Orden no terminada/entregada |
| | 400 `VALIDATION_ERROR` | Total en `0.00` o datos inválidos (sin cambios) |

## Pagos y tickets anteriores (FR-006, CA-6)

No se altera ningún dato existente: `payments` no cambia de esquema y la
migración 014 solo agrega columnas a `order_parts` con backfill del precio
vigente. Un pago `PAID` emitido antes del sprint conserva importe, método y
estado, y un ticket previo sigue mostrando los mismos importes aunque cambien
los precios del catálogo después (SC-002).
