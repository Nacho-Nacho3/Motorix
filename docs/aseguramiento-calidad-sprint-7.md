# Aseguramiento de la calidad - Sprint 7: Reportes, configuración, términos y seguridad

Este documento es el registro de calidad del Sprint 7 de Motorix. Reúne los criterios de entrada y de salida, las puertas de calidad, las decisiones, los riesgos, la trazabilidad de los criterios de aceptación, los hallazgos, la regresión de los sprints 1 a 6 y el control de calidad final, con sus evidencias.

**Estado: en curso (inicio 2026-11-24).** Se llena durante el sprint y se completa al cierre (T132), según [`docs/aseguramiento-calidad/guia-aseguramiento-calidad.md`](aseguramiento-calidad/guia-aseguramiento-calidad.md).

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
| Fecha de cierre | Pendiente (se llena al cierre) |
| Estado general | En curso |

## 1. Objetivo y alcance

**Objetivo.** Asegurar que el Sprint 7 salga con calidad: que los requisitos estén completos, sean medibles y no se contradigan, que las pruebas estén planeadas antes del código y que el cambio no rompa lo construido en los sprints 1 a 6.

**Dentro del alcance:** configuración del taller y de los márgenes de mantenimiento; catálogo de tipos de servicio; reportes de ingresos, servicios, productividad, costo y margen de refacciones y rotación de inventario, con exportación CSV; términos y condiciones con aceptación versionada; bitácora de acciones sensibles; política de contraseñas; cierre por inactividad; verificación de que la API no expone datos reservados.

**Fuera de alcance:** lo que la sección «Fuera de alcance» del spec lista.

## 2. Criterios de entrada y de salida

Estado real al 2026-11-25. `[x]` solo cuando de verdad se cumplió.

**Criterios de entrada (para comenzar la implementación):**

- [x] La constitución 1.2.0 ya cubre el sprint 7 (alcance de 7 sprints); no hay enmienda nueva.
- [x] Rama `007-reportes-configuracion` creada desde `main` (2026-11-24), sin squash ni force-push.
- [x] Checklist de requisitos en verde: [`checklists/requirements.md`](../specs/007-reportes-configuracion/checklists/requirements.md) 16/16.
- [x] Fases de Spec Kit completadas: specify (`04fe96c`), clarify (`c2f9a0c`), plan (`1a547ac`), tasks (`e1cd554`) y analyze (corregido en `dea8f78`).
- [x] Línea base de regresión medida y registrada (sección 8) — T003, 2026-11-25.

**Criterios de salida (para cerrar el sprint):**

- [ ] Los 26 criterios de aceptación del insumo están Aprobados con evidencia (sección 6).
- [ ] Todas las pruebas de los sprints 1 a 6 siguen pasando (sección 8).
- [ ] No hay defectos críticos ni altos abiertos (sección 7).
- [ ] La matriz de calidad final está completa, con evidencia (sección 9).
- [ ] Reporte, análisis y matriz no se contradicen (sección 10).

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

La sesión de `/speckit.clarify` del 2026-11-24 resolvió D-16, D-10 (parcial), D-01, D-07 y D-05; D-19 se agregó al detectar que la orden no tenía fecha de terminación. Las demás decisiones del insumo quedaron con un valor por omisión documentado en [`spec.md`](../specs/007-reportes-configuracion/spec.md) y [`research.md`](../specs/007-reportes-configuracion/research.md). Se completa la tabla al cierre.

## 5. Riesgos y mitigaciones

Se llenan conforme se implementa (ver `plan.md` R-01 a R-04 y `research.md`).

| ID | Riesgo | Impacto | Mitigación | Prueba que lo cubre | Estado |
|:--:|---|---|---|---|---|
| R-01 | El bloqueo por términos rompe las suites autenticadas existentes | Alto: regresión masiva | El helper de pruebas registra la aceptación de la versión vigente (T017) | Regresión T019 y T077 | Abierto |
| R-02 | La migración 016 altera datos existentes | Medio | Cambios aditivos con rellenos documentados y sin migración inversa | T011 | Abierto |

## 6. Trazabilidad

