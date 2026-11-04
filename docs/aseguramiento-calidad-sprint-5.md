# Aseguramiento de la calidad - Sprint 5: Precios de refacciones y cobro completo

Este documento es el registro de calidad del Sprint 5 de Motorix. Reúne las puertas de calidad, las decisiones, los riesgos, la trazabilidad de los criterios de aceptación, los hallazgos, la regresión de los sprints 1 a 4 y el control de calidad final, con sus evidencias.

**Estado: en elaboración (proceso Spec Kit en curso).** Se ejecutaron la G-01 (revisión del insumo contra el código, 2026-11-02), la G-02 (`/speckit.specify`), la G-03 (`/speckit.clarify`), la G-04 (`/speckit.checklist`), la G-05 (`/speckit.plan`), la G-06 (`/speckit.tasks`) y la G-07 (`/speckit.analyze`), del 2 al 3 de noviembre; falta la implementación de las 52 tareas y el cierre del documento. Según `docs/aseguramiento-calidad/guia-aseguramiento-calidad.md`, este documento se llena **durante** el sprint: las secciones que dependen de la implementación quedan marcadas como no ejecutadas y se completan al avanzar. Por eso todavía no se declara resultado general ni aprobación.

## 0. Datos del documento

| Campo | Valor |
|---|---|
| Sprint | 5 - Precios de refacciones y cobro completo |
| Insumo | `docs/sprints/sprint-5-precios-refacciones-cobro.md` (commit `0f8d3da`) |
| Especificación | `specs/005-precios-refacciones-cobro/spec.md` (G-02, commit `959268b`) |
| Rama (planeada) | `005-precios-refacciones-cobro` desde `main` (aún no creada; se crea al iniciar la implementación) |
| Responsable | Ignacio Joaquín Trejo (proyecto escolar: él mismo aprueba el cierre) |
| Fecha de inicio | 2026-11-02 |
| Fecha de cierre | Se llena al cerrar el sprint |
| Estado general | En elaboración - proceso Spec Kit en curso (G-01 a G-07 completadas) |

## 1. Objetivo y alcance

**Objetivo.** Asegurar que el Sprint 5 salga con calidad: que los requisitos estén completos, sean medibles y no se contradigan, que las pruebas estén planeadas antes del código y que el cambio no rompa lo construido en los sprints 1 a 4.

**Dentro del alcance:** categoría, marca y precios de las refacciones; guardado del precio vigente en la línea de la orden (instantánea); total de la orden con refacciones; pago y ticket con el nuevo total; conservación de pagos y tickets ya emitidos; visibilidad del precio de compra por rol.

**Fuera del alcance:** lo que la sección 8 del insumo lista (costeo, impuestos, descuentos, reembolsos, catálogo de proveedores, notificaciones, reportes, WhatsApp y puesta en producción).

## 2. Criterios de entrada y de salida

Estado real al 2026-11-03. Los criterios se completan a lo largo del sprint; `[x]` solo cuando de verdad se cumplió.

**Criterios de entrada (para comenzar la implementación):**

- [x] Las 8 puertas de la sección 3 tienen estado final (G-01 a G-07 realizadas y G-08 aprobada con observación; ninguna pendiente).
- [x] Si el sprint contradice un principio de la constitución, la enmienda está aprobada y registrada (hallazgo H-01): enmienda **1.1.0** en `.specify/memory/constitution.md` (líneas 36, 48 y 84 ampliadas al quinto sprint, con reporte de impacto en el encabezado), aprobada por el responsable con delegación del 2026-11-03, commit `ef56cc7`.
- [x] Las 10 decisiones de la sección 4 tienen estado final registrado (6 resueltas en la sesión de clarify del 2026-11-03; D-02, D-06, D-07 y D-09 cerradas como diferidas con default documentado en `spec.md`).
- [x] No hay hallazgos críticos, altos ni medios abiertos en el análisis de consistencia (G-07: 0/0/0 tras los commits `f44a180` y `ef56cc7`; 2 bajos aceptados sin impacto: A1 y F3).
- [x] Cada criterio de aceptación tuvo al menos una prueba planeada (sección 6).
- [x] La línea base de regresión está registrada (sección 8).
- [x] La documentación desfasada de los sprints anteriores está identificada (G-01: hallazgo H-08).

**Criterios de salida (para cerrar el sprint):**

- [ ] Los 14 criterios de aceptación están Aprobados.
- [ ] Todas las pruebas de los sprints 1 a 4 siguen pasando.
- [ ] No hay defectos críticos ni altos abiertos (sección 7).
- [ ] La matriz de calidad final (sección 9) está completa, con evidencia.
- [ ] Reporte, análisis y matriz no se contradicen.

## 3. Puertas de calidad

G-01 se ejecutó el 2026-11-02 (revisión del insumo contra el código real); G-02 (`/speckit.specify`), G-03 (`/speckit.clarify`), G-04 (`/speckit.checklist`) y G-05 (`/speckit.plan`) el 2026-11-03, al igual que G-06 (`/speckit.tasks`) y G-07 (`/speckit.analyze`); todas las puertas de Spec Kit quedaron ejecutadas y restan las de implementación y cierre.

