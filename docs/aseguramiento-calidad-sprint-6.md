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
| Fecha de cierre | pendiente |
| Estado general | En curso - criterios de entrada en cumplimiento |

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
- [ ] Línea base de regresión medida y registrada (sección 8) — pendiente (T003).

**Criterios de salida (para cerrar el sprint):**

- [ ] Los 7 criterios de aceptación del spec están Aprobados con evidencia (sección 6 y `docs/evidencias/sprint-6/`).
- [ ] Todas las pruebas de los sprints 1 a 5 siguen pasando (regresión al cierre, sección 8; SC-007).
- [ ] No hay defectos críticos ni altos abiertos (sección 7).
- [ ] La matriz de calidad final está completa, con evidencia (sección 9).
- [ ] Reporte, análisis y matriz no se contradicen (sección 10).

## 3. Puertas de calidad

Pendiente: se completa al cierre con el estado de G-01 a G-08 del sprint (T064).

## 4. Decisiones de aclaración

Pendiente: D-01 a D-08 con su estado (sesión clarify 2026-11-05: 5 resueltas, D-05 derivada, D-06 y D-07 diferidas con default) — se documenta al cierre (T064).

## 5. Riesgos y mitigaciones

Pendiente: se completa al cierre (T064).

## 6. Trazabilidad

Pendiente: trazabilidad CA → tarea → prueba de los criterios de aceptación del spec (CA-1 a CA-13) — se completa al cierre (T064).

## 7. Hallazgos y defectos

Pendiente: se completa al cierre (T064).

## 8. Línea base de regresión

Pendiente (T003): conteos de `npm.cmd test` (backend), `flutter test` y `flutter analyze lib` (frontend) medidos antes de escribir código, y regresión de cierre.

## 9. Control de calidad final

Pendiente: se completa al cierre (T064).

## 10. Cierre

Pendiente: se completa al cierre (T064).

# Anexo de evidencias

Pendiente: E-01 en adelante con recorrido V1 a V10 y capturas (T063).
