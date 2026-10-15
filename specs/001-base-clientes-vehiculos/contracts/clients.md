# Contrato: Clientes (`/api/clients`)

Relacionado: FR-006, FR-007, FR-008, HU2 y HU4, SC-001.

**Lectura**: ADMIN, RECEPTIONIST y MECHANIC · **Escritura**: ADMIN y RECEPTIONIST
(MECHANIC recibe 403).

## GET /api/clients

Query opcional: `?q=<texto>` (nombre, teléfono o correo), `?page=`, `?limit=`.

**200**

```json
{ "ok": true, "data": { "clients": [
  { "id": 1, "name": "Juan Pérez", "phone": "5512345678",
    "email": "juan@correo.mx", "active": true,
    "vehicleCount": 2, "createdAt": "2026-10-13T10:00:00" } ],
  "total": 1 } }
```

## GET /api/clients/{id}

Devuelve el cliente con sus vehículos asociados (CA-4).

**200**

```json
{ "ok": true, "data": { "client": { "id": 1, "name": "Juan Pérez",
  "phone": "5512345678", "email": "juan@correo.mx", "active": true,
  "createdAt": "2026-10-13T10:00:00" },
  "vehicles": [ { "id": 1, "brand": "Toyota", "model": "Corolla", "year": 2020,
    "licensePlate": "ABC1234", "vin": null, "currentMileage": 85000 } ] } }
```

- **404** `CLIENT_NOT_FOUND`

## POST /api/clients

```json
{ "name": "Juan Pérez", "phone": "5512345678", "email": "juan@correo.mx" }
```

| Campo | Reglas |
|-------|--------|
| `name` | Obligatorio, hasta 100 caracteres |
| `phone` | Obligatorio, hasta 20 caracteres; **no único** (VC-02) |
| `email` | Obligatorio, formato válido; **no único** (Q2) |

| Éxito | Error | Condición |
|-------|-------|-----------|
| 201 `data.client` | 400 `VALIDATION_ERROR` | Faltan datos o formato inválido |
| | 409 `DUPLICATE_PHONE` | Ya existe un cliente con ese teléfono; la interfaz muestra el aviso y pide confirmación ("¿Guardar de todos modos?"), reintenta con `"confirmDuplicatePhone": true` y responde 201 |

## PATCH /api/clients/{id}

Edita los datos de un cliente (FR-008); los vehículos asociados se conservan.

```json
{ "name": "Juan Pérez", "phone": "5587654321", "email": "juan2@correo.mx" }
```

- Todos los campos opcionales; al menos uno obligatorio.
- Aplica la misma regla de teléfono duplicado que el POST (confirmación requerida).

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.client` | 404 `CLIENT_NOT_FOUND` | Id inexistente o ya no disponible |
| | 400 `VALIDATION_ERROR` | Datos inválidos; no se aplica ningún cambio |
| | 409 `DUPLICATE_PHONE` | Teléfono de otro cliente, sin confirmar |
