# Aseguramiento de la calidad - Sprint 6: Notificaciones internas

Este documento es el registro de calidad del Sprint 6 de Motorix. Reúne los criterios de entrada y de salida, las puertas de calidad, las decisiones, los riesgos, la trazabilidad de los criterios de aceptación, los hallazgos, la regresión de los sprints 1 a 5 y el control de calidad final, con sus evidencias.

**Estado: en curso (inicio 2026-11-18).** Se llenó durante el sprint y se completa al cierre (T064), según [`docs/aseguramiento-calidad/guia-aseguramiento-calidad.md`](../aseguramiento-calidad/guia-aseguramiento-calidad.md).

## 0. Datos del documento

| Campo | Valor |
|---|---|
| Sprint | 6 - Notificaciones internas |
| Insumo | [`docs/sprints/sprint-6-notificaciones-internas.md`](sprints/sprint-6-notificaciones-internas.md) (commit `7d78735`) |
| Especificación | [`specs/006-notificaciones-internas/spec.md`](../specs/006-notificaciones-internas/spec.md) (commits `a06e485` specify, `be2ad7d` clarify) |
| Plan y tareas | `plan.md` (commit `528b405`), `tasks.md` (commit `39c27e1`), 64 tareas en 10 fases |
| Rama | `006-notificaciones-internas` desde `main` (sin squash ni force-push durante todo el sprint) |
| Responsable | Ignacio Joaquín Trejo (proyecto escolar: él mismo aprueba el cierre) |
| Fecha de inicio | 2026-11-18 |
| Fecha de cierre | 2026-11-24 |
| Estado general | Cerrado - implementación, regresión y recorrido manual hechos; aprobado el 2026-11-24 |

## 1. Objetivo y alcance

**Objetivo.** Asegurar que el Sprint 6 salga con calidad: que los requisitos estén completos, sean medibles y no se contradigan, que las pruebas estén planeadas antes del código y que el cambio no rompa lo construido en los sprints 1 a 5.

**Dentro del alcance:** campana con contador en el encabezado; centro de avisos agrupado por tipo (mantenimientos, citas, stock, órdenes detenidas); lectura por usuario; matriz de rol en el backend; lista de «clientes por avisar» con registro de aviso; seeds con un caso por tipo.

**Fuera de alcance:** lo que la sección «Fuera de alcance» del spec lista (envío automático de avisos al cliente, notificaciones en tiempo real/SO, preferencias por usuario, historial de avisos, reportes y configuración del Sprint 7).

## 2. Criterios de entrada y de salida

Estado real al 2026-11-18. Los criterios se completan a lo largo del sprint; `[x]` solo cuando de verdad se cumplió.

**Criterios de entrada (para comenzar la implementación):**

- [x] Si el sprint contradice un principio de la constitución, la enmienda está aprobada y registrada (puerta I del plan): enmienda **1.2.0** en [`.specify/memory/constitution.md`](../.specify/memory/constitution.md) (alcance de 5 a 7 sprints en la introducción y los principios I y III, con reporte de impacto en el encabezado), registrada el 2026-11-18 bajo el criterio T001; ratificación formal del equipo pendiente, como en contribuciones previas.
- [x] Rama `006-notificaciones-internas` creada desde `main` (T002, 2026-11-05), sin squash ni force-push.
- [x] Checklist de requisitos en verde: [`checklists/requirements.md`](../specs/006-notificaciones-internas/checklists/requirements.md) 16/16 (specify + clarify, 2026-11-05).
- [x] Fases de Spec Kit completadas: specify (`a06e485`), clarify (`be2ad7d`), plan (`528b405`), tasks (`39c27e1`).
- [x] Línea base de regresión medida y registrada (sección 8) — T003, 2026-11-22.

**Criterios de salida (para cerrar el sprint):**

