# Aseguramiento de la calidad - Sprint 5: Precios de refacciones y cobro completo

Este documento es el registro de calidad del Sprint 5 de Motorix. Reúne las puertas de calidad, las decisiones, los riesgos, la trazabilidad de los criterios de aceptación, los hallazgos, la regresión de los sprints 1 a 4 y el control de calidad final, con sus evidencias.

**Estado: cierre técnico completo (2026-11-03); pendiente la aprobación del responsable.** Se ejecutaron todas las puertas del ciclo (G-01 a G-08) y las 52 tareas de la implementación en la rama `005-precios-refacciones-cobro` (T001–T052, sin squash ni force-push): la regresión completa cerró en verde (backend 51 suites / 423 pruebas; frontend 128 pruebas y `flutter analyze` sin observaciones), los 14 criterios de aceptación quedaron Aprobados con su evidencia en `docs/evidencias/sprint-5/`, y el recorrido de escenarios V1–V10 cumplió 52 de 52 casos. Según `docs/aseguramiento-calidad/guia-aseguramiento-calidad.md`, este documento se llenó **durante** el sprint y se completa al cierre; lo que falta es externo al código: la aprobación final de Ignacio Joaquín Trejo y sus capturas C-04, C-05 y C-12, que la guía le asignan a él.

## 0. Datos del documento

| Campo | Valor |
|---|---|
| Sprint | 5 - Precios de refacciones y cobro completo |
| Insumo | `docs/sprints/sprint-5-precios-refacciones-cobro.md` (commit `0f8d3da`) |
| Especificación | `specs/005-precios-refacciones-cobro/spec.md` (G-02, commit `959268b`) |
| Rama | `005-precios-refacciones-cobro` desde `main` (creada para la implementación; todo el proceso, de la migración al cierre, quedó en la rama: commits `9b529f9`, `1d122fa`, `ed92116`, `526eb45`, `291c962`, `9d1e215`, `b203d30`, `cce4fe4` y los commits de cierre) |
| Responsable | Ignacio Joaquín Trejo (proyecto escolar: él mismo aprueba el cierre) |
| Fecha de inicio | 2026-11-02 |
| Fecha de cierre | 2026-11-03 (cierre técnico; la aprobación del responsable se anota al recibir sus capturas C-04, C-05 y C-12) |
| Estado general | Cierre técnico completo - pendiente de aprobación por el responsable y de las capturas C-04, C-05 y C-12 |

## 1. Objetivo y alcance

**Objetivo.** Asegurar que el Sprint 5 salga con calidad: que los requisitos estén completos, sean medibles y no se contradigan, que las pruebas estén planeadas antes del código y que el cambio no rompa lo construido en los sprints 1 a 4.

**Dentro del alcance:** categoría, marca y precios de las refacciones; guardado del precio vigente en la línea de la orden (instantánea); total de la orden con refacciones; pago y ticket con el nuevo total; conservación de pagos y tickets ya emitidos; visibilidad del precio de compra por rol.

**Fuera del alcance:** lo que la sección 8 del insumo lista (costeo, impuestos, descuentos, reembolsos, catálogo de proveedores, notificaciones, reportes, WhatsApp y puesta en producción).

## 2. Criterios de entrada y de salida

Estado real al 2026-11-03. Los criterios se completan a lo largo del sprint; `[x]` solo cuando de verdad se cumplió.

**Criterios de entrada (para comenzar la implementación):**

- [x] Las 8 puertas de la sección 3 tienen estado final (al inicio: G-01 a G-07 realizadas y G-08 aprobada con observación; al cierre: G-08 sin observaciones, sección 3; ninguna pendiente).
- [x] Si el sprint contradice un principio de la constitución, la enmienda está aprobada y registrada (hallazgo H-01): enmienda **1.1.0** en `.specify/memory/constitution.md` (líneas 36, 48 y 84 ampliadas al quinto sprint, con reporte de impacto en el encabezado), aprobada por el responsable con delegación del 2026-11-03, commit `ef56cc7`.
- [x] Las 10 decisiones de la sección 4 tienen estado final registrado (6 resueltas en la sesión de clarify del 2026-11-03; D-02, D-06, D-07 y D-09 cerradas como diferidas con default documentado en `spec.md`).
- [x] No hay hallazgos críticos, altos ni medios abiertos en el análisis de consistencia (G-07: 0/0/0 tras los commits `f44a180` y `ef56cc7`; 2 bajos aceptados sin impacto: A1 y F3).
- [x] Cada criterio de aceptación tuvo al menos una prueba planeada (sección 6).
- [x] La línea base de regresión está registrada (sección 8).
- [x] La documentación desfasada de los sprints anteriores está identificada (G-01: hallazgo H-08).

**Criterios de salida (para cerrar el sprint), cumplidos el 2026-11-03:**

- [x] Los 14 criterios de aceptación están Aprobados (sección 6, con evidencia en `docs/evidencias/sprint-5/`).
- [x] Todas las pruebas de los sprints 1 a 4 siguen pasando (regresión al cierre: backend 51 suites / 423 pruebas y frontend 128 pruebas, sin ninguna en rojo; sección 8).
- [x] No hay defectos críticos ni altos abiertos (sección 7: los 10 hallazgos H-01 a H-10 están resueltos y la regresión no detectó defectos de implementación).
- [x] La matriz de calidad final (sección 9) está completa, con evidencia (RF-01 a RF-05 Aprobados, enlazados con sus corridas).
- [x] Reporte, análisis y matriz no se contradicen (G-07 con 0 críticos / 0 altos / 0 medios y secciones 6, 8 y 9 conciladas al cierre).

## 3. Puertas de calidad

G-01 se ejecutó el 2026-11-02 (revisión del insumo contra el código real); G-02 (`/speckit.specify`), G-03 (`/speckit.clarify`), G-04 (`/speckit.checklist`) y G-05 (`/speckit.plan`) el 2026-11-03, al igual que G-06 (`/speckit.tasks`) y G-07 (`/speckit.analyze`); la G-08 quedó aprobada al cierre, tras crear las pruebas y medir la regresión completa.

