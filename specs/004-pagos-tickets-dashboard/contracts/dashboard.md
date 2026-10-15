# Contrato: Panel de control (`/api/dashboard`)

Relacionado: FR-012, FR-013, FR-014, FR-015, US5, US6, CA-6, RN-10, RN-15.

**Lectura**: exclusivo de ADMIN · **RECEPTIONIST y MECHANIC**: 403 (FR-012,
matriz R-08). Un solo endpoint que devuelve resumen y detalle calculados en la
misma ejecución, sin caché ni tablas derivadas (RN-10, SC-007): el panel abre y
recalcula al consultar o al pulsar «Actualizar».

## GET /api/dashboard

**200**

```json
{ "ok": true, "data": {
  "summary": {
    "vehiclesAttended": 12, "vehiclesInRepair": 3,
    "ordersPending": 4, "ordersFinished": 18,
    "nextAppointments": 2, "upcomingMaintenances": 5,
    "overdueMaintenances": 1, "lowStockCount": 2
  },
  "recentOrders": [
    { "id": 12, "clientName": "María López", "vehicleLabel": "Nissan Versa 2020",
      "status": "FINISHED", "total": "3150.00", "updatedAt": "2026-10-14T12:00:00" }
  ],
  "nextAppointments": [
    { "id": 7, "clientName": "María López", "vehicleLabel": "Nissan Versa 2020",
      "appointmentDate": "2026-10-16", "appointmentTime": "10:00:00",
      "reason": "Revisión de frenos", "status": "CONFIRMED" }
  ],
  "maintenances": {
    "upcoming": [
      { "id": 3, "vehicleLabel": "Nissan Versa 2020", "clientName": "María López",
        "nextDueDate": "2026-10-20", "nextDueMileage": 46000,
        "daysRemaining": 6, "mileageRemaining": 1000 }
    ],
    "overdue": [
      { "id": 1, "vehicleLabel": "Mazda 3 2018", "clientName": "Juan Pérez",
        "nextDueDate": "2026-09-30", "nextDueMileage": null,
        "daysRemaining": -14, "mileageRemaining": null }
    ]
  },
  "lowStockParts": [
    { "id": 1, "partCode": "BAL-001", "name": "Balatas traseras",
      "stockCurrent": 2, "stockMin": 5 }
  ]
} }
```

Definiciones (todas derivadas de los módulos existentes, CA-6):

| Indicador | Regla |
|-----------|-------|
| `vehiclesAttended` | vehículos distintos con al menos una orden `FINISHED`/`DELIVERED` |
| `vehiclesInRepair` | vehículos distintos con una orden activa (`RECEIVED`/`DIAGNOSIS`/`IN_REPAIR`/`WAITING_PART`) |
| `ordersPending` | órdenes en los 4 estados activos |
| `ordersFinished` | órdenes `FINISHED`/`DELIVERED` |
| `nextAppointments` | citas con `appointmentDate >= hoy` y estado `PENDING`/`CONFIRMED` |
| `upcomingMaintenances` | mantenimientos con estado calculado `UPCOMING` (misma regla que `GET /api/maintenances`) |
| `overdueMaintenances` | mantenimientos con estado calculado `OVERDUE` |
| `lowStockCount` | refacciones con `stockCurrent <= stockMin` (mismo filtro que `GET /api/parts?low=true`) |

Límites del detalle: `recentOrders` (últimas 5 órdenes por `updatedAt`),
`nextAppointments` (próximas 5), `maintenances.upcoming` (5),
`maintenances.overdue` (todas) y `lowStockParts` (todas). Sin datos, cada arreglo
viene vacío y los contadores en cero (US5 escenario 3).

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data` | 403 `FORBIDDEN` | Rol distinto de ADMIN |
