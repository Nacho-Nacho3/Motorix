# Contrato: Mantenimientos (`/api/maintenances`)

Relacionado: FR-004, FR-005, FR-006, FR-007, US3, US4, CA-2, CA-3, RN-11, RN-12.

**Consulta**: ADMIN, RECEPTIONIST y MECHANIC · **Escritura**: ADMIN y MECHANIC
(RECEPTIONIST 403 en `POST`, R-07).

**Un registro vigente por vehículo** (índice único): registrar un nuevo
mantenimiento reemplaza al anterior (supuesto del spec, VM-04). El estado **no** se
recibe ni se guarda: lo calcula el backend en cada lectura (Q4, R-04).

Objeto mantenimiento en respuestas:

```json
{ "id": 4, "vehicleId": 2, "vehicleLabel": "Nissan Versa XYZ5678",
  "clientName": "María López", "nextDueDate": "2026-10-20", "nextDueMileage": 50000,
  "warnDays": 30, "warnKm": 500, "recommendations": "Cambio de aceite y filtro",
  "state": "UPCOMING", "daysRemaining": 6, "mileageRemaining": 1500,
  "registeredBy": 3, "updatedAt": "2026-10-14T12:00:00" }
```

| Campo de estado | Valores |
|-----------------|---------|
| `state` | `NORMAL` (Normal), `UPCOMING` (Próximo), `OVERDUE` (Vencido) |
| `daysRemaining` | Días hasta `nextDueDate` (negativo si ya venció); `null` sin fecha |
| `mileageRemaining` | `nextDueMileage − vehicles.current_mileage` (negativo si ya se cumplió); `null` sin kilometraje |

Cálculo (Q4): `OVERDUE` si la fecha objetivo ya pasó **o** el kilometraje actual
alcanzó el objetivo (con ambos objetivos, basta con cumplir uno); `UPCOMING` si
está dentro de `warnDays`/`warnKm`; si no, `NORMAL`.

## GET /api/maintenances

Query opcional: `?state=NORMAL|UPCOMING|OVERDUE`.

**200**

```json
{ "ok": true, "data": { "maintenances": [ /* objeto mantenimiento */ ], "total": 3 } }
```

- Solo vehículos con registro vigente (los demás no aparecen).
- Orden: `OVERDUE` primero, luego `UPCOMING`, luego `NORMAL`; dentro de cada estado,
  por fecha objetivo ascendente.
- `?state` con valor desconocido → 400 `VALIDATION_ERROR`.
- Sin resultados → arreglo vacío y `total: 0`.

## POST /api/maintenances

```json
{ "vehicleId": 2, "nextDueDate": "2026-10-20", "nextDueMileage": 50000,
  "warnDays": 30, "warnKm": 500, "recommendations": "Cambio de aceite y filtro" }
```

| Campo | Reglas |
|-------|--------|
| `vehicleId` | Obligatorio → 400 `VEHICLE_REQUIRED`; debe existir → 404 `VEHICLE_NOT_FOUND` |
| `nextDueDate` | Opcional (uno de los dos objetivos es obligatorio), `YYYY-MM-DD` |
| `nextDueMileage` | Opcional, entero ≥ 0 |
| `warnDays` | Opcional, ≥ 0; defecto 30 |
| `warnKm` | Opcional, ≥ 0; defecto 500 |
| `recommendations` | Opcional, hasta 1000 caracteres |
| *(no se envía)* | `state`, `daysRemaining`, `mileageRemaining` → los calcula el backend (VM-06) |

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.maintenance` | 400 `VALIDATION_ERROR` | Datos faltantes o inválidos |
| 200 `data.maintenance` (reemplazado) | 400 `MAINTENANCE_TARGET_REQUIRED` | Sin `nextDueDate` ni `nextDueMileage` (RN-11) |
| | 404 `VEHICLE_NOT_FOUND` | Vehículo inexistente |
| | 403 `FORBIDDEN` | RECEPTIONIST (solo consulta) |

- **201** si el vehículo no tenía registro (se crea); **200** si ya existía y se
  reemplaza (el anterior queda sustituido, sin duplicados).
- No existe `DELETE`: el registro se actualiza, no se borra.
