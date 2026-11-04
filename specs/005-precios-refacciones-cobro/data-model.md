# Modelo de datos — Sprint 5: Precios de refacciones y cobro completo

**Fecha**: 2026-11-03 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Investigación**: [research.md](research.md)

Fase 1 de `/speckit.plan`. Describe solo lo que este sprint agrega o cambia; el resto del esquema (Sprints 1–4) se conserva sin modificaciones. La fuente autoritativa del esquema son los scripts de `database/migrations/`; este documento los interpreta.

## Entidades afectadas

### order_parts (uso de una refacción en una orden)

Tabla existente (migración `011`) **ampliada por `014_order_parts_price.sql`**. Es un evento constancia: sin DELETE (R-06) y con una única mutación autorizada (corrección de precio, D-05).

| Columna | Tipo | Origen | Reglas |
|---|---|---|---|
| `id` | INT UNSIGNED PK | 011 | sin cambios |
| `order_id` | INT UNSIGNED FK → service_orders | 011 | `RESTRICT/CASCADE`, sin cambios |
| `part_id` | INT UNSIGNED FK → parts | 011 | `RESTRICT/CASCADE`, sin cambios |
| `quantity` | INT UNSIGNED | 011 | `CHECK (quantity > 0)`, sin cambios |
| `unit_price` | DECIMAL(10,2) | **014** | `NOT NULL DEFAULT 0`; `CHECK (unit_price >= 0 AND unit_price <= 99999.99)` (D-08); **instantánea**: se escribe una vez al agregar la refacción con el `sale_price` vigente (FR-003) |
| `price_correction_reason` | VARCHAR(200) NULL | **014** | motivo obligatorio al corregir (10–200 caracteres, D-05) |
| `price_corrected_by` | INT UNSIGNED NULL FK → users | **014** | `RESTRICT/CASCADE`; quién corrigió (solo ADMIN) |
| `price_corrected_at` | DATETIME NULL | **014** | cuándo se corrigió |
| `created_by` / `created_at` | 011 | 011 | sin cambios |

**Backfill (D-01/D-03)**, dentro de la 014 y solo sobre filas previas:

```sql
UPDATE order_parts op
  JOIN parts p ON p.id = op.part_id
   SET op.unit_price = p.sale_price;
```

**Mutaciones admitidas**:

- `INSERT` al agregar la refacción a la orden (solo MECHANIC dueño de la orden, ya existente): lleva `unit_price` leído de `parts.sale_price` en la misma conexión/transacción que el alta.
- `UPDATE` **solo** de `unit_price`, `price_correction_reason`, `price_corrected_by`, `price_corrected_at` vía `PATCH /api/service-orders/:id/parts/:partRowId/price` (solo ADMIN). Guardas: orden no `DELIVERED`, sin pago `PAID`, fila perteneciente a la orden.
- `DELETE`: no existe (R-06).

### parts (catálogo)

Sin cambios de columnas. La 014 agrega dos CHECK de límite (D-08): `purchase_price <= 99999.99` y `sale_price <= 99999.99`. Validación de entrada (FR-002) en `validators/parts.js`: formato `^\d+(\.\d{1,2})?$` (hasta 2 decimales, no negativo) **más** tope `$99,999.99` con mensaje en español. `category` y `brand` siguen como texto libre (D-06, P-9). Sin borrado lógico (heredado).

**Proyección por rol en consultas (FR-010, D-10)**:

| Endpoint | ADMIN | RECEPTIONIST | MECHANIC |
|---|---|---|---|
| `GET /api/parts` | todos los campos | 403 (sin cambios) | 403 (sin cambios) |
| `GET /api/parts/lookup` (nuevo) | 403 | 403 | `id, partCode, name, category, brand, stockCurrent, stockMin` — **sin precios** |
| `POST/PATCH /api/parts` | permitido | 403 | 403 |

### service_orders (orden de servicio)

Sin cambios de esquema. El total sigue **derivado** (RN-10): `total = Σ servicios + Σ (horas × tarifa) + Σ (cantidad × unit_price de la línea)`, calculado en centavos por `sumarTotales()` y presentado con 2 decimales (FR-004). Al cambiar `unit_price` por corrección, el total cambia solo en la siguiente consulta.

### payments (pagos)

Sin cambios de esquema. Estados `PENDING | PAID | REJECTED | CANCELLED` y máquina R-04 intactas (`PENDING → CANCELLED` ya permitida). Regla nueva (D-04, FR-009):

```
cancelarPendienteDesfasado(orderId, total):
  UPDATE payments SET status = 'CANCELLED'
   WHERE order_id = :orderId AND status = 'PENDING' AND amount <> :total
```

- Sentencia única atómica e idempotente (una segunda ejecución no afecta filas).
- Se ejecuta en: `GET .../id/total`, `GET .../id/payments` y dentro de la transacción de `POST .../id/payments` **antes** de VN-04/VN-05 (para que `PENDING_PAYMENT_EXISTS` solo bloquee pendientes que **sí** coinciden con el total).
- No llama al proveedor (cancelación local, como el `cancel` existente) y no toca pagos `PAID` (SC-002).

### tickets (comprobantes)

Sin cambios de esquema ni de forma. El contenido sigue calculado en cada lectura (RN-10) pero ahora desde `order_parts.unit_price`: un ticket emitido antes del sprint muestra los mismos importes después de la migración (el backfill copia el precio vigente) y deja de moverse cuando cambia el catálogo (SC-002, CA-6).

### users

Sin cambios. La 014 solo agrega la FK `order_parts.price_corrected_by → users(id)`.

## Transiciones de estado

| Entidad | Transición | Condición |
|---|---|---|
| payments | `PENDING → CANCELLED` (automática) | `amount <> total` al consultar total/pagos o al registrar un cobro (D-04) |
| payments | `PENDING → CANCELLED` (manual, ya existente) | `POST .../payments/:paymentId/cancel` |
| service_orders | sin transiciones nuevas | la corrección de precio no cambia el estado de la orden |

## Reglas de validación (resumen)

| Regla | Fuente | Capa |
|---|---|---|
| Precio: ≥ 0, hasta 2 decimales, ≤ 99,999.99 | FR-002, D-08 | zod (entrada) + CHECK (datos) |
| Motivo de corrección: 10–200 caracteres, obligatorio | D-05 | zod |
| Corrección: solo ADMIN; orden no entregada y sin pago `PAID` | D-05, RN-9 | servicio (guardas) |
| Instantánea al agregar: `unit_price = sale_price` vigente | FR-003, D-01/D-03 | servicio (misma transacción) |
| El mecánico no recibe precios en ninguna consulta | FR-010, D-10 | servicio (proyección) |
| Total en centavos con 2 decimales | FR-004 | `sumarTotales()` (ya existente) |
| Un solo pago vigente por orden | RN-14/FR-008 | transacción con `FOR UPDATE` (ya existente) |

## Relaciones

```text
service_orders 1 ──∞ order_parts ∞ ── 1 parts
service_orders 1 ──∞ payments
service_orders 1 ── 1 tickets
order_parts.price_corrected_by ── 1 users (nueva FK, opcional)
```

## Impacto en índices

Ninguno nuevo: `order_parts` se lee por `order_id` (índice existente) y se actualiza por PK; el `UPDATE` del desfase usa los índices existentes de `payments (order_id, status)`; el lookup del mecánico devuelve el catálogo completo (decenas de filas) sin filtro de texto obligatorio.

## Migraciones y semillas

- **`014_order_parts_price.sql`** (nueva, aditiva): columnas + backfill + CHECK + FK (detalle arriba). Se registra en `schema_migrations` con el mecanismo existente (`database/scripts/aplicar-migraciones.ps1`).
- **`database/README.md`**: se documenta la 014.
- **`server/scripts/seed.js`** (ampliado, idempotente): verifica la orden `FINISHED` cobrable con refacciones existente, agrega una orden abierta con línea de refacción y un pago `PENDING` de Mercado Pago con importe distinto al total para demostrar D-04, todo con marcadores propios (P-11).
