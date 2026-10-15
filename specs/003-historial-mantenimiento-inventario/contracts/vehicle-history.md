# Contrato: Historial del vehículo (`/api/vehicles/{id}/history`)

Relacionado: FR-001, FR-002, FR-003, US1, US2, CA-1, RN-10.

**Lectura**: ADMIN y MECHANIC · **RECEPTIONIST**: 403 (R-07, matriz FR-016).

El historial se **calcula en consulta** (Q3): no existe tabla ni vista de historial;
cada entrada se deriva de la orden terminada correspondiente (RN-10).

## GET /api/vehicles/{id}/history

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.history` | 404 `VEHICLE_NOT_FOUND` | Vehículo inexistente |
| | 403 `FORBIDDEN` | Rol sin permiso (RECEPTIONIST) |

```json
{ "ok": true, "data": {
    "vehicle": { "id": 1, "label": "Toyota Corolla ABC1234", "clientName": "Juan Pérez",
                 "currentMileage": 48500 },
    "entries": [ {
      "orderId": 3, "date": "2026-10-10", "status": "DELIVERED",
      "entryMileage": 48000, "reportedProblem": "Ruido al frenar",
      "diagnosis": "Balatas traseras desgastadas",
      "services": [ { "description": "Cambio de balatas", "unitPrice": "850.00" } ],
      "labor": [ { "concept": "Mano de obra frenos", "hours": "1.50", "hourlyRate": "350.00" } ],
      "parts": [ { "partCode": "BAL-001", "name": "Balatas traseras", "quantity": 1 } ],
      "observations": "Sin fugas", "recommendations": "Revisar a los 5,000 km",
      "mechanicName": "Carlos Mecánico" } ] } }
```

Reglas de la respuesta:

- **Solo** órdenes en estado `FINISHED` o `DELIVERED` (CA-1); las órdenes en curso
  no aparecen (caso límite del spec).
- `entries` en orden **cronológico descendente** (del servicio más reciente al más
  antiguo).
- Cada entrada replica los datos de la orden original (servicios, mano de obra,
  refacciones, observaciones, recomendaciones): **0** copias almacenadas (RN-10).
- `entries` vacío si el vehículo no tiene servicios terminados (la interfaz muestra
  estado vacío con mensaje en español).
