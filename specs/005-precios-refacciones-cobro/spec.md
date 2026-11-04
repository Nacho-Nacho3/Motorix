# Especificación de la funcionalidad: Precios de refacciones y cobro completo

**Feature Branch**: `005-precios-refacciones-cobro`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "Usa la descripcion de @docs/sprints/sprint-5-precios-refacciones-cobro.md (Sprint 5 post-MVP de Motorix: precios de refacciones y cobro completo)"

## Escenarios de usuario y pruebas *(obligatorio)*

### User Story 1 - Registrar categoría, marca y precios de una refacción (Priority: P1)

Como administrador, quiero registrar la categoría, la marca, el precio de compra y el precio de venta de una refacción para conocer el costo y el precio de cada pieza y poder cobrarla correctamente.

**Why this priority**: Es la base del sprint: sin precio de venta no hay total correcto ni cobro, y sin precio de compra el administrador no conoce su costo. Todo lo demás se apoya en que el catálogo tenga precios válidos.

**Independent Test**: Puede probarse registrando y editando una refacción con categoría, marca y los dos precios, reconsultándola para verificar que persisten, e intentando guardar precios inválidos para verificar que se rechazan.

**Acceptance Scenarios**:

1. **Dado** una refacción nueva, **Cuando** el administrador la registra con categoría, marca, precio de compra y precio de venta, **Entonces** se guarda y se reconsulta con esos datos.
2. **Dado** una refacción registrada, **Cuando** el administrador edita su precio de venta, **Entonces** el cambio persiste y las líneas ya agregadas a órdenes conservan su precio original (ver User Story 4).
3. **Dado** un precio negativo, no numérico o con más de dos decimales, **Cuando** se intenta guardarlo, **Entonces** se rechaza con un mensaje claro en español.
4. **Dado** un precio por encima del límite máximo de $99,999.99, **Cuando** se intenta guardarlo, **Entonces** se rechaza con un mensaje claro en español.

---

### User Story 2 - Total de la orden con refacciones (Priority: P2)

Como recepcionista, quiero que el total de la orden incluya las refacciones utilizadas con el precio que tenían al momento de agregarlas, para cobrar el trabajo completo y que un cambio de precio posterior no lo altere.

**Why this priority**: Es el dinero del taller: el cobro, el ticket y el panel se apoyan en que el total es correcto. Es el cambio central del sprint y puede probarse por sí solo.

**Independent Test**: Puede probarse agregando refacciones a una orden, consultando el total y verificando que suma servicios, mano de obra y refacciones con el precio guardado en cada línea; luego cambiando el precio en el catálogo y verificando que ni la línea ni el total cambian.

**Acceptance Scenarios**:

1. **Dado** una orden con servicios, mano de obra y refacciones, **Cuando** se consulta su total, **Entonces** es la suma de los tres conceptos con exactamente dos decimales.
2. **Dado** una línea de refacción con su precio guardado, **Cuando** el administrador cambia el precio en el catálogo, **Entonces** ni la línea ni el total de esa orden cambian.
3. **Dado** un total cuyas líneas producen fracciones de centavo, **Cuando** se calcula, **Entonces** el total se presenta con dos decimales exactos y sin errores de coma flotante.
4. **Dado** una orden terminada sin trabajo registrado, **Cuando** se consulta su total, **Entonces** es 0.00 y no hay importe que cobrar.

---

### User Story 3 - Pago y ticket con el nuevo total (Priority: P3)

Como recepcionista, quiero que el pago y el ticket reflejen el total con refacciones para entregarle al cliente un comprobante correcto.

**Why this priority**: Completa el ciclo de cobro del taller; depende de que el total exista (User Story 2) pero no de la comparación con datos anteriores.

**Independent Test**: Puede probarse registrando un pago por el total con refacciones de una orden terminada y generando su ticket, verificando que el pago queda con ese importe y que el ticket detalla cada refacción con su importe y su total.

**Acceptance Scenarios**:

1. **Dado** una orden terminada con refacciones, **Cuando** la recepción registra el pago por el total, **Entonces** el pago queda con ese importe; un importe que no coincida con él se rechaza.
2. **Dado** esa orden, **Cuando** se genera el ticket, **Entonces** incluye cada refacción con cantidad, precio unitario e importe, más los subtotales y el total que los suman.
3. **Dado** un pago de Mercado Pago pendiente cuyo importe ya no coincide con el total, **Cuando** se consulta la orden, **Entonces** el desfase se detecta, el pago pendiente se cancela y puede generarse uno nuevo con el importe correcto (D-04).
4. **Dado** un ticket ya generado, **Cuando** se vuelve a consultar, **Entonces** se muestra idéntico, aunque los precios del catálogo hayan cambiado.

---

### User Story 4 - Integridad de pagos y tickets ya emitidos (Priority: P4)

Como administrador, quiero que un cambio de precio no altere órdenes abiertas ni pagos y tickets ya emitidos para conservar la integridad del historial.

**Why this priority**: Protege todo lo que el taller ya cobró; se prueba sobre el flujo de las historias 2 y 3, por eso va después.

**Independent Test**: Puede probarse teniendo una orden abierta con refacciones, un pago y un ticket emitidos, cambiando después todos los precios del catálogo y verificando que nada de eso cambia.

**Acceptance Scenarios**:

1. **Dado** una orden abierta con refacciones, **Cuando** se cambia el precio de esas refacciones en el catálogo, **Entonces** sus líneas y su total conservan el precio original.
2. **Dado** un pago y un ticket ya emitidos, **Cuando** se cambian precios del catálogo, **Entonces** conservan su importe y su contenido.
3. **Dado** pagos y tickets generados antes del sprint, **Cuando** se aplica el cambio del sprint, **Entonces** siguen consultándose y mostrándose sin cambios.
4. **Dado** una línea de refacción con el precio capturado mal en una orden abierta, **Cuando** el administrador corrige el precio con un motivo obligatorio, **Entonces** la línea y el total se actualizan y el motivo queda registrado (D-05).

---

### User Story 5 - Mecánico sin precios de compra (Priority: P5)

Como mecánico, quiero seguir agregando refacciones a una orden sin ver los precios de compra para no exponer la información financiera del taller.

**Why this priority**: Es una capa de permisos sobre el catálogo ya existente; el resto del sprint no depende de ella.

**Independent Test**: Puede probarse con una sesión de mecánico agregando refacciones a una orden y revisando que en ninguna consulta recibe el precio de compra, y con una sesión de administrador verificando que sí lo recibe.

**Acceptance Scenarios**:

1. **Dado** un mecánico con sesión iniciada, **Cuando** consulta o agrega refacciones en una orden, **Entonces** no recibe precios (ni de compra ni de venta, D-10).
2. **Dado** un administrador con sesión iniciada, **Cuando** consulta el catálogo de refacciones, **Entonces** sí recibe los precios de compra y de venta.
3. **Dado** cualquier rol sin permiso, **Cuando** intenta consultar el precio de compra, **Entonces** el sistema lo rechaza en el backend, no solo en la interfaz (RN-15).

---

### Casos límite

