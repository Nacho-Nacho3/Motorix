# Contrato: Clientes por avisar (Sprint 6)

Relacionado: FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, US6, US7, CA-7, CA-10, CA-11, D-07, RN-15.

Módulo nuevo (`server/routes/client-notices.routes.js`): no hay contrato previo del que derivar. Registra avisos **manuales** a clientes (el sistema no envía mensajes): el responsable ve la lista, habla con el cliente y lo marca como avisado (CA-7/CA-10).

## `GET /api/client-notices` — clientes por avisar

- **Roles**: ADMIN, RECEPTIONIST. **MECHANIC → 403 `FORBIDDEN`** (CA-10, FR-010).
- **Sin parámetros**: devuelve los pendientes completos (sin paginación).

**Respuesta 200**:

```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "clientId": 3,
      "clientName": "María Gómez",
      "phone": "3511234567",
      "motive": "ORDER_READY",
      "motiveLabel": "Orden terminada sin entregar",
      "sourceId": 42,
      "detail": "Orden #42 — Toyota Corolla 2015 (ABC123)",
      "note": null,
      "createdAt": "2026-11-05T10:00:00.000Z"
    }
  ]
}
```

| Campo | Tipo | Reglas |
|-------|------|--------|
| `clientId` / `clientName` / `phone` | number / string / string | teléfono solo a estos dos roles (mismos que hoy acceden a `GET /api/clients`) |
| `motive` | string | `ORDER_READY`, `APPOINTMENT_TOMORROW`, `MAINTENANCE_UPCOMING`, `MAINTENANCE_OVERDUE` (P-9) |
| `motiveLabel` | string | rótulo en español (ej. «Orden terminada sin entregar», «Cita de mañana», «Mantenimiento por vencer», «Mantenimiento vencido») |
| `sourceId` | number | id del hecho: orden, cita o mantenimiento |
| `detail` | string | contexto para la llamada (un renglón, español) |
| `note` | string \| null | nota guardada con el aviso (D-07); en la lista siempre `null` (la nota se guarda al registrar) |
| `createdAt` | ISO-8601 | `notified_at` de `client_notices` |

**Reglas de la lista (P-8)**: solo aparece un hecho **sin aviso registrado**; si el mismo cliente tiene dos motivos, aparece en dos filas (CA-11 es «una vez por hecho», no por cliente). Orden: por `motive` y luego por nombre.

**Errores**: 401 `UNAUTHORIZED`; 403 `FORBIDDEN` (MECHANIC).

## `POST /api/client-notices` — registrar que se avisó

- **Roles**: ADMIN, RECEPTIONIST (MECHANIC 403).
- **Cuerpo**:

```json
{ "clientId": 3, "type": "ORDER_READY", "sourceId": 42, "note": "Ya lo llamé, pasa el viernes." }
```

| Campo | Tipo | Reglas |
|-------|------|--------|
| `clientId` | number | requerido; debe existir → si no, 404 `NOT_FOUND` |
| `type` | string | requerido; ∈ dominio de cuatro valores → si no, 400 `VALIDATION_ERROR` |
| `sourceId` | number | requerido; el hecho (orden/cita/mantenimiento) debe existir **y** corresponder al motivo → si no, 404 `NOT_FOUND` |
| `note` | string | opcional, ≤ 300 caracteres (D-07) |

**Respuestas**:

- **201** — se creó el registro:

```json
{
  "ok": true,
  "data": {
    "id": 1, "clientId": 3, "type": "ORDER_READY", "sourceId": 42,
    "note": "Ya lo llamé, pasa el viernes.",
    "notifiedBy": 1, "notifiedByName": "Ana Recepción",
    "notifiedAt": "2026-11-05T10:05:00.000Z"
  }
}
```

- **200** — ya estaba registrado para ese `(clientId, type, sourceId)` (idempotente): devuelve el registro existente tal cual, sin sobreescribir `note` ni `notified_by`.

**Errores**: 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 400 `VALIDATION_ERROR` (campos); 404 `NOT_FOUND` (cliente o hecho inexistente / no corresponde al motivo).
