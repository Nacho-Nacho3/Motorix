# Aseguramiento de la calidad - Sprint 7: Reportes, configuración, términos y seguridad

Este documento es el registro de calidad del Sprint 7 de Motorix. Reúne los criterios de entrada y de salida, las puertas de calidad, las decisiones, los riesgos, la trazabilidad de los criterios de aceptación, los hallazgos, la regresión de los sprints 1 a 6 y el control de calidad final, con sus evidencias.

**Estado: Aprobado. Sprint cerrado el 2026-11-26** (inicio 2026-11-24). Aprobación del responsable en la sección 10. Se llenó durante el sprint y se completó para el cierre (T132), según [`docs/aseguramiento-calidad/guia-aseguramiento-calidad.md`](aseguramiento-calidad/guia-aseguramiento-calidad.md).

## 0. Datos del documento

| Campo | Valor |
|---|---|
| Sprint | 7 - Reportes, configuración, términos y seguridad |
| Insumo | [`docs/sprints/sprint-7-reportes-configuracion.md`](sprints/sprint-7-reportes-configuracion.md) |
| Especificación | [`specs/007-reportes-configuracion/spec.md`](../specs/007-reportes-configuracion/spec.md) (commits `04fe96c` specify y `c2f9a0c` clarify) |
| Plan y tareas | `plan.md` (commit `1a547ac`), `tasks.md` (commit `e1cd554`, correcciones del análisis en `dea8f78`), 132 tareas en 13 fases |
| Rama | `007-reportes-configuracion` desde `main` (sin squash ni force-push durante todo el sprint) |
| Responsable | Ignacio Joaquín Trejo (proyecto escolar: él mismo aprueba el cierre) |
| Fecha de inicio | 2026-11-24 |
| Fecha de cierre | 2026-11-26 |
| Estado general | Aprobado |

## 1. Objetivo y alcance

**Objetivo.** Asegurar que el Sprint 7 salga con calidad: que los requisitos estén completos, sean medibles y no se contradigan, que las pruebas estén planeadas antes del código y que el cambio no rompa lo construido en los sprints 1 a 6.

**Dentro del alcance:** configuración del taller y de los márgenes de mantenimiento; catálogo de tipos de servicio; reportes de ingresos, servicios, productividad, costo y margen de refacciones y rotación de inventario, con exportación CSV; términos y condiciones con aceptación versionada; bitácora de acciones sensibles; política de contraseñas; cierre por inactividad; verificación de que la API no expone datos reservados.

**Fuera de alcance:** lo que la sección «Fuera de alcance» del spec lista.

## 2. Criterios de entrada y de salida

Estado real al 2026-11-26. `[x]` solo cuando de verdad se cumplió.

**Criterios de entrada (para comenzar la implementación):**

- [x] La constitución 1.2.0 ya cubre el sprint 7 (alcance de 7 sprints); no hay enmienda nueva.
- [x] Rama `007-reportes-configuracion` creada desde `main` (2026-11-24), sin squash ni force-push.
- [x] Checklist de requisitos en verde: [`checklists/requirements.md`](../specs/007-reportes-configuracion/checklists/requirements.md) 16/16.
- [x] Fases de Spec Kit completadas: specify (`04fe96c`), clarify (`c2f9a0c`), plan (`1a547ac`), tasks (`e1cd554`) y analyze (corregido en `dea8f78`).
- [x] Línea base de regresión medida y registrada (sección 8) — T003, 2026-11-25.

**Criterios de salida (para cerrar el sprint):**

- [x] Los 26 criterios de aceptación del insumo están Aprobados con evidencia (sección 6).
- [x] Todas las pruebas de los sprints 1 a 6 siguen pasando (sección 8).
- [x] No hay defectos críticos ni altos abiertos (sección 7).
- [x] La matriz de calidad final está completa, con evidencia (sección 9).
- [x] Reporte, análisis y matriz no se contradicen (sección 10).

## 3. Puertas de calidad

Estado al 2026-11-25.