- [x] Los 14 criterios de aceptación del insumo están Aprobados con evidencia (sección 6 y `docs/evidencias/sprint-6/`): implementados, con pruebas automáticas en verde y recorrido manual V1 a V10 hecho el 2026-11-24 (capturas de la interfaz y comprobación por la API; el anexo indica cuál evidencia respalda cada escenario).
- [x] Todas las pruebas de los sprints 1 a 5 siguen pasando (regresión al cierre, sección 8; SC-007): 56 suites / 479 pruebas de backend y 145 de Flutter en verde, sin regresiones.
- [x] No hay defectos críticos ni altos abiertos (sección 7).
- [x] La matriz de calidad final está completa, con evidencia (sección 9): pruebas automáticas ejecutadas y capturas del recorrido manual en `docs/evidencias/sprint-6/`.
- [x] Reporte, análisis y matriz no se contradicen (sección 10): confirmado al cerrar, 2026-11-24; H-04 (baja) quedó cerrado por decisión del responsable (se omite `/speckit.analyze`).

## 3. Puertas de calidad

Estado al 2026-11-24. Solo se marca como realizada la puerta que tiene evidencia en el repositorio; las demás se dejan como están.

| ID | Puerta | Estado | Evidencia |
|:--:|---|---|---|
| G-01 | Insumo del sprint revisado contra el código | Sin registro | El insumo [`docs/sprints/sprint-6-notificaciones-internas.md`](sprints/sprint-6-notificaciones-internas.md) está en el commit `7d78735`, pero no hay un registro de la revisión contra el código. Las suposiciones del insumo que no coincidían con el código (por ejemplo, que no existe `order_status_history`) quedaron corregidas en [`research.md`](../specs/006-notificaciones-internas/research.md) P-3 |
| G-02 | Especificación (`/speckit.specify`) | Realizada | [`spec.md`](../specs/006-notificaciones-internas/spec.md), commit `a06e485` |
| G-03 | Aclaraciones (`/speckit.clarify`) | Realizada | Sesión del 2026-11-05 en `spec.md` (`### Session 2026-11-05`), commit `be2ad7d` (sección 4) |
| G-04 | Lista de calidad de requisitos (`/speckit.checklist`) | Realizada | [`checklists/requirements.md`](../specs/006-notificaciones-internas/checklists/requirements.md): 16 de 16 marcados |
| G-05 | Plan (`/speckit.plan`) | Realizada | [`plan.md`](../specs/006-notificaciones-internas/plan.md), commit `528b405`; 7 de 8 puertas de la constitución en PASS y la puerta I resuelta con la enmienda 1.2.0 (commit `eb22526`) |
| G-06 | Tareas (`/speckit.tasks`) | Realizada | [`tasks.md`](../specs/006-notificaciones-internas/tasks.md), commit `39c27e1`: 64 tareas en 10 fases |
| G-07 | Consistencia (`/speckit.analyze`) | **Omitida por decisión del responsable (2026-11-24)** | No hay registro de que se haya ejecutado el análisis entre `tasks.md` y la implementación; el responsable decidió no correrlo antes del cierre. La consistencia se respaldó con la trazabilidad CA-1 a CA-14 (sección 6) y la regresión en verde |
| G-08 | Pruebas planeadas y línea base | Aprobada | Línea base del 2026-11-22 (sección 8); las pruebas se escribieron antes de cada implementación y fallaron primero (T010 a T013, T044, T049 a T051) |

## 4. Decisiones de aclaración

La sesión de `/speckit.clarify` del 2026-11-05 resolvió 5 preguntas; D-05 se derivó de D-04; D-06 y D-07 quedaron diferidas con un valor por defecto documentado en [`research.md`](../specs/006-notificaciones-internas/research.md) (P-14).

