# Contrato: Ticket de servicio (`/api/service-orders/{id}/ticket`)

Relacionado: FR-009, FR-010, FR-011, FR-015, US3, CA-4, CA-5, RN-9, RN-10,
RN-15.

**Lectura y escritura**: ADMIN y RECEPTIONIST · **MECHANIC**: 403 (el ticket
incluye importes y estado de cobro, matriz R-08). Un ticket por orden
(`order_id` ÚNICO); el contenido se calcula al servirlo, no se almacena (RN-10).

Objeto ticket en respuestas:

```json
{ "ok": true, "data": { "ticket": {
    "id": 3, "folio": "TCK-000003", "orderId": 12,
    "issuedBy": 2, "issuedByName": "Recepción",
    "createdAt": "2026-10-14T12:30:00",
    "workshop": { "name": "Motorix", "address": null, "phone": null },
    "client": { "id": 4, "name": "María López", "phone": "5512345678" },
    "vehicle": { "id": 4, "label": "Nissan Versa 2020", "licensePlate": "ABC1234",
                 "entryMileage": 45000 },
    "services": [ { "id": 9, "description": "Afinación mayor", "unitPrice": "850.00" } ],
    "labor": [ { "id": 5, "concept": "Instalación de refacción", "hours": "2.00",
                 "hourlyRate": "300.00", "subtotal": "600.00" } ],
    "parts": [ { "id": 12, "partCode": "BAL-001", "name": "Balatas traseras",
                 "quantity": 2, "unitPrice": "850.00", "subtotal": "1700.00" } ],
    "totals": { "servicesSubtotal": "850.00", "laborSubtotal": "600.00",
                "partsSubtotal": "1700.00", "total": "3150.00" },
    "payment": { "method": "CASH", "status": "PAID", "amount": "3150.00" }
} } }
```

- `folio`: derivado del id (`TCK-` + 6 dígitos); único e inalterable (FR-011).
- `parts[].unitPrice`/`subtotal`: precio de venta **vigente** de la refacción,
  idéntico al desglose del total (R-03).
- `payment`: el pago `PAID` de la orden; si no existe, `null` y la interfaz
  muestra «Sin pago» (US3 escenario 4).

## POST /api/service-orders/{id}/ticket

Genera el ticket de una orden terminada o entregada. **Idempotente**: si la orden
ya tiene ticket, devuelve el existente sin duplicarlo.

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.ticket` (creado) · 200 `data.ticket` (ya existía) | 404 `SERVICE_ORDER_NOT_FOUND` | Orden inexistente |
| | 400 `ORDER_NOT_FINISHED` | Orden no está `FINISHED`/`DELIVERED` |
| | 403 `FORBIDDEN` | Rol MECHANIC |

## GET /api/service-orders/{id}/ticket

**200** con `data.ticket` (contenido calculado completo) · **404**
`TICKET_NOT_FOUND` (la orden aún no tiene ticket; se genera con `POST`) o
`SERVICE_ORDER_NOT_FOUND` · **403** `FORBIDDEN` para MECHANIC.

> La impresión (CA-5) es responsabilidad de la interfaz: el frontend genera el
> PDF del comprobante en memoria con el contenido de este contrato y lo envía al
> diálogo de impresión del sistema; no se almacena ningún archivo (supuesto del
> spec). No existe `DELETE` de tickets.
