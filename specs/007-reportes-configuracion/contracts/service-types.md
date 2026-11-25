# Contrato: Tipos de servicio (Sprint 7)

Relacionado: FR-005 a FR-009, US3, CA-4, CA-5, CA-10, D-04, RN-12, RN-5, RN-15.

Módulo nuevo (`server/routes/service_types.routes.js`). **No existe `DELETE`**: un tipo se desactiva (CA-4).

## `GET /api/service-types` (ADMIN)

Parámetro opcional `?active=true|false`. Sin paginación (catálogo corto).

**Respuesta 200**:

```json
{
  "ok": true,
  "data": [
    { "id": 1, "name": "Cambio de aceite", "intervalDays": 180, "intervalKm": 5000, "active": true, "usedInServices": 12 }
  ]
}
```

`usedInServices` es el número de líneas de servicio de órdenes que lo usan (para que la pantalla avise antes de desactivar).

## `GET /api/service-types/lookup` (ADMIN, RECEPTIONIST, MECHANIC)

Solo tipos activos, sin contadores, para el selector del formulario de servicio.

```json
{ "ok": true, "data": [ { "id": 1, "name": "Cambio de aceite", "intervalDays": 180, "intervalKm": 5000 } ] }
```

## `POST /api/service-types` (ADMIN)

**Cuerpo**:

```json
{ "name": "Cambio de aceite", "intervalDays": 180, "intervalKm": 5000 }
```

| Campo | Reglas |
|-------|--------|
| `name` | obligatorio, 1–100 caracteres, único (sin distinguir mayúsculas) |
| `intervalDays` / `intervalKm` | enteros > 0 (días ≤ 3650, km ≤ 1,000,000); **al menos uno** obligatorio |

**Respuesta 201**: el tipo creado (mismos campos que el listado, `usedInServices: 0`).

**Errores**: 400 `VALIDATION_ERROR` (sin ningún intervalo, intervalo 0 o negativo, no entero); 409 `SERVICE_TYPE_NAME_TAKEN`; 403 `FORBIDDEN`.

## `PATCH /api/service-types/:id` (ADMIN)

Actualización parcial de `name`, `intervalDays`, `intervalKm` y `active`. Para quitar un intervalo se envía `null`, siempre que quede al menos uno.

**Respuesta 200**: el tipo actualizado. **Errores**: 404 `NOT_FOUND`; los de `POST`.

- Desactivar un tipo **no** toca las órdenes que ya lo usan (siguen mostrando su nombre).
- Editar el intervalo **no** cambia tickets ya emitidos (guardan su instantánea) ni mantenimientos ya registrados.