| ID | Puerta | Estado | Evidencia |
|:--:|---|---|---|
| G-01 | Insumo del sprint revisado contra el código | Aprobado con observación | Revisión del 2026-11-02 contra `order-total.service.js`, migraciones `009`/`011`, `validators/parts.js`, `payments.service.js`, `tickets.service.js` y `parts.routes.js`: 9 hallazgos H-01 a H-09 (sección 7) |
| G-02 | Especificación (`/speckit.specify`) | Realizada (2026-11-03) | `specs/005-precios-refacciones-cobro/spec.md` (5 historias, 14 FR, 8 SC) y `checklists/requirements.md` (17/17 ítems); commit `959268b`; corrige los hallazgos H-02 a H-05 |
| G-03 | Aclaraciones (`/speckit.clarify`) | Realizada con observación (2026-11-03) | 5 preguntas → 6 decisiones resueltas (D-01/D-03, D-04, D-05, D-08, D-10) en `spec.md` (`### Session 2026-11-03`), commit `86d29bc`; 4 diferidas por bajo impacto (D-02, D-06, D-07, D-09) con defaults en Supuestos |
| G-04 | Lista de calidad de requisitos (`/speckit.checklist`) | Realizada (2026-11-03) | `specs/005-precios-refacciones-cobro/checklists/precios-cobro.md`: 38 ítems de calidad de requisitos, **38 cumplidos** (evaluación asistida y autorizada por el revisor, anotada en las notas del archivo); `checklists/requirements.md` sigue en 17/17; commit `d06a00e` |
| G-05 | Plan (`/speckit.plan`) | Realizada (2026-11-03) | `specs/005-precios-refacciones-cobro/`: `plan.md` (contexto técnico verificado; constitución con la puerta I en enmienda pendiente, H-01), `research.md` (14 decisiones P-01 a P-14), `data-model.md` (migración `014` con backfill y CHECK de tope), `contracts/` (order-parts, parts-catalog, payments) y `quickstart.md` (V1 a V10); commit `971aacf`; detecta el hallazgo H-10 |
| G-06 | Tareas (`/speckit.tasks`) | Realizada (2026-11-03) | `specs/005-precios-refacciones-cobro/tasks.md`: **52 tareas** en 8 fases (Preparación, Fundacional, US1-US5, Pulido), con las pruebas antes del código en cada historia por exigirlo FR-013; trazabilidad CA→tarea→prueba completada en la sección 6 (CA-1 a CA-14); commit `12e5ce8` |
| G-07 | Consistencia (`/speckit.analyze`) | Realizada (2026-11-03) | Análisis solo lectura de `spec.md`, `plan.md` y `tasks.md`: cobertura 14/14 FR y 8/8 SC, sin marcadores de plantilla; hallazgos D1 crítico (constitución), B1/C1/F1 medios y A1/B2/F2/F3 bajos; correcciones al spec en commit `f44a180` y enmienda 1.1.0 en commit `ef56cc7`; reanálisis: **0 críticos, 0 altos, 0 medios** (2 bajos aceptados sin impacto: A1 y F3); criterio cumplido |
| G-08 | Pruebas planeadas y línea base | Aprobado (2026-11-03) | Línea base medida el 2026-11-02 (49 suites / 390 pruebas, 120 de Flutter, análisis limpio) y regresión de cierre en verde (51/423 y 128; sección 8); las pruebas planeadas por CA y por tarea existen en `server/tests/` y `client/test/` (sección 6 y `tasks.md`) |

## 4. Decisiones de aclaración

Las 10 decisiones del insumo (sección 9, líneas 93 a 102) se trabajaron en la sesión de `/speckit.clarify` del 2026-11-03 (G-03): **6 resueltas** con su respuesta registrada en `### Session 2026-11-03` del `spec.md` (commit `86d29bc`) y **4 diferidas** por bajo impacto (D-02, D-06, D-07, D-09), con defaults documentados en Supuestos. Nada se asume sin registrar.

| ID | Decisión (resumen del insumo) | Estado |
|:--:|---|---|
| D-01 | Refacciones existentes o líneas sin precio: asignar 0, exigir precio o bloquearlas | Resuelta (2026-11-03): precio vigente al migrar |
| D-02 | Orden con solo refacciones: si es cobrable (el insumo la llama `NOTHING_TO_CHARGE`; ver H-04) | Diferida (2026-11-03): default documentado en Supuestos del `spec.md`; verificada al implementar (V7 del recorrido: sí es cobrable, D-02) |
| D-03 | Órdenes abiertas al desplegar: precio vigente al migrar o 0 | Resuelta (2026-11-03): precio vigente al migrar (misma que D-01) |
| D-04 | Pago de Mercado Pago pendiente cuando cambia el total: cancelar, actualizar o marcar desfasado | Resuelta (2026-11-03): cancelar el pendiente y generar uno nuevo |
| D-05 | Corrección del precio de una línea en una orden abierta: si se permite y con qué motivo o permiso | Resuelta (2026-11-03): solo administrador, con motivo obligatorio |
| D-06 | Categoría: lista cerrada administrable o texto libre; marca: texto libre | Diferida (2026-11-03): default documentado en Supuestos del `spec.md` |
| D-07 | Precio de venta menor al de compra: permitir, advertir o rechazar | Diferida (2026-11-03): default documentado en Supuestos del `spec.md`; verificada al implementar (V5: se guarda con advertencia) |
| D-08 | Redondeo del importe de una línea y límites máximos de precio y de total | Resuelta (2026-11-03): precio máximo $99,999.99; redondeo al centavo más cercano |
| D-09 | Cómo conviven los tickets anteriores (sin precios) con los nuevos | Diferida (2026-11-03): default documentado en Supuestos del `spec.md`; verificada al implementar (`integration/historical-compat.test.js`) |
| D-10 | Visibilidad del precio de venta para el mecánico | Resuelta (2026-11-03): el mecánico no ve precios |

## 5. Riesgos y mitigaciones

Riesgos identificados antes de implementar, con la prueba que los cubre. Los 10 quedaron en **Mitigado** al cierre (2026-11-03): cada riesgo tiene su prueba ejecutada y en verde, con su evidencia en `docs/evidencias/sprint-5/` (corrida focalizada, regresión de cierre o recorrido de escenarios V1–V10).

