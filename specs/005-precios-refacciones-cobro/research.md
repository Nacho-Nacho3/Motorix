# Investigación — Sprint 5: Precios de refacciones y cobro completo

**Fecha**: 2026-11-03 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Fase 0 de `/speckit.plan`. No quedan `NEEDS CLARIFICATION` en el Contexto técnico: cada valor se verificó contra el repositorio (migraciones 001–013, `order-total.service.js`, `payments.service.js`, `tickets.service.js`, `inventory.service.js`, rutas, validadores y pruebas). Cada decisión se registra con **Decisión**, **Justificación** y **Alternativas consideradas**. Los identificadores `P-xx` son de este plan; no confundir con `D-xx` (decisiones de negocio de clarify) ni con `R-xx` (riesgos del documento de calidad).

## P-1. Instantánea de precio como columna en `order_parts`

**Decisión**: agregar `order_parts.unit_price DECIMAL(10,2) NOT NULL` y guardar ahí el precio de venta de la refacción al momento de agregarla a la orden; el total y el ticket leen esa columna en lugar de `parts.sale_price`.

**Justificación**: es la deuda real del sprint (la migración `011` no tiene columna de precio, G-01/CA-3). La línea es un evento constancia (R-06, sin DELETE), así que su precio debe ser un atributo del evento, no una referencia viva. Con la instantánea, un cambio posterior en el catálogo no toca órdenes abiertas, pagos ni tickets (SC-001, SC-002). El cálculo en centavos de `sumarTotales()` ya existe y no cambia: solo cambia la fuente del dato.

**Alternativas consideradas**:
- *Leer siempre `parts.sale_price` (estado actual)*: rechazada porque un cambio de precio reescribe retroactivamente el total de órdenes abiertas y el contenido de tickets (exactamente lo que el sprint debe evitar).
- *Tabla de historial de precios de refacciones*: rechazada por complejidad innecesaria; el historial de precios por línea ya queda en las propias filas de `order_parts` y el catálogo conserva su `updated_at`.
- *Calcular el precio al momento del cobro*: rechazada porque el ticket y el total dejarían de coincidir con lo que se vio al agregar la pieza.

## P-2. Una sola migración aditiva `014_order_parts_price.sql`

**Decisión**: la migración 014 agrega en un solo archivo: `unit_price` (con `DEFAULT 0`), `price_correction_reason`, `price_corrected_by` y `price_corrected_at`; el backfill `UPDATE order_parts JOIN parts SET unit_price = parts.sale_price` (precio vigente al migrar, D-01/D-03); los CHECK de límite `unit_price <= 99999.99` y `purchase_price/sale_price <= 99999.99` (D-08); y la FK `price_corrected_by → users(id)`.

**Justificación**: la constitución exige scripts numerados, aditivos e inmutables y la G-01 ya corrigió el insumo (H-05: la migración del sprint es la siguiente a la 013). Backfill con el precio vigente cumple D-01/D-03 en el mismo despliegue. Los CHECK refuerzan en datos lo que zod valida en entrada, siguiendo el estilo de `009` y `011`.

**Alternativas consideradas**:
- *Dos migraciones (014 precio, 015 corrección)*: rechazada por dividir en dos un cambio que se aplica y se prueba junto; una sola pasada evita una ventana con columnas a medias.
- *Editar la migración 011*: prohibido por la constitución (los scripts de sprints aplicados no se tocan).
- *Backfill con 0 y exigir captura manual*: rechazado por D-01/D-03 (precio vigente al migrar) y dejaría totales en 0.00 en órdenes existentes.

## P-3. Total y ticket cambian de fuente, no de fórmula

**Decisión**: en `calcularTotalOrden()` y en `seccionesDeTrabajo()` la consulta de refacciones pasa de `p.sale_price AS salePrice` a `op.unit_price AS salePrice`. `sumarTotales()` (función pura en centavos) no se modifica ni cambia su interfaz.

**Justificación**: un solo punto de verdad (la línea) para total, cobro y ticket (RN-10); el alias conserva la interfaz de la función pura y las pruebas unitarias de la línea base siguen pasando sin cambios (regresión intacta).

