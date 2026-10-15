# Especificación de la funcionalidad: Pagos, tickets y dashboard

**Feature Branch**: `004-pagos-tickets-dashboard`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Usa la descripcion de @docs/sprints/sprint-4-pagos-tickets-dashboard.md (Sprint 4 del MVP de Motorix: pagos, tickets y dashboard)"

## Escenarios de usuario y pruebas *(obligatorio)*

### User Story 1 - Registrar el pago de una orden (Priority: P1)

Como recepcionista, quiero registrar el pago de una orden terminada para cerrar el ciclo del servicio y que quede constancia de que el cliente ya cubrió el importe.

**Why this priority**: Sin cobro no hay cierre del ciclo: los tickets y el dashboard se apoyan en que el pago quedó registrado. Es el corazón del Sprint 4 y el único escenario que, por sí solo, aporta valor al taller.

**Independent Test**: Puede probarse por completo registrando un pago contra una orden terminada existente y verificando que el pago persiste, se puede reconsultar y muestra su importe, método y estado.

**Acceptance Scenarios**:

1. **Dado** una orden terminada con su total, **Cuando** la recepción registra un pago con importe, método y estado, **Entonces** el pago queda guardado, asociado a esa orden y visible en su consulta.
2. **Dado** una orden que ya tiene un pago registrado, **Cuando** se consulta el historial de pagos de la orden, **Entonces** aparecen todos los pagos con su fecha y estado.
3. **Dado** una orden inexistente, **Cuando** se intenta registrar un pago contra ella, **Entonces** el sistema rechaza la operación con un mensaje claro (todo pago está relacionado con una orden, RN-13).
4. **Dado** un pago registrado, **Cuando** se reinicia la aplicación, **Entonces** el pago sigue consultable con los mismos datos.

---

### User Story 2 - Seleccionar el método de pago (Priority: P2)

Como recepcionista, quiero elegir el método con el que se cobró (efectivo, tarjeta, transferencia o Mercado Pago) para dejar constancia de cómo se pagó.

**Why this priority**: Un registro de pago sin método no sirve como constancia ni para el ticket. Completa la historia 1 con los cuatro métodos que exige el negocio.

**Independent Test**: Puede probarse registrando pagos con cada uno de los cuatro métodos y verificando que cada uno queda guardado y se muestra en el pago y en el ticket.

**Acceptance Scenarios**:

1. **Dado** una orden terminada, **Cuando** la recepción registra un pago eligiendo cada método disponible (efectivo, tarjeta, transferencia, Mercado Pago), **Entonces** el pago se guarda con el método elegido.
2. **Dado** un pago registrado, **Cuando** se consulta desde la orden, **Entonces** el método de pago es visible junto al importe y el estado.
3. **Dado** un método no soportado, **Cuando** se intenta registrar el pago, **Entonces** la operación se rechaza con mensaje en español.

---

### User Story 3 - Generar el ticket de servicio (Priority: P3)

Como recepcionista, quiero generar un ticket de la orden para entregar un comprobante impreso al cliente.

**Why this priority**: El comprobante impreso es la operación diaria del taller y cierra la entrega al cliente; depende de que existan el total y el pago, pero no de Mercado Pago.

**Independent Test**: Puede probarse generando el ticket de una orden terminada y verificando que contiene todo el desglose exigido, se puede abrir en pantalla y enviar a impresión.

**Acceptance Scenarios**:

1. **Dado** una orden terminada con servicios, refacciones y mano de obra, **Cuando** la recepción genera el ticket, **Entonces** el ticket muestra folio, datos del taller, cliente, vehículo, placas, kilometraje, servicios, refacciones, mano de obra, subtotal, total, método de pago, estado del pago y fecha.
2. **Dado** un ticket generado, **Cuando** se vuelve a abrir desde la orden, **Entonces** se muestra igual (el folio no cambia ni se duplica).
3. **Dado** un ticket en pantalla, **Cuando** se solicita imprimirlo, **Entonces** se envía a la impresora con el mismo contenido visible.
4. **Dado** una orden sin pago registrado, **Cuando** se genera su ticket, **Entonces** el ticket indica que aún no hay pago (no se oculta ni se inventa información).

---