| ID | Puerta | Estado | Evidencia |
|:--:|---|---|---|
| G-01 | Insumo del sprint revisado contra el código | Aprobado con observación | Revisión del 2026-11-02 contra `order-total.service.js`, migraciones `009`/`011`, `validators/parts.js`, `payments.service.js`, `tickets.service.js` y `parts.routes.js`: 9 hallazgos H-01 a H-09 (sección 7) |
| G-02 | Especificación (`/speckit.specify`) | Realizada (2026-11-03) | `specs/005-precios-refacciones-cobro/spec.md` (5 historias, 14 FR, 8 SC) y `checklists/requirements.md` (17/17 ítems); commit `959268b`; corrige los hallazgos H-02 a H-05 |
| G-03 | Aclaraciones (`/speckit.clarify`) | Realizada con observación (2026-11-03) | 5 preguntas → 6 decisiones resueltas (D-01/D-03, D-04, D-05, D-08, D-10) en `spec.md` (`### Session 2026-11-03`), commit `86d29bc`; 4 diferidas por bajo impacto (D-02, D-06, D-07, D-09) con defaults en Supuestos |
| G-04 | Lista de calidad de requisitos (`/speckit.checklist`) | Realizada (2026-11-03) | `specs/005-precios-refacciones-cobro/checklists/precios-cobro.md`: 38 ítems de calidad de requisitos, **38 cumplidos** (evaluación asistida y autorizada por el revisor, anotada en las notas del archivo); `checklists/requirements.md` sigue en 17/17; commit `d06a00e` |
| G-05 | Plan (`/speckit.plan`) | Realizada (2026-11-03) | `specs/005-precios-refacciones-cobro/`: `plan.md` (contexto técnico verificado; constitución con la puerta I en enmienda pendiente, H-01), `research.md` (14 decisiones P-01 a P-14), `data-model.md` (migración `014` con backfill y CHECK de tope), `contracts/` (order-parts, parts-catalog, payments) y `quickstart.md` (V1 a V10); commit `971aacf`; detecta el hallazgo H-10 |
| G-06 | Tareas (`/speckit.tasks`) | Realizada (2026-11-03) | `specs/005-precios-refacciones-cobro/tasks.md`: **52 tareas** en 8 fases (Preparación, Fundacional, US1-US5, Pulido), con las pruebas antes del código en cada historia por exigirlo FR-013; trazabilidad CA→tarea→prueba completada en la sección 6 (CA-1 a CA-14); commit `12e5ce8` |
| G-07 | Consistencia (`/speckit.analyze`) | Realizada (2026-11-03) | Análisis solo lectura de `spec.md`, `plan.md` y `tasks.md`: cobertura 14/14 FR y 8/8 SC, sin marcadores de plantilla; hallazgos D1 crítico (constitución), B1/C1/F1 medios y A1/B2/F2/F3 bajos; correcciones al spec en commit `f44a180` y enmienda 1.1.0 en commit `ef56cc7`; reanálisis: **0 críticos, 0 altos, 0 medios** (2 bajos aceptados sin impacto: A1 y F3); criterio cumplido |
| G-08 | Pruebas planeadas y línea base | Aprobado con observación | Línea base medida el 2026-11-02 (sección 8); las pruebas están planeadas por CA y por tarea (sección 6 y `tasks.md`), todavía sin crear |

## 4. Decisiones de aclaración

Las 10 decisiones del insumo (sección 9, líneas 93 a 102) se trabajaron en la sesión de `/speckit.clarify` del 2026-11-03 (G-03): **6 resueltas** con su respuesta registrada en `### Session 2026-11-03` del `spec.md` (commit `86d29bc`) y **4 diferidas** por bajo impacto (D-02, D-06, D-07, D-09), con defaults documentados en Supuestos. Nada se asume sin registrar.

| ID | Decisión (resumen del insumo) | Estado |
|:--:|---|---|
| D-01 | Refacciones existentes o líneas sin precio: asignar 0, exigir precio o bloquearlas | Resuelta (2026-11-03): precio vigente al migrar |
| D-02 | Orden con solo refacciones: si es cobrable (el insumo la llama `NOTHING_TO_CHARGE`; ver H-04) | Abierta |
| D-03 | Órdenes abiertas al desplegar: precio vigente al migrar o 0 | Resuelta (2026-11-03): precio vigente al migrar (misma que D-01) |
| D-04 | Pago de Mercado Pago pendiente cuando cambia el total: cancelar, actualizar o marcar desfasado | Resuelta (2026-11-03): cancelar el pendiente y generar uno nuevo |
| D-05 | Corrección del precio de una línea en una orden abierta: si se permite y con qué motivo o permiso | Resuelta (2026-11-03): solo administrador, con motivo obligatorio |
| D-06 | Categoría: lista cerrada administrable o texto libre; marca: texto libre | Abierta |
| D-07 | Precio de venta menor al de compra: permitir, advertir o rechazar | Abierta |
| D-08 | Redondeo del importe de una línea y límites máximos de precio y de total | Resuelta (2026-11-03): precio máximo $99,999.99; redondeo al centavo más cercano |
| D-09 | Cómo conviven los tickets anteriores (sin precios) con los nuevos | Abierta |
| D-10 | Visibilidad del precio de venta para el mecánico | Resuelta (2026-11-03): el mecánico no ve precios |

## 5. Riesgos y mitigaciones

Riesgos identificados antes de implementar, con la prueba que los cubrirá. Los estados se pasarán a **Mitigado** cuando la prueba exista y pase; hoy todos están **Abierto** con su mitigación planeada.

