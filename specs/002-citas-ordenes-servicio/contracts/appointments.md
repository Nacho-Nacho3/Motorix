# Contrato: Citas (`/api/appointments`)

Relacionado: FR-001 a FR-005, US1, CA-1.

**Lectura y escritura**: ADMIN y RECEPTIONIST · **MECHANIC**: 403 en todos los
endpoints (no gestiona citas, supuesto del spec).

Objeto cita en respuestas:

```json
{ "id": 1, "clientId": 1, "clientName": "Juan Pérez",
  "vehicleId": 1, "vehicleLabel": "Toyota Corolla ABC1234",
  "date": "2026-10-20", "time": "09:30", "reason": "Servicio de 10,000 km",
  "notes": "Llega puntual", "status": "PENDING",
  "createdAt": "2026-10-14T10:00:00", "updatedAt": "2026-10-14T10:00:00" }
```

Estados: `PENDING` (Pendiente), `CONFIRMED` (Confirmada), `IN_PROGRESS` (En
proceso), `COMPLETED` (Completada), `CANCELED` (Cancelada).

## GET /api/appointments

Query opcional: `?date=YYYY-MM-DD` (agenda del día), `?status=`, `?q=<texto>`
(cliente o placas), `?page=`, `?limit=`.

**200**

```json
{ "ok": true, "data": { "appointments": [ /* objeto cita */ ], "total": 1 } }
```

- Sin resultados → arreglo vacío y `total: 0` (la interfaz muestra estado vacío).

## GET /api/appointments/{id}

- **200** con `data.appointment` · **404** `APPOINTMENT_NOT_FOUND`

## POST /api/appointments

```json
{ "clientId": 1, "vehicleId": 1, "date": "2026-10-20", "time": "09:30",
  "reason": "Servicio de 10,000 km", "notes": "Llega puntual" }
```

| Campo | Reglas |
|-------|--------|
| `clientId` | Obligatorio; debe existir → 404 `CLIENT_NOT_FOUND` |
| `vehicleId` | Obligatorio → 400 `VEHICLE_REQUIRED`; debe existir → 404 `VEHICLE_NOT_FOUND`; debe pertenecer al cliente → 400 `VEHICLE_CLIENT_MISMATCH` (VA-03) |
| `date` | Obligatorio, `YYYY-MM-DD` |
| `time` | Obligatorio, `HH:MM` |
| `reason` | Obligatorio, hasta 150 caracteres |
| `notes` | Opcional, hasta 500 caracteres |

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.appointment` (estado `PENDING`) | 400 `VALIDATION_ERROR` | Faltan datos o formato inválido |
| | 404 `CLIENT_NOT_FOUND` / `VEHICLE_NOT_FOUND` | Referencias inexistentes |
| | 400 `VEHICLE_CLIENT_MISMATCH` | Vehículo que no es del cliente |

## PATCH /api/appointments/{id}

Edita fecha, hora, motivo y observaciones, y/o cambia el estado con la misma
petición (incluida la cancelación).

```json
{ "date": "2026-10-21", "time": "11:00", "status": "CONFIRMED" }
```

- Todos los campos opcionales; al menos uno obligatorio.
- `status` se valida contra la máquina de transiciones (FR-005, Q3): solo avance y
  cancelación desde un estado activo; sin retrocesos.

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.appointment` | 404 `APPOINTMENT_NOT_FOUND` | Id inexistente |
| | 400 `VALIDATION_ERROR` | Sin campos o datos inválidos |
| | 400 `INVALID_STATUS_TRANSITION` | Transición no permitida entre estados activos (p. ej. un salto como PENDING → COMPLETED o un retroceso) |
| | 400 `APPOINTMENT_CLOSED` | La cita está COMPLETED o CANCELED: se conserva como historial |

> **Cancelación**: la interfaz pide confirmación («Confirmar»/«Cancelar») antes de
> enviar `{"status": "CANCELED"}`. Cancelar no borra la cita ni afecta órdenes
> (FR-004, Q3). **No existe `DELETE`**.