### User Story 4 - Pagar con Mercado Pago en modo sandbox (Priority: P4)

Como recepcionista, quiero gestionar el pago de una orden mediante Mercado Pago para ofrecer también una opción digital de cobro.

**Why this priority**: Es una opción digital adicional sobre el cobro ya existente; añade valor pero el taller puede operar con efectivo/tarjeta/transferencia sin ella.

**Independent Test**: Puede probarse iniciando un pago de Mercado Pago contra una orden en el entorno de pruebas (sandbox) y verificando que el pago queda relacionado con la orden, que su estado se actualiza al resultado del proveedor y que no se guardó ningún dato de tarjeta.

**Acceptance Scenarios**:

1. **Dado** una orden terminada, **Cuando** la recepción inicia un pago con Mercado Pago, **Entonces** se genera la operación de cobro digital en modo sandbox asociada a esa orden y el pago queda en estado pendiente.
2. **Dado** un pago de Mercado Pago concluido en el proveedor (aprobado o rechazado), **Cuando** el sistema consulta su resultado, **Entonces** el pago de la orden queda con el estado resultante (pagado o rechazado).
3. **Dado** un pago de Mercado Pago cancelado, **Cuando** se consulta la orden, **Entonces** el pago aparece como cancelado y puede iniciarse otro intento.
4. **Dado** cualquier pago, **Cuando** se audita el almacenamiento, **Entonces** no existen números de tarjeta, códigos de seguridad ni credenciales del proveedor guardados en el sistema (RN-14).

---

### User Story 5 - Panel de control con información general (Priority: P5)

Como administrador, quiero consultar un panel con la información general del taller para supervisar la operación de un vistazo.

**Why this priority**: Aporta visibilidad de gestión, pero no participa en el cobro: el taller puede facturar sin él. Usa datos ya registrados por los módulos anteriores.

**Independent Test**: Puede probarse abriendo el panel como administrador y verificando que muestra los indicadores del taller con valores que coinciden con los datos reales de órdenes, citas, mantenimientos e inventario.

**Acceptance Scenarios**:

1. **Dado** un taller con datos de ejemplo, **Cuando** el administrador abre el panel, **Entonces** ve los indicadores generales (vehículos atendidos, vehículos en reparación, órdenes pendientes, órdenes terminadas, citas próximas, mantenimientos próximos, mantenimientos vencidos y refacciones con stock bajo) con valores reales.
2. **Dado** un usuario recepcionista o mecánico, **Cuando** intenta abrir el panel, **Entonces** el sistema lo rechaza con un mensaje claro (permisos validados en backend, RN-15).
3. **Dado** que el taller aún no tiene actividad, **Cuando** se abre el panel, **Entonces** muestra los indicadores en cero con un estado vacío amigable en español.

---

### User Story 6 - Detalle visual del panel: órdenes, citas, mantenimientos y alertas (Priority: P6)

Como administrador, quiero ver en el panel el detalle de órdenes, citas, mantenimientos y alertas de inventario para pasar del resumen a la acción.

**Why this priority**: Completa el panel con desglose operativo; depende del resumen de la historia 5 y es la capa más superficial del sprint.

**Independent Test**: Puede probarse abriendo el panel y verificando que las secciones de órdenes, citas, mantenimientos y alertas muestran los registros vigentes, sin información duplicada ni desactualizada.

**Acceptance Scenarios**:

1. **Dado** el panel abierto, **Cuando** se observa la sección de órdenes, **Entonces** aparecen las órdenes vigentes con su estado.
2. **Dado** el panel abierto, **Cuando** se observa la sección de citas, **Entonces** aparecen las próximas con fecha y cliente.
3. **Dado** el panel abierto, **Cuando** se observa la sección de mantenimientos, **Entonces** aparecen los próximos y vencidos con su estado calculado.
4. **Dado** el panel abierto, **Cuando** se observa la sección de inventario, **Entonces** aparecen las refacciones en alerta de stock bajo.
5. **Dado** un dato modificado en su módulo de origen (por ejemplo, una orden entregada), **Cuando** se vuelve a abrir el panel, **Entonces** el indicador refleja el cambio (el panel deriva la información de los módulos, sin duplicarla, RN-10).

---

### Casos límite

