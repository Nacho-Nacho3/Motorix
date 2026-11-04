# Contratos — Sprint 5: Precios de refacciones y cobro completo

Cada contrato define la interfaz JSON autoritativa de su módulo **para este sprint**. Las respuestas usan el sobre estándar `{ "ok": true, "data": { … } }` y los errores el sobre `{ "ok": false, "error": { "code", "message" } }` con el código HTTP apropiado. Todos los endpoints exigen `Authorization: Bearer <token>` y validan el rol en el backend (RN-15).

| Contrato | Endpoints | Roles |
|----------|-----------|-------|
| [order-parts.md](order-parts.md) | `GET/POST .../service-orders/:id/parts`, nuevo `PATCH .../service-orders/:id/parts/:partRowId/price` | lectura: ADMIN, RECEPTIONIST, MECHANIC (sin precios para MECHANIC); alta: MECHANIC; corrección: solo ADMIN |
| [parts-catalog.md](parts-catalog.md) | `GET/POST/PATCH /api/parts`, nuevo `GET /api/parts/lookup` | catálogo completo: solo ADMIN; lookup: solo MECHANIC, sin precios |
| [payments.md](payments.md) | `GET .../service-orders/:id/total`, `GET/POST .../:id/payments` | ADMIN y RECEPTIONIST; efecto nuevo: cancelación del pago pendiente desfasado (D-04) |

Convenciones compartidas (heredadas de los Sprints 1–4 y de [specs/004-pagos-tickets-dashboard/contracts/README.md](../../004-pagos-tickets-dashboard/contracts/README.md)):

- Importes: cadenas con dos decimales (`"3150.00"`), `DECIMAL(10,2)`.
- Fechas: ISO sin zona horaria (`2026-11-03T12:00:00`).
- **Precio guardado en la línea**: `unitPrice` de `order_parts` es una instantánea (FR-003); en tickets y totales, `unitPrice`/`salePrice` de una refacción proviene de la línea, nunca del catálogo (FR-007, SC-001).
- Tope de precio: `$99,999.99` (D-08) en `purchasePrice`, `salePrice` y `unitPrice` de corrección.
- Códigos **nuevos** de este sprint: ninguno. Se reutilizan `VALIDATION_ERROR` (400), `FORBIDDEN` (403), `UNAUTHORIZED` (401), `ORDER_ITEM_NOT_FOUND` (404), `ORDER_DELIVERED` (400), `ORDER_ALREADY_PAID` (400), `PART_NOT_FOUND` (404) y `SERVICE_ORDER_NOT_FOUND` (404); para el desfase no hay error: la cancelación es un efecto silencioso e idempotente del GET (ver [payments.md](payments.md)).
- Efecto secundario en GET documentado: solo la cancelación del pago pendiente desfasado (idempotente); ningún otro GET escribe.