| ID | Riesgo | Impacto | Mitigación | Prueba que lo cubre | Estado |
|:--:|---|---|---|---|---|
| R-01 | Al pasar a precio guardado, el cambio altera órdenes abiertas o documentos ya emitidos | Alto: importes incorrectos en el historial | Guardar el precio en la línea de uso (migración `014`, aditiva a la `013`); no se tocaron `payments` ni `tickets.content` existentes | Creada: `integration/order-parts.test.js` + `integration/historical-compat.test.js` (CA-3, CA-6); en verde en la corrida focalizada (11/114) y en la regresión (51/423) | **Mitigado** |
| R-02 | Las líneas ya registradas no tienen precio y al migrar quedan en 0 o desfases | Medio: totales incorrectos en órdenes existentes | Resolver D-01 y D-03 antes de migrar datos (precio vigente al migrar) | Creada: backfill verificado en `integration/order-parts.test.js` y en los V1 del recorrido (0 líneas con precio nulo y 0 con precio ajeno al catálogo) | **Mitigado** |
| R-03 | Se rompe el pago único vigente (VN-04/VN-05) al tocar total y cobro | Alto: doble cobro | Mantener la transacción con `SELECT ... FOR UPDATE` de `payments.service.js` | Existente: `integration/payments.test.js` (segundo pago 400 e importe distinto 400); nueva simultaneidad: `integration/payment-concurrency.test.js` (H-09 resuelto) | **Mitigado** |
| R-04 | Un pago pendiente de Mercado Pago queda con importe distinto al total | Medio | Resolver D-04 y señalar el importe desfasado | Existente: `integration/payments-mp.test.js`; desfase cubierto en `integration/payments.test.js` y en los V8 del recorrido (CANCELLED → 409 → cobro con importe correcto) | **Mitigado** |
| R-05 | El precio de compra llega a recepción o al mecánico al agregar importes a las vistas | Alto: fuga de información financiera | Mantener el catálogo solo ADMIN (`parts.routes.js`, líneas 13 a 18), proyección sin precios en el lookup del mecánico y en la lista de refacciones de la orden (FR-010) | Existente: `integration/parts-catalog.test.js` (403 de otros roles y lookup sin precios); proyección en `integration/order-parts.test.js`; verificado también en los V6 del recorrido (7 elementos del lookup, 0 con precios) | **Mitigado** |
| R-06 | Precios sin límite máximo y errores de redondeo en el importe de una línea | Medio | Definir límites en el validador (D-08) y conservar el cálculo en centavos | Existente: `unit/order-total.test.js` (centavos y redondeo); límites creados en `integration/parts-catalog.test.js` (tope `99,999.99`, negativos y 3 decimales) y `contract/inventory.contract.test.js`; verificado en los V5 | **Mitigado** |
| R-07 | El panel de control o los listados fallan con el nuevo total | Medio | Regresión de dashboard y listados al cierre | Existente: `integration/dashboard.test.js` y contratos; regresión completa al cierre en verde: 51 suites / 423 pruebas (CA-11) | **Mitigado** |
| R-08 | La documentación vuelve a quedar desfasada (como `active` en la entidad Part) | Bajo: contradicciones | Actualizar `project-context.md` y `design-system.md` dentro del sprint (CA-14), empezando por H-08 | Revisión documental cumplida en T047: `project-context.md` sin el campo `active` (con nota H-08) y con la sección de reglas de precios; `design-system.md` sin cambios de token | **Mitigado** |
| R-09 | La CA-8 da por hechas pruebas de concurrencia que hoy no existen | Medio: falsa sensación de cobertura | Crear la prueba de cobros simultáneos desde el inicio (H-09) | Creada: `integration/payment-concurrency.test.js` con `Promise.all` (T021), en verde (CA-8; H-09 resuelto) | **Mitigado** |
| R-10 | El selector de refacciones del mecánico sigue sin funcionar si el lookup no se implementa o no se prueba (H-10) | Medio: US5 no demostrable de extremo a extremo | Implementar `GET /api/parts/lookup` sin campos de precio (`research.md` P-6) y probarlo en backend y en la interfaz | Creada y verde: `integration/parts-catalog.test.js` (describe «US5 - Lookup del mecánico sin precios») y `client/test/order_detail_test.dart` («el selector del mecánico carga el lookup y no muestra precios») | **Mitigado** |

## 6. Trazabilidad

Cada criterio de aceptación (CA) se enlaza con su requisito, su tarea (`tasks.md`, G-06, commit `12e5ce8`) y su prueba. Los requisitos funcionales (FR) están en `specs/005-precios-refacciones-cobro/spec.md` (G-02, commit `959268b`). Los resultados se registraron al cierre (2026-11-03) después de ejecutar las pruebas: corrida focalizada de 11 suites / 114 pruebas, regresión completa de 51 suites / 423 pruebas, frontend con 128 pruebas y recorrido de escenarios V1–V10 con 52/52 casos, todo en `docs/evidencias/sprint-5/`.

| CA | Criterio de aceptación (resumen) | Requisito (FR) | Tarea | Prueba | Resultado | Evidencia |
|:--:|---|---|---|---|---|---|
| CA-1 | Refacción con categoría, marca y precios persistida | FR-001 | T012 | Existente: `integration/parts-catalog.test.js` (alta 201 y PATCH de precios) | **Aprobado** | G-01/H-03 · corrida focalizada en `docs/evidencias/sprint-5/corrida-focalizada-rf.md` |
| CA-2 | Precios rechazan negativos, no numéricos y más de 2 decimales; con límites máximos | FR-002 | T007, T009, T010, T011 | Creadas: `integration/parts-catalog.test.js` (tope `99,999.99`, negativos y 3 decimales), `contract/inventory.contract.test.js` y `client/test/parts_form_test.dart` (tope rechazado en cliente); existentes: negativos y 3 decimales | **Aprobado** | G-01/H-03 + D-08 · corrida focalizada y Flutter (`corrida-focalizada-rf.md`, `regresion-cierre-2026-11-03.md`) |
| CA-3 | El precio vigente se guarda al agregar la refacción a la orden | FR-003 | T004, T006, T013, T016 | Creadas: `integration/order-parts.test.js` («la línea guarda el precio vigente y el total no cambia si cambia el catálogo» y «ninguna línea queda sin precio tras la 014») y `contract/order-parts.contract.test.js` | **Aprobado** | Hueco de G-01 cerrado con la migración `014` · corrida focalizada y V1/V3 del recorrido (`escenarios-api-e06.md`) |
| CA-4 | Total = servicios + mano de obra + refacciones, en centavos | FR-004 | T015, T017 | Existente ampliada: `unit/order-total.test.js` («los precios de refacciones se suman en centavos exactos con 2 decimales») y `integration/order-parts.test.js` (total y `partsSubtotal`) | **Aprobado** | G-01/H-02 · corrida focalizada y V4 del recorrido (Σ de subtotales = total, diferencia 0.00) |
| CA-5 | El pago se registra por el total con refacciones; importe distinto se rechaza | FR-005 | T019, T027 | Existente ampliada: `integration/payments.test.js` (importe exacto, mismatch 400 y «una orden terminada solo con refacciones y total > 0.00 sí es cobrable (D-02)») | **Aprobado** | La fórmula del total ya incluye refacciones (G-01/H-02) · corrida focalizada y V7 del recorrido |
| CA-6 | Pagos y tickets anteriores conservan importe y contenido | FR-006 | T004, T006, T029 | Creada: `integration/historical-compat.test.js` (T029); backfill verificado en `integration/order-parts.test.js` y en los escenarios V1 y V10 del recorrido | **Aprobado** | R-01 y R-02 · corrida focalizada (`corrida-focalizada-rf.md`) y V1/V10 (`escenarios-api-e06.md`) |
| CA-7 | El ticket nuevo detalla refacciones con cantidad, precio e importe | FR-007 | T022, T026, T028 | Existente ampliada: `integration/tickets.test.js` y `contract/tickets.contract.test.js`; `client/test/ticket_screen_test.dart` verifica «la línea de refacción muestra el precio guardado (unitPrice)» | **Aprobado** | G-01/H-06 · corrida focalizada y Flutter (128 pruebas) |
| CA-8 | Un solo pago vigente, también con solicitudes simultáneas; sin datos de tarjeta | FR-008 | T021, T049 | Creada: `integration/payment-concurrency.test.js` con `Promise.all` (T021); existente: `integration/payments.test.js` (segundo pago 400) | **Aprobado** | H-09 resuelto · corrida focalizada y V9 del recorrido |
| CA-9 | Mercado Pago recibe el importe correcto; pago pendiente desfasado se resuelve | FR-009 | T020, T023, T024, T025 | Existente: `integration/payments-mp.test.js`; creadas: D-04 en `integration/payments.test.js` (cancela el desfasado, 409 al coincidente y PAID intactos) y `contract/payments.contract.test.js` | **Aprobado** | D-04 · corrida focalizada y V8 del recorrido |
| CA-10 | El precio de compra solo lo ve el administrador | FR-010 | T038, T039, T040, T041 | Existente: `integration/parts-catalog.test.js` (403 y lookup «sin precios») y `contract/inventory.contract.test.js`; creadas: proyección en `integration/order-parts.test.js` («mecánico sin unitPrice, recepción con unitPrice sin corrección y admin con ambos») y `client/test/order_detail_test.dart` (selector con lookup) | **Aprobado** | G-01/H-07 y H-10 · corrida focalizada, V6 del recorrido y Flutter |
| CA-11 | Dashboard y listados funcionan con el nuevo total | FR-011 | T048, T049, T050 | Existente: `integration/dashboard.test.js`, `integration/service-orders.test.js` e `integration/payments.test.js` (regresión de T048 y completa de T049) | **Aprobado** | R-07 · `docs/evidencias/sprint-5/regresion-cierre-2026-11-03.md` (51 suites / 423 pruebas) |
| CA-12 | Seeds con precios y una orden cobrable con refacciones, idempotentes | FR-012 | T045, T046 | Creadas: escenarios de precios en `server/scripts/seed.js` (T045) y doble ejecución sobre base limpia sin duplicados (T046), verificada también en los V2 | **Aprobado** | `docs/evidencias/sprint-5/seeds-idempotentes-t046.md` |
| CA-13 | Pruebas de total, instantáneas, redondeo, permisos, concurrencia y compatibilidad | FR-013 | T007 a T044 (pruebas de cada historia), T049, T050 | Todas las anteriores, más la regresión completa de backend (T049) y de frontend (T050) | **Aprobado** | `docs/evidencias/sprint-5/regresion-cierre-2026-11-03.md`: 51/423 de backend, 128 de Flutter y `flutter analyze` limpio |
| CA-14 | `docs/project-context.md`, `docs/design-system.md` y los comentarios que dicen que las refacciones no suman importe se actualizan en el mismo sprint | FR-014 | T047 | Revisión documental (sin prueba automática): `project-context.md` sin el campo `active` (con nota H-08) y con la sección «Reglas de precios (Sprint 5)»; `design-system.md` sin cambios de token | **Aprobado** | H-08 resuelto · commit `cce4fe4` |