| ID | Riesgo | Impacto | Mitigación | Prueba que lo cubre | Estado |
|:--:|---|---|---|---|---|
| R-01 | Al pasar a precio guardado, el cambio altera órdenes abiertas o documentos ya emitidos | Alto: importes incorrectos en el historial | Guardar el precio en la línea de uso (migración aditiva siguiente a la 013); no tocar `payments` ni `tickets.content` existentes | Por crear: instantánea y compatibilidad (CA-3, CA-6) | Abierto |
| R-02 | Las líneas ya registradas no tienen precio y al migrar quedan en 0 o desfases | Medio: totales incorrectos en órdenes existentes | Resolver D-01 y D-03 antes de migrar datos | Por crear (CA-3) | Abierto |
| R-03 | Se rompe el pago único vigente (VN-04/VN-05) al tocar total y cobro | Alto: doble cobro | Mantener la transacción con `SELECT ... FOR UPDATE` de `payments.service.js` | Existente: `integration/payments.test.js` (segundo pago 400 y importe distinto 400); simultaneidad por crear (H-09) | Abierto |
| R-04 | Un pago pendiente de Mercado Pago queda con importe distinto al total | Medio | Resolver D-04 y señalar el importe desfasado | Existente parcial: `integration/payments-mp.test.js`; desfasado por crear (CA-9) | Abierto |
| R-05 | El precio de compra llega a recepción o al mecánico al agregar importes a las vistas | Alto: fuga de información financiera | Mantener el catálogo solo ADMIN (`parts.routes.js`, líneas 13 a 18), proyección sin precios en el lookup nuevo del mecánico y en la lista de refacciones de la orden (FR-010) | Existente parcial: `integration/parts-catalog.test.js` (403 de otros roles); prueba de fuga por crear (CA-10, H-10) | Abierto |
| R-06 | Precios sin límite máximo y errores de redondeo en el importe de una línea | Medio | Definir límites en el validador (D-08) y conservar el cálculo en centavos | Existente: `unit/order-total.test.js`; límites por crear (CA-2) | Abierto |
| R-07 | El panel de control o los listados fallan con el nuevo total | Medio | Regresión de dashboard y listados al cierre | Existente: `integration/dashboard.test.js` y contratos; regresión al cierre (CA-11) | Abierto |
| R-08 | La documentación vuelve a quedar desfasada (como `active` en la entidad Part) | Bajo: contradicciones | Actualizar `project-context.md` y `design-system.md` dentro del sprint (CA-14), empezando por H-08 | Revisión documental (sin prueba automática) | Abierto |
| R-09 | La CA-8 da por hechas pruebas de concurrencia que hoy no existen | Medio: falsa sensación de cobertura | Crear la prueba de cobros simultáneos desde el inicio (H-09) | Por crear (CA-8) | Abierto |
| R-10 | El selector de refacciones del mecánico sigue sin funcionar si el lookup no se implementa o no se prueba (H-10) | Medio: US5 no demostrable de extremo a extremo | Implementar `GET /api/parts/lookup` sin campos de precio (`research.md` P-6) y probarlo en backend y en la interfaz | Por crear: `integration/parts-catalog.test.js` (lookup) y `client/test/order_detail_test.dart` (selector con opciones y sin precios) | Abierto |

## 6. Trazabilidad

Cada criterio de aceptación (CA) se enlaza con su requisito, su tarea (`tasks.md`, G-06, commit `12e5ce8`) y su prueba. Los requisitos funcionales (FR) ya existen en `specs/005-precios-refacciones-cobro/spec.md` (G-02, commit `959268b`); «existente» señala una prueba que ya pasó en la línea base de la sección 8 y «por crear» la que se creará en la tarea indicada. El resultado se llena cuando la prueba corra durante la implementación.

