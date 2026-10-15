# Contrato: Vehículos (`/api/vehicles`)

Relacionado: FR-009, FR-010, FR-011, FR-020, HU3, SC-005, RN-1.

**Lectura**: ADMIN, RECEPTIONIST y MECHANIC · **Escritura**: ADMIN y RECEPTIONIST
(MECHANIC recibe 403).

## GET /api/vehicles

Query opcional: `?clientId=<id>` (vehículos de un cliente), `?q=<texto>` (placa,
marca, modelo o VIN), `?page=`, `?limit=`.

**200**

```json
{ "ok": true, "data": { "vehicles": [
  { "id": 1, "clientId": 1, "clientName": "Juan Pérez", "brand": "Toyota",
    "model": "Corolla", "year": 2020, "licensePlate": "ABC1234", "vin": null,
    "currentMileage": 85000 } ],
  "total": 1 } }
```

## GET /api/vehicles/{id}

**200** con `data.vehicle` (incluye `clientName` y `clientId`) ·
**404** `VEHICLE_NOT_FOUND`

## POST /api/vehicles

```json
{ "clientId": 1, "brand": "Toyota", "model": "Corolla", "year": 2020,
  "licensePlate": "ABC1234", "vin": "JTDBR90K0X0000000", "currentMileage": 85000 }
```

| Campo | Reglas |
|-------|--------|
| `clientId` | Obligatorio; debe existir y estar disponible (**RN-1**: sin propietario no se guarda) |
| `brand`, `model` | Obligatorios, hasta 50 caracteres |
| `year` | Obligatorio; entre 1900 y el año actual + 1 |
| `licensePlate` | Obligatorio, único (VV-02) |
| `vin` | Opcional; si viene, único (VV-03), hasta 20 caracteres |
| `currentMileage` | Obligatorio; entero ≥ 0, por defecto 0 |

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.vehicle` | 400 `VALIDATION_ERROR` | Datos faltantes o inválidos |
| | 400 `CLIENT_REQUIRED` | Sin `clientId` (formulario sin propietario) |
| | 404 `CLIENT_NOT_FOUND` | `clientId` inexistente |
| | 409 `DUPLICATE_PLATE` | Esas placas ya están registradas (FR-020) |
| | 409 `DUPLICATE_VIN` | Ese VIN ya está registrado |

## PATCH /api/vehicles/{id}

Actualiza datos del vehículo y su kilometraje actual.

```json
{ "currentMileage": 91000, "brand": "Toyota", "model": "Corolla" }
```

- Todos los campos opcionales; `clientId` **no** se modifica en este sprint (la
  asociación propietario↔vehículo se establece al crear).
- `currentMileage` debe ser ≥ 0; en sprints posteriores se aplicará la regla de
  kilometraje no decreciente (fuera del alcance del Sprint 1).

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.vehicle` | 404 `VEHICLE_NOT_FOUND` | Id inexistente |
| | 400 `VALIDATION_ERROR` | Datos inválidos; no se aplica ningún cambio |
| | 409 `DUPLICATE_PLATE` / `DUPLICATE_VIN` | Choca con otro vehículo |
