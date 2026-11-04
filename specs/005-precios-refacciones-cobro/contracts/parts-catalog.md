# Contrato: Catálogo de refacciones (`/api/parts`)

Relacionado: FR-001, FR-002, FR-010, FR-012, US1, US5, CA-1, CA-2, CA-10,
D-06, D-07, D-08, D-10, RN-15.

**Catálogo completo** (`GET`, `POST`, `PATCH`): solo ADMIN (sin cambios: SC-008
del Sprint 3 sigue intacto) · **Lookup** (`GET /lookup`): solo MECHANIC (nuevo).

Objeto refacción del catálogo (ADMIN, sin cambios de forma):

```json
{ "id": 4, "partCode": "FUS-004", "name": "Filtro de combustible",
  "category": "Filtros", "brand": "Bosch", "stockCurrent": 12, "stockMin": 3,
  "purchasePrice": "65.00", "salePrice": "85.00",
  "createdAt": "2026-09-10T09:00:00", "updatedAt": "2026-11-03T10:00:00" }
```

## GET /api/parts (existente, sin cambios de forma)

Solo ADMIN; los demás roles siguen con **403 `FORBIDDEN`** (SC-008). Los precios
son cadenas con 2 decimales y no pueden superar `$99,999.99` desde la migración
014 (el límite se valida al escribir).

## GET /api/parts/lookup (NUEVO, solo MECHANIC)

Listado ligero para el selector «agregar refacción» del detalle de orden (H-10,
US5): el mecánico elige piezas sin recibir ningún precio (FR-010, D-10).

**200**

```json
{ "ok": true, "data": { "parts": [
  { "id": 4, "partCode": "FUS-004", "name": "Filtro de combustible",
    "category": "Filtros", "brand": "Bosch",
    "stockCurrent": 12, "stockMin": 3 } ] } }
```

- **Nunca** incluye `purchasePrice` ni `salePrice`.
- Mismos parámetros de filtro que `GET /api/parts`.

| Éxito | Error | Condición |
|-------|-------|-----------|
| 200 `data.parts` | 401 `UNAUTHORIZED` | Sin token |
| | 403 `FORBIDDEN` | ADMIN o RECEPTIONIST (el catálogo completo es de ADMIN) |

## POST /api/parts y PATCH /api/parts/{id} (existentes, con tope nuevo)

Misma forma y mismos errores que en el Sprint 3, con una validación agregada
(FR-002, D-08) en `purchasePrice` y `salePrice`:

| Condición | Respuesta |
|-----------|-----------|
| Negativo, no numérico o con más de 2 decimales | 400 `VALIDATION_ERROR` (ya existente) |
| **Mayor a `$99,999.99`** | 400 `VALIDATION_ERROR` con mensaje «El precio … no puede superar los 99,999.99.» |
| `salePrice < purchasePrice` | **Permitido** (200/201): el backend no lo rechaza; el formulario muestra una advertencia ámbar no bloqueante (D-07, default documentado) |

Categoría y marca siguen como texto libre de hasta 50 caracteres (D-06, sin
cambios). `POST`/`PATCH` siguen siendo 403 para RECEPTIONIST y MECHANIC (RN-15).