**Alternativas consideradas**:
- *Renombrar el parámetro a `unitPrice`*: rechazada: obligaría a tocar `unit/order-total.test.js` (prueba de la línea base) sin ganancia funcional.
- *Recalcular desde el catálogo en el ticket*: rechazado por P-1.

## P-4. Corrección de precio de línea: endpoint propio solo ADMIN con motivo

**Decisión**: `PATCH /api/service-orders/:id/parts/:partRowId/price` con cuerpo `{ unitPrice, reason }` (zod: precio con el mismo formato de siempre y tope; `reason` de 10 a 200 caracteres, obligatorio), `authorize("ADMIN")`, que actualiza `unit_price` y registra `price_correction_reason`, `price_corrected_by` y `price_corrected_at`. Guardas: la fila debe pertenecer a la orden (`ORDER_ITEM_NOT_FOUND`), la orden no debe estar `DELIVERED` (`ORDER_DELIVERED`) y no debe tener un pago `PAID` (`ORDER_ALREADY_PAID`). Siempre en transacción; el total queda recalculado por ser derivado.

**Justificación**: D-05 (clarify) resolvió «solo administrador, con motivo obligatorio registrado». La única mutación autorizada sobre la constancia inmutable es la del precio, y queda auditada en la misma fila (quién, cuándo, por qué). Las guardas protegen el dinero cobrado y el historial entregado (RN-9). Reutiliza códigos de error existentes: sin catálogo de errores nuevo.

**Alternativas consideradas**:
- *Permitir también a recepción*: rechazado por D-05 (opción B sobre C).
- *Tabla de auditoría aparte*: rechazada por complejidad; tres columnas en la misma fila responden «quién, cuándo, por qué» sin nuevas llaves ni joins.
- *Corregir quitando y reagregando la refacción*: imposible: `order_parts` no tiene DELETE (R-06) y perdería quién y cuándo la usó.
- *Editar desde el catálogo*: no puede: el catálogo ya no vive en la línea (P-1).

## P-5. Pago pendiente desfasado: cancelación atómica e idempotente (D-04)

**Decisión**: helper `cancelarPendienteDesfasado(orderId, total, conexion = pool)` que ejecuta `UPDATE payments SET status = 'CANCELLED' WHERE order_id = ? AND status = 'PENDING' AND amount <> ?` (una sola sentencia, sin lectura previa). Se invoca en tres puntos: `GET /api/service-orders/:id/total`, `GET /api/service-orders/:id/payments` y dentro de la transacción de `POST /api/service-orders/:id/payments`, **antes** de las reglas VN-04/VN-05. El efecto queda documentado en el contrato.

**Justificación**: cumple el escenario de US3 («al consultar la orden, el desfase se detecta y el pago se cancela») y hace que D-04 sea operable: sin este paso, `VN-05` (`PENDING_PAYMENT_EXISTS`) bloquearía el pago nuevo con el importe correcto. La máquina de estados R-04 ya permite `PENDING → CANCELLED`; la actualización `WHERE ... amount <> ?` es idempotente (segunda consulta no hace nada) y segura ante concurrencia (afecta a una fila con condición). Es cancelación local, igual que el `cancel` existente: sin llamada al proveedor y sin reembolsos.

**Alternativas consideradas**:
- *Cancelar solo al registrar el nuevo pago*: rechazado: US3 pide que la consulta lo resuelva y el usuario vería un importe desfasado hasta el momento del cobro.
- *Marcar «desfasado» sin cancelar (opción B de D-04)*: rechazado por clarify (opción A).
- *Llamar a Mercado Pago para cancelar*: rechazado: sin webhooks ni reembolsos en el MVP (Sprint 4) y el intento nunca cobró.
- *Cancelar en cada modificación que cambie el total*: rechazado: dispersaría la regla en alta de refacciones, corrección, servicios y mano de obra; los tres puntos de consulta cubren todo cambio (el total es derivado).

## P-6. Selector del mecánico: endpoint nuevo `GET /api/parts/lookup`

**Decisión**: agregar `GET /api/parts/lookup` con `authorize("MECHANIC")`, que devuelve `id, partCode, name, category, brand, stockCurrent, stockMin` **sin ningún campo de precio**, con los mismos filtros que el catálogo existente. `GET /api/parts` sigue siendo solo ADMIN. Además, `GET /api/service-orders/:id/parts` omite `unitPrice` cuando quien consulta es MECHANIC (proyección por rol).