| ID | Puerta | Estado | Evidencia |
|:--:|---|---|---|
| G-01 | Insumo del sprint revisado contra el código | Realizada | Las suposiciones del insumo que no coincidían con el código (por ejemplo, que `finished_at` no existía en la orden) quedaron corregidas en [`research.md`](../specs/007-reportes-configuracion/research.md) y en la decisión D-19 del spec |
| G-02 | Especificación (`/speckit.specify`) | Realizada | [`spec.md`](../specs/007-reportes-configuracion/spec.md), commit `04fe96c`: 10 historias, 32 requisitos y 15 criterios de éxito |
| G-03 | Aclaraciones (`/speckit.clarify`) | Realizada | Sesión del 2026-11-24 en `spec.md`, commit `c2f9a0c`; 0 marcadores `[NEEDS CLARIFICATION]` |
| G-04 | Lista de calidad de requisitos (`/speckit.checklist`) | Realizada | [`checklists/requirements.md`](../specs/007-reportes-configuracion/checklists/requirements.md): 16 de 16 marcados |
| G-05 | Plan (`/speckit.plan`) | Realizada | [`plan.md`](../specs/007-reportes-configuracion/plan.md), commit `1a547ac`, con `research.md`, `data-model.md`, `contracts/` y `quickstart.md` |
| G-06 | Tareas (`/speckit.tasks`) | Realizada | [`tasks.md`](../specs/007-reportes-configuracion/tasks.md), commit `e1cd554`: 132 tareas en 13 fases |
| G-07 | Consistencia (`/speckit.analyze`) | Realizada | Análisis del 2026-11-24: 0 críticos, 1 alto, 3 medios y 4 bajos; el alto y los medios se corrigieron en `dea8f78`; los 4 bajos (G2, A1, N1, D1) quedaron sin corregir (sección 7) |
| G-08 | Pruebas planeadas y línea base | Realizada | Línea base del 2026-11-25 (sección 8); las pruebas se escriben antes de cada implementación y deben fallar primero |

## 4. Decisiones de aclaración

La sesión de `/speckit.clarify` del 2026-11-24 resolvió D-16, D-10 (parcial), D-01, D-07 y D-05; D-19 se agregó al detectar que la orden no tenía fecha de terminación. Las marcadas como «Valor por omisión» se tomaron del [`spec.md`](../specs/007-reportes-configuracion/spec.md) y no se discutieron una por una con el responsable: la aprobación del cierre las ratifica.

| ID | Tema | Decisión aplicada | Origen |
|:--:|---|---|---|
| D-01 | Formato de exportación | CSV sin dependencias nuevas; Excel y PDF fuera del sprint | Clarificación |
| D-02 | Prioridad si el sprint se divide | Configuración, términos y seguridad primero; reportes después | Propuesta de sprints |
| D-03 | Datos del taller en el ticket | Cada ticket guarda una copia al emitirse; los anteriores conservan «Motorix» sin dirección ni teléfono | Valor por omisión |
| D-04 | Tipo de servicio en las líneas de la orden | Enlace opcional; las líneas existentes quedan sin tipo y no proponen mantenimiento | Valor por omisión |
| D-05 | Margen de líneas sin precio de compra | Se excluyen del margen, se marcan «sin costo registrado» y sus ventas van aparte | Clarificación |
| D-06 | Periodos y corte de los reportes | Hoy, semana, mes y rango libre; hora local del taller; máximo un año | Valor por omisión |
| D-07 | Productividad por mecánico | Órdenes terminadas e importe de mano de obra; sin tiempo promedio | Clarificación |
| D-08 | Rotación de inventario | Unidades salidas del periodo entre la existencia promedio | Valor por omisión |
| D-09 | Reportes para recepción | No; solo administrador | Valor por omisión |
| D-10 | Términos y condiciones | El administrador publica versiones desde la aplicación; texto inicial en español redactado por el equipo; una aceptación por versión | Clarificación (parcial) y valor por omisión |
| D-11 | Usuarios existentes | Aceptan en su siguiente inicio de sesión | Valor por omisión |
| D-12 | Alcance de la bitácora | Las acciones del CA-20; sin purga; consulta paginada y sin exportación | Valor por omisión |
| D-13 | Política de contraseñas | 8 a 64 caracteres con mayúscula, minúscula y número; sin forzar cambio a las cuentas de demostración | Valor por omisión |
| D-14 | Inactividad | 30 minutos para todos los roles | Valor por omisión |
| D-15 | Prioridad si no alcanza | Términos y seguridad antes que reportes | Propuesta de sprints |
| D-16 | Márgenes del taller frente a los de cada mantenimiento | El valor del taller rige donde se usa el valor por omisión; la antelación capturada a mano se conserva | Clarificación |
| D-17 | Márgenes de instalación | 30 días y 500 km, los que ya regían (el insumo decía 1,000 km) | Valor por omisión |
| D-18 | Cabeceras de seguridad | Fuera del alcance obligatorio: no existían y ningún criterio las exige | Valor por omisión |
| D-19 | Fecha de terminación de la orden | Se guarda al cambiar de estado; las anteriores usan su última modificación y se marcan como estimadas | Valor por omisión (derivada de D-07) |