## 7. Hallazgos y defectos

Se registra todo lo que se encuentre, sea en los documentos, en el análisis o en las pruebas. Los hallazgos H-01 a H-09 provienen de la G-01 (revisión del insumo contra el código) y de la constitución; H-10 lo detectó la G-05 (plan). **Los 10 hallazgos están resueltos al cierre (2026-11-03): seis al escribir la especificación (G-02, commit `959268b`), H-01 con la enmienda 1.1.0 (commit `ef56cc7`), H-08 con la actualización documental de T047 (commit `cce4fe4`), H-09 con la prueba de concurrencia creada en T021 y H-10 con el lookup del mecánico implementado y probado al cerrar US5 (commit `b203d30`).** No se detectaron defectos de implementación: la regresión de cierre cerró con 51 suites / 423 pruebas de backend y 128 pruebas de Flutter en verde, y el recorrido de escenarios cumplió 52 de 52 casos.

| ID | Descripción | Severidad | Origen | Estado | Resolución | Evidencia |
|:--:|---|---|---|---|---|---|
| H-01 | La constitución limita el proyecto a cuatro sprints y el Sprint 5 es posterior al MVP: se necesita enmienda aprobada antes de implementar | Media | G-01 (constitución) | Resuelto | Enmienda **1.1.0** registrada: líneas 36, 48 y 84 ampliadas al quinto sprint con reporte de impacto, aprobada por el responsable con delegación del 2026-11-03; criterio de entrada cumplido | `.specify/memory/constitution.md`, commits `ef56cc7` y `f44a180` |
| H-02 | El insumo afirma «hoy el total es solo servicios más mano de obra y las refacciones no suman»: es falso, ya suman | Media | G-01 | Resuelto | Corregido en la especificación: los requisitos parten de que el total ya suma refacciones y la deuda real es la instantánea (Supuestos del `spec.md`) | `server/services/order-total.service.js`, líneas 45 a 57 y 86 a 92; `unit/order-total.test.js`, línea 8; corrección en commit `959268b` |
| H-03 | El insumo afirma que el Sprint 3 difirió categoría, marca y precios: ya existen | Media | G-01 | Resuelto | Corregido en la especificación: FR-001 y FR-002 se enfocan en límites y reglas sobre lo ya existente (Supuestos del `spec.md`) | Migración `009`, líneas 10 a 23; `validators/parts.js`, líneas 7 y 52 a 69; `seed.js`, líneas 124 a 178; corrección en commit `959268b` |
| H-04 | El insumo menciona el código `NOTHING_TO_CHARGE`, que no existe; el rechazo real es un `VALIDATION_ERROR` con otro mensaje | Baja | G-01 | Resuelto | Corregido en la especificación: el Supuesto describe el rechazo real y D-02 queda en Clarificaciones | `server/services/payments.service.js`, líneas 81 a 87; corrección en commit `959268b` |
| H-05 | El insumo pide la migración `005_...sql` y «crear» seeds: el repositorio ya tiene migraciones `001` a `013` y `server/scripts/seed.js` existe | Media | G-01 | Resuelto | Corregido en la especificación: migración siguiente a la 013 y ampliación del seed existente (Supuestos del `spec.md`) | `database/migrations/` (13 archivos); `server/scripts/seed.js`; corrección en commit `959268b` |
| H-06 | La CA-7 (ticket con refacciones, precio e importe) ya se cumple hoy | Baja | G-01 | Resuelto | Registrado en la especificación: FR-007 pide el ticket con precio guardado y el Supuesto documenta que ya se detalla con precio vivo | `server/services/tickets.service.js`, líneas 103 a 110 y 154; commit `959268b` |
| H-07 | La CA-10 ya se cumple hoy en lo esencial: el catálogo es solo ADMIN y el detalle de orden no trae precios | Baja | G-01 | Resuelto | Registrado en la especificación: FR-010 y US5 sostienen la proyección por rol al agregar importes | `server/routes/parts.routes.js`, líneas 13 a 18; `server/models/order_part.model.js`, líneas 9 a 12; commit `959268b` |
| H-08 | `docs/project-context.md` documenta un campo `active` en la entidad Part que no existe en la tabla (y el spec prohíbe el borrado lógico) | Baja | G-01 | Resuelto | Actualizado en T047 (CA-14): el campo `active` se eliminó de la entidad Part con una nota que explica el hallazgo, y la sección 6.7 documenta «Reglas de precios (Sprint 5)» | `docs/project-context.md` (T047), commit `cce4fe4`; migración `009` sin esa columna |
| H-09 | La CA-8 asume que el Sprint 4 ya cubre «solicitudes simultáneas», pero no existe ninguna prueba de concurrencia en `server/tests/` | Media | G-01 | Resuelto | Creada `server/tests/integration/payment-concurrency.test.js` con `Promise.all` (T021): cobros simultáneos que dejan un solo pago vigente; verde en la corrida focalizada y citada en los V9 del recorrido | `server/tests/integration/payment-concurrency.test.js`; corrida focalizada de 11 suites / 114 pruebas |
| H-10 | El diálogo «agregar refacción» del mecánico no puede cargar el catálogo: `GET /api/parts` es solo ADMIN y responde 403, así que su selector queda vacío y US5 no sería demostrable de extremo a extremo | Media | G-05 (plan) | Resuelto | Implementado al cerrar US5: `GET /api/parts/lookup` solo MECHANIC y sin campos de precio, manteniendo el catálogo solo ADMIN; probado en `integration/parts-catalog.test.js` (describe «US5 - Lookup del mecánico sin precios») y en `client/test/order_detail_test.dart` («el selector del mecánico carga el lookup y no muestra precios»); verificado en los V6 (7 elementos, 0 con precios) | Commits `971aacf` (diseño en `research.md` P-6) y `b203d30` (implementación); corrida focalizada y `docs/evidencias/sprint-5/escenarios-api-e06.md` |