| CA | Criterio de aceptación (resumen) | Requisito (FR) | Tarea | Prueba | Resultado | Evidencia |
|:--:|---|---|---|---|---|---|
| CA-1 | Refacción con categoría, marca y precios persistida | FR-001 | T012 | Existente: `integration/parts-catalog.test.js` (alta 201 y PATCH), verificado al ejecutar US1 | Sin ejecutar | G-01/H-03: ya se cumple en lo esencial desde el Sprint 3 |
| CA-2 | Precios rechazan negativos, no numéricos y más de 2 decimales; con límites máximos | FR-002 | T007, T009, T010, T011 | Por crear: `integration/parts-catalog.test.js` con tope (T007), `contract/inventory.contract.test.js` (T008) y `client/test/parts_form_test.dart` (T009); existente: negativos y 3 decimales | Sin ejecutar | G-01/H-03 + D-08: tope de $99,999.99 |
| CA-3 | El precio vigente se guarda al agregar la refacción a la orden | FR-003 | T004, T006, T013, T016 | Por crear: `integration/order-parts.test.js` (guardado del precio y `unit_price` de las filas existentes, T013) y `contract/order-parts.contract.test.js` (T014) | Sin ejecutar | Hueco real confirmado en G-01: migración `011` sin columna de precio; se cierra con la `014` |
| CA-4 | Total = servicios + mano de obra + refacciones, en centavos | FR-004 | T015, T017 | Existente: `unit/order-total.test.js` (suma y redondeo); se amplía con precios de refacciones (T015) y `integration/order-parts.test.js` (total y `partsSubtotal`, T013) | Sin ejecutar | G-01/H-02: la suma ya existe; el cambio es la fuente (precio guardado) |
| CA-5 | El pago se registra por el total con refacciones; importe distinto se rechaza | FR-005 | T019, T027 | Existente: `integration/payments.test.js` (importe exacto y mismatch 400); se amplía con el total de refacciones y la orden solo con refacciones (T019) | Sin ejecutar | La fórmula del total ya incluye refacciones (G-01/H-02) |
| CA-6 | Pagos y tickets anteriores conservan importe y contenido | FR-006 | T004, T006, T029 | Por crear: `integration/historical-compat.test.js` (T029); backfill verificado en T006 y en los escenarios V1 y V10 del `quickstart.md` | Sin ejecutar | R-01 y R-02 |
| CA-7 | El ticket nuevo detalla refacciones con cantidad, precio e importe | FR-007 | T022, T026, T028 | Existente parcial: `integration/tickets.test.js` (contenido completo); se amplía al precio guardado (T022) y se verifica en `client/test/ticket_screen_test.dart` (T028) | Sin ejecutar | G-01/H-06: el ticket ya incluye refacciones con precio vivo; ahora con precio guardado |
| CA-8 | Un solo pago vigente, también con solicitudes simultáneas; sin datos de tarjeta | FR-008 | T021, T049 | Existente: `integration/payments.test.js` (segundo pago); **nueva** `integration/payment-concurrency.test.js` con `Promise.all` (T021) | Sin ejecutar | G-01/H-09: no existe ninguna prueba simultánea hoy |
| CA-9 | Mercado Pago recibe el importe correcto; pago pendiente desfasado se resuelve | FR-009 | T020, T023, T024, T025 | Existente parcial: `integration/payments-mp.test.js`; por crear: desfase en `integration/payments.test.js` (T020) y `contract/payments.contract.test.js` (T023) | Sin ejecutar | D-04 resuelta: se cancela y se genera uno nuevo |
| CA-10 | El precio de compra solo lo ve el administrador | FR-010 | T038, T039, T040, T041 | Existente: `integration/parts-catalog.test.js` e `inventory.contract.test.js` (403); por crear: lookup sin precios (T038/T039) y lista de la orden sin `unitPrice` para el mecánico | Sin ejecutar | G-01/H-07; G-05/H-10: el selector del mecánico necesita el lookup |
| CA-11 | Dashboard y listados funcionan con el nuevo total | FR-011 | T048, T049, T050 | Existente: `integration/dashboard.test.js`, `integration/service-orders.test.js` y `integration/payments.test.js` (regresión, T048) | Sin ejecutar | R-07 |
| CA-12 | Seeds con precios y una orden cobrable con refacciones, idempotentes | FR-012 | T045, T046 | Existente parcial: `server/scripts/seed.js` (refacciones con precios); por crear: orden cobrable con refacciones, pago pendiente de ejemplo y doble ejecución sin duplicados (T046) | Sin ejecutar | G-01: el seed ya incluye precios; verificar orden cobrable con refacciones |
| CA-13 | Pruebas de total, instantáneas, redondeo, permisos, concurrencia y compatibilidad | FR-013 | T007 a T044 (pruebas de cada historia), T049, T050 | Todas las anteriores, más la regresión completa de backend (T049) y de frontend (T050) | Sin ejecutar | CA-1 a CA-12 |
| CA-14 | `docs/project-context.md`, `docs/design-system.md` y los comentarios que dicen que las refacciones no suman importe se actualizan en el mismo sprint | FR-014 | T047 | Revisión documental (sin prueba automática) | Sin ejecutar | H-08: campo `active` inexistente y comentarios desactualizados |

## 7. Hallazgos y defectos

Se registra todo lo que se encuentre, sea en los documentos, en el análisis o en las pruebas. Los hallazgos H-01 a H-09 provienen de la G-01 (revisión del insumo contra el código) y de la constitución; H-10 lo detectó la G-05 (plan). No hay defectos de implementación porque el código aún no cambió. **Seis hallazgos quedaron resueltos al escribir la especificación (G-02, commit `959268b`); permanecen abiertos H-01 (enmienda de la constitución), H-08 (documentación, tarea CA-14), H-09 (prueba de concurrencia, tarea CA-8) y H-10 (selector del mecánico, con el diseño de corrección en `research.md` P-6, commit `971aacf`).**