## 5. Riesgos y mitigaciones

Los ocho riesgos de [`plan.md`](../specs/007-reportes-configuracion/plan.md).

| ID | Riesgo | Impacto | Mitigación | Prueba o verificación | Estado |
|:--:|---|---|---|---|---|
| R-01 | El bloqueo por términos rompe las suites autenticadas existentes | Alto: regresión masiva | El helper de pruebas registra la aceptación de la versión vigente | Regresión completa (T019, T077) sin fallos | Cerrado: no ocurrió |
| R-02 | El relleno trata como «por omisión» un 30 o 500 capturado a propósito | Bajo: sin efecto mientras el valor del taller no cambie | Documentado en la investigación y en el quickstart | `maintenance-margins.test.js` | Aceptado |
| R-03 | La fecha de terminación de las órdenes anteriores es aproximada | Medio: productividad imprecisa | El reporte cuenta las fechas estimadas y la pantalla lo avisa (D-19) | `order-finished-at.test.js`, `reports-services-productivity.test.js` | Aceptado y avisado |
| R-04 | La migración 016 falla a mitad o altera datos existentes | Medio | Cambios aditivos; probada en `motorix_test` antes de la base principal | T011 (`schema_migrations`, restricciones, rellenos y reejecución) | Cerrado: no ocurrió |
| R-05 | Registrar la actividad en cada petición castiga el rendimiento | Bajo | Se refresca como máximo una vez por minuto | `session-idle.test.js` | Mitigado |
| R-06 | La bitácora guarda datos reservados | Alto | Lista blanca de campos por acción | `audit-detail.test.js`, `audit-log.test.js` | Mitigado |
| R-07 | Un CSV ejecuta fórmulas al abrirse | Medio | Las celdas peligrosas se neutralizan | `csv.test.js`, `reports-export.test.js` | Mitigado |
| R-08 | Los reportes no alcanzan el tiempo | Medio | El bloque A se cerró primero con su regresión en verde | Checkpoints de la sección 8 | Cerrado: no ocurrió |

## 6. Trazabilidad

Los nombres de prueba sin ruta son archivos `.test.js` de `server/tests/integration/`. «V1» a «V13» son los escenarios del [`quickstart.md`](../specs/007-reportes-configuracion/quickstart.md): las capturas y la verificación por API están en el anexo. «Aprobado» significa que las pruebas automatizadas del 2026-11-26 pasan; la revisión visual del responsable se registra en la sección 10.