| ID | Decisión | Estado | Cómo quedó en el código |
|:--:|---|---|---|
| D-01 | Qué es una orden detenida | Resuelta: más de 2 días sin cambio de estado, en estado no terminal | `esOrdenDetenida` en `server/utils/notification-rules.js`; `unit/notification-rules.test.js` |
| D-02 | Qué es una cita del día | Resuelta: fecha de hoy sin importar su estado; la cita de mañana es motivo de la lista por avisar | `avisosCitas` en `notifications.service.js`; `pendientesCitas` en `client_notice.model.js` |
| D-03 | Cuándo se actualiza el contador | Resuelta: al iniciar sesión, al abrir el panel y al navegar; sin polling | `notifications_provider.dart` y `app_shell.dart` |
| D-04 | Identidad de un aviso para la lectura | Resuelta: tipo, hecho y estado (`TIPO:id:ESTADO`) | `construirClave`; `notification_reads` con clave única |
| D-05 | Aviso leído que empeora | Derivada de D-04: la clave cambia y vuelve a no leído | `unit/notification-rules.test.js` (transiciones) |
| D-06 | Antelación del mantenimiento próximo | Diferida con default: el `warn_days`/`warn_km` de cada registro (RN-11) | `calcularEstadoMantenimiento`, el mismo de la lista y el dashboard |
| D-07 | Aviso al cliente una sola vez por hecho y con nota | Diferida con default: una fila por `(cliente, tipo, hecho)` y nota opcional de hasta 300 caracteres | `client_notices` con `uq_client_notices_source`; `integration/client-notices.test.js` |
| D-08 | Avisos del mecánico | Resuelta: solo sus órdenes asignadas | `MECHANIC: ["ORDER_STOPPED"]` filtrado por `mechanic_id`; T044 y T045 |

## 5. Riesgos y mitigaciones

| ID | Riesgo | Impacto | Mitigación | Prueba que lo cubre | Estado |
|:--:|---|---|---|---|---|
| R-01 | Los avisos calculan distinto que el dashboard, la lista de Mantenimientos o la insignia de Inventario y se contradicen | Alto: números distintos entre pantallas | Reutilizar `listarMantenimientos()`, `partes.listar({ low: true })` y `calcularEstadoMantenimiento`; no duplicar reglas | `integration/notifications.test.js`: «los números del centro coinciden 1:1 con dashboard y con la lista de Mantenimientos» y «el stock del centro es idéntico a la insignia y a las alertas del dashboard» | Mitigado |
| R-02 | El stock llega a recepción o al mecánico | Alto: fuga de información de inventario | Matriz de rol en el backend y guarda explícita de stock solo ADMIN | `integration/notifications.test.js`: «recepción ve mantenimientos, citas y órdenes, y nunca stock» y «el stock no sale del administrador» | Mitigado |
| R-03 | El mecánico recibe avisos de órdenes de otros mecánicos o accede a la lista de clientes | Alto: información ajena | Filtro por `mechanic_id` y `authorize("ADMIN","RECEPTIONIST")` en `/api/client-notices` | `integration/notifications.test.js` (US5, T044 y T045); `integration/client-notices.test.js` y `contract/client-notices.contract.test.js` (403) | Mitigado |
| R-04 | El cálculo en cada consulta hace lenta la campana | Medio | Consultas acotadas sobre datos existentes, sin tabla de avisos | `integration/notifications.test.js`: respuesta en menos de 1000 ms (CA-13) | Mitigado en prueba; falta la medición de panel < 2 s del recorrido (V10) |
| R-05 | Un cliente queda avisado dos veces por el mismo hecho | Medio: avisos repetidos | Clave única `(client_id, notice_type, source_id)` e `INSERT IGNORE` dentro de una transacción | `integration/client-notices.test.js`: «201 la primera vez … 200 al repetir sin duplicar ni pisar». No hay prueba de dos peticiones simultáneas; la garantía es estructural (clave única) | Mitigado |
| R-06 | La migración nueva altera tablas existentes o rompe el control de checksums | Medio | `015_notifications.sql` aditiva, sin tocar migraciones previas | Aplicación en la base principal y en `motorix_test` (T006) y regresión completa en verde | Mitigado (ver H-01) |
| R-07 | La documentación queda desfasada de lo entregado | Bajo | Actualizar `project-context.md` 6.12 en el mismo sprint (CA-14) | Revisión del diff de T059 | Mitigado |