| ID | Descripción | Severidad | Origen | Estado | Resolución | Evidencia |
|:--:|---|---|---|---|---|---|
| H-01 | La constitución limita el proyecto a cuatro sprints y el Sprint 5 es posterior al MVP: se necesita enmienda aprobada antes de implementar | Media | G-01 (constitución) | Resuelto | Enmienda **1.1.0** registrada: líneas 36, 48 y 84 ampliadas al quinto sprint con reporte de impacto, aprobada por el responsable con delegación del 2026-11-03; criterio de entrada cumplido | `.specify/memory/constitution.md`, commits `ef56cc7` y `f44a180` |
| H-02 | El insumo afirma «hoy el total es solo servicios más mano de obra y las refacciones no suman»: es falso, ya suman | Media | G-01 | Resuelto | Corregido en la especificación: los requisitos parten de que el total ya suma refacciones y la deuda real es la instantánea (Supuestos del `spec.md`) | `server/services/order-total.service.js`, líneas 45 a 57 y 86 a 92; `unit/order-total.test.js`, línea 8; corrección en commit `959268b` |
| H-03 | El insumo afirma que el Sprint 3 difirió categoría, marca y precios: ya existen | Media | G-01 | Resuelto | Corregido en la especificación: FR-001 y FR-002 se enfocan en límites y reglas sobre lo ya existente (Supuestos del `spec.md`) | Migración `009`, líneas 10 a 23; `validators/parts.js`, líneas 7 y 52 a 69; `seed.js`, líneas 124 a 178; corrección en commit `959268b` |
| H-04 | El insumo menciona el código `NOTHING_TO_CHARGE`, que no existe; el rechazo real es un `VALIDATION_ERROR` con otro mensaje | Baja | G-01 | Resuelto | Corregido en la especificación: el Supuesto describe el rechazo real y D-02 queda en Clarificaciones | `server/services/payments.service.js`, líneas 81 a 87; corrección en commit `959268b` |
| H-05 | El insumo pide la migración `005_...sql` y «crear» seeds: el repositorio ya tiene migraciones `001` a `013` y `server/scripts/seed.js` existe | Media | G-01 | Resuelto | Corregido en la especificación: migración siguiente a la 013 y ampliación del seed existente (Supuestos del `spec.md`) | `database/migrations/` (13 archivos); `server/scripts/seed.js`; corrección en commit `959268b` |
| H-06 | La CA-7 (ticket con refacciones, precio e importe) ya se cumple hoy | Baja | G-01 | Resuelto | Registrado en la especificación: FR-007 pide el ticket con precio guardado y el Supuesto documenta que ya se detalla con precio vivo | `server/services/tickets.service.js`, líneas 103 a 110 y 154; commit `959268b` |
| H-07 | La CA-10 ya se cumple hoy en lo esencial: el catálogo es solo ADMIN y el detalle de orden no trae precios | Baja | G-01 | Resuelto | Registrado en la especificación: FR-010 y US5 sostienen la proyección por rol al agregar importes | `server/routes/parts.routes.js`, líneas 13 a 18; `server/models/order_part.model.js`, líneas 9 a 12; commit `959268b` |
| H-08 | `docs/project-context.md` documenta un campo `active` en la entidad Part que no existe en la tabla (y el spec prohíbe el borrado lógico) | Baja | G-01 | Abierto | Corregirlo en CA-14 dentro del sprint (FR-014) | `docs/project-context.md`, línea 678; migración `009` sin esa columna |
| H-09 | La CA-8 asume que el Sprint 4 ya cubre «solicitudes simultáneas», pero no existe ninguna prueba de concurrencia en `server/tests/` | Media | G-01 | Abierto | Crear la prueba de cobros simultáneos desde el inicio del sprint (R-09, FR-013) | Búsqueda de `Promise.all`, `concurrenc` y `concurrent` sin resultados en `server/tests/` |
| H-10 | El diálogo «agregar refacción» del mecánico no puede cargar el catálogo: `GET /api/parts` es solo ADMIN y responde 403, así que su selector queda vacío y US5 no sería demostrable de extremo a extremo | Media | G-05 (plan) | Abierto | Diseñado en `research.md` P-6 y `contracts/parts-catalog.md` (commit `971aacf`): endpoint nuevo `GET /api/parts/lookup`, solo MECHANIC y sin campos de precio, manteniendo el catálogo solo ADMIN; se cierra al implementar US5 | `server/routes/parts.routes.js`, líneas 13 a 18; `client/lib/screens/orders/order_detail_screen.dart`, líneas 71 a 72 y 419 |

## 8. Línea base de regresión

Se ejecuta la suite completa **antes** de tocar el código y de nuevo **al cierre**. Ninguna prueba de los sprints 1 a 4 debe pasar de verde a rojo.

| Suite | Comando | Antes del sprint 5 | Después del sprint 5 | Diferencia | Evidencia |
|---|---|---|---|---|---|
| Backend (Jest) | `npm.cmd test` en `server/` | 49 suites y 390 pruebas aprobadas, 0 fallidas (46.8 s) | Se llena al cierre | Se llena al cierre | Captura C-01 |
| Frontend (Flutter) | `flutter test` en `client/` | 120 pruebas aprobadas ("All tests passed!"), 0 fallidas | Se llena al cierre | Se llena al cierre | Captura C-02 |
| Análisis estático | `flutter analyze lib` en `client/` | "No issues found!" | Se llena al cierre | Se llena al cierre | Captura C-03 |

**Fecha de la línea base:** 2026-11-02, sobre el commit `fe587b5` de la rama `main`, antes de crear la rama `005-precios-refacciones-cobro`. Las suites corren contra la base `motorix_test` (configuración de pruebas); los datos de demostración de `motorix` no se tocaron.

**Capturas de la línea base (2026-11-02), en `docs/evidencias/sprint-5/`:**

- `captura-linea-base-backend.png` (C-01): terminal con `Test Suites: 49 passed` y `Tests: 390 passed`.
- `captura-linea-base-frontend.png` (C-02): terminal con `+120: All tests passed!`.
- `captura-linea-base-analyze.png` (C-03): terminal con `No issues found!`.

Al cierre se agregan `captura-regresion-backend.png` (C-09) y `captura-regresion-frontend.png` (C-10), y se completan las columnas «Después» y «Diferencia».

**Fecha del cierre:** se llena al cerrar el sprint, sobre la rama `005-precios-refacciones-cobro`. Se anotarán aquí las pruebas que deban actualizarse por cambios de contrato declarados, con su hallazgo.

## 9. Control de calidad final

Cinco requisitos funcionales del Sprint 5, elegidos entre los que más pueden fallar (instantánea de precio, compatibilidad con lo ya emitido, permisos por rol, concurrencia del pago y redondeo con límites), con el mismo formato de la matriz de calidad del MVP. Se ejecutarán al cierre; hoy queda el estado real.