Se llena al cierre (T132) con los 26 criterios CA-1 a CA-26.

| CA | Criterio de aceptación (resumen) | Requisito (FR) | Tarea | Prueba | Resultado | Evidencia |
|:--:|---|---|---|---|---|---|
| — | Pendiente de llenar al cierre | — | — | — | — | — |

## 7. Hallazgos y defectos

| ID | Descripción | Severidad | Origen | Estado | Resolución | Evidencia |
|:--:|---|---|---|---|---|---|
| H-01 | La línea base del backend arrancó en rojo (46 suites): el checksum de `015_notifications.sql` no coincidía porque la copia de trabajo tenía fin de línea CRLF (autocrlf de Windows) y `schema_migrations` guardaba el hash de la versión LF; es la misma causa que H-01 del Sprint 6 | Media | T003 (línea base) | Resuelto | Se restauraron los bytes LF (contenido idéntico a `HEAD`) y se agregó `.gitattributes` con `database/migrations/*.sql text eol=lf` para que no se repita | `.gitattributes` |
| H-03 | `GET /api/appointments?date=<texto>` respondía 500 porque la fecha no se validaba antes de la consulta (no era inyección: la consulta ya usaba parámetros) | Media | T082 (prueba de entradas maliciosas) | Resuelto | `list` valida el formato `YYYY-MM-DD` y responde 400 `VALIDATION_ERROR` | `server/services/appointments.service.js` |
| H-04 | El catálogo mostraba «Usado en 1 servicios» (sin concordancia de número) | Baja | T131 (capturas) | Resuelto | Se usa el singular cuando es una sola línea, también en el aviso al desactivar | `V3-01-tipos-de-servicio.png` |
| H-05 | Detalles de presentación: Configuración, Bitácora y Reportes repiten el título (cabecera del menú y barra propia, como el Dashboard); la bitácora muestra la clave técnica del campo (`shop.name`); la lista de aceptaciones y el encabezado del ticket muestran la fecha en formato ISO | Baja | T131 (capturas) | Abierto | Pendiente de decisión del responsable; no afecta a ningún criterio de aceptación | Capturas V1, V5 y V6 |
| H-06 | En escritorio, desplazar los textos de la pantalla de aceptación de términos producía el error «The Scrollbar's ScrollController has no ScrollPosition attached» (la barra no tenía controlador propio); las pruebas anteriores no lo detectaban | Media | Revisión en la aplicación (registro de `flutter run`) | Resuelto | La barra y la lista comparten un `ScrollController`; prueba nueva con la plataforma Windows (Flutter queda en 252 pruebas) | `client/test/terms_gate_test.dart` |
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

## 9. Control de calidad final

Se eligen cinco requisitos del Sprint 7 entre los que más pueden fallar (bloqueo por términos, bitácora sin datos reservados, márgenes por taller, exportación CSV, cálculo de margen). Se llena al cierre (T132).

| ID | Requisito | Criterio de Aceptación | Prueba ejecutada | Resultado | Evidencia / defecto |
|:--:|---|---|---|---|---|
| RF-01 | Pendiente | | | | |

## 10. Cierre

| Campo | Valor |
|---|---|
| Criterios de salida cumplidos | Pendiente |
| Defectos abiertos | Pendiente |
| Observaciones | Pendiente |
| Aprobado por | Pendiente |
| Fecha | Pendiente |

# Anexo de evidencias

## Recorrido con capturas de la interfaz (T131), 2026-11-25

A petición del responsable, el recorrido lo ejecutó el agente con un guion
(`client/tool/capturas.dart`) que corre la aplicación real contra el backend en
ejecución sobre la base de pruebas `motorix_test` recién sembrada, pulsa y
escribe en sus pantallas y guarda la imagen de la propia aplicación. No es un
recorrido manual hecho por una persona: la revisión visual de las 25 capturas la
hizo el agente y queda pendiente la del responsable. El escenario V8 adelanta en
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

50 de 50 comprobaciones aprobadas contra el servidor en ejecución:
[`evidencias/sprint-7/verificacion-api-v1-v13.md`](evidencias/sprint-7/verificacion-api-v1-v13.md).