## 8. Línea base de regresión

Se ejecuta la suite completa **antes** de tocar el código y de nuevo **al cierre**. Ninguna prueba de los sprints 1 a 4 debe pasar de verde a rojo.

| Suite | Comando | Antes del sprint 5 | Después del sprint 5 | Diferencia | Evidencia |
|---|---|---|---|---|---|
| Backend (Jest) | `npm.cmd test` en `server/` | 49 suites y 390 pruebas aprobadas, 0 fallidas (46.8 s) | 51 suites y 423 pruebas aprobadas, 0 fallidas (39.2 s) | +2 suites y +33 pruebas (las creadas en el Sprint 5); ninguna prueba en rojo | `evidencias/sprint-5/linea-base-2026-11-02.md` (C-01) · `evidencias/sprint-5/regresion-cierre-2026-11-03.md` (C-09) |
| Frontend (Flutter) | `flutter test` en `client/` | 120 pruebas aprobadas ("All tests passed!"), 0 fallidas | 128 pruebas aprobadas ("All tests passed!"), 0 fallidas | +8 pruebas; ninguna en rojo | `evidencias/sprint-5/linea-base-2026-11-02.md` (C-02) · `evidencias/sprint-5/regresion-cierre-2026-11-03.md` (C-10) |
| Análisis estático | `flutter analyze lib` en `client/` | "No issues found!" | "No issues found!" (4.7 s) | Sin diferencia | `evidencias/sprint-5/linea-base-2026-11-02.md` (C-03) · `evidencias/sprint-5/regresion-cierre-2026-11-03.md` |

**Fecha de la línea base:** 2026-11-02, sobre el commit `fe587b5` de la rama `main`, antes de crear la rama `005-precios-refacciones-cobro`. Las suites corren contra la base `motorix_test` (configuración de pruebas); los datos de demostración de `motorix` no se tocaron.

**Evidencias de la línea base (2026-11-02), en `docs/evidencias/sprint-5/` (transcripciones markdown, siguiendo el patrón de `docs/evidencias/2026-10-18-suite-backend.md`; no se tomaron PNG):**

- `linea-base-2026-11-02.md` (C-01, C-02 y C-03): conteos de backend (49 suites / 390 pruebas), frontend (120 pruebas) y análisis estático sin observaciones.

Al cierre se agregó `regresion-cierre-2026-11-03.md` (C-09 y C-10) y se completaron las columnas «Después» y «Diferencia» de la tabla.

**Fecha del cierre:** 2026-11-03, sobre la rama `005-precios-refacciones-cobro`. Ninguna prueba quedó desactualizada por cambios de contrato declarados: los contratos ampliados en el sprint (`order-parts`, `inventory`/`parts-catalog` y `payments`) se actualizaron junto con su código y la regresión completa cerró en verde.

## 9. Control de calidad final

Cinco requisitos funcionales del Sprint 5, elegidos entre los que más pueden fallar (instantánea de precio, compatibilidad con lo ya emitido, permisos por rol, concurrencia del pago y redondeo con límites), con el mismo formato de la matriz de calidad del MVP. Se ejecutaron al cierre (2026-11-03): los cinco quedaron **Aprobados** con la corrida focalizada de 11 suites / 114 pruebas, la regresión completa y el recorrido de escenarios V1–V10 (52/52) como evidencia.