- Líneas de órdenes existentes que se registraron sin precio guardado: qué precio toman al aplicar el sprint (D-01, D-03; resuelto: precio vigente al migrar, ver Clarificaciones).
- Orden con solo refacciones y total mayor a 0.00: ¿pasa a ser cobrable? (D-02).
- Pago de Mercado Pago pendiente cuando cambia el total: ¿se cancela, se actualiza o se marca desfasado? (D-04; resuelto: se cancela y se genera uno nuevo, ver Clarificaciones).
- Corrección del precio de una línea en una orden abierta: ¿se permite y con qué permiso o motivo? (D-05; resuelto: solo administrador con motivo obligatorio, ver Clarificaciones).
- Categoría como lista administrable o texto libre; marca como texto libre (D-06).
- Precio de venta menor al de compra: ¿se permite, se advierte o se rechaza? (D-07).
- Redondeo del importe de una línea (cantidad por precio) y límites máximos de precio y de total (D-08; resuelto: precio máximo $99,999.99, redondeo al centavo más cercano, ver Clarificaciones).
- Tickets anteriores, sin precio de refacciones, mostrándose junto a los nuevos (D-09).
- Precio de venta visible para el mecánico: ¿lo ve o solo ve nombre, código y existencia? (D-10; resuelto: no ve ningún precio, ver Clarificaciones).
- La misma refacción agregada dos veces a una orden: cada uso conserva su propio precio guardado.
- Cambio de precio en el catálogo en el mismo momento en que se registra el cobro.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El sistema DEBE permitir al administrador registrar y editar la categoría, la marca, el precio de compra y el precio de venta de una refacción, y conservar esos datos en las consultas.
- **FR-002**: El sistema DEBE rechazar precios negativos, no numéricos o con más de dos decimales, y DEBE aplicar un límite máximo de precio de $99,999.99 (D-08, Clarificaciones).
- **FR-003**: Al agregar una refacción a una orden, el sistema DEBE guardar en esa línea el precio de venta que la refacción tenía en ese momento; cambios posteriores de precio NO deben modificar la línea. Al aplicar este cambio, las líneas de refacciones ya registradas DEBEN recibir el precio de venta vigente de su refacción (D-01/D-03, Clarificaciones). Solo el administrador puede corregir el precio de una línea en una orden abierta, con un motivo obligatorio que queda registrado (D-05, Clarificaciones).
- **FR-004**: El total de la orden DEBE calcularse con exactitud de centavos enteros como la suma de servicios, mano de obra y refacciones (cantidad por el precio guardado en cada línea), y presentarse siempre con dos decimales.
- **FR-005**: El pago nuevo DEBE registrarse por el total calculado de la orden; un importe que no coincida con él DEBE rechazarse con mensaje claro.
- **FR-006**: Los pagos y tickets generados antes del sprint NO deben alterarse: deben conservar su importe y su contenido y seguir consultándose y mostrándose correctamente.
- **FR-007**: El ticket nuevo DEBE incluir, por cada refacción, cantidad, precio unitario e importe, y subtotales y total que los suman.
- **FR-008**: El sistema DEBE mantener un solo pago vigente por orden, también cuando lleguen solicitudes de cobro al mismo tiempo, y NO debe almacenar ningún dato de tarjeta (RN-14).
- **FR-009**: El sistema DEBE detectar un pago pendiente de Mercado Pago cuyo importe ya no coincida con el total de la orden, cancelarlo y permitir generar un pago nuevo con el importe correcto (D-04, Clarificaciones).
- **FR-010**: El precio de compra solo DEBE estar disponible para el administrador en las consultas del sistema; el mecánico no DEBE recibir precios (ni de compra ni de venta, D-10) y recepción no DEBE recibir el precio de compra; las restricciones DEBEN validarse en el backend (RN-15).
- **FR-011**: El panel de control y los listados de órdenes y pagos DEBEN seguir funcionando correctamente con el total nuevo.
- **FR-012**: Los datos de ejemplo del sistema DEBEN incluir refacciones con precios y al menos una orden cobrable con refacciones, y DEBEN poder ejecutarse de nuevo sin duplicar registros.
- **FR-013**: DEBEN existir y pasar pruebas automatizadas de cálculo del total, guardado de precios, redondeo, permisos por rol, cobros simultáneos y compatibilidad con pagos y tickets anteriores.
- **FR-014**: La documentación del proyecto y los comentarios del código que contradigan este comportamiento DEBEN actualizarse en el mismo sprint.

### Entidades clave

- **Refacción**: pieza del catálogo del taller. Atributos clave: código, nombre, categoría, marca, existencia, existencia mínima, precio de compra y precio de venta. Sin borrado lógico (restricción heredada del Sprint 3).
- **Uso de refacción en una orden**: evento inmutable que registra qué refacción se usó, en qué cantidad, por quién y a qué precio de venta se agregó (el precio queda guardado en la línea).
- **Orden de servicio**: tiene servicios, mano de obra y refacciones; su total se deriva de esos conceptos, no se almacena.
- **Pago**: cobro de una orden; importe igual al total de la orden, sin datos de tarjeta, un solo pago vigente por orden.
- **Ticket**: comprobante de la orden; una vez emitido, su contenido no cambia aunque cambien los precios del catálogo.