**Justificación**: el diálogo «agregar refacción» del detalle de orden usa `PartsProvider` → `GET /api/parts`, que hoy responde 403 al mecánico: su selector queda vacío y no puede completar el flujo (hallazgo H-10, detectado en esta Fase 0). El lookup resuelve el hueco sin tocar el contrato del catálogo. FR-010/D-10 exigen que el mecánico no reciba precios en **ninguna** consulta: el lookup no los incluye y la lista de la orden los omite. El rol ADMIN conserva el catálogo completo para registrar y editar (FR-001); recepción no necesita catálogo (no agrega refacciones) y su cláusula de FR-010 (sin precio de compra) queda cumplida en todas sus consultas.

**Alternativas consideradas**:
- *Abrir `GET /api/parts` a los tres roles con proyección por rol*: rechazado: convertiría en rojo `integration/parts-catalog.test.js` y `contract/inventory.contract.test.js` de la línea base (SC-008 del Sprint 3: «los demás roles reciben 403 en GET»), exigiendo reescribir un criterio ya entregado y aprobado; el mismo efecto se logra con un endpoint nuevo sin tocar nada probado.
- *Devolver el catálogo dentro del detalle de la orden*: rechazado: mezclaría catálogo y orden en un solo recurso y obligaría a cargarlo aunque no se vaya a agregar nada.
- *Que el mecánico capture el código a mano*: rechazado: pierde la validación de existencia y stock antes del alta.

## P-7. Tope de precio en dos capas (D-08)

**Decisión**: zod valida `<= 99999.99` en `purchasePrice` y `salePrice` (create y patch) y en el precio corregido de la línea, con mensaje en español; MySQL lo refuerza con CHECK agregados en la 014 (también sobre `order_parts.unit_price`). El redondeo sigue siendo al centavo más cercano, como se resolvió en clarify (D-08): la línea es cantidad entera × precio con 2 decimales, producto exacto en centavos; `sumarTotales()` ya redondea al entero más cercano.

**Justificación**: D-08 fija el tope; validarlo en entrada da mensaje claro (FR-002) y el CHECK evita que datos sembrados o importados a mano lo superen (defensa en profundidad, estilo de los CHECK ya existentes).

**Alternativas consideradas**:
- *Solo CHECK de MySQL*: rechazado: fallaría como error 500 en lugar de un mensaje de validación en español.
- *Solo zod*: rechazado por debilidad ante escrituras directas (seeds, ajustes manuales).

## P-8. Venta menor que compra: permitir con advertencia (D-07)

**Decisión**: el backend permite `salePrice < purchasePrice` (solo aplica el CHECK `>= 0` y el tope); el formulario muestra una advertencia ámbar no bloqueante al detectarlo. Sin cambios de esquema.

**Justificación**: es el default documentado en Supuestos del spec mientras D-07 siga diferida; una pieza en liquidación o con precio especial es un caso legítimo del taller y el operador decide.

**Alternativas consideradas**:
- *Rechazar en el backend*: rechazado: cambiaría el default sin decisión de negocio y bloquearía casos válidos.
- *Permitir sin avisar*: rechazado: el usuario pidió visibilidad del caso; la advertencia es barata y no bloquea.

## P-9. Categoría y marca siguen como texto libre (D-06)

**Decisión**: sin cambios de esquema ni de validación: `category VARCHAR(50)` y `brand VARCHAR(50) NULL` como están desde la migración `009`.

**Justificación**: es el default documentado (se mantiene el comportamiento actual); D-06 sigue diferida y una lista administrable agregaría tablas, pantallas y pruebas sin necesidad demostrada.

**Alternativas consideradas**: tabla `part_categories` administrable (más superficie sin decisión de negocio) — diferida junto con D-06.

## P-10. Orden con solo refacciones es cobrable (D-02)

**Decisión**: sin cambios de código: `verificarReglasAltaPago()` ya rechaza solo cuando `total <= 0.00` y acepta cualquier total positivo, sea de donde sea.