## 6. Trazabilidad

Cada criterio de aceptación del insumo con las tareas que lo implementan y las pruebas que lo verifican. **Estado «Probado»** = implementado y con pruebas automáticas en verde; la evidencia del recorrido manual (V1 a V10, T063) está en el anexo y en `docs/evidencias/sprint-6/`.

| CA | Criterio (resumen) | Tareas | Pruebas | Recorrido | Estado |
|:--:|---|---|---|:--:|---|
| CA-1 | Campana con total de no leídos y panel agrupado por tipo | T014 a T019 | `client/test/notifications_panel_test.dart` (campana y panel); `integration/notifications.test.js` | V1, V3 | Probado |
| CA-2 | Avisos calculados al consultar; solo se guarda la lectura | T014, T004 | `integration/notifications.test.js`: «cada consulta recalcula los avisos: no hay caché» | V2 | Probado |
| CA-3 | Tipos: mantenimientos, citas del día, stock, órdenes detenidas | T014, T034, T041 | `integration/notifications.test.js` (4 casos sembrados); `unit/notification-rules.test.js` | V3 | Probado |
| CA-4 | Cada rol recibe solo sus avisos; el stock solo para ADMIN | T033, T038, T047 | `integration/notifications.test.js` (recepción, stock solo admin, mecánico con y sin órdenes); `client/test/notifications_panel_test.dart` (mecánico) | V1 | Probado |
| CA-5 | Mismo cálculo que dashboard, mantenimientos y stock | T032, T034, T037 | `integration/notifications.test.js`: paridad con módulos y convivencia con la insignia | V4 | Probado |
| CA-6 | Lectura por usuario; reaparece si cambia el estado | T021 a T030 | `unit/notification-rules.test.js`; `integration/notifications.test.js` (lectura por usuario e idempotencia); `contract/notifications.contract.test.js` | V5, V6 | Probado |
| CA-7 | Cada aviso abre su pantalla relacionada | T029, T042 | `client/test/notifications_panel_test.dart`: «marcar leído … abre la pantalla relacionada» y «las rutas de los avisos abren su sección» | V3 | Probado |
| CA-8 | La insignia de Inventario y el aviso de inicio siguen funcionando | T020, T035, T039, T060 | Suites `dashboard`, `parts-catalog`, `parts-alerts` y `maintenances`: 7 suites / 57 pruebas en verde | V4 | Probado |
| CA-9 | Estados de carga, vacío y error | T019 | `client/test/notifications_panel_test.dart` (LoadingView, EmptyView, ErrorView); `client/test/client_notices_test.dart` | V3 | Probado |
| CA-10 | La lista de clientes por avisar es solo ADMIN y recepción; el mecánico no accede | T049 a T058 | `integration/client-notices.test.js`; `contract/client-notices.contract.test.js` (403); `client/test/client_notices_test.dart` (sección solo para ADMIN y recepción) | V7 | Probado |
| CA-11 | Avisar guarda quién y cuándo, quita la fila y no repite el hecho | T052, T053, T057 | `integration/client-notices.test.js` (201/200, nota, un hecho por vez); `client/test/client_notices_test.dart` | V8, V9 | Probado |
| CA-12 | Seeds con al menos un caso por tipo, idempotentes | T008 | Doble pasada de `npm.cmd run seed` con 0 registros nuevos (T008) | V3 | Verificado |
| CA-13 | Pruebas de cálculo, permisos, lectura y rendimiento | T010 a T013, T021 a T024, T031 a T041, T044 a T046, T049 a T051 | Las suites anteriores; rendimiento < 1000 ms | V10 | Probado |
| CA-14 | `project-context.md` 6.12 y `design-system.md` actualizados | T059 | Sección 6.12 reescrita con el comportamiento entregado; `design-system.md` no cambia porque no se agregó ningún token (solo se usaron `AppColors`, `AppSpacing` y `AppRadii` existentes) | — | Cumplido |