- ¿Qué sucede cuando se intenta pagar una orden que ya está pagada? (debe rechazarse o exigir cancelar el pago anterior)
- ¿Qué sucede cuando el pago de Mercado Pago se rechaza o el usuario abandona el flujo? (estado rechazado/cancelado y reintento permitido)
- ¿Cómo se maneja un importe cero, negativo, menor que el total o mayor que el total de la orden? (debe rechazarse; los pagos parciales no se admiten)
- ¿Qué pasa si se intenta generar un ticket de una orden que no está terminada?
- ¿Qué sucede si el proveedor de Mercado Pago no está disponible o no hay credenciales configuradas? (mensaje claro, sin bloquear los otros métodos)
- ¿Cómo responde el panel ante un taller sin datos o con pocos datos?
- ¿Qué ve la recepción al intentar imprimir dos veces el mismo ticket? (mismo folio, sin duplicados)

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El sistema DEBE permitir registrar un pago asociado a una orden existente, con importe, método, estado y fecha, y poder reconsultarlo.
- **FR-002**: El sistema DEBE soportar los métodos de pago: efectivo, tarjeta, transferencia y Mercado Pago.
- **FR-003**: El sistema DEBE gestionar los estados de pago: pendiente, pagado, rechazado y cancelado, con transiciones válidas entre ellos.
- **FR-004**: Todo pago DEBE estar relacionado con una orden existente; no se permiten pagos sin orden (RN-13).
- **FR-005**: El importe registrado DEBE corresponder al total de la orden; se admite un único pago efectivo por orden y NO se admiten pagos parciales (decidido en clarify, Q1).
- **FR-006**: El sistema DEBE integrar Mercado Pago en modo sandbox/pruebas para las órdenes, sin que la aplicación almacene datos de tarjeta (RN-14, CA-3).
- **FR-007**: Las credenciales de Mercado Pago DEBEN mantenerse fuera del código fuente y fuera del repositorio (CA-7).
- **FR-008**: El sistema DEBE permitir consultar los pagos de una orden con su importe, método, estado y fecha.
- **FR-009**: El sistema DEBE generar un ticket por orden que incluya: folio, datos del taller, cliente, vehículo, placas, kilometraje, servicios, refacciones, mano de obra, subtotal, total, método de pago, estado del pago y fecha (CA-4).
- **FR-010**: El ticket DEBE poder visualizarse en pantalla e imprimirse (CA-5).
- **FR-011**: El ticket DEBE conservar su folio sin duplicarlo ni alterarlo al reabrirse o reimprimirse.
- **FR-012**: El sistema DEBE ofrecer un panel de control, de uso exclusivo del administrador, con los indicadores: vehículos atendidos, vehículos en reparación, órdenes pendientes, órdenes terminadas, citas próximas, mantenimientos próximos, mantenimientos vencidos y refacciones con stock bajo.
- **FR-013**: El panel DEBE derivar sus indicadores de la información ya registrada en los demás módulos, sin duplicar datos solo para estadísticas (CA-6).
- **FR-014**: El panel DEBE mostrar también el detalle de órdenes, citas, mantenimientos y alertas de inventario vigentes.
- **FR-015**: Los permisos DEBEN validarse en el backend: recepción registra pagos y genera tickets; administrador consulta pagos y el panel; el rol mecánico no accede a pagos (RN-15).
- **FR-016**: Una orden entregada DEBE conservarse como historial; registrar un pago o ticket NO modifica su información de servicio (RN-9).
- **FR-017**: El sistema NO DEBE almacenar números de tarjeta, códigos de seguridad ni credenciales de pago (RN-14).
- **FR-018**: Los datos de ejemplo del sprint DEBEN incluir pagos, tickets e indicadores suficientes para que la aplicación muestre información al arrancar, sin registros duplicados al reejecutarlos.

### Entidades clave