| ID | Requisito | Criterio de Aceptación | Prueba ejecutada | Resultado | Evidencia / defecto |
|:--:|---|---|---|---|---|
| RF-01 | `spec.md` FR-003 y FR-004 (insumo CA-3 y CA-4, líneas 68 y 69): al agregar una refacción a una orden se guarda su precio de venta vigente, los cambios posteriores no modifican la línea y el total usa ese precio guardado en centavos. | Un cambio posterior de precio no altera la línea, su importe ni el total; la suma sigue siendo exacta a 2 decimales. | Backend (Jest + supertest): `integration/order-parts.test.js` («la línea guarda el precio vigente y el total no cambia si cambia el catálogo», «ninguna línea queda sin precio tras la 014») y `contract/order-parts.contract.test.js`; más los V3 y V7 del recorrido por HTTP. | **Aprobado** — 11 suites / 114 pruebas en verde y los casos V3/V7 cumplidos. | [Requisito](#e-01-requisito) · [Prueba](#e-01-prueba) · [Resultado](#e-01-resultado) · `docs/evidencias/sprint-5/corrida-focalizada-rf.md` y `docs/evidencias/sprint-5/escenarios-api-e06.md` |
| RF-02 | `spec.md` FR-006 y FR-007 (insumo CA-6 y CA-7, líneas 71 y 72): los pagos y tickets anteriores conservan importe y contenido, y el ticket nuevo detalla las refacciones con cantidad, precio unitario e importe. | Un ticket anterior se devuelve idéntico al guardado; uno nuevo trae las refacciones y sus importes; cambiar precios no altera lo ya emitido. | Backend: `integration/historical-compat.test.js` (creada en T029), `integration/tickets.test.js` y `contract/tickets.contract.test.js`; frontend: `client/test/ticket_screen_test.dart` (precio guardado en la línea). | **Aprobado** — verde en la corrida focalizada y en la regresión; V10 cumplido. | [Requisito](#e-02-requisito) · [Prueba](#e-02-prueba) · [Resultado](#e-02-resultado) · `docs/evidencias/sprint-5/corrida-focalizada-rf.md` |
| RF-03 | `spec.md` FR-010 (insumo CA-10, línea 75): el precio de compra solo es visible para el administrador; recepción y mecánico no lo reciben en las consultas del sistema. | Recorrido de las rutas de consulta con cada rol buscando la clave y el valor del precio de compra: solo el administrador los recibe. | Backend: `integration/parts-catalog.test.js` (403 de otros roles, lookup del mecánico sin precios y lookup solo MECHANIC), proyección por rol en `integration/order-parts.test.js` y `contract/inventory.contract.test.js`; recorrido V6 con los tres roles. | **Aprobado** — lookup con 7 elementos y 0 con precios para el mecánico; recepción con `unitPrice` sin campos de corrección. | [Requisito](#e-03-requisito) · [Prueba](#e-03-prueba) · [Resultado](#e-03-resultado) · `docs/evidencias/sprint-5/corrida-focalizada-rf.md` y `docs/evidencias/sprint-5/escenarios-api-e06.md` |
| RF-04 | `spec.md` FR-008 (insumo CA-8, línea 73): un solo pago vigente por orden, también con solicitudes simultáneas, y ningún dato de tarjeta almacenado. | Varios cobros al mismo tiempo sobre una orden dejan un solo pago PAID y el resto responde error; la tabla no tiene columnas de tarjeta. | Backend: `integration/payment-concurrency.test.js` (creada con `Promise.all` en T021), `integration/payments.test.js` (segundo pago e importe distinto), `integration/payments-mp.test.js` y `contract/payments.contract.test.js`; columnas de tarjeta verificadas en la migración `012` (RN-14). | **Aprobado** — verde en la corrida focalizada; V9 respaldado por la suite de concurrencia. | [Requisito](#e-04-requisito) · [Prueba](#e-04-prueba) · [Resultado](#e-04-resultado) · `docs/evidencias/sprint-5/corrida-focalizada-rf.md` |
| RF-05 | `spec.md` FR-002 y FR-004 (insumo CA-2 y CA-4, líneas 67 y 69): los precios rechazan valores negativos, no numéricos, con más de 2 decimales y fuera de los límites máximos; el total se calcula en centavos enteros. | Un precio inválido responde 400 con mensaje claro; los importes salen siempre con 2 decimales y las sumas cuadran sin errores de coma flotante. | Backend: `unit/order-total.test.js` (centavos y redondeo) e `integration/parts-catalog.test.js` (negativos, 3 decimales y tope `99,999.99` en alta y en PATCH); frontend: `client/test/parts_form_test.dart` (tope rechazado en cliente). | **Aprobado** — verde en la corrida focalizada; V4 (Σ = total, diferencia 0.00) y V5 (400 con el tope en `error.details[]`) cumplidos. | [Requisito](#e-05-requisito) · [Prueba](#e-05-prueba) · [Resultado](#e-05-resultado) · `docs/evidencias/sprint-5/corrida-focalizada-rf.md` y `docs/evidencias/sprint-5/escenarios-api-e06.md` |

## 10. Cierre

Registro final del sprint (2026-11-03).

| Campo | Valor |
|---|---|
| Criterios de salida cumplidos | 5 de 5, verificados en la sección 2: los 14 CA Aprobados, regresión completa en verde, ningún defecto crítico/medio/alto abierto, matriz RF con evidencia y ausencia de contradicciones con el análisis G-07 |
| Defectos abiertos | Ninguno. 0 defectos de implementación (regresión de 51/423 de backend y 128 de Flutter en verde) y 0 hallazgos abiertos: los 10 de la sección 7 (H-01 a H-10) están resueltos (6 en la especificación, H-01 con la enmienda 1.1.0, H-08 en T047, H-09 en T021 y H-10 al cerrar US5) |
| Observaciones | Ciclo Spec Kit completo (G-01 a G-08) y las 52 tareas (T001–T052) implementadas en la rama `005-precios-refacciones-cobro`, sin squash ni force-push; las 10 decisiones de aclaración cerradas (6 resueltas y 4 diferidas con default documentado). Regresión al cierre: 51 suites / 423 pruebas de backend y 128 de frontend con `flutter analyze` limpio, contra la línea base de 49/390 y 120. Recorrido V1–V10 contra la API real con `motorix_test`: 52 de 52 casos cumplidos. Seeds idempotentes con doble ejecución verificada. Evidencias en `docs/evidencias/sprint-5/` (transcripciones markdown, patrón del proyecto). Pendientes del responsable: su aprobación final y las capturas C-04, C-05 y C-12 (app y cronómetro), que la guía le asigna a él |
| Aprobado por | Pendiente: lo aprueba Ignacio Joaquín Trejo al cierre del sprint, junto con las capturas C-04, C-05 y C-12 que quedaron en sus manos |
| Fecha | 2026-11-03 (cierre técnico; la aprobación del responsable se anota al recibir las capturas pendientes) |

# Anexo de evidencias

Cada evidencia tiene tres bloques: **Requisito** (cita del `spec.md` y del insumo con archivo y línea), **Prueba** (descripción de la prueba creada o existente, con su nombre real) y **Resultado** (comando ejecutado, salida real y enlace a la transcripción). Las evidencias están en `docs/evidencias/sprint-5/` (transcripciones markdown); las capturas C-04, C-05 y C-12 quedan pendientes del responsable.

## E-01 Requisito

Especificación: `specs/005-precios-refacciones-cobro/spec.md`, **FR-003** (instantánea) y **FR-004** (total con precio guardado), historia US2.

Insumo: `docs/sprints/sprint-5-precios-refacciones-cobro.md`, líneas 68 y 69.

> **CA-3**: Al agregar una refacción a una orden se guarda su precio de venta vigente; un cambio posterior de precio no modifica esa línea.
>
> **CA-4**: El total de la orden es servicios más mano de obra más refacciones (cantidad por precio guardado), calculado en centavos enteros.

## E-01 Prueba

Archivos creados: `server/tests/integration/order-parts.test.js` («la línea guarda el precio vigente y el total no cambia si cambia el catálogo (D-01, SC-001, FR-003)» y «ninguna línea queda sin precio tras la 014: NOT NULL con default 0.00») y `server/tests/contract/order-parts.contract.test.js`; el cálculo en centavos está en `server/tests/unit/order-total.test.js` («los precios de refacciones se suman en centavos exactos con 2 decimales (SC-005)»).

La prueba agrega una refacción con precio de venta A, el administrador cambia después el precio a B y verifica que la línea conserve A, que su importe y el total no cambien y que el total siga saliendo con 2 decimales. El mismo caso se ejercita por HTTP en los V3 y V7 del recorrido de escenarios.

Resultado observado en el recorrido (V3): la línea guardó `unitPrice` `100.00`, el catálogo pasó a `150.00` y la línea siguió en `100.00`; `partsSubtotal` quedó en `200.00` (2 × 100.00).

## E-01 Resultado

Comando ejecutado: `npm.cmd test -- order-parts historical tickets order-total payment-concurrency payments parts-catalog` dentro de `server/`.

Salida: `Test Suites: 11 passed, 11 total` y `Tests: 114 passed, 114 total` (11.411 s, código de salida 0), con `order-parts.test.js`, `order-parts.contract.test.js` y `unit/order-total.test.js` dentro de esa corrida; en el recorrido, los V3 y V7 cumplieron.

Estado: **Aprobado** (2026-11-03). Evidencia: `docs/evidencias/sprint-5/corrida-focalizada-rf.md` y `docs/evidencias/sprint-5/escenarios-api-e06.md`.

## E-02 Requisito

Especificación: `specs/005-precios-refacciones-cobro/spec.md`, **FR-006** (compatibilidad) y **FR-007** (ticket nuevo), historias US4 y US3.

Insumo: `docs/sprints/sprint-5-precios-refacciones-cobro.md`, líneas 71 y 72.

> **CA-6**: Los pagos y tickets generados antes del sprint conservan su importe y su contenido sin cambios, y siguen consultándose y mostrándose correctamente.
>
> **CA-7**: El ticket nuevo incluye cantidad, precio unitario e importe de cada refacción, y el subtotal y el total las suman.

## E-02 Prueba

Archivo creado: `server/tests/integration/historical-compat.test.js` (T029), con «los pagos y el ticket no cambian cuando cambian todos los precios del catálogo» (US4, SC-002, CA-6). Existen `server/tests/integration/tickets.test.js` («devuelve el contenido completo calculado del comprobante» y «el ticket usa el precio guardado en la línea aunque cambie el catálogo») y `server/tests/contract/tickets.contract.test.js`; en frontend, `client/test/ticket_screen_test.dart` verifica que «la línea de refacción muestra el precio guardado (unitPrice)» (T028).

La prueba fotografía los pagos y los tickets existentes, cambia todos los precios del catálogo y comprueba que nada de lo emitido cambie.

## E-02 Resultado

Comando ejecutado: `npm.cmd test -- order-parts historical tickets order-total payment-concurrency payments parts-catalog` dentro de `server/`.

Salida: `Test Suites: 11 passed, 11 total` y `Tests: 114 passed, 114 total` (0 fallidas), con `historical-compat.test.js`, `tickets.test.js` y `tickets.contract.test.js` dentro de esa corrida; el V10 del recorrido respalda la compatibilidad histórica y el frontend cerró con 128 pruebas.

Estado: **Aprobado** (2026-11-03). Evidencia: `docs/evidencias/sprint-5/corrida-focalizada-rf.md` y `docs/evidencias/sprint-5/regresion-cierre-2026-11-03.md`.

## E-03 Requisito

Especificación: `specs/005-precios-refacciones-cobro/spec.md`, **FR-010** (precio de compra solo admin), historia US5.

Insumo: `docs/sprints/sprint-5-precios-refacciones-cobro.md`, línea 75.

> **CA-10**: El precio de compra solo es visible para el administrador; el mecánico y recepción no lo reciben en la API, validado en backend.

## E-03 Prueba

Pruebas creadas y ampliadas: `server/tests/integration/parts-catalog.test.js` con «MECHANIC y RECEPTIONIST reciben 403 en GET, POST y PATCH» y el bloque «US5 - Lookup del mecánico sin precios (T038, D-10, H-10)» («mecánico GET /api/parts/lookup → 200 con los 7 campos y sin precios» y «recepción y administrador reciben 403 en el lookup»); proyección por rol en `server/tests/integration/order-parts.test.js` («mecánico sin unitPrice, recepción con unitPrice sin corrección y admin con ambos», T041); y `server/tests/contract/inventory.contract.test.js`, que verifica el lookup sin `purchasePrice`.

La prueba recorre las rutas de consulta con cada rol, buscando en las respuestas la clave `purchasePrice` y su valor; solo el administrador debe recibirlos. Fragmento real:

```js
// server/tests/integration/parts-catalog.test.js — lookup del mecánico
const elemento = lookup.body.data.parts[0];
expect(elemento).not.toHaveProperty("purchasePrice");
```

El recorrido V6 repite lo mismo por HTTP con los tres roles sobre la API real.

## E-03 Resultado

Comando ejecutado: `npm.cmd test -- order-parts historical tickets order-total payment-concurrency payments parts-catalog` dentro de `server/` (incluye `parts-catalog.test.js` y `order-parts.test.js`); `inventory.contract.test.js` corrió en la regresión completa.

Salida: `Test Suites: 11 passed, 11 total` y `Tests: 114 passed, 114 total` (0 fallidas). En el recorrido (V6): `GET /api/parts/lookup` del mecánico con `HTTP 200, 7 elementos, con precios: 0`, líneas de la orden del mecánico con `unitPrice: 0` y 403 de recepción y mecánico al catálogo.

Estado: **Aprobado** (2026-11-03). Evidencia: `docs/evidencias/sprint-5/corrida-focalizada-rf.md` y `docs/evidencias/sprint-5/escenarios-api-e06.md`.

## E-04 Requisito

Especificación: `specs/005-precios-refacciones-cobro/spec.md`, **FR-008** (un solo pago vigente, simultáneo, sin datos de tarjeta), historia US3.

Insumo: `docs/sprints/sprint-5-precios-refacciones-cobro.md`, línea 73.

> **CA-8**: Se mantienen las reglas del Sprint 4: un solo pago vigente por orden, también con solicitudes simultáneas, y ningún dato de tarjeta almacenado.

## E-04 Prueba

Archivos: `server/tests/integration/payments.test.js` («un segundo pago sobre la misma orden responde 400 ORDER_ALREADY_PAID», línea 249, y «un importe distinto del total responde 400 PAYMENT_AMOUNT_MISMATCH», línea 265) y la prueba de concurrencia **creada** en T021 (H-09 resuelto): `server/tests/integration/payment-concurrency.test.js` con «6 cobros manuales simultáneos dejan exactamente 1 PAID y ningún 500» y «6 cobros MP simultáneos dejan exactamente 1 PENDING y ningún 500», ambas construidas con `Promise.all`.

También se verifica que la tabla `payments` no tenga columnas de tarjeta (migración `012`, RN-14).

## E-04 Resultado

Comando ejecutado: `npm.cmd test -- order-parts historical tickets order-total payment-concurrency payments parts-catalog` dentro de `server/` (incluye `payment-concurrency.test.js`, `payments.test.js`, `payments-mp.test.js` y `payments.contract.test.js`).

Salida: `Test Suites: 11 passed, 11 total` y `Tests: 114 passed, 114 total` (0 fallidas). El V9 del recorrido se apoya en esta suite de concurrencia.

Estado: **Aprobado** (2026-11-03). Evidencia: `docs/evidencias/sprint-5/corrida-focalizada-rf.md`.

## E-05 Requisito

Especificación: `specs/005-precios-refacciones-cobro/spec.md`, **FR-002** (precios con límite máximo) y **FR-004** (centavos), historias US1 y US2.

Insumo: `docs/sprints/sprint-5-precios-refacciones-cobro.md`, líneas 67 y 69.

> **CA-2**: Los precios rechazan valores negativos, no numéricos y con más de dos decimales; se definen los límites máximos.
>
> **CA-4**: El total de la orden es servicios más mano de obra más refacciones (cantidad por precio guardado), calculado en centavos enteros.

## E-05 Prueba

Archivos: `server/tests/unit/order-total.test.js` (centavos, redondeo y «los precios de refacciones se suman en centavos exactos con 2 decimales (SC-005)») y `server/tests/integration/parts-catalog.test.js` («precios, stock o stock mínimo negativos → 400 VALIDATION_ERROR», con `-1.00` y `420.999`, y la prueba de límite máximo creada en el sprint: «el tope $99,999.99 se acepta y el precio mayor se rechaza en alta y en PATCH (D-08, FR-002)»). En frontend, `client/test/parts_form_test.dart` rechaza el tope en el formulario con mensaje en español.

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

Comando ejecutado: `npm.cmd test -- order-parts historical tickets order-total payment-concurrency payments parts-catalog` dentro de `server/` (incluye `unit/order-total.test.js` y `parts-catalog.test.js`).

Salida: `Test Suites: 11 passed, 11 total` y `Tests: 114 passed, 114 total` (0 fallidas). En el recorrido, los V5 rechazaron `100000.00` con «El precio de venta no puede superar los 99,999.99.» en `error.details[]`, rechazaron 3 decimales y precio negativo, aceptaron la venta menor que compra (advertencia de interfaz) y el V4 cerró con diferencia `0.00`.

Estado: **Aprobado** (2026-11-03). Evidencia: `docs/evidencias/sprint-5/corrida-focalizada-rf.md` y `docs/evidencias/sprint-5/escenarios-api-e06.md`.

## E-06 Recorrido de los escenarios contra la API real

El `quickstart.md` del sprint define los escenarios V1 a V10. Se ejecutaron el **2026-11-03** contra la API real (`node app.js`, puerto 3999) con la base `motorix_test` sembrada con los seeds del sprint, para no gastar los datos de demostración de `motorix`, mediante un guion por HTTP (`docs/evidencias/sprint-5/guion-e06-sprint5.mjs`: levanta la API, inicia sesión con los tres usuarios seed y ejecuta cada escenario con `fetch`).

Comando (desde `server/`):

```powershell
$env:DB_NAME="motorix_test"; node ..\docs\evidencias\sprint-5\guion-e06-sprint5.mjs
```

Resultado: **52 de 52 casos cumplidos**, 0 fallidos, código de salida 0. La tabla completa —V1 migración y backfill, V2 seeds idempotentes, V3 instantánea de precio, V4 totales y cobro con total 0.00, V5 límites de precio, V6 proyección por rol, V7 corrección de precio con sus guardas, V8 pagos pendientes desfasados, V9 concurrencia y V10 compatibilidad— está en `docs/evidencias/sprint-5/escenarios-api-e06.md`.

Estado: **Aprobado** (2026-11-03). Evidencia: `docs/evidencias/sprint-5/escenarios-api-e06.md` (sustituye a la captura C-11).

# Guía de capturas de pantalla

Evidencias en `docs/evidencias/sprint-5/` (carpeta creada el 2026-11-03). Los nombres van en minúsculas y con guiones. Siguiendo el patrón del proyecto (`docs/evidencias/2026-10-18-suite-backend.md`), las corridas quedaron como **transcripciones markdown** en lugar de PNG; la guía reserva a Ignacio las capturas de la app y del cronómetro.

| ID | Evidencia | Qué debe verse o registra | Cómo se obtiene | Estado |
|---|---|---|---|---|
| C-01 | `linea-base-2026-11-02.md` | Transcripción con `Test Suites: 49 passed, 49 total` y `Tests: 390 passed, 390 total` | Línea base del 2026-11-02 sobre `fe587b5` | Hecho (markdown, sin PNG) |
| C-02 | `linea-base-2026-11-02.md` | `+120: All tests passed!` | `flutter test` del 2026-11-02 | Hecho (markdown, sin PNG) |
| C-03 | `linea-base-2026-11-02.md` | `No issues found!` | `flutter analyze lib` del 2026-11-02 | Hecho (markdown, sin PNG) |
| C-04 | `captura-rf-01-instantanea-precio.png` (sin tomar) | Detalle de una orden con la línea de refacción conservando su precio tras cambiar el precio en el catálogo | App (`client\lib\screens\orders\order_detail_screen.dart`): el admin cambia el precio, recepción reabre la orden | **Pendiente del responsable** |
| C-05 | `captura-rf-02-ticket-anterior-y-nuevo.png` (sin tomar) | Un ticket anterior y uno nuevo en el mismo listado | App (`client\lib\screens\tickets\ticket_screen.dart`) | **Pendiente del responsable** |
| C-06 | `corrida-focalizada-rf.md` | Prueba de fuga de precios en verde (lookup sin `purchasePrice`) | `npm.cmd test -- ... parts-catalog` (corrida de 11 suites / 114 pruebas) | Hecho (markdown, sin PNG) |
| C-07 | `corrida-focalizada-rf.md` | Prueba de cobros simultáneos: 1 PAID y ningún 500 | `npm.cmd test -- ... payment-concurrency` (`integration/payment-concurrency.test.js`) | Hecho (markdown, sin PNG) |
| C-08 | `corrida-focalizada-rf.md` | Prueba de límites (`99,999.99`) y redondeo en centavos | `npm.cmd test -- ... parts-catalog order-total` | Hecho (markdown, sin PNG) |
| C-09 | `regresion-cierre-2026-11-03.md` | Suite completa al cierre: `Test Suites: 51 passed` y `Tests: 423 passed` | `npm.cmd test` en `server\` (2026-11-03) | Hecho (markdown, sin PNG) |
| C-10 | `regresion-cierre-2026-11-03.md` | `+128: All tests passed!` al cierre | `flutter test` en `client\` (2026-11-03) | Hecho (markdown, sin PNG) |
| C-11 | `escenarios-api-e06.md` | Tabla del recorrido de los escenarios: 52 de 52 cumplidos | Guion HTTP contra la API con `motorix_test` (`guion-e06-sprint5.mjs`) | Hecho (markdown, sin PNG) |
| C-12 | `captura-tiempos-<nombre-del-criterio>.png` (sin tomar) | Cronómetro del criterio de éxito medible que defina el spec, con la pantalla de inicio y la final | Medido por Ignacio en la app con los datos de ejemplo | **Pendiente del responsable** |

Notas para tomar las capturas que faltan:

- Para las capturas de la app (C-04, C-05 y C-12) hace falta MySQL (`MySQL96`) y el backend (`npm.cmd start` en `server\`); la app es el ejecutable en `client\build\windows\x64\runner\Debug\motorix_client.exe`.
- Los datos de demostración se gastan al hacer el recorrido (una orden cobrada no se cobra otra vez): avísame antes y puedo resembrar `motorix` o crear datos nuevos.
- **Verifica cada captura antes de enlazarla**: ábrela, confirma que muestra lo que dice la tabla y compara los hash (`Get-FileHash`) para detectar imágenes idénticas con nombres distintos.
- Los tiempos de uso (C-12) son mediciones tuyas con cronómetro; nunca se registran estimaciones como si fueran mediciones.
- Si se toman PNG para C-01 a C-03, C-06 a C-11, se agregan junto a las transcripciones markdown que ya están enlazadas en las secciones 8 y 9.

---

*Cierre técnico: 2026-11-03 · Sprint 5 de Motorix · Inicio: 2026-11-02 · Línea base sobre el commit `fe587b5` · Ciclo Spec Kit completo (G-01 a G-08) · Regresión de cierre: 51 suites / 423 pruebas de backend, 128 de Flutter y `flutter analyze` limpio · Evidencias en `docs/evidencias/sprint-5/` · Pendiente: aprobación del responsable y capturas C-04, C-05 y C-12.*