**Justificación**: es el default documentado (D-02 diferida) y el comportamiento actual ya cumple: una orden terminada con total > 0 por refacciones es cobrable; lo que falta es la **prueba** que lo demuestre (escenario del quickstart y caso en `payments.test.js`).

**Alternativas consideradas**: marcar la orden «cobrable» con una bandera nueva — rechazada: el estado `FINISHED/DELIVERED` ya lo define y el total derivado no necesita flags.

## P-11. Seeds ampliados, idempotentes (FR-012)

**Decisión**: ampliar `server/scripts/seed.js` (ya idempotente y con refacciones con precios, H-05) para garantizar: (a) una orden `FINISHED` cobrable con refacciones (ya existe desde el Sprint 3, se verifica), (b) una orden abierta con al menos una línea de refacción con precio, para demostrar instantánea y corrección, y (c) un pago `PENDING` de Mercado Pago con importe distinto al total, para demostrar la cancelación por desfase (D-04) sin depender de credenciales. Todo con marcadores propios para que la segunda pasada no duplique.

**Justificación**: la constitución exige que cada sprint se vea con datos reales al arrancar y que los seeds sean idempotentes; el pago pendiente no puede crearse por API sin credenciales de Mercado Pago (`MERCADO_PAGO_NOT_CONFIGURED`), por eso el seed lo inserta directamente como ejemplo.

**Alternativas consideradas**: crear el escenario solo en pruebas — rechazado: el criterio CA-12 pide verlo también en la interfaz; pedir credenciales al usuario — rechazado: el MVP usa sandbox y el demo no debe depender de ellas.

## P-12. Prueba de concurrencia (H-09, CA-8)

**Decisión**: nueva `server/tests/integration/payment-concurrency.test.js` que dispara N `POST .../payments` en paralelo con `Promise.all` sobre el mismo cliente supertest y afirma exactamente 1 pago `PAID` (y, con el cliente MP simulado que ya usan las pruebas de Mercado Pago, 1 `PENDING`); además, pruebas del desfase (P-5) y de la corrección (P-4).

**Justificación**: la G-01 confirmó que no existe ninguna prueba simultánea en el proyecto (H-09) y FR-013/CA-8 la exigen; el diseño ya está protegido por el `SELECT ... FOR UPDATE` de `registrarPago`, así que la prueba demuestra la garantía sin cambiar el diseño.

**Alternativas consideradas**: simular la concurrencia con mocks del modelo — rechazado: no prueba el bloqueo real de filas de InnoDB que es justamente lo que hay que demostrar.

## P-13. Compatibilidad de pagos y tickets anteriores (CA-6)

**Decisión**: no se altera ningún dato existente: la 014 solo agrega columnas y el backfill copia el precio que el ticket ya mostraba; `payments` y `tickets` no se modifican. La prueba congela el JSON de un ticket y de sus pagos, cambia todos los precios del catálogo y verifica cero diferencias (SC-002), además de reejecutar la suite completa (SC-006).

**Justificación**: los tickets no almacenan contenido (se calculan, RN-10); con la instantánea, el cálculo deja de moverse cuando cambia el catálogo, que era justo el riesgo R-01.

**Alternativas consideradas**: congelar el ticket en una columna JSON — rechazado: contradice RN-10 y duplicaría información que ya se puede derivar.

## P-14. Frontend sin dependencias nuevas

**Decisión**: `order_part.dart` agrega `unitPrice` y los campos de corrección como **nulos** (el mecánico no los recibe: si vienen, se muestran); `parts_provider.dart` agrega `cargarLookup()`; `part_form_screen.dart` valida el tope en cliente y muestra la advertencia ámbar; `order_detail_screen.dart` muestra el precio de línea para los roles que lo reciben y el botón «Corregir precio» solo para ADMIN con diálogo de motivo obligatorio (reutiliza `confirm_dialog` y tokens de `docs/design-system.md`).

**Justificación**: la validación del cliente es solo espejo (el backend es la autoridad, Principio IV); los campos nulos permiten que el mismo widget sirva a los tres roles sin ramas por pantalla; sin librerías nuevas (Principio VIII).

**Alternativas consideradas**: pantalla independiente de corrección — rechazada: es un ajuste de dos campos sobre la línea existente; el diálogo mantiene el contexto de la orden.
