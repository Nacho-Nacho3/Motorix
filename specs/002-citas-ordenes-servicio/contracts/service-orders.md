# Contrato: Órdenes de servicio (`/api/service-orders`)

Relacionado: FR-006 a FR-018, US2–US7, CA-2 a CA-8.

**Lectura**: los 3 roles (MECHANIC solo sus órdenes, R-07) · **Escritura**:
según endpoint (ver [README.md](README.md) y la matriz CA-7).

Objeto resumen en listados:

```json
{ "id": 1, "clientId": 1, "clientName": "Juan Pérez", "vehicleId": 1,
  "vehicleLabel": "Toyota Corolla ABC1234", "mechanicId": 3,
  "mechanicName": "Mecánico Demo", "status": "RECEIVED",
  "entryMileage": 86000, "reportedProblem": "Ruido al frenar",
  "createdAt": "2026-10-14T10:30:00", "updatedAt": "2026-10-14T10:30:00" }
```

Estados: `RECEIVED` (Recibido), `DIAGNOSIS` (Diagnóstico), `IN_REPAIR` (En
reparación), `WAITING_PART` (Esperando refacción), `FINISHED` (Terminado),
`DELIVERED` (Entregado).

## GET /api/service-orders

Query opcional: `?status=`, `?vehicleId=` (solo las órdenes de ese vehículo),
`?mechanicId=` (solo ADMIN/RECEPTIONIST; para
MECHANIC se ignora y siempre son las suyas), `?q=<texto>` (cliente o placas),
`?page=`, `?limit=`.

**200**

```json
{ "ok": true, "data": { "orders": [ /* objeto resumen */ ], "total": 1 } }
```

- Para MECHANIC la consulta agrega `WHERE mechanic_id = <usuario del token>` en el
  backend: jamás aparecen órdenes ajenas (CA-3, SC-004).

## GET /api/service-orders/{id}

Devuelve la orden completa con cliente, vehículo, mecánico y los arreglos de
trabajo (CA-4).

**200**

```json
{ "ok": true, "data": { "order": { /* objeto resumen + */ 
    "diagnosis": "Pastillas desgastadas",
    "observations": "Discos en buen estado",
    "recommendations": "Revisar frenos en 5,000 km",
    "mileageCorrectionReason": null,
    "waitingOrigin": null },
  "services": [ { "id": 1, "description": "Cambio de pastillas", "unitPrice": 450.00 } ],
  "labor": [ { "id": 1, "concept": "Cambiar pastillas delanteras", "hours": 1.5,
               "hourlyRate": 350.00 } ] } }
```

- `waitingOrigin` (US6): solo en el detalle; `null`, `DIAGNOSIS` o `IN_REPAIR`.
  Es el estado desde el que se entró a `WAITING_PART` y al que debe regresar la
  orden; el control de estado de la interfaz lo usa para ofrecer una única
  salida válida.

- **404** `SERVICE_ORDER_NOT_FOUND` · **403** `FORBIDDEN` si MECHANIC pide una
  orden ajena.

## GET /api/service-orders/mechanics

Solo ADMIN y RECEPTIONIST (MECHANIC → 403): lista los mecánicos activos para
asignar la orden al crearla o al reasignarla (Q2). Se añadió durante la
implementación porque `/api/users` es de solo ADMIN y la recepción necesita el
selector de mecánicos.

**200**

```json
{ "ok": true, "data": { "mechanics": [ { "id": 3, "name": "Mecánico Demo",
  "username": "mecanico" } ] } }
```

## POST /api/service-orders

Solo ADMIN y RECEPTIONIST (MECHANIC → 403). Corresponde a «crear orden → asignar
orden a mecánico» (Q2: la asignación es manual y ocurre al crear).

```json
{ "clientId": 1, "vehicleId": 1, "mechanicId": 3, "entryMileage": 86000,
  "reportedProblem": "Ruido al frenar", "mileageCorrectionReason": null }
```

| Campo | Reglas |
|-------|--------|
| `clientId` | Obligatorio → 400 `CLIENT_REQUIRED`; debe existir → 404 `CLIENT_NOT_FOUND` |
| `vehicleId` | Obligatorio → 400 `VEHICLE_REQUIRED`; debe existir → 404 `VEHICLE_NOT_FOUND` (RN-2); debe pertenecer al cliente → 400 `VEHICLE_CLIENT_MISMATCH` |
| `mechanicId` | Obligatorio → 400 `MECHANIC_REQUIRED`; debe existir → 404 `MECHANIC_NOT_FOUND`; debe ser usuario activo con rol MECHANIC → 400 `INVALID_MECHANIC` (Q2) |
| `entryMileage` | Obligatorio, entero ≥ 0 (RN-3); ≥ kilometraje actual del vehículo, salvo corrección (abajo) |
| `reportedProblem` | Obligatorio, hasta 500 caracteres |
| `mileageCorrectionReason` | Opcional; solo ADMIN: ≥ 10 caracteres, permite `entryMileage` menor (RN-4). Otro rol → 403 `FORBIDDEN` |

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.order` (estado `RECEIVED`; `vehicles.current_mileage` pasa a `entryMileage`) | 400 `VALIDATION_ERROR` | Faltan datos o formato inválido |
| | 400 `MILEAGE_LOWER_THAN_PREVIOUS` | Kilometraje menor que el registrado sin corrección de ADMIN (RN-4, CA-6) |
| | 404 `VEHICLE_NOT_FOUND` | Vehículo inexistente (RN-2) |
| | 400 `INVALID_MECHANIC` | Asignado que no es mecánico activo |

## PATCH /api/service-orders/{id}

Solo ADMIN y RECEPTIONIST (MECHANIC → 403): editar el problema reportado o
**reasignar** la orden (Q2).

```json
{ "reportedProblem": "Ruido al frenar y vibración", "mechanicId": 4 }
```

- Todos los campos opcionales; al menos uno obligatorio.
- `mechanicId` se valida igual que en el POST (`INVALID_MECHANIC` etc.).
- Orden en estado `DELIVERED` → 400 `ORDER_DELIVERED` (solo ADMIN corrige; VS-07).

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.order` | 404 `SERVICE_ORDER_NOT_FOUND` | Id inexistente |
| | 400 `VALIDATION_ERROR` | Sin campos o datos inválidos |