## 7. Hallazgos y defectos

| ID | Descripción | Severidad | Origen | Estado | Resolución |
|:--:|---|---|---|---|---|
| H-01 | El backend arrancó en rojo en la línea base: el checksum de `014_order_parts_price.sql` no coincidía porque el archivo tenía fin de línea CRLF y `schema_migrations` guardaba el hash de la versión LF | Media | T003 (línea base) | Resuelto | Se restauraron los bytes LF originales (contenido SQL idéntico, `git diff` vacío); la línea base quedó en verde |
| H-02 | La cabecera de la lista de Mantenimientos se desbordaba con títulos largos | Baja | Implementación de US1 | Resuelto | Commit `536987f`: se evitó el desbordamiento de la cabecera con títulos largos |
| H-03 | El contrato de `GET /api/client-notices` pedía `id` y `createdAt = notified_at`, pero un pendiente aún no tiene fila en `client_notices` | Baja | US7 (T052 y T053) | Resuelto | `id` es la posición del pendiente en la respuesta y `createdAt` es la fecha del hecho; el contrato [`client-notices.md`](../specs/006-notificaciones-internas/contracts/client-notices.md) quedó actualizado y la pantalla identifica cada fila por `(clientId, motive, sourceId)` |
| H-04 | No consta la ejecución de `/speckit.analyze` (G-07) | Baja | Cierre | Cerrado por decisión | El responsable decidió omitir `/speckit.analyze` (2026-11-24); queda registrado en G-07 |

No hay defectos críticos ni altos abiertos.

## 8. Línea base de regresión

**Línea base (antes de escribir código del sprint), medida el 2026-11-22 en la rama `006-notificaciones-internas`:**

| Comando | Resultado |
|---|---|
| `cd server && npm.cmd test` | 51 suites y **423 pruebas**, todas en verde |
| `flutter test` (en `client/`) | **128 pruebas**, todas en verde |
| `flutter analyze lib` (en `client/`) | sin observaciones |

Nota de la primera corrida: el backend arrancó en rojo por el checksum de `014_order_parts_price.sql` (hallazgo H-01 de la sección 7). Se restauraron los bytes LF originales (contenido SQL idéntico) y la línea base quedó en verde.

**Regresión de cierre, medida el 2026-11-24 con las 64 tareas implementadas salvo el recorrido manual:**

| Comando | Resultado | Diferencia con la línea base |
|---|---|---|
| `cd server && npm.cmd test` | **56 suites y 479 pruebas**, todas en verde | +5 suites y +56 pruebas |
| `flutter test` (en `client/`) | **145 pruebas**, todas en verde | +17 pruebas |
| `flutter analyze lib` (en `client/`) | sin observaciones | sin cambio |

Ninguna prueba que estaba en verde en la línea base falló (SC-007: 0 regresiones). Las suites de convivencia (CA-8) por separado: `dashboard`, `parts-catalog`, `parts-alerts` y `maintenances`, 7 suites y 57 pruebas en verde.

## 9. Control de calidad final

Cinco requisitos del Sprint 6 elegidos entre los que más pueden fallar. **Las pruebas automáticas se ejecutaron en verde y la columna «Evidencia» apunta a las capturas del recorrido manual (anexo).**

