<!--
Insumo de especificacion para /speckit.specify.
Sprint 4 del MVP de Motorix: pagos, tickets y dashboard.
-->

# Insumo de especificacion - Sprint 4: Pagos, tickets y dashboard

> Referencias obligatorias para el agente:
> - Contexto maestro: `docs/project-context.md`
> - Constitucion: `docs/reglas.md` y `.specify/memory/constitution.md`
> - Este documento describe unicamente el alcance del Sprint 4.

## 1. Contexto del sprint

Cierra el MVP. Se apoya en las ordenes de servicio (Sprint 2) y en el control de refacciones y mantenimientos (Sprint 3) para completar el ciclo de atencion: cobro, ticket y vision general del taller.

## 2. Objetivo

Permitir el registro de pagos asociados a una orden (incluyendo Mercado Pago en sandbox), la generacion de tickets de servicio y la consulta de un panel de control con informacion general del taller.

## 3. Historias de usuario del sprint

- **US1** - Como recepcionista, quiero registrar el pago de una orden para cerrar el ciclo del servicio.
- **US2** - Como recepcionista, quiero seleccionar el metodo de pago para dejar constancia de como se cobro.
- **US3** - Como recepcionista, quiero gestionar pagos mediante Mercado Pago para ofrecer una opcion digital.
- **US4** - Como recepcionista, quiero generar tickets de servicio para entregar comprobante al cliente.
- **US5** - Como administrador, quiero consultar informacion general desde el panel de control para supervisar el taller.
- **US6** - Como administrador, quiero visualizar ordenes, citas, mantenimientos y alertas de inventario en el dashboard.

## 4. Flujo demostrable al cierre del sprint

    Orden terminada
    -> calcular / consultar total
    -> registrar pago
    -> Mercado Pago cuando corresponda
    -> generar ticket
    -> consultar indicadores en dashboard

## 5. Entidades y tablas que toca este sprint

| Entidad / tabla | Accion en este sprint |
|-----------------|-----------------------|
| `payments`      | crear tabla, registrar, consultar, actualizar estado |
| `tickets`       | crear tabla, generar, consultar |
| ordenes y citas | consultar para el dashboard |
| `inventory_movements` | consultar para el dashboard |

## 6. Reglas de negocio aplicables

- RN-9: Una orden entregada debe conservarse como historial.
- RN-13: Todo pago debe estar relacionado con una orden.
- RN-14: Los datos sensibles del procesamiento de pagos no deben almacenarse en la aplicacion.
- RN-15: Los permisos deben validarse en backend.

## 7. Criterios de aceptacion

- [X] CA-1: Registrar un pago asociado a una orden funciona y persiste en MySQL local. (Evidencia 2026-10-14: `quickstart-resultados.md` V2 — `POST .../payments` → 201 `PAID` y la fila queda en `payments` de la base local — más `server/tests/integration/payments.test.js` y `payments.contract.test.js` en verde)
- [X] CA-2: Se soportan los metodos efectivo, tarjeta, transferencia y Mercado Pago. (Evidencia: V2 — CASH, CARD y TRANSFER probados por API con `PAID` en cada orden; MERCADO_PAGO aceptado por el validador y probado en `payments-mp.test.js` con cliente simulado — 409 `MERCADO_PAGO_NOT_CONFIGURED` en este entorno sin credenciales, V4)
- [X] CA-3: Mercado Pago se integra en modo sandbox y no se almacenan datos de tarjeta. (Evidencia: V4 — alta MP → 409 sin credenciales y columnas de `payments` = `id, order_id, amount, method, status, external_reference, created_by, created_at, updated_at`, cero datos de tarjeta; integración sandbox con `initPoint`, `approved → PAID` y `rejected → REJECTED` verificada en `payments-mp.test.js` — 10 pruebas con cliente HTTP simulado y sin red. Ejecución manual con cuenta sandbox: NO APLICA, sin credenciales en este entorno)
- [X] CA-4: El ticket incluye folio, datos del taller, cliente, vehiculo, placas, kilometraje, servicios, refacciones, mano de obra, subtotal, total, metodo de pago, estado del pago y fecha. (Evidencia: V5 — `POST .../ticket` → 201 con folio `TCK-\d{6}`, taller/cliente/vehículo con placas/servicios/mano de obra/totales `1320.00`/pago `CASH`-`PAID`/fecha; refacciones con cantidad y precio y kilometraje de entrada cubiertos por `tickets.test.js` y `tickets.contract.test.js`)
- [X] CA-5: El ticket se puede visualizar e imprimir. (Evidencia: V5 — `GET .../ticket` → 200 con el comprobante; «Imprimir» abre el diálogo del sistema con el PDF armado en memoria y nada almacenado, cubierto por `client/test/ticket_screen_test.dart`)
- [X] CA-6: El dashboard muestra datos reales de ordenes, citas, mantenimientos y alertas de inventario, sin duplicar informacion. (Evidencia: V6 — `GET /api/dashboard` → 200 en 4–8 ms; contadores idénticos a sus listados — `ordersFinished` 11 = FINISHED+DELIVERED, `vehiclesAttended` 7 = vehículos distintos, `lowStockCount` 4 = `?low=true` — y cambio en la misma respuesta al terminar/entregar una orden; sin tablas ni caché derivadas; pruebas `dashboard.test.js` + `dashboard.contract.test.js` — 9 — y `dashboard_screen_test.dart` — 6)
- [X] CA-7: Las credenciales de Mercado Pago se manejan por variables de entorno. (Evidencia: V4 — `MP_ACCESS_TOKEN`/`MP_PUBLIC_KEY` solo en `.env` (ignorado por `.gitignore`), `.env.example` con placeholders vacíos, cero tokens `APP_USR-…` en el repositorio, `client/` sin referencias a las claves y `config/mercadopago.js` leyendo `process.env`)
- [X] CA-8: Las pruebas de logica de pagos y generacion de tickets existen y pasan. (Evidencia V7 2026-10-14: `npm test` → 49 suites / 390 pruebas en verde — unit, integración y contrato, incluidas máquina de estados de pagos, total, Mercado Pago simulado, tickets y dashboard — `npm run lint` 0 hallazgos; `flutter test` → 118 pruebas en verde y `flutter analyze` 0 problemas)

## 8. Fuera de alcance de este sprint

- Chatbot de WhatsApp.
- Facturacion electronica.
- Envio automatico de correos o mensajes al cliente.
- Reportes avanzados o analitica historica.
- Aplicacion movil nativa.

## 9. Decisiones pendientes que deben resolverse en /speckit.clarify

- Implementacion concreta de PDF/tickets: libreria, formato y almacenamiento.
- Alcance exacto de Mercado Pago para la demostracion: checkout, link de pago u otro.
- Indicadores exactos del dashboard y su periodicidad.
- Politica de reembolsos o cancelaciones de pago.

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