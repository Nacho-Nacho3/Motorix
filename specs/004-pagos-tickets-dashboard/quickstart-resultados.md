# Resultados del quickstart — Sprint 4

**Fecha**: 2026-10-14 · **Rama**: `004-pagos-tickets-dashboard` · **Entorno**:
Windows, MySQL local (base `motorix`), Node v25.1.0, Flutter 3.47.2.

Método: V1 y V7 con los scripts y suites del repositorio; V2–V6 con verificación
por API contra el backend local (`GET /api/health` → 200) mediante scripts de
comprobación (48 + 6 aserciones en una corrida). Las comprobaciones
exclusivamente visuales (estados en píldora, botones del panel, diálogo de
impresión y entrada del rail) se respaldan con las pruebas widget del mismo
sprint, citadas en cada escenario.

## Resumen

| Escenario | Estado |
|-----------|--------|
| V1 Esquema y seeds idempotentes | **PASS** |
| V2 Total y cobro en efectivo | **PASS** (13/13) |
| V3 Permisos de pagos | **PASS** (13/13) |
| V4 Mercado Pago sin credenciales | **PASS** (3/3) + auditoría **PASS**; con credenciales: NO APLICA (cubierto por pruebas simuladas) |
| V5 Ticket de servicio | **PASS** (13/13) |
| V6 Panel de control | **PASS** (12/12) |
| V7 Batería del sprint | **PASS** (390 + 118 pruebas, lint/analyze en 0) |

**Resultado global: PASS** — 54 verificaciones por API sin fallos y suites en verde.

## V1 — Esquema y seeds idempotentes (CA-1, CA-4, FR-018)

| # | Paso | Estado | Evidencia |
|---|------|--------|-----------|
| 1 | Migraciones registran 012/013 | PASS | `schema_migrations` contiene `012_create_payments.sql` y `013_create_tickets.sql` |
| 2 | Re-ejecutar → 0 aplicadas | PASS | Segunda corrida: 13 × `[omitida] … ya estaba aplicada` → «Migraciones al día para la base 'motorix'» |
| 3 | `npm run seed` dos veces sin duplicar | PASS | 1ª corrida: `Órdenes: 1 creadas, 3 ya existentes` + `Cobro y ticket: pago PAID registrado, ticket generado`; 2ª corrida: `0 creadas` en todas las secciones y `Cobro y ticket: pago ya existente…, ticket ya existente…` |
| 4 | Orden terminada con pago `PAID` + ticket y otra terminada sin pago | PASS | `payments`: 1 fila {order_id 3, CASH, PAID, 3195.00} — 3195.00 = total calculado (620 + 2.5×350 + 2×850); `tickets`: 1 fila {order_id 3} → folio derivado `TCK-000001`; orden id 36 («Mantenimiento de 100,000 km y revisión general», FINISHED) **sin** pagos para demostrar el cobro |

## V2 — Total y cobro en efectivo (CA-1, CA-2, US1, US2, SC-001)

13/13 PASS (órdenes propias del quickstart, cliente «Q4 Quickstart S4»):

1. `GET .../total` con `recepcion` → 200; subtotales servicios `620.00` / mano de obra `700.00` / refacciones `0.00` y total calculado `1320.00` (SC-001).
2. `POST .../payments` **Efectivo** `1320.00` → 201 con pago `PAID`; `GET .../payments` → lista 1 pago y `data.total` `1320.00`.
3. Segundo cobro sobre la misma orden → 400 `ORDER_ALREADY_PAID` («ya tiene un pago pagado»).
4. **Tarjeta** `500.00` y **Transferencia** `450.00` sobre dos órdenes distintas → ambos 201 `PAID`.
5. Cobro sobre orden en curso → 400 `ORDER_NOT_PAYABLE`.
6. `amount` `400.00` ≠ total `500.00` → 400 `PAYMENT_AMOUNT_MISMATCH` (Q1: sin parciales); `GET .../total` sigue respondiendo `500.00`.

> La sección «Pago» con estados en píldora y el texto en español de los errores lo cubre `client/test/payment_form_test.dart`.

## V3 — Permisos de pagos (RN-15, FR-015, matriz R-08)

13/13 PASS (7 del script principal + 6 de complemento):

| Rol | `GET /total` | `GET/POST /payments` | `POST/GET /ticket` | `GET /dashboard` |
|-----|--------------|----------------------|--------------------|------------------|
| `mecanico` | 403 | 403 / 403 | 403 / — | 403 |
| `recepcion` | 200 | 200 / 201 | 201 / 200 | 403 |
| `admin` | 200 | 200 / — | 201 / 200 | 200 |

- Control: el mecánico **sí** lee la orden (`GET /service-orders/{id}` → 200): el 403 es de permiso, no de existencia.
- **Resultado**: el backend rechaza con 403, no solo la interfaz que oculta botones.

## V4 — Mercado Pago en sandbox (CA-3, CA-7, US4, RN-14, SC-006)

**Sin credenciales** (`MP_ACCESS_TOKEN` vacío) — 3/3 PASS:

1. `POST .../payments` método **Mercado Pago** sobre orden terminada sin pago → 409 `MERCADO_PAGO_NOT_CONFIGURED`; la transacción no deja fila (0 pagos tras el error) y en la MISMA orden el cobro en efectivo posterior → 201 `PAID` (los métodos manuales siguen operando).
2. Auditoría (RN-14): columnas de `payments` = `id, order_id, amount, method, status, external_reference, created_by, created_at, updated_at` → **cero datos de tarjeta**; métodos usados en la base: `CASH, CARD, TRANSFER`; `external_reference` vacío (sin preferencia creada). `MP_ACCESS_TOKEN`/`MP_PUBLIC_KEY` **no existen** en el `.env` local; `.env.example` solo con placeholders vacíos; `.gitignore` ignora `.env` (línea 2); sin tokens `APP_USR-…` en ningún archivo del repositorio; `client/` sin ninguna referencia a claves de MP.
3. Estados y acciones del pago `Pendiente` («Abrir en el navegador», «Verificar estado», «Cancelar pago» con confirmación) y el aviso 409 en español → `client/test/payment_mp_test.dart` (4 pruebas).

**Con credenciales sandbox**: **NO APLICA** en este entorno (no hay cuenta de
pruebas de Mercado Pago). Los escenarios 1–4 y 6 quedan cubiertos por
`server/tests/integration/payments-mp.test.js` (10 pruebas con el cliente HTTP
**simulado**, sin red): preferencia creada con `initPoint` y `external_reference`
del preferenceId, `approved → PAID`, `rejected → REJECTED`, transiciones de
`sync`/`cancel`, y «segundo MP con uno `Pendiente` → 409 `PENDING_PAYMENT_EXISTS`»
validado **antes** de revisar credenciales.

## V5 — Ticket de servicio (CA-4, CA-5, US3, FR-011, SC-002)

13/13 PASS:

1. `POST .../ticket` con `recepcion` sobre orden terminada → 201 con folio `TCK-\d{6}`.
2. Contenido (CA-4): taller `Motorix`, cliente, vehículo con placas, servicios listados, mano de obra (horas × tarifa), subtotales y total `1320.00` (= total calculado), método/estado del pago (`CASH`/`PAID`) y fecha.
3. Repetir `POST .../ticket` → **200 con el MISMO folio** (sin duplicados; `order_id` ÚNICO garantiza la idempotencia a nivel de base).
4. `GET .../ticket` → 200 con el mismo folio.
5. Orden en curso → 400 `ORDER_NOT_FINISHED`; orden terminada **sin** pago → ticket con `payment: null` («Sin pago»).
6. `GET .../ticket` sin generar antes → 404 `TICKET_NOT_FOUND`.
7. «Imprimir» → diálogo de impresión del sistema con el PDF armado en memoria (nada almacenado) → `client/test/ticket_screen_test.dart`.

## V6 — Panel de control (CA-6, US5, US6, RN-10, SC-003, SC-007)

12/12 PASS:

1. `admin` `GET /api/dashboard` → 200 con las 8 tarjetas; 5 consultas seguidas responden en **4–8 ms** (SC-003, <3 s).
2. Consistencia (SC-007): `ordersFinished` 11 = órdenes `FINISHED`+`DELIVERED` del listado (11); `vehiclesAttended` 7 = vehículos distintos con orden terminada (7); `lowStockCount` 4 = `GET /api/parts?low=true` (4).
3. Terminar una orden nueva → `ordersFinished` 11→12 y `vehiclesAttended` 7→8, y la orden aparece en `recentOrders` en la **misma** respuesta; al entregarla → los contadores se mantienen (RN-10: todo se recalcula en cada consulta, sin caché).
4. Secciones de detalle: `recentOrders` 1…5, `nextAppointments` ≤5, `maintenances.upcoming` ≤5 con `.overdue` completo y `lowStockParts` = su contador.
5. `recepcion` y `mecanico` → 403; la entrada **Dashboard** no se construye en el rail → `client/test/dashboard_screen_test.dart` (2 pruebas de visibilidad por rol).
6. Base vacía → contadores en cero y estado vacío en español (escenario 3 de `server/tests/integration/dashboard.test.js`; no se borra la base real de práctica).

> Las 8 tarjetas con etiquetas en español, las 4 secciones con sus estados vacíos y el botón «Actualizar» lo cubren las 6 pruebas de `client/test/dashboard_screen_test.dart`.

## V7 — Batería completa del sprint (CA-8, SC-008)

| Comando | Estado | Detalle |
|---------|--------|---------|
| `cd server && npm test` | PASS | 49 suites, **390 pruebas**, 0 fallos (unit + integración + contrato, contra `motorix_test`; Mercado Pago con cliente simulado) |
| `cd server && npm run lint` | PASS | 0 hallazgos (exit 0) |
| `cd client && flutter analyze` | PASS | 0 problemas (exit 0) |
| `cd client && flutter test` | PASS | **118 pruebas** en verde |

**SC-006 (extremo a extremo en <5 min)**: la secuencia orden terminada → total →
pago → ticket → panel queda demostrada en una sola corrida del script de API
(48 verificaciones en segundos); el único paso no ejecutable aquí es el pago con
tarjeta de sandbox de Mercado Pago por falta de credenciales del proveedor (V4).