| ID | Requisito | Criterio de Aceptación | Prueba ejecutada | Resultado | Evidencia / defecto |
|:--:|---|---|---|---|---|
| RF-01 | `spec.md` FR-004 (CA-4): cada rol recibe solo sus avisos; el stock solo para el administrador y el mecánico solo de sus órdenes. | Con la misma escena, administrador ve 4 grupos con datos, recepción 3 sin stock y el mecánico solo sus órdenes detenidas; las de otro mecánico no se entregan. | `integration/notifications.test.js`: «recepción ve mantenimientos, citas y órdenes, y nunca stock», «el stock no sale del administrador» y «ve solo sus órdenes detenidas y no las de otros mecánicos» | Aprobado (automática) | Captura `V1-V3-panel-admin.png` y `V1-panel-mecanico.png` (V1); recepción comprobada por API |
| RF-02 | `spec.md` FR-006 (CA-6): la lectura persiste por usuario y no afecta a otros. | Marcar leído baja el contador y persiste; otro administrador sigue viendo el aviso como no leído; repetir no duplica. | `integration/notifications.test.js` («baja unreadCount de inmediato…», «es por usuario…», «repetir la llamada es idempotente…») | Aprobado (automática) | Captura `V5-aviso-leido.png` (V5); el otro usuario comprobado por API |
| RF-03 | `spec.md` FR-005 (CA-5): los números del centro coinciden con dashboard, Mantenimientos e Inventario. | 0 diferencias entre el centro, el dashboard, la lista de Mantenimientos y la insignia de Inventario. | `integration/notifications.test.js`: «los números del centro coinciden 1:1 con dashboard y con la lista de Mantenimientos» y «el stock del centro es idéntico a la insignia y a las alertas del dashboard» | Aprobado (automática) | Capturas `V1-V3-panel-admin.png` y `V2-contador-sin-cambio.png` (V4) |
| RF-04 | `spec.md` FR-011 (CA-11): avisar a un cliente registra quién y cuándo, sale de la lista y no se repite por el mismo hecho. | Primera vez 201, repetir 200 sin duplicar ni pisar la nota; el mismo cliente conserva sus otros motivos. | `integration/client-notices.test.js`: «201 la primera vez … 200 al repetir», «al avisar un hecho solo sale ese»; `client/test/client_notices_test.dart` | Aprobado (automática) | Captura `V8-dialogo-nota.png` y `V7-por-avisar-admin-10.png` (V8); V9 comprobado por API |
| RF-05 | `spec.md` FR-010 (CA-10): el mecánico no accede a la lista de clientes por avisar. | 403 `FORBIDDEN` en GET y POST sin escribir nada; la sección no aparece en su menú. | `integration/client-notices.test.js` («el mecánico recibe 403 FORBIDDEN en GET y POST»); `contract/client-notices.contract.test.js`; `client/test/client_notices_test.dart` (sección solo para ADMIN y recepción) | Aprobado (automática) | Capturas `V7-menu-mecanico.png` y `V7-por-avisar-admin-11.png` (V7); 403 comprobado por API |

## 10. Cierre

Registro del cierre técnico (2026-11-24). **Sprint cerrado y aprobado por el responsable.**

| Campo | Valor |
|---|---|
| Criterios de salida cumplidos | 5 de 5 (sección 2) |
| Defectos abiertos | Ninguno de implementación. Ninguno abierto. H-04 (no se ejecutó `/speckit.analyze`) se cerró por decisión del responsable |
| Observaciones | 64 tareas: T001 a T064 hechas; el recorrido manual (T063) se hizo el 2026-11-24. Rama `006-notificaciones-internas`, sin squash ni force-push. El trabajo de T044 a T064 se hizo con Claude Code después de usar opencode en T001 a T043; el flujo de Spec Kit no cambió |
| Aprobado por | Ignacio Joaquín Trejo (responsable del proyecto) |
| Fecha | 2026-11-24 |

# Anexo de evidencias

## E-00 Corrida automática del cierre (2026-11-24)

| Comando | Resultado |
|---|---|
| `cd server && npm.cmd test` | `Test Suites: 56 passed, 56 total` / `Tests: 479 passed, 479 total` |
| `cd server && npm.cmd test -- dashboard parts-catalog parts-alerts maintenances` | `Test Suites: 7 passed, 7 total` / `Tests: 57 passed, 57 total` |
| `cd client && flutter test` | `All tests passed!` (145 pruebas) |
| `cd client && flutter analyze lib` | `No issues found!` |

## Recorrido manual V1 a V10 (T063)

