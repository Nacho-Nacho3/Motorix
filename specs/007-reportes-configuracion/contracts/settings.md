# Contrato: Configuración del taller (Sprint 7)

Relacionado: FR-001 a FR-004, FR-009, US1, US2, CA-1, CA-2, CA-3, CA-10, D-16, D-17, RN-5, RN-15.

Módulo nuevo (`server/routes/settings.routes.js`). **Solo ADMIN**; RECEPTIONIST y MECHANIC → 403 `FORBIDDEN`.

## `GET /api/settings`

Devuelve siempre el objeto completo: el valor guardado o, si falta, el valor de respaldo (CA-3).

**Respuesta 200**:

```json
{
  "ok": true,
  "data": {
    "shop": { "name": "Taller Pérez", "address": "Av. Juárez 120", "phone": "3511234567" },
    "maintenance": { "warnDays": 30, "warnKm": 500 },
    "defaults": { "shop": { "name": "Motorix", "address": null, "phone": null }, "maintenance": { "warnDays": 30, "warnKm": 500 } }
  }
}
```

| Campo | Tipo | Reglas |
|-------|------|--------|
| `shop.name` | string | 1–100 caracteres |
| `shop.address` / `shop.phone` | string \| null | ≤ 200 / ≤ 30; vacío o `null` = sin dato |
| `maintenance.warnDays` | number | entero 0–365 |
| `maintenance.warnKm` | number | entero 0–20,000 |
| `defaults` | objeto | los valores de respaldo vigentes, para que la pantalla ofrezca «restablecer» |

## `PATCH /api/settings`

Actualización parcial: solo se aplican las claves enviadas. Cada cambio queda en la bitácora (`SETTINGS_UPDATED`, con el valor anterior y el nuevo).

**Cuerpo** (todas opcionales, al menos una):

```json
{ "shop": { "name": "Taller Pérez", "phone": "3511234567" }, "maintenance": { "warnDays": 45 } }
```

**Respuesta 200**: el mismo objeto de `GET /api/settings` ya actualizado.

**Errores**:

- 400 `VALIDATION_ERROR`: nombre vacío o muy largo, margen negativo, no entero o fuera de rango, cuerpo sin ninguna clave, claves desconocidas. Mensajes en español y se conserva el valor anterior.
- 403 `FORBIDDEN`: rol distinto de ADMIN.

## Efectos observables (se prueban en el cierre)

- Los tickets **nuevos** usan `shop`; los emitidos conservan su instantánea (CA-1, ver `changes-to-existing.md`).
- `maintenance.warnDays` y `warnKm` rigen para todo mantenimiento sin antelación propia (D-16): la lista de Mantenimientos, el dashboard y el centro de avisos coinciden (CA-2).