| CA | Criterio de aceptación (resumen) | Requisito (FR) | Tarea | Prueba | Resultado | Evidencia |
|:--:|---|---|---|---|---|---|
| CA-1 | Datos del taller editables; los tickets emitidos no cambian | FR-001, FR-002 | T020–T032 | settings, ticket-snapshot | Aprobado | V1 |
| CA-2 | Márgenes de «Próximo» editables y respetados por lista y dashboard | FR-003 | T033–T041 | maintenance-margins, settings | Aprobado | V2 |
| CA-3 | Valores de respaldo sin configuración guardada (30 días y 500 km, D-17) | FR-004 | T020–T041 | settings, maintenance-margins; unit/settings-resolution | Aprobado | API V1–V2 |
| CA-4 | Catálogo de tipos sin borrar los usados | FR-005, FR-006 | T042–T054 | service-types, order-service-type | Aprobado | V3, V4-03 |
| CA-5 | Propuesta de próximo mantenimiento corregible | FR-007 | T042–T054 | maintenance-suggestion; unit/next-service | Aprobado | V4-04 |
| CA-6 | Cuatro reportes con filtro por fechas | FR-010 | T094–T118 | reports-income, reports-services-productivity, reports-parts | Aprobado | V9 |
| CA-7 | Importes en centavos que coinciden con pagos y órdenes | FR-011 | T094–T118 | reports-income, reports-services-productivity, reports-parts | Aprobado | V9 |
| CA-8 | Costo, venta y margen; precio de compra solo para ADMIN | FR-013 | T109–T118 | reports-parts, order-part-unit-cost, data-exposure | Aprobado | V9-04 |
| CA-9 | Exportación que coincide con la pantalla | FR-014 | T119–T124 | reports-export; unit/csv | Aprobado | V10 |
| CA-10 | Configuración y reportes solo ADMIN en el backend | FR-009, FR-015 | T020–T124 | settings, service-types, reports-income, reports-services-productivity; `settings_test.dart`, `reports_test.dart` | Aprobado | V11 |
| CA-11 | Tiempo razonable con muchos datos y rango limitado | FR-016 | T125 | reports-performance | Aprobado | API V12 |
| CA-12 | Seeds del sprint idempotentes | FR-029 | T126 | seed-sprint7 | Aprobado | Capturas V9 |
| CA-13 | Pruebas de configuración, reportes, permisos y exportación | FR-030 | T020–T130 | Las suites de CA-1 a CA-12 | Aprobado | Sección 8 |
| CA-14 | «Próximo servicio» en el ticket nuevo | FR-008 | T055–T063 | ticket-next-service; unit/next-service | Aprobado | V4-02 |
| CA-15 | Documentación actualizada y respaldo de las variables | FR-031 | T127, T128, T132 | Revisión documental | Aprobado | `project-context.md`, `design-system.md`, `README.md` |
| CA-16 | Aceptación de términos al iniciar sesión; rechazar cierra la sesión | FR-018 | T064–T077 | terms-gate; `terms_gate_test.dart` | Aprobado | V5 |
| CA-17 | Se guarda usuario, versión y fecha; se repide con versión nueva | FR-019, FR-032 | T064–T077 | terms | Aprobado | V5-03 |
| CA-18 | Contenido de los términos y consulta de aceptaciones | FR-020, FR-032 | T064–T077 | terms | Aprobado | V5-01, V5-03 |
| CA-19 | El backend rechaza operaciones sin aceptación vigente | FR-021 | T064–T077 | terms-gate; `terms_gate_http_test.dart` | Aprobado | API V5 |
| CA-20 | Bitácora con las acciones sensibles, filtros y solo lectura | FR-022, FR-023 | T078–T093 | audit-log, payments; `audit_log_test.dart` | Aprobado | V6 |
| CA-21 | La bitácora sin contraseñas, hashes, tokens ni tarjetas | FR-024 | T078–T093 | audit-log; unit/audit-detail | Aprobado | API V6 |
| CA-22 | Política de contraseñas al crear y cambiar; solo hash | FR-025 | T078–T093 | password-policy | Aprobado | API V7 |
| CA-23 | Cierre por inactividad y expiración validada en el backend | FR-026 | T078–T093 | session-idle; `inactivity_test.dart` | Aprobado | V8 |
| CA-24 | Sin hash, token ni precios reservados en las respuestas | FR-027 | T081, T132 | data-exposure (lecturas y escrituras) | Aprobado | API V13 |
| CA-25 | Consultas parametrizadas y entradas validadas | FR-028 | T082 | search-injection | Aprobado | API V13 |
| CA-26 | Pruebas de términos, bitácora, contraseñas, inactividad y no exposición | FR-030 | T064–T093 | Las suites de CA-16 a CA-25 | Aprobado | Sección 8 |

## 7. Hallazgos y defectos