| ID | Requisito | Criterio de Aceptación | Prueba ejecutada | Resultado | Evidencia / defecto |
|:--:|---|---|---|---|---|
| RF-01 | `spec.md` FR-003 y FR-004 (insumo CA-3 y CA-4, líneas 68 y 69): al agregar una refacción a una orden se guarda su precio de venta vigente, los cambios posteriores no modifican la línea y el total usa ese precio guardado en centavos. | Un cambio posterior de precio no altera la línea, su importe ni el total; la suma sigue siendo exacta a 2 decimales. | Backend (Jest + supertest): por crear `orderParts.prices.test.js` (alta, cambio de precio y verificación de línea y total). | Por ejecutar | [Requisito](#e-01-requisito) · [Prueba](#e-01-prueba) · [Resultado](#e-01-resultado). Sin ejecutar todavía. |
| RF-02 | `spec.md` FR-006 y FR-007 (insumo CA-6 y CA-7, líneas 71 y 72): los pagos y tickets anteriores conservan importe y contenido, y el ticket nuevo detalla las refacciones con cantidad, precio unitario e importe. | Un ticket anterior se devuelve idéntico al guardado; uno nuevo trae las refacciones y sus importes; cambiar precios no altera lo ya emitido. | Backend (Jest + supertest): por crear `emitted.compat.test.js`; existe parcial `tickets.test.js`. | Por ejecutar | [Requisito](#e-02-requisito) · [Prueba](#e-02-prueba) · [Resultado](#e-02-resultado). Sin ejecutar todavía. |
| RF-03 | `spec.md` FR-010 (insumo CA-10, línea 75): el precio de compra solo es visible para el administrador; recepción y mecánico no lo reciben en las consultas del sistema. | Recorrido de las rutas de consulta con cada rol buscando la clave y el valor del precio de compra: solo el administrador los recibe. | Backend (Jest + supertest): por crear `prices.leak.test.js`; existe parcial `parts-catalog.test.js` (403 de otros roles). | Por ejecutar | [Requisito](#e-03-requisito) · [Prueba](#e-03-prueba) · [Resultado](#e-03-resultado). Sin ejecutar todavía. |
| RF-04 | `spec.md` FR-008 (insumo CA-8, línea 73): un solo pago vigente por orden, también con solicitudes simultáneas, y ningún dato de tarjeta almacenado. | Varios cobros al mismo tiempo sobre una orden dejan un solo pago PAID y el resto responde error; la tabla no tiene columnas de tarjeta. | Backend (Jest + supertest): existente `payments.test.js` (segundo pago e importe distinto) y por crear la prueba de concurrencia (H-09). | Por ejecutar | [Requisito](#e-04-requisito) · [Prueba](#e-04-prueba) · [Resultado](#e-04-resultado). Sin ejecutar todavía. |
| RF-05 | `spec.md` FR-002 y FR-004 (insumo CA-2 y CA-4, líneas 67 y 69): los precios rechazan valores negativos, no numéricos, con más de 2 decimales y fuera de los límites máximos; el total se calcula en centavos enteros. | Un precio inválido responde 400 con mensaje claro; los importes salen siempre con 2 decimales y las sumas cuadran sin errores de coma flotante. | Backend (Jest): existente `unit/order-total.test.js` (centavos y redondeo) y `parts-catalog.test.js` (negativos y decimales); por crear los casos de límite máximo (D-08). | Por ejecutar | [Requisito](#e-05-requisito) · [Prueba](#e-05-prueba) · [Resultado](#e-05-resultado). Sin ejecutar todavía. |

## 10. Cierre

Se completa al cerrar el sprint.

| Campo | Valor |
|---|---|
| Criterios de salida cumplidos | 0 de 5: el sprint aún no tiene implementación |
| Defectos abiertos | Sin defectos de implementación. 3 hallazgos abiertos (H-01, H-08, H-09); 6 resueltos en la especificación (H-02 a H-07, commit `959268b`) |
| Observaciones | Línea base medida el 2026-11-02: 49 suites y 390 pruebas de backend, 120 de frontend y análisis estático limpio, todas en verde. Especificación creada el 2026-11-03 (`specs/005-precios-refacciones-cobro/spec.md`): 5 historias, 14 requisitos funcionales y 8 criterios de éxito, con checklist 17/17. 10 decisiones de aclaración abiertas. La constitución exige una enmienda (H-01) antes de implementar |
| Aprobado por | Lo aprueba Ignacio Joaquín Trejo al cierre del sprint |
| Fecha | Se llena al cierre |

# Anexo de evidencias

Cada evidencia tiene tres bloques: **Requisito** (cita del `spec.md` y del insumo con archivo y línea), **Prueba** (descripción de la prueba existente o planeada) y **Resultado** (comando, salida real y captura). Las capturas están en `docs/evidencias/sprint-5/`.

## E-01 Requisito

Especificación: `specs/005-precios-refacciones-cobro/spec.md`, **FR-003** (instantánea) y **FR-004** (total con precio guardado), historia US2.

Insumo: `docs/sprints/sprint-5-precios-refacciones-cobro.md`, líneas 68 y 69.

> **CA-3**: Al agregar una refacción a una orden se guarda su precio de venta vigente; un cambio posterior de precio no modifica esa línea.
>
> **CA-4**: El total de la orden es servicios más mano de obra más refacciones (cantidad por precio guardado), calculado en centavos enteros.

## E-01 Prueba

Archivo por crear: `server/tests/integration/orderParts.prices.test.js` (se planeará en `/speckit.tasks`).

La prueba agregará una refacción con precio de venta A a una orden, el administrador cambiará después el precio a B, y verificará que la línea conserve el precio A, que su importe y el total de la orden no cambien y que el total siga saliendo con 2 decimales. Hoy el hueco está confirmado: la migración `011` no guarda precio y el total usa el precio vivo (`order-total.service.js`, líneas 86 a 92).

Fragmento: se escribirá con la prueba y se documentará aquí con su salida real.

## E-01 Resultado

Comando previsto: `npm.cmd test -- tests/integration/orderParts.prices.test.js`

Estado: **Por ejecutar** (la implementación no ha comenzado).

## E-02 Requisito

Especificación: `specs/005-precios-refacciones-cobro/spec.md`, **FR-006** (compatibilidad) y **FR-007** (ticket nuevo), historias US4 y US3.

Insumo: `docs/sprints/sprint-5-precios-refacciones-cobro.md`, líneas 71 y 72.

> **CA-6**: Los pagos y tickets generados antes del sprint conservan su importe y su contenido sin cambios, y siguen consultándose y mostrándose correctamente.
>
> **CA-7**: El ticket nuevo incluye cantidad, precio unitario e importe de cada refacción, y el subtotal y el total las suman.

## E-02 Prueba

Archivo por crear: `server/tests/integration/emitted.compat.test.js` (se planeará en `/speckit.tasks`). Existe la prueba parcial `server/tests/integration/tickets.test.js` («devuelve el contenido completo calculado del comprobante», línea 212), que ya pasó en la línea base.

La prueba fotografiará los pagos y tickets existentes, cambiará todos los precios de las refacciones y comprobará que nada de lo emitido cambie; además pedirá un ticket anterior y uno nuevo y verificará que el anterior vuelva idéntico al guardado.

Fragmento: se escribirá con la prueba y se documentará aquí con su salida real.

## E-02 Resultado

Comando previsto: `npm.cmd test -- tests/integration/emitted.compat.test.js`

Estado: **Por ejecutar** (la implementación no ha comenzado).

## E-03 Requisito

Especificación: `specs/005-precios-refacciones-cobro/spec.md`, **FR-010** (precio de compra solo admin), historia US5.

Insumo: `docs/sprints/sprint-5-precios-refacciones-cobro.md`, línea 75.

> **CA-10**: El precio de compra solo es visible para el administrador; el mecánico y recepción no lo reciben en la API, validado en backend.

## E-03 Prueba

Archivo por crear: `server/tests/integration/prices.leak.test.js` (se planeará en `/speckit.tasks`). Existen las pruebas parciales `server/tests/integration/parts-catalog.test.js` («MECHANIC y RECEPTIONIST reciben 403 en GET, POST y PATCH», línea 304) y `server/tests/contract/inventory.contract.test.js` (línea 172), que ya pasaron en la línea base.

La prueba recorrerá las rutas de consulta con cada rol, buscando en las respuestas la clave `purchasePrice` y su valor; solo el administrador debe recibirlos. Hoy el catálogo es solo ADMIN, así que la prueba debe extenderse a las nuevas respuestas que agregue el sprint (totales, líneas y tickets).

Fragmento: se escribirá con la prueba y se documentará aquí con su salida real.

## E-03 Resultado

Comando previsto: `npm.cmd test -- tests/integration/prices.leak.test.js`

Estado: **Por ejecutar** (la implementación no ha comenzado).

## E-04 Requisito

Especificación: `specs/005-precios-refacciones-cobro/spec.md`, **FR-008** (un solo pago vigente, simultáneo, sin datos de tarjeta), historia US3.

Insumo: `docs/sprints/sprint-5-precios-refacciones-cobro.md`, línea 73.

> **CA-8**: Se mantienen las reglas del Sprint 4: un solo pago vigente por orden, también con solicitudes simultáneas, y ningún dato de tarjeta almacenado.

## E-04 Prueba

Archivos: existente `server/tests/integration/payments.test.js` («un segundo pago sobre la misma orden responde 400 ORDER_ALREADY_PAID», línea 249, y «un importe distinto del total responde 400 PAYMENT_AMOUNT_MISMATCH», línea 265) y la prueba de concurrencia **por crear** (H-09): varios cobros enviados al mismo tiempo sobre la misma orden, comprobando que solo uno queda vigente.

También se verifica que la tabla `payments` no tenga columnas de tarjeta (migración `012`, RN-14).

Fragmento: la parte simultánea se escribirá con la prueba y se documentará aquí con su salida real.

## E-04 Resultado

Comando previsto: `npm.cmd test -- tests/integration/payments.test.js` (la parte existente ya pasó en la línea base).

Estado: **Por ejecutar** (falta la prueba de simultaneidad).

## E-05 Requisito

Especificación: `specs/005-precios-refacciones-cobro/spec.md`, **FR-002** (precios con límite máximo) y **FR-004** (centavos), historias US1 y US2.

Insumo: `docs/sprints/sprint-5-precios-refacciones-cobro.md`, líneas 67 y 69.

> **CA-2**: Los precios rechazan valores negativos, no numéricos y con más de dos decimales; se definen los límites máximos.
>
> **CA-4**: El total de la orden es servicios más mano de obra más refacciones (cantidad por precio guardado), calculado en centavos enteros.

## E-05 Prueba

Archivos existentes: `server/tests/unit/order-total.test.js` y `server/tests/integration/parts-catalog.test.js` («precios, stock o stock mínimo negativos → 400 VALIDATION_ERROR», línea 142, con `-1.00` y `420.999`). Ambos ya pasaron en la línea base. Falta crear la prueba de límite máximo (D-08).

Fragmento clave (ya existente):

```js
// server/tests/unit/order-total.test.js, líneas 8 a 24
test("suma servicios, mano de obra y refacciones con precio vigente", () => {
  const totales = sumarTotales({
    servicios: [{ unitPrice: "850.00" }, { unitPrice: "150.50" }],
    manoDeObra: [
      { hours: "2.00", hourlyRate: "300.00" },
      { hours: "1.50", hourlyRate: "200.00" },
    ],
    refacciones: [
      { quantity: 2, salePrice: "850.00" },
      { quantity: 1, salePrice: "120.25" },
    ],
  });

  expect(totales.partsSubtotal).toBe("1820.25");
  expect(totales.total).toBe("3720.75");
});
```

## E-05 Resultado

Comando previsto: `npm.cmd test -- tests/unit/order-total.test.js tests/integration/parts-catalog.test.js` (la parte existente ya pasó en la línea base; los casos de límite máximo están por crear).

Estado: **Por ejecutar** (faltan los límites máximos).

## E-06 Recorrido de los escenarios contra la API real

Se ejecutará cuando `/speckit.plan` y `/speckit.tasks` generen el `quickstart.md` del sprint, contra la API real con la base `motorix_test` (sembrada con los seeds del sprint) para no gastar los datos de demostración de `motorix`, con un guion por HTTP que ejecute cada escenario y su resultado. Aquí se anotará la fecha, el comando y la tabla de escenarios.

Estado: **Por ejecutar**.

# Guía de capturas de pantalla

Capturas en `docs/evidencias/sprint-5/` (crear la carpeta al tomar la primera). Los nombres van en minúsculas y con guiones.

| ID | Archivo | Qué debe verse | Cómo se obtiene | Cuándo |
|---|---|---|---|---|
| C-01 | `captura-linea-base-backend.png` | Terminal con `Test Suites: 49 passed, 49 total` y `Tests: 390 passed, 390 total` | PowerShell en `server\`: `npm.cmd test` (≈50 s) | Ahora |
| C-02 | `captura-linea-base-frontend.png` | Terminal con `+120: All tests passed!` | PowerShell en `client\`: `flutter test` (≈45 s) | Ahora |
| C-03 | `captura-linea-base-analyze.png` | Terminal con `No issues found!` | PowerShell en `client\`: `flutter analyze lib` | Ahora |
| C-04 | `captura-rf-01-instantanea-precio.png` | Detalle de una orden con la línea de refacción conservando su precio tras cambiar el precio en el catálogo | App (`client\lib\screens\orders\order_detail_screen.dart`): el admin cambia el precio, recepción reabre la orden | Al cierre (RF-01) |
| C-05 | `captura-rf-02-ticket-anterior-y-nuevo.png` | Un ticket anterior y uno nuevo en el mismo listado | App (`client\lib\screens\tickets\ticket_screen.dart`) | Al cierre (RF-02) |
| C-06 | `captura-rf-03-precio-compra-oculto.png` | Terminal de la prueba de fuga de precios o la respuesta de la consulta al mecánico sin precios | `npm.cmd test -- tests/integration/prices.leak.test.js` | Al cierre (RF-03) |
| C-07 | `captura-rf-04-pago-unico-concurrencia.png` | Terminal con la prueba de cobros simultáneos: un éxito y el resto rechazado | `npm.cmd test -- tests/integration/payments.concurrency.test.js` (nombre por confirmar en tasks) | Al cierre (RF-04) |
| C-08 | `captura-rf-05-limites-precio.png` | Terminal con la prueba de límites y redondeo, o la respuesta 400 a un precio fuera de límite | `npm.cmd test -- <prueba de límites>` | Al cierre (RF-05) |
| C-09 | `captura-regresion-backend.png` | Suite completa al cierre con los conteos nuevos | `npm.cmd test` en `server\` | Al cierre |
| C-10 | `captura-regresion-frontend.png` | `flutter test` al cierre con los conteos nuevos | `flutter test` en `client\` | Al cierre |
| C-11 | `captura-escenarios-api.png` | Resultado del recorrido de los escenarios del `quickstart.md` (tabla o terminal) | Guion HTTP contra la API con `motorix_test` | Cuando exista el quickstart (E-06) |
| C-12 | `captura-tiempos-<nombre-del-criterio>.png` | Cronómetro del criterio de éxito medible que defina el spec, con la pantalla de inicio y la final | Medido por Ignacio en la app con los datos de ejemplo | Al cierre |

Notas para tomar las capturas:

- Para las capturas de la app (C-04, C-05 y C-12) hace falta MySQL (`MySQL96`) y el backend (`npm.cmd start` en `server\`); la app es el ejecutable en `client\build\windows\x64\runner\Debug\motorix_client.exe`.
- Los datos de demostración se gastan al hacer el recorrido (una orden cobrada no se cobra otra vez): avísame antes y puedo resembrar `motorix` o crear datos nuevos.
- **Verifica cada captura antes de enlazarla**: ábrela, confirma que muestra lo que dice la tabla y compara los hash (`Get-FileHash`) para detectar imágenes idénticas con nombres distintos.
- Los tiempos de uso (C-12) son mediciones tuyas con cronómetro; nunca se registran estimaciones como si fueran mediciones.
- Cuando el documento se cierre, las capturas C-01 a C-03 de la sección 8 se enlazan como imágenes (`![...](evidencias/sprint-5/...png)`).

---

*Documento en elaboración · Sprint 5 de Motorix · Inicio: 2026-11-02 · Línea base sobre el commit `fe587b5` · G-02: especificación en el commit `959268b` (2026-11-03).*