## Criterios de éxito *(obligatorio)*

### Measurable Outcomes

- **SC-001**: 100 % de las líneas de refacción conservan su precio guardado ante cualquier cambio posterior de precio en el catálogo (0 líneas alteradas).
- **SC-002**: 100 % de los pagos y tickets emitidos antes del sprint se muestran idénticos después del cambio (0 diferencias de importe o contenido).
- **SC-003**: 0 precios de compra presentes en las consultas de roles distintos de administrador, verificado en el backend.
- **SC-004**: Ante cobros simultáneos sobre la misma orden queda exactamente 1 pago vigente en 100 % de los intentos.
- **SC-005**: Todos los totales e importes mostrados tienen exactamente 2 decimales y la suma de sus líneas cuadra con el total (diferencia 0.00).
- **SC-006**: La regresión completa del proyecto pasa al cierre del sprint: ninguna prueba que estaba en verde en la línea base falla.
- **SC-007**: Una instalación limpia muestra datos completos al arrancar y ejecutar los datos de ejemplo dos veces no duplica registros.
- **SC-008**: El flujo demostrable del sprint (refacción con precios → uso en orden → total → pago → ticket → cambio de precio sin efectos retroactivos) se recorre de extremo a extremo sin errores.

## Clarificaciones

### Session 2026-11-03

- Q: ¿Qué precio deben tomar las líneas de refacción de las órdenes que ya existen cuando se aplique el guardado de precios? → A: **precio vigente al migrar** (opción A): cada línea existente recibe el precio de venta que su refacción tiene al aplicar el cambio.
- Q: ¿Qué hacemos con un pago de Mercado Pago que está pendiente cuando cambia el total de su orden? → A: **cancelarlo y generar uno nuevo con el importe correcto** (opción A): un pago pendiente aún no cobró nada; se cancela y el cobro nuevo nace con el total vigente.
- Q: ¿Cuál es el límite máximo que aceptamos para el precio de una refacción? → A: **$99,999.99** (opción A): tope que cubre cualquier pieza real sin aceptar cifras que delatan un error de captura; el redondeo se mantiene al centavo más cercano.
- Q: ¿Debe ver el mecánico el precio de venta de las refacciones cuando trabaja sobre una orden? → A: **no ve ningún precio** (opción A): solo nombre, código, cantidad y existencia; ni de compra ni de venta.
- Q: ¿Se puede corregir el precio capturado en una línea de refacción de una orden abierta, y quién tiene permiso? → A: **solo el administrador, con motivo obligatorio registrado** (opción B): corrige capturas erróneas sin abrir el mecanismo a otros roles.

Decisiones del insumo (sección 9), por resolver en `/speckit.clarify`:

- **D-01** (resuelta en Session 2026-11-03): refacciones existentes y líneas ya registradas sin precio: ¿se les asigna 0, se les exige precio o se bloquean? → respuesta: precio vigente al migrar.
- **D-02**: orden con solo refacciones: ¿pasa a ser cobrable?
- **D-03** (resuelta en Session 2026-11-03): órdenes abiertas al desplegar: ¿qué precio toman sus refacciones ya agregadas? → respuesta: el precio vigente al migrar (misma respuesta que D-01).
- **D-04** (resuelta en Session 2026-11-03): pago de Mercado Pago pendiente cuando cambia el total: ¿se cancela, se actualiza o se marca desfasado? → respuesta: se cancela y se genera uno nuevo con el importe correcto.
- **D-05** (resuelta en Session 2026-11-03): corrección del precio de una línea en una orden abierta: ¿se permite y con qué permiso o motivo? → respuesta: solo el administrador, con motivo obligatorio registrado.
- **D-06**: categoría: ¿lista administrable o texto libre? ¿marca como texto libre?
- **D-07**: precio de venta menor al de compra: ¿se permite, se advierte o se rechaza?
- **D-08** (resuelta en Session 2026-11-03): redondeo del importe de una línea y límites máximos de precio y de total → respuesta: precio máximo $99,999.99 (el total queda limitado por la suma de sus líneas) y redondeo al centavo más cercano.
- **D-09**: convivencia de tickets anteriores (sin precios) con los nuevos.
- **D-10** (resuelta en Session 2026-11-03): visibilidad del precio de venta para el mecánico → respuesta: el mecánico no ve precios (ni de compra ni de venta), solo nombre, código, cantidad y existencia.