| ID | Descripción | Severidad | Origen | Estado | Resolución | Evidencia |
|:--:|---|---|---|---|---|---|
| H-01 | La línea base del backend arrancó en rojo (46 suites): el checksum de `015_notifications.sql` no coincidía porque la copia de trabajo tenía fin de línea CRLF (autocrlf de Windows) y `schema_migrations` guardaba el hash de la versión LF; es la misma causa que H-01 del Sprint 6 | Media | T003 (línea base) | Resuelto | Se restauraron los bytes LF (contenido idéntico a `HEAD`) y se agregó `.gitattributes` con `database/migrations/*.sql text eol=lf` para que no se repita | `.gitattributes` |
| H-03 | `GET /api/appointments?date=<texto>` respondía 500 porque la fecha no se validaba antes de la consulta (no era inyección: la consulta ya usaba parámetros) | Media | T082 (prueba de entradas maliciosas) | Resuelto | `list` valida el formato `YYYY-MM-DD` y responde 400 `VALIDATION_ERROR` | `server/services/appointments.service.js` |
| H-04 | El catálogo mostraba «Usado en 1 servicios» (sin concordancia de número) | Baja | T131 (capturas) | Resuelto | Se usa el singular cuando es una sola línea, también en el aviso al desactivar | `V3-01-tipos-de-servicio.png` |
| H-05 | Detalles de presentación: Configuración, Bitácora y Reportes repetían el título; la bitácora mostraba la clave técnica del campo (`shop.name`); la lista de aceptaciones y el encabezado del ticket mostraban la fecha en formato ISO | Baja | T131 (capturas) | Resuelto (2026-11-26) | Se quitaron las barras repetidas, la bitácora traduce campo, rol y método sin cambiar lo guardado y las fechas se muestran como `dd/mm/aaaa hh:mm` | `client/test/readable_labels_test.dart`; capturas V1, V5, V6 y V9 |
| H-06 | En escritorio, desplazar los textos de la pantalla de aceptación de términos producía el error «The Scrollbar's ScrollController has no ScrollPosition attached» (la barra no tenía controlador propio); las pruebas anteriores no lo detectaban | Media | Revisión en la aplicación (registro de `flutter run`) | Resuelto | La barra y la lista comparten un `ScrollController`; prueba nueva con la plataforma Windows (Flutter queda en 252 pruebas) | `client/test/terms_gate_test.dart` |
| H-07 | Cuando el sistema cancelaba solo un pago pendiente porque el total de la orden cambió, la cancelación no quedaba en la bitácora (CA-20) | Media | T132 (revisión de la trazabilidad) | Resuelto (2026-11-26) | Se registra `PAYMENT_CANCELLED` con actor `sistema` y el motivo, una sola vez aunque se repita la consulta | `server/tests/integration/payments.test.js` |
| H-08 | La prueba de no exposición de datos cubría las lecturas y el alta y edición de usuarios, no las demás escrituras que pide CA-24; al agregarlas no apareció ninguna fuga | Baja | T132 | Resuelto (2026-11-26) | Dos pruebas nuevas sobre las escrituras de órdenes, tickets, pagos y refacciones (sin la sincronización con Mercado Pago, que depende del proveedor) | `server/tests/integration/data-exposure.test.js` |
| H-09 | `docs/design-system.md` no se había actualizado, como pide CA-15 | Baja | T132 | Resuelto (2026-11-26) | Se agregaron las secciones nuevas del menú y las reglas de título y formato de fecha | `docs/design-system.md` |
| H-10 | Defecto D-02 de la auditoría del MVP: una fecha u hora inexistente (`2026-02-31`, `25:00`) en citas o mantenimientos pasaba la validación | Media | Auditoría del MVP; corregido antes del cierre | Resuelto (2026-11-26) | Se valida que la fecha exista y que la hora esté entre 00:00 y 23:59; responde 400 | `server/tests/integration/date-validation.test.js` |
| H-11 | Defecto D-03 de la auditoría del MVP: el día de la fecha objetivo el mantenimiento quedaba «Próximo» y no «Vencido» | Media | Auditoría del MVP; corregido antes del cierre | Resuelto (2026-11-26) | El día objetivo cuenta como Vencido, igual que el kilometraje alcanzado | `server/tests/unit/maintenance-state.test.js` |
| H-12 | Defecto D-04 de la auditoría del MVP: una orden ya pagada admitía servicios, mano de obra y refacciones, y su total dejaba de coincidir con lo cobrado | Alta | Auditoría del MVP; corregido antes del cierre | Resuelto (2026-11-26) | Esos cambios responden 400 `ORDER_ALREADY_PAID` y bloquean la misma fila que el cobro; las notas y la entrega siguen permitidas | `server/tests/integration/payments.test.js` |
| H-02 | Hallazgos bajos del análisis sin corregir: G2 (FR-029 y la versión de términos en los seeds), A1 (usuario de `settings.updated_by` al sembrar), N1 (nombres de pruebas del plan frente a las tareas) y D1 (requisitos repetidos) | Baja | G-07 | Aceptado | Se resuelven sobre la marcha durante la implementación | — |

