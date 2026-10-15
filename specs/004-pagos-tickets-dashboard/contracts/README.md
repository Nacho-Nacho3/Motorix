# Contratos — Sprint 4: Pagos, tickets y dashboard

Cada contrato define la interfaz JSON autoritativa de su módulo. Las respuestas
usan el sobre estándar `{ "ok": true, "data": { … } }` y los errores el sobre
`{ "ok": false, "error": { "code", "message" } }` con el código HTTP apropiado.
Todos los endpoints exigen `Authorization: Bearer <token>` (excepto `/api/auth/*`)
y validan el rol en el backend (RN-15).

| Contrato | Endpoints | Roles |
|----------|-----------|-------|
| [payments.md](payments.md) | `GET .../total`, `GET/POST .../payments`, `POST .../payments/{paymentId}/sync`, `POST .../payments/{paymentId}/cancel` | ADMIN y RECEPTIONIST escriben; MECHANIC 403 |
| [tickets.md](tickets.md) | `POST/GET .../ticket` | ADMIN y RECEPTIONIST; MECHANIC 403 |
| [dashboard.md](dashboard.md) | `GET /api/dashboard` | solo ADMIN |

Convenciones compartidas:

- Importes: cadenas con dos decimales (`"3150.00"`), `DECIMAL(10,2)`.
- Fechas: ISO sin zona horaria (`2026-10-14T12:00:00`).
- Métodos de pago: `CASH | CARD | TRANSFER | MERCADO_PAGO`.
  Estados de pago: `PENDING | PAID | REJECTED | CANCELLED`.
- El estado del pago y el importe **nunca** vienen del cliente en la alta: el
  importe por defecto es el total calculado de la orden y el estado lo determina
  el método (manual → `PAID`; Mercado Pago → `PENDING`).
- Códigos nuevos de este sprint: `PAYMENT_NOT_FOUND` (404),
  `PAYMENT_AMOUNT_MISMATCH` (400), `ORDER_ALREADY_PAID` (409),
  `PENDING_PAYMENT_EXISTS` (409), `ORDER_NOT_PAYABLE` (400),
  `INVALID_PAYMENT_TRANSITION` (409), `MERCADO_PAGO_NOT_CONFIGURED` (409),
  `MERCADO_PAGO_ERROR` (502), `TICKET_NOT_FOUND` (404),
  `ORDER_NOT_FINISHED` (400). Reutiliza `SERVICE_ORDER_NOT_FOUND` (404),
  `VALIDATION_ERROR` (400), `FORBIDDEN` (403), `UNAUTHORIZED` (401) e
  `INTERNAL_ERROR` (500).