## Fuera de alcance

- Costeo, margen de ganancia, utilidad y reportes financieros.
- Impuestos y facturación electrónica.
- Descuentos, promociones y pagos parciales o a plazos.
- Reembolsos dentro del sistema.
- Catálogo de proveedores y órdenes de compra.
- Notificaciones, reportes, configuración del taller y WhatsApp.
- Fotos del vehículo y puesta en producción.

## Supuestos

- **Estado real verificado (hallazgos G-01 del aseguramiento de calidad)**: el total de la orden YA suma las refacciones con el precio vigente del catálogo y el ticket YA las detalla; categoría, marca y precios YA existen en el catálogo desde el Sprint 3. La deuda real de este sprint es guardar el precio en la línea (instantánea) y sostener la integridad del historial; la especificación parte de ese estado, no de la premisa original del insumo (ver `docs/aseguramiento-calidad-sprint-5.md`, hallazgos H-02, H-03 y H-06).
- **Numeración de migración**: el repositorio ya tiene migraciones 001 a 013; la del sprint debe ser la siguiente en la serie, aditiva y sin tocar migraciones ya aplicadas (hallazgo H-05).
- **Datos de ejemplo**: el archivo de seeds ya existe y ya incluye refacciones con precios; el sprint lo amplía en lugar de crear uno nuevo (hallazgo H-05).
- **Rechazo de cobro sin importes**: hoy una orden con total 0.00 se rechaza con un mensaje de validación (el código `NOTHING_TO_CHARGE` del insumo no existe, hallazgo H-04); el comportamiento se mantiene salvo que D-02 diga lo contrario.
- **Defaults mientras se resuelven las decisiones** (se actualizarán con las respuestas de clarify):
  - D-01/D-03: RESUELTA en Clarificaciones (Session 2026-11-03): las líneas existentes toman el precio vigente al migrar.
  - D-02: una orden con solo refacciones y total mayor a 0.00 es cobrable; el rechazo queda para totales de 0.00.
  - D-04: RESUELTA en Clarificaciones (Session 2026-11-03): el pago pendiente desfasado se cancela y se genera uno nuevo con el importe correcto.
  - D-05: RESUELTA en Clarificaciones (Session 2026-11-03): solo el administrador corrige el precio de una línea en orden abierta, con motivo obligatorio registrado.
  - D-06: categoría como texto libre administrado (se mantiene el comportamiento actual) y marca como texto libre.
  - D-07: se permite el precio de venta menor al de compra con una advertencia.
  - D-08: RESUELTA en Clarificaciones (Session 2026-11-03): precio máximo $99,999.99 y redondeo al centavo más cercano.
  - D-09: los tickets anteriores se muestran tal cual los conserva el sistema; los nuevos usan el formato con precios.
  - D-10: RESUELTA en Clarificaciones (Session 2026-11-03): el mecánico no recibe precios (ni de compra ni de venta) en sus consultas.
- **Constitución**: el proyecto está definido para cuatro sprints; este sprint posterior al MVP requiere una enmienda aprobada antes de implementar (hallazgo H-01 del aseguramiento).
- **Dependencias heredadas**: se apoya en el inventario (Sprint 3) y en pagos y tickets (Sprint 4); no se tocan sus reglas (RN-6, RN-7, RN-8, RN-9, RN-13, RN-14, RN-15).
- **Entorno**: MySQL local con datos de demostración; las pruebas del proyecto corren contra su base de pruebas, nunca contra la base principal.