- **Pago (Payment)**: constancia del cobro de una orden. Atributos clave: orden a la que pertenece, importe, método (efectivo, tarjeta, transferencia, Mercado Pago), estado (pendiente, pagado, rechazado, cancelado), fecha y referencia externa del proveedor cuando el cobro fue digital. Relación: N pagos por orden (historial de intentos), solo uno puede quedar pagado.
- **Ticket**: comprobante de la orden. Atributos clave: folio único, fecha de emisión y la referencia a la orden. El desglose (cliente, vehículo, placas, kilometraje, servicios, refacciones, mano de obra, subtotal, total, método y estado de pago) se deriva de la orden y sus pagos; no se copia información que pudiera desincronizarse (RN-10).
- **Indicadores del panel**: valores derivados de órdenes, citas, mantenimientos e inventario existentes; son una vista de consulta, no una fuente de datos nueva.

## Criterios de éxito *(obligatorio)*

### Measurable Outcomes

- **SC-001**: La recepción puede registrar un pago completo de una orden terminada en menos de 1 minuto desde que abre la orden.
- **SC-002**: El ticket queda listo para imprimir en menos de 30 segundos después de generarlo desde la orden.
- **SC-003**: El panel de control muestra todos sus indicadores en menos de 3 segundos con el volumen de datos de demostración.
- **SC-004**: 100 % de los pagos registrados están asociados a una orden existente (0 pagos huérfanos) en cualquier consulta.
- **SC-005**: 0 números de tarjeta, códigos de seguridad o credenciales de pago almacenados en la aplicación tras una auditoría del sprint.
- **SC-006**: El flujo completo (orden terminada → total → pago → Mercado Pago en sandbox → ticket → panel) es demostrable de extremo a extremo en menos de 5 minutos.
- **SC-007**: Los indicadores del panel coinciden en 100 % de los casos con los datos reales de los módulos de origen al consultarlos en el mismo momento.
- **SC-008**: Las pruebas automatizadas de la lógica de pagos y de la generación de tickets existen y pasan en verde.

## Clarificaciones

- **Q1 (2026-10-14) → FR-005 · Forma de pago de una orden — Opción A**: se admite un único pago por el total de la orden; no se admiten pagos parciales acumulables. Un intento rechazado o cancelado no impide registrar otro pago. La deuda a plazos queda fuera del alcance del MVP.

## Fuera de alcance

- Reembolsos o devoluciones de dinero desde la aplicación (ver Supuestos).
- Cobros que no estén relacionados con una orden de servicio (venta de accesorios, cotizaciones, etc.).
- Almacenar o procesar datos de tarjetas en Motorix (la captura ocurre en el proveedor).
- Pasarelas de pago distintas a Mercado Pago.
- Panel con gráficas históricas, exportación de reportes o alertas automáticas por correo/mensajería.
- Refresco automático del panel en tiempo real.
- Modificación de las reglas de los módulos de órdenes, inventario y mantenimientos.

## Supuestos

- **Pagos por orden (decidido en clarify, Q1)**: se admite un único pago efectivo por orden, por el total; los pagos parciales acumulables NO están permitidos. Pueden existir intentos previos rechazados o cancelados como historial, sin bloquear un nuevo intento.
- **Política de reembolsos**: el MVP no gestiona reembolsos desde la aplicación; un pago pagado solo puede corregirse como acción administrativa futura. Un pago pendiente, rechazado o cancelado puede cancelarse o repetirse.
- **Formato del ticket**: se entrega como vista imprimible desde la aplicación (visualización e impresión, CA-5); la generación de PDF archivado queda como posibilidad futura, decisión pendiente de la constitución.
- **Alcance de Mercado Pago**: entorno sandbox/pruebas; la forma concreta del flujo (link de pago, checkout u otro) se resuelve en clarify.
- **Periodicidad del panel**: los indicadores se calculan al abrir el panel o al recargarlo manualmente; no hay refresco automático ni alertas push en el MVP.
- **Indicadores del panel**: se usa la lista prevista en el contexto del proyecto (sección Dashboard); «vehículos atendidos» cuenta vehículos con al menos una orden terminada.
- **Roles**: recepción opera pagos y tickets; el administrador tiene acceso total de consulta; el mecánico no ve información de pagos.
- **Dependencias heredadas**: se apoya en las órdenes del Sprint 2 y en inventario/mantenimientos del Sprint 3; no se tocan sus reglas (RN-9, RN-13, RN-15).
- **Entorno**: la demostración usa el entorno sandbox del proveedor con credenciales de prueba en variables de entorno; sin credenciales, el método Mercado Pago se informa como no disponible y los otros métodos siguen operando.