## 8. Línea base de regresión

**Línea base (antes de escribir código del sprint), medida el 2026-11-25 sobre el commit `dea8f78` de la rama `007-reportes-configuracion`:**

| Comando | Resultado |
|---|---|
| `cd server && npm.cmd test` | 56 suites y **479 pruebas**, todas en verde (tras resolver H-01) |
| `cd server && npm.cmd run lint` | 0 errores y 1 advertencia previa en `tests/integration/order-parts.test.js` (`orden` sin usar) |
| `cd client && flutter test` | **145 pruebas**, todas en verde |
| `cd client && flutter analyze` | sin observaciones |

**Checkpoint del bloque A (US1, US2, US3, US8, US9 y US10), medido el 2026-11-25:**

| Comando | Resultado | Diferencia con la línea base |
|---|---|---|
| `cd server && npm.cmd test` | 80 suites y **796 pruebas**, todas en verde | +24 suites y +317 pruebas |
| `cd server && npm.cmd run lint` | 0 errores y 1 advertencia previa | sin cambio |
| `cd client && flutter test` | **217 pruebas**, todas en verde | +72 pruebas |
| `cd client && flutter analyze` | sin observaciones | sin cambio |

Ninguna prueba de la línea base falló (SC-014: 0 regresiones). El bloqueo por términos activo no obligó a corregir ninguna suite existente.

**Checkpoint del bloque B (reportes y exportación, US4 a US7), medido el 2026-11-25:**

| Comando | Resultado | Diferencia con la línea base |
|---|---|---|
| `cd server && npm.cmd test` | 88 suites y **922 pruebas**, todas en verde | +32 suites y +443 pruebas |
| `cd server && npm.cmd run lint` | 0 errores y 1 advertencia previa | sin cambio |
| `cd client && flutter test` | **251 pruebas**, todas en verde | +106 pruebas |
| `cd client && flutter analyze` | sin observaciones | sin cambio |

Ninguna prueba de la línea base falló (SC-014: 0 regresiones).

**Regresión de cierre (T129), medida el 2026-11-25 con todas las historias y el pulido de pruebas y documentación (faltan el recorrido manual y el cierre del documento):**

| Comando | Resultado | Diferencia con la línea base |
|---|---|---|
| `cd server && npm.cmd test` | 90 suites y **942 pruebas**, todas en verde | +34 suites y +463 pruebas |
| `cd server && npm.cmd run lint` | 0 errores y 1 advertencia previa (`order-parts.test.js`) | sin cambio |
| `cd client && flutter test` | **251 pruebas**, todas en verde | +106 pruebas |
| `cd client && flutter analyze` | sin observaciones | sin cambio |

Ninguna prueba de la línea base falló (SC-014: 0 regresiones).

**Regresión final, medida el 2026-11-26 después de corregir H-05 a H-09:**

| Comando | Resultado | Diferencia con la línea base |
|---|---|---|
| `cd server && npm.cmd test` | 90 suites y **946 pruebas**, todas en verde | +34 suites y +467 pruebas |
| `cd server && npm.cmd run lint` | 0 errores y 1 advertencia previa (`order-parts.test.js`) | sin cambio |
| `cd client && flutter test` | **259 pruebas**, todas en verde | +114 pruebas |
| `cd client && flutter analyze` | sin observaciones | sin cambio |

Ninguna prueba de la línea base falló (SC-014: 0 regresiones).

**Regresión tras corregir los defectos del MVP (H-10 a H-12), medida el 2026-11-26:**

| Comando | Resultado | Diferencia con la línea base |
|---|---|---|
| `cd server && npm.cmd test` | 91 suites y **968 pruebas**, todas en verde | +35 suites y +489 pruebas |
| `cd server && npm.cmd run lint` | 0 errores y 1 advertencia previa | sin cambio |

Al cierre, tras corregir dos fechas sin formato (pago de la orden y ficha del cliente), el cliente queda en **261 pruebas** y `flutter analyze` sin observaciones.