Se siguió [`quickstart.md`](../specs/006-notificaciones-internas/quickstart.md) el 2026-11-24 con los usuarios del seed (`admin`, `recepcion`, `mecanico`). Las capturas están en `docs/evidencias/sprint-6/`. Lo que una imagen no puede mostrar (otros usuarios, tiempos, códigos HTTP) se comprobó contra la API en ejecución y se indica como «API».

| Recorrido | Escenario | Captura | Resultado |
|:--:|---|---|---|
| V1 | Campana por rol (CA-4) | `V1-V3-panel-admin.png`, `V1-panel-mecanico.png` | Aprobado. Administrador: 20 avisos en 4 grupos. Mecánico: 8 sin leer, solo «Órdenes detenidas». API: recepción 16 avisos y 0 de stock |
| V2 | Contador sin polling (D-03) | `V2-contador-sin-cambio.png` | Aprobado con reserva: la captura única muestra 20 sin leer a las 4:36 p. m. y no basta para probar que el valor no cambió solo; el contador solo se recarga al iniciar sesión, abrir el panel o cambiar de sección (T017, prueba del proveedor) |
| V3 | Aviso por tipo (CA-3, CA-12) | `V1-V3-panel-admin.png` | Aprobado. Hay mantenimientos (2 vencidos y 1 próximo), cita de hoy, stock bajo y órdenes detenidas |
| V4 | Coincidencia con módulos (CA-5) | `V1-V3-panel-admin.png`, `V2-contador-sin-cambio.png` | Aprobado. El grupo Stock del panel muestra 4 avisos y Inventario muestra «Stock bajo: 4» (3 con stock bajo y 1 agotado): coinciden |
| V5 | Lectura individual (D-04) | `V5-aviso-leido.png` | Aprobado. El aviso leído sigue visible con la marca de leído y el contador baja de 20 a 19. API: el usuario de recepción conserva 16 sin leer; marcar dos veces devuelve 200 las dos |
| V6 | Reaparición por empeoramiento (CA-6) | `V1-V3-panel-admin.png` frente a `V4-V6-inventario-admin-18.png` | Aprobado. Al normalizarse el stock del amortiguador (mínimo de 4 a 2) el aviso desaparece y el contador baja de 20 a 18. API: al llevar el stock de 3 a 0 apareció `STOCK:3:OUT` sin leer, la clave `LOW` desapareció y al restituir volvió |
| V7 | Lista por avisar y acceso del mecánico (CA-10) | `V7-menu-mecanico.png`, `V7-por-avisar-admin-11.png` | Aprobado. El menú del mecánico no trae «Por avisar»; administrador ve nombre, teléfono, motivo y contexto. API: el mecánico recibe 403 |
| V8 | Registro idempotente (CA-11) | `V8-dialogo-nota.png`, `V7-por-avisar-admin-11.png`, `V7-por-avisar-admin-10.png` | Aprobado. El diálogo pide la nota (35/300) y la lista pasa de 11 a 10 al registrar. API: primera vez 201, repetir 200 con el mismo id, y el mecánico recibe 403 |
| V9 | Una vez por hecho (CA-11, D-07) | Sin captura | Aprobado por API. Juan Pérez tiene 4 motivos; al avisar uno, los otros 3 siguen en la lista |
| V10 | Rendimiento (CA-13, SC-006) | Sin captura | Aprobado por API. 10 consultas a `GET /api/notifications` tardaron entre 2 y 3 ms (límite de 1000 ms), y la prueba automática del endpoint pasa |

### Observaciones del recorrido

- Las capturas de V1 y V3 del administrador cuentan 20 avisos y las de Inventario 18: entre ambas se normalizó el stock de una pieza y se marcó un aviso como leído, por lo que la diferencia es esperada.
- El ajuste de stock de V6 por la API dejó dos movimientos de ajuste en la pieza 3 (−3 y +3, con motivo); el stock volvió a 3.
- No se registró captura de V9 ni de V10; su evidencia es la comprobación por la API descrita arriba.
