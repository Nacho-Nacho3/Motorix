<!--
Insumo de especificacion para /speckit.specify.
Sprint 3 del MVP de Motorix: historial, mantenimiento e inventario.
-->

# Insumo de especificacion - Sprint 3: Historial, mantenimiento e inventario

> Referencias obligatorias para el agente:
> - Contexto maestro: `docs/project-context.md`
> - Constitucion: `docs/reglas.md` y `.specify/memory/constitution.md`
> - Este documento describe unicamente el alcance del Sprint 3.

## 1. Contexto del sprint

Se apoya en las ordenes de servicio del Sprint 2 para construir el historial del vehiculo, programar proximos mantenimientos y controlar el inventario de refacciones utilizadas.

## 2. Objetivo

Mantener el historial de servicios por vehiculo a partir de las ordenes terminadas, dar seguimiento a proximos mantenimientos y controlar el inventario de refacciones con alertas de stock bajo.

## 3. Historias de usuario del sprint

- **US1** - Como mecanico, quiero consultar el historial de servicios de un vehiculo para conocer su estado y antecedentes.
- **US2** - Como mecanico, quiero registrar el kilometraje de cada servicio para mantener actualizado el historial.
- **US3** - Como mecanico, quiero establecer el proximo mantenimiento para programar el siguiente servicio.
- **US4** - Como recepcionista, quiero consultar los mantenimientos proximos para avisar al cliente.
- **US5** - Como administrador, quiero registrar y consultar refacciones para controlar el inventario.
- **US6** - Como administrador, quiero consultar el stock disponible para saber que hay en existencia.
- **US7** - Como mecanico, quiero agregar refacciones utilizadas a una orden para reflejar su uso.
- **US8** - Como administrador, quiero visualizar alertas de stock bajo para reabastecer a tiempo.

## 4. Flujo demostrable al cierre del sprint

    Finalizar servicio
    -> conservarlo en historial
    -> registrar proximo mantenimiento
    -> utilizar refacciones en la orden
    -> actualizar inventario
    -> mostrar alertas de stock

## 5. Entidades y tablas que toca este sprint

| Entidad / tabla       | Accion en este sprint |
|-----------------------|-----------------------|
| `maintenance`         | crear tabla, registrar, consultar, actualizar |
| `parts`               | crear tabla, registrar, consultar, actualizar |
| `inventory_movements` | crear tabla, registrar entradas y salidas |
| `order_parts`         | crear tabla de refacciones utilizadas por orden |

## 6. Reglas de negocio aplicables

- RN-6: Las refacciones utilizadas deben estar relacionadas con una orden.
- RN-7: El uso de una refaccion debe generar o reflejar una salida de inventario.
- RN-8: No permitir stock negativo salvo que el equipo defina explicitamente una politica distinta.
- RN-10: El historial del vehiculo debe derivarse de informacion registrada, evitando duplicacion innecesaria.
- RN-11: Los proximos mantenimientos deben basarse en fecha, kilometraje o ambos.
- RN-12: Los intervalos de mantenimiento son configurables; no asumir valores universales.

## 7. Criterios de aceptacion

- [X] CA-1: Consultar el historial de un vehiculo muestra las ordenes terminadas en orden cronologico. — Evidencia: quickstart V2 (9 comprobaciones PASS, entradas solo FINISHED/DELIVERED en orden cronológico con diagnóstico, servicios, mano de obra, refacciones, observaciones y recomendaciones); pruebas `vehicle-history` (integración + contrato).
- [X] CA-2: Registrar el proximo mantenimiento por fecha y/o kilometraje funciona. — Evidencia: quickstart V3 (alta 201 con `state` calculado; sin fecha ni kilometraje → 400 `MAINTENANCE_TARGET_REQUIRED`; re-registro reemplaza sin duplicar); pruebas `maintenances` y `maintenances.contract`.
- [X] CA-3: Consultar mantenimientos proximos y vencidos devuelve resultados correctos. — Evidencia: quickstart V4 (lista OVERDUE → UPCOMING → NORMAL con los 3 estados en los datos de ejemplo; `?state=XX` → 400; `recepcion` → 403 en POST); pruebas unit `maintenance-state` y `maintenances-list`.
- [X] CA-4: Registrar refacciones y consultar su stock funciona contra MySQL local. — Evidencia: quickstart V5 (alta 201 con `IN` inicial, saldo de `GET /api/parts` == columna `stock_current`, código duplicado → 400); pruebas `parts-catalog`, `stock-balance` e `inventory.contract`.
- [X] CA-5: Agregar una refaccion a una orden genera un movimiento de salida en el inventario. — Evidencia: quickstart V6 (uso 201, stock baja 1 y movimiento `OUT` con el `orderId`); pruebas `order-parts` (integración + contrato).
- [X] CA-6: El sistema impide stock negativo. — Evidencia: quickstart V6.3 (`quantity` > stock → 400 `STOCK_INSUFFICIENT` sin fila, sin movimiento y sin descuento) y V7.1 (`ADJUSTMENT` que dejaría negativo → 400 sin cambio); pruebas unit `inventory-stock` y `order-parts`.
- [X] CA-7: Las alertas de stock bajo se muestran en la interfaz. — Evidencia: quickstart V7.4/V7.5 (filtro `?low=true` entra y sale con el stock; recuento == `lowStockCount`) y V9.3; chip «Stock bajo» y píldoras de estado en `parts_list_screen.dart`; pruebas `parts-alerts` y `parts_alerts_test.dart` (3 widget).
- [X] CA-8: Las pruebas de logica de inventario y mantenimiento existen y pasan. — Evidencia: quickstart V10.3 (`npm test` 39 suites / 308 tests y `npm run lint` limpio; `flutter analyze` 0 issues y `flutter test` 98/98); V10.4 con instalación desde cero 001→011 + seed ×2 sin duplicados.

## 8. Fuera de alcance de este sprint

- Pagos.
- Mercado Pago.
- Tickets.
- Dashboard.
- Notificaciones externas (correo, WhatsApp).

## 9. Decisiones pendientes que deben resolverse en /speckit.clarify

- Modelo exacto de historial: tabla derivada o vista calculada.
- Reglas de vencimiento de mantenimiento: umbrales por fecha y por kilometraje.
- Politica de stock negativo: prohibido o permitido con advertencia.
- Tipos de movimiento de inventario permitidos: IN, OUT, ADJUSTMENT y su uso exacto.

## 10. Restricciones tecnicas heredadas

- Backend en ES Modules, nunca CommonJS.
- Solo el backend accede a MySQL; el frontend nunca se conecta directo.
- Permisos validados en backend, no solo en UI.
- Sin secretos en el repositorio.
- Idioma: espanol en chat, docs, comentarios y pruebas.
- MySQL local, InnoDB, llaves foraneas, `utf8mb4`.
- Login acepta usuario o correo electronico en el mismo campo.
- Toda pantalla del frontend sigue `docs/design-system.md`.
- Pruebas de integracion contra `motorix_test`, nunca contra la base principal.
- Los seeds del sprint DEBEN incluir datos de ejemplo suficientes para que la aplicacion muestre informacion al arrancar. La base no puede quedar vacia tras la instalacion.
- Los seeds DEBEN ser idempotentes: si se corren de nuevo, no duplican registros.