## 9. Control de calidad final

Cinco requisitos del Sprint 7 elegidos entre los que más pueden fallar. Pruebas ejecutadas el 2026-11-26 dentro de la regresión final.

| ID | Requisito | Criterio de Aceptación | Prueba ejecutada | Resultado | Evidencia / defecto |
|:--:|---|---|---|---|---|
| RF-01 | Bloqueo por términos (FR-021) | Sin aceptación vigente la API rechaza las operaciones, salvo las rutas exentas | `terms-gate.test.js`, `terms_gate_test.dart`, `terms_gate_http_test.dart` | Aprobado | V5; H-06 resuelto |
| RF-02 | Bitácora sin datos reservados (FR-022, FR-024) | Registra las acciones sensibles sin contraseñas, hashes, tokens ni tarjetas | `audit-log.test.js`, `audit-detail.test.js`, `payments.test.js` | Aprobado | V6; H-07 resuelto |
| RF-03 | Márgenes por taller (FR-003) | Cambiar el margen reclasifica igual en lista, dashboard y avisos | `maintenance-margins.test.js` | Aprobado | V2 |
| RF-04 | Exportación CSV (FR-014) | El archivo coincide fila por fila con la pantalla y neutraliza fórmulas | `reports-export.test.js`, `csv.test.js` | Aprobado | V10 |
| RF-05 | Margen de refacciones (FR-013) | Coincide al centavo con una suma independiente y separa las líneas sin costo | `reports-parts.test.js` | Aprobado | V9-04 |

## 10. Cierre

| Campo | Valor |
|---|---|
| Criterios de salida cumplidos | 5 de 5 (sección 2) |
| Defectos abiertos | Ninguno crítico, alto ni medio. H-02 (bajo, documentación del análisis) aceptado |
| Observaciones | El recorrido con capturas (T131) lo ejecutó el agente; los márgenes de instalación son 30 días y 500 km (D-17); la rotación solo lista refacciones con existencia o movimientos; los datos de ejemplo tienen un solo mecánico; el cambio de contraseña propia requiere haber aceptado los términos; cambiar de sección del menú no avisa de cambios sin guardar |
| Aprobado por | Ignacio Joaquín Trejo |
| Fecha | 2026-11-26 |

# Anexo de evidencias

## Recorrido con capturas de la interfaz (T131), 2026-11-25

Las capturas se repitieron el 2026-11-26, después de corregir H-05, con el mismo
guion y sin fallos.

A petición del responsable, el recorrido lo ejecutó el agente con un guion
(`client/tool/capturas.dart`) que corre la aplicación real contra el backend en
ejecución sobre la base de pruebas `motorix_test` recién sembrada, pulsa y
escribe en sus pantallas y guarda la imagen de la propia aplicación. No es un
recorrido manual hecho por una persona: la revisión visual de las 25 capturas la
hizo el agente; el responsable aprobó el cierre el 2026-11-26. El escenario V8 adelanta en
la base la última actividad 31 minutos en lugar de esperar; el resto del flujo
(respuesta `401 SESSION_IDLE` y aviso) es el real. V7, V12 y V13 no tienen
pantalla propia y se comprobaron por API.

| Escenario | Qué muestra | Captura | Resultado |
|---|---|---|---|
| V5 | Pantalla de aceptación tras iniciar sesión | [`V5-01-terminos-aceptacion-admin.png`](evidencias/sprint-7/V5-01-terminos-aceptacion-admin.png) | Aprobado |
| V5 | Entrada al sistema tras aceptar | [`V5-02-inicio-tras-aceptar.png`](evidencias/sprint-7/V5-02-inicio-tras-aceptar.png) | Aprobado |
| V5 | Sección de términos: versión vigente, aceptaciones y pendientes | [`V5-03-terminos-en-configuracion.png`](evidencias/sprint-7/V5-03-terminos-en-configuracion.png) | Aprobado |
| V1 | Ticket emitido antes del cambio («Taller Motorix») | [`V1-01-ticket-anterior.png`](evidencias/sprint-7/V1-01-ticket-anterior.png) | Aprobado |
| V1 | Datos del taller en Configuración | [`V1-02-configuracion-taller.png`](evidencias/sprint-7/V1-02-configuracion-taller.png) | Aprobado |
| V1 | Datos del taller guardados («Taller Evidencia») | [`V1-03-taller-guardado.png`](evidencias/sprint-7/V1-03-taller-guardado.png) | Aprobado |
| V2 | Márgenes de «Próximo» | [`V2-01-margenes-de-proximo.png`](evidencias/sprint-7/V2-01-margenes-de-proximo.png) | Aprobado |
| V2 | Lista de mantenimientos con margen propio (45 días) y del taller | [`V2-02-lista-de-mantenimientos.png`](evidencias/sprint-7/V2-02-lista-de-mantenimientos.png) | Aprobado |
| V3 | Catálogo de tipos de servicio | [`V3-01-tipos-de-servicio.png`](evidencias/sprint-7/V3-01-tipos-de-servicio.png) | Aprobado |
| V3 | Nombre repetido rechazado | [`V3-02-nombre-repetido.png`](evidencias/sprint-7/V3-02-nombre-repetido.png) | Aprobado |
| V3 | Confirmación «Cambios sin guardar» | [`V3-03-cambios-sin-guardar.png`](evidencias/sprint-7/V3-03-cambios-sin-guardar.png) | Aprobado |
| V4 | Ticket nuevo con los datos nuevos del taller | [`V4-01-ticket-nuevo-con-datos-del-taller.png`](evidencias/sprint-7/V4-01-ticket-nuevo-con-datos-del-taller.png) | Aprobado |
| V4 | Ticket con «Próximo servicio» | [`V4-02-ticket-proximo-servicio.png`](evidencias/sprint-7/V4-02-ticket-proximo-servicio.png) | Aprobado |
| V4 | Selector de tipo en el servicio de la orden | [`V4-03-selector-de-tipo-de-servicio.png`](evidencias/sprint-7/V4-03-selector-de-tipo-de-servicio.png) | Aprobado |
| V4 | Propuesta precargada en el mantenimiento | [`V4-04-propuesta-de-mantenimiento.png`](evidencias/sprint-7/V4-04-propuesta-de-mantenimiento.png) | Aprobado |
| V9 | Reporte de ingresos | [`V9-01-ingresos.png`](evidencias/sprint-7/V9-01-ingresos.png) | Aprobado |
| V9 | Reporte de servicios | [`V9-02-servicios.png`](evidencias/sprint-7/V9-02-servicios.png) | Aprobado |
| V9 | Reporte de productividad | [`V9-03-productividad.png`](evidencias/sprint-7/V9-03-productividad.png) | Aprobado |
| V9 | Reporte de margen con una línea sin costo | [`V9-04-margen-de-refacciones.png`](evidencias/sprint-7/V9-04-margen-de-refacciones.png) | Aprobado |
| V9 | Reporte de rotación | [`V9-05-rotacion.png`](evidencias/sprint-7/V9-05-rotacion.png) | Aprobado |
| V10 | Mensaje con la ruta del CSV exportado | [`V10-01-exportacion-csv.png`](evidencias/sprint-7/V10-01-exportacion-csv.png) | Aprobado |
| V6 | Bitácora con configuración modificada e inicio fallido | [`V6-01-bitacora.png`](evidencias/sprint-7/V6-01-bitacora.png) | Aprobado |
| V11 | Menú de recepción sin Configuración, Bitácora ni Reportes | [`V11-01-menu-recepcion.png`](evidencias/sprint-7/V11-01-menu-recepcion.png) | Aprobado |
| V11 | Menú del mecánico | [`V11-02-menu-mecanico.png`](evidencias/sprint-7/V11-02-menu-mecanico.png) | Aprobado |
| V8 | Aviso de sesión cerrada por inactividad | [`V8-01-sesion-cerrada-por-inactividad.png`](evidencias/sprint-7/V8-01-sesion-cerrada-por-inactividad.png) | Aprobado |

## Verificación por API de V1 a V13 (T130)

50 de 50 comprobaciones aprobadas contra el servidor en ejecución el 2026-11-25
(antes de las correcciones de H-07, que cubren las pruebas automatizadas):
[`evidencias/sprint-7/verificacion-api-v1-v13.md`](evidencias/sprint-7/verificacion-api-v1-v13.md).