## PATCH /api/service-orders/{id}/status

ADMIN (cualquier orden) o MECHANIC (solo las suyas). RECEPTIONIST → 403 (Q1).

```json
{ "status": "DIAGNOSIS" }
```

- Transiciones permitidas (Q1, CA-5):
  `RECEIVED → DIAGNOSIS`; `DIAGNOSIS → IN_REPAIR | WAITING_PART`;
  `IN_REPAIR → FINISHED | WAITING_PART`;
  `WAITING_PART →` el estado desde el que se entró (`waiting_origin`);
  `FINISHED → DELIVERED`; `DELIVERED` sin salidas.

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.order` | 404 `SERVICE_ORDER_NOT_FOUND` | Id inexistente |
| | 400 `INVALID_STATUS_TRANSITION` | Salto, retroceso o salida de `DELIVERED` (CA-5, CA-8) |
| | 403 `FORBIDDEN` | RECEPTIONIST, o MECHANIC de una orden ajena (R-07) |

## PATCH /api/service-orders/{id}/work

MECHANIC (solo las suyas) o ADMIN. RECEPTIONIST → 403.

```json
{ "diagnosis": "Pastillas desgastadas", "observations": "Discos en buen estado",
  "recommendations": "Revisar frenos en 5,000 km" }
```

- Todos los campos opcionales; al menos uno obligatorio; hasta 1,000 caracteres
  cada uno (US5, US7).

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.order` | 404 `SERVICE_ORDER_NOT_FOUND` | Id inexistente |
| | 400 `ORDER_DELIVERED` | Orden `DELIVERED` y quien edita no es ADMIN (VS-07) |
| | 403 `FORBIDDEN` | RECEPTIONIST, o MECHANIC de una orden ajena |

## POST /api/service-orders/{id}/services

MECHANIC (solo las suyas) o ADMIN. Agrega un servicio realizado (FR-013).

```json
{ "description": "Cambio de pastillas delanteras", "unitPrice": 450.00 }
```

| Campo | Reglas |
|-------|--------|
| `description` | Obligatorio, hasta 200 caracteres |
| `unitPrice` | Opcional, ≥ 0; default 0 (sin cálculo de totales en este sprint) |

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.service` | 400 `VALIDATION_ERROR` | Datos inválidos (VS-06) |
| | 404 `SERVICE_ORDER_NOT_FOUND` | Orden inexistente |
| | 400 `ORDER_DELIVERED` | Orden entregada y rol distinto de ADMIN |
| | 403 `FORBIDDEN` | RECEPTIONIST, o MECHANIC de orden ajena |

## DELETE /api/service-orders/{id}/services/{serviceId}

Corrige una captura errónea (misma autorización que el POST; la interfaz pide
confirmación). **No** es el borrado de la orden: esa operación no existe (RN-9).

- **200** con `data.deleted: true` · **404** `ORDER_ITEM_NOT_FOUND` (id inexistente
  o que no pertenece a la orden) · **400** `ORDER_DELIVERED` · **403** `FORBIDDEN`

## POST /api/service-orders/{id}/labor

Misma autorización que `services`. Registra mano de obra (FR-014).

```json
{ "concept": "Cambiar pastillas delanteras", "hours": 1.5, "hourlyRate": 350.00 }
```

| Campo | Reglas |
|-------|--------|
| `concept` | Obligatorio, hasta 200 caracteres |
| `hours` | Obligatorio, > 0 y ≤ 999.99 |
| `hourlyRate` | Opcional, ≥ 0; default 0 |

- **201** `data.labor` · mismos errores que `services` (`VALIDATION_ERROR`,
  `SERVICE_ORDER_NOT_FOUND`, `ORDER_DELIVERED`, `FORBIDDEN`).

## DELETE /api/service-orders/{id}/labor/{laborId}

Misma autorización y errores que el DELETE de `services`
(`ORDER_ITEM_NOT_FOUND`, `ORDER_DELIVERED`, `FORBIDDEN`).

## Lo que NO existe (a propósito)

- `DELETE /api/service-orders/{id}`: RN-9, la orden entregada se conserva como
  historial y no se elimina de forma ordinaria.
- `POST .../{id}/services/{serviceId}` (editar fila): corregir = borrar y volver a
  agregar.
- Vínculo con citas: ninguna ruta relaciona órdenes con `/api/appointments` (Q3).
