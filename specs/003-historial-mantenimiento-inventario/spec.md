# Especificación de la funcionalidad: Historial, mantenimiento e inventario (Sprint 3)

**Rama de la funcionalidad**: `003-historial-mantenimiento-inventario`

**Creado**: 2026-10-14

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripción de `docs/sprints/sprint-3-historial-inventario.md` — Sprint 3 del MVP de Motorix: historial, mantenimiento e inventario."

## Clarificaciones

### Sesión 2026-10-14

- P: ¿Qué política aplica el sistema cuando una salida de inventario dejaría el stock de una refacción por debajo de cero? → R: Opción A — rechazar la operación: el stock nunca baja de cero y el sistema responde con mensaje en español (RN-8, CA-6).
- P: ¿Qué tipos de movimiento de inventario admite el sistema y quién puede registrar cada uno? → R: Opción A — IN, OUT y ADJUSTMENT: IN (reposición) y ADJUSTMENT (corrección) solo administrador; OUT se genera automáticamente al usar la refacción en una orden (RN-7).
- P: ¿Cómo debe construirse el historial de servicios del vehículo: calculándolo en cada consulta desde las órdenes existentes o guardándolo en una tabla derivada? → R: Opción A — cálculo en consulta, sin tabla derivada: se arma uniendo las órdenes terminadas con sus servicios, mano de obra y refacciones (RN-10).
- P: ¿Cómo determina el sistema los estados Normal, Próximo y Vencido de un mantenimiento? → R: Opción A — antelación guardada en cada mantenimiento (días y/o km, con valor por defecto): dentro de la antelación → Próximo; objetivo cumplido → Vencido; el resto → Normal. Si define fecha y kilometraje, vencido al cumplirse cualquiera de los dos (RN-11, RN-12).
- P: ¿En qué órdenes y quiénes pueden agregar refacciones utilizadas? → R: Opción A — solo el mecánico, solo en sus órdenes y solo mientras la orden no esté ENTREGADO (RN-6, RN-9, RN-15).

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Consultar el historial de servicios del vehículo (Prioridad: P1)

Como mecánico, quiero consultar el historial de servicios de un vehículo para conocer su estado y antecedentes.

**Por qué esta prioridad**: Es el eje del sprint: convierte las órdenes terminadas del Sprint 2 en conocimiento reutilizable por vehículo; sin historial, el mantenimiento preventivo y el inventario no tienen a qué referirse.

**Prueba independiente**: Se completa abriendo el historial de un vehículo con órdenes terminadas y viendo sus servicios en orden cronológico con fecha, kilometraje, diagnóstico y refacciones utilizadas, sin registrar ningún dato nuevo.

**Escenarios de aceptación**:

1. **Dado** un vehículo con órdenes en estado TERMINADO o ENTREGADO, **Cuando** el mecánico abre su historial, **Entonces** aparecen esas órdenes en orden cronológico con fecha del servicio, kilometraje, orden relacionada, diagnóstico, servicios realizados, refacciones utilizadas, observaciones y recomendaciones (CA-1).
2. **Dado** un vehículo cuyas órdenes están todas en curso (RECIBIDO, DIAGNOSTICO, EN_REPARACION o ESPERANDO_REFACCION), **Cuando** se abre su historial, **Entonces** no aparece ninguna entrada y se muestra un estado vacío con mensaje en español.
3. **Dado** una orden terminada, **Cuando** se la consulta desde el historial, **Entonces** los datos coinciden con los de la orden original: el historial deriva de la información registrada y no crea una copia paralela (RN-10).
4. **Dado** un vehículo sin órdenes, **Cuando** se abre su historial, **Entonces** se muestra un estado vacío con mensaje en español, sin errores.

---

### Historia de usuario 2 - Registrar el kilometraje de cada servicio (Prioridad: P2)

Como mecánico, quiero registrar el kilometraje de cada servicio para mantener actualizado el historial.

**Por qué esta prioridad**: El kilometraje es el eje del seguimiento preventivo (RN-11): sin él, el próximo mantenimiento no puede evaluarse por kilometraje ni contrastarse con el historial.

**Prueba independiente**: Se completa registrando el kilometraje de un servicio (visita u mantenimiento) y viéndolo reflejado en el historial y en la ficha del vehículo.

**Escenarios de aceptación**:

1. **Dado** una orden creada con kilometraje de entrada, **Cuando** se consulta el historial del vehículo, **Entonces** cada servicio muestra el kilometraje registrado en esa visita (RN-3, RN-10).
2. **Dado** un mantenimiento que se registra con kilometraje de referencia, **Cuando** se guarda, **Entonces** el kilometraje queda asociado al mantenimiento y es visible en su consulta.
3. **Dado** un kilometraje inválido (negativo o no numérico), **Cuando** se intenta guardar, **Entonces** el sistema lo rechaza con un mensaje en español y no se pierde lo ya capturado.

---

### Historia de usuario 3 - Establecer el próximo mantenimiento (Prioridad: P3)

Como mecánico, quiero establecer el próximo mantenimiento de un vehículo por fecha, por kilometraje o por ambos, para programar el siguiente servicio.

**Por qué esta prioridad**: Es el puente entre el historial y la acción: convierte lo registrado en una visita futura programada; depende de que exista historial y kilometraje confiables.

**Prueba independiente**: Se completa registrando un próximo mantenimiento con fecha y/o kilometraje objetivo para un vehículo atendido y viéndolo aparecer en la consulta de próximos mantenimientos.

**Escenarios de aceptación**:

1. **Dado** un vehículo recién atendido, **Cuando** el mecánico registra el próximo mantenimiento con fecha y/o kilometraje objetivo, **Entonces** queda guardado, asociado al vehículo y es consultable (CA-2, RN-11).
2. **Dado** un vehículo con un mantenimiento pendiente vigente, **Cuando** se registra un mantenimiento nuevo, **Entonces** el nuevo queda como el pendiente a cumplir y la consulta lo refleja así (supuestos).
3. **Dado** intervalos distintos según el servicio o la recomendación del mecánico, **Cuando** se configuran, **Entonces** el sistema los respeta sin asumir valores universales (RN-12).
4. **Dado** un próximo mantenimiento con fecha vencida o con el kilometraje objetivo ya superado, **Cuando** se consulta, **Entonces** aparece marcado como Vencido con un estado visual diferenciado.

---

### Historia de usuario 4 - Consultar los mantenimientos próximos (Prioridad: P4)

Como recepcionista, quiero consultar los mantenimientos próximos y vencidos para avisar al cliente.

**Por qué esta prioridad**: Aporta valor al cliente al aprovechar el programa ya cargado por el mecánico; puede probarse sin crear datos nuevos.

**Prueba independiente**: Se completa abriendo la vista de mantenimientos con al menos un registro próximo y uno vencido y verlos listados con vehículo, cliente y objetivo.

**Escenarios de aceptación**:

1. **Dado** vehículos con mantenimientos próximos por vencer, **Cuando** recepcionista abre la consulta, **Entonces** los ve ordenados por urgencia con vehículo, cliente, fecha y/o kilometraje objetivo y su estado (Próximo o Vencido) (CA-3).
2. **Dado** un mantenimiento cuyo umbral de fecha o kilometraje ya se cumplió, **Cuando** se consulta, **Entonces** aparece como Vencido (RN-11, reglas de umbral definidas en los requisitos).
3. **Dado** ningún vehículo con mantenimientos registrados, **Cuando** se abre la consulta, **Entonces** se muestra un estado vacío con mensaje en español.

---

### Historia de usuario 5 - Registrar y consultar refacciones (Prioridad: P5)

Como administrador, quiero registrar y consultar las refacciones para controlar el inventario del taller.

**Por qué esta prioridad**: Es la base del inventario: sin el catálogo de refacciones no existe stock que consultar ni salidas que reflejar.

**Prueba independiente**: Se completa registrando una refacción con sus datos mínimos y viéndola en la consulta del catálogo.

**Escenarios de aceptación**:

1. **Dado** los datos de una refacción (código o número de parte, nombre, categoría, marca, stock inicial, stock mínimo, precio de compra y precio de venta), **Cuando** el administrador la registra, **Entonces** queda en el catálogo y aparece en la consulta (CA-4).
2. **Dado** una refacción con un código ya registrado, **Cuando** se intenta guardar otra con el mismo código, **Entonces** el sistema la rechaza con un mensaje en español y no crea el registro.
3. **Dado** una refacción registrada, **Cuando** se actualiza su precio o su stock mínimo, **Entonces** el cambio se conserva al reabrir la consulta.

---

### Historia de usuario 6 - Consultar el stock disponible (Prioridad: P6)

Como administrador, quiero consultar el stock disponible para saber qué hay en existencia.

**Por qué esta prioridad**: Aporta visibilidad sobre el catálogo ya cargado; es lectura pura sobre datos que el inventario ya debe manejar.

**Prueba independiente**: Se completa abriendo la consulta de stock con refacciones que tienen entradas y salidas y ver el saldo actual de cada una.

**Escenarios de aceptación**:

1. **Dado** el catálogo de refacciones, **Cuando** el administrador abre la consulta de stock, **Entonces** ve cada refacción con su stock actual, su stock mínimo y su disponibilidad (CA-4).
2. **Dado** los movimientos registrados de una refacción, **Cuando** se consulta su stock, **Entonces** el saldo refleja las entradas y salidas registradas.
3. **Dado** una refacción con stock actual menor o igual al stock mínimo, **Cuando** se consulta el stock, **Entonces** aparece señalada como stock bajo.

---

### Historia de usuario 7 - Agregar refacciones utilizadas a una orden (Prioridad: P7)

Como mecánico, quiero agregar las refacciones utilizadas a una de mis órdenes para reflejar su uso en el inventario.

**Por qué esta prioridad**: Es el punto donde el trabajo del taller consume inventario; depende de órdenes del Sprint 2 y del catálogo de refacciones.

**Prueba independiente**: Se completa agregando una refacción con cantidad a una orden asignada y comprobando que queda en la orden y que el stock del inventario baja.

**Escenarios de aceptación**:

1. **Dado** una orden asignada en curso, **Cuando** el mecánico agrega una refacción con su cantidad, **Entonces** queda asociada a esa orden y se muestra en su detalle (RN-6).
2. **Dado** una refacción agregada a la orden, **Cuando** se guarda, **Entonces** el inventario registra una salida por la cantidad utilizada y el stock se decrementa (RN-7, CA-5).
3. **Dado** una cantidad mayor al stock disponible, **Cuando** se intenta guardar, **Entonces** el sistema rechaza la operación con un mensaje en español: el stock nunca baja de cero (RN-8, CA-6).
4. **Dado** una orden que no está asignada al mecánico, **Cuando** intenta agregarle refacciones, **Entonces** el sistema la rechaza en el backend con mensaje en español aunque la interfaz no ofrezca la opción (RN-15).
5. **Dado** una orden del mecánico en estado ENTREGADO, **Cuando** intenta agregarle una refacción, **Entonces** el sistema la rechaza con mensaje en español: ENTREGADO es historial inmutable (RN-9, Clarificaciones).

---

### Historia de usuario 8 - Visualizar alertas de stock bajo (Prioridad: P8)

Como administrador, quiero visualizar las alertas de stock bajo para reabastecer a tiempo.

**Por qué esta prioridad**: Es el cierre del flujo demostrable del sprint: convierte el movimiento de inventario en una acción de reposición; depende de que existan refacciones y salidas registradas.

**Prueba independiente**: Se completa llevando una refacción por debajo de su stock mínimo y verla aparecer en la vista de alertas.

**Escenarios de aceptación**:

1. **Dado** refacciones con stock actual menor o igual al stock mínimo, **Cuando** el administrador abre la vista de alertas, **Entonces** aparecen listadas con su stock actual y su stock mínimo (CA-7).
2. **Dado** todas las refacciones por encima de su stock mínimo, **Cuando** se abre la vista de alertas, **Entonces** se muestra un estado sin alertas con mensaje en español.
3. **Dado** una refacción en alerta, **Cuando** el administrador registra una entrada que la lleva por encima de su mínimo, **Entonces** deja de aparecer en las alertas.

---

### Casos límite

- ¿Qué ocurre con un vehículo sin órdenes ni mantenimientos? → historial y consulta de próximos mantenimientos en estado vacío con mensaje en español, sin errores.
- ¿Qué ocurre si una orden todavía está en curso al consultar el historial? → no aparece: solo las órdenes TERMINADO o ENTREGADO forman parte del historial.
- ¿Qué ocurre si el kilometraje capturado en un servicio es inválido (negativo o no numérico)? → se rechaza con mensaje en español y no se pierde lo ya capturado.
- ¿Qué ocurre si el kilometraje de una orden es menor que el registrado? → se aplica la regla del Sprint 2: rechazo salvo corrección explícita autorizada del administrador (RN-4).
- ¿Qué ocurre al registrar un mantenimiento cuya fecha ya pasó o cuyo kilometraje objetivo ya se superó? → se guarda y aparece de inmediato como Vencido.
- ¿Qué ocurre si se programa un segundo mantenimiento para un vehículo que ya tiene uno pendiente? → el nuevo queda como el pendiente a cumplir (supuestos).
- ¿Qué ocurre si una refacción se agrega a una orden con cantidad mayor al stock? → se rechaza con mensaje en español: el stock nunca baja de cero (RN-8, CA-6).
- ¿Qué ocurre si el stock llega a cero? → la refacción se puede seguir consultando y aparece como stock bajo; cualquier salida posterior se rechaza con mensaje en español.
- ¿Qué ocurre si una refacción ya utilizada en una orden se quiere eliminar? → no existe borrado con movimientos u órdenes asociados: se conserva para no romper el historial ni la auditoría de inventario.
- ¿Qué ocurre si el mecánico intenta agregar refacciones a una orden que no es suya? → se rechaza en el backend aunque la interfaz no le muestre la opción (RN-15).
- ¿Qué ocurre si se intenta agregar refacciones a una orden ya ENTREGADA? → se rechaza con mensaje en español: ENTREGADO es historial inmutable y no admite nuevos usos de inventario (RN-9, FR-010).
- ¿Qué ocurre si recepción intenta registrar o modificar refacciones? → se rechaza en el backend: el catálogo y el stock son de administrador (RN-15).
- ¿Qué ocurre si el administrador corrige un stock por error de captura? → registra un movimiento ADJUSTMENT que deja constancia del responsable: es la única forma de modificar el stock fuera de las entradas IN y las salidas OUT (FR-012).
- ¿Qué ocurre si una refacción se registra sin stock mínimo? → se rechaza: el stock mínimo es dato obligatorio del catálogo.
- ¿Qué ocurre al pulsar guardar dos veces seguidas? → el botón queda inactivo mientras se guarda; no se crean registros duplicados.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Historial de servicios del vehículo**

- **FR-001**: El sistema DEBE permitir consultar el historial de un vehículo con sus órdenes terminadas (estado TERMINADO o ENTREGADO) en orden cronológico, mostrando por cada servicio la fecha, el kilometraje, la orden relacionada, el diagnóstico, los servicios realizados, las refacciones utilizadas, las observaciones y las recomendaciones (CA-1).
- **FR-002**: El sistema DEBE construir el historial calculándolo en cada consulta a partir de la información ya registrada en las órdenes terminadas, sin crear una tabla derivada ni duplicar datos (RN-10, Clarificaciones).
- **FR-003**: El sistema DEBE mostrar en cada entrada del historial el kilometraje registrado en ese servicio y DEBE conservar actualizado el kilometraje del vehículo con lo capturado en órdenes y mantenimientos (US2, RN-3).

**Mantenimiento preventivo**

- **FR-004**: El sistema DEBE permitir al mecánico registrar el próximo mantenimiento de un vehículo basándose en fecha, kilometraje o ambos, junto con las recomendaciones del mecánico, y consultarlo después (CA-2, RN-11).
- **FR-005**: El sistema DEBE tratar los intervalos de mantenimiento como configurables según el servicio o la recomendación registrada, sin asumir valores universales para todos los vehículos (RN-12).
- **FR-006**: El sistema DEBE permitir consultar los mantenimientos próximos y vencidos con los estados visuales Normal, Próximo y Vencido, para que recepcionista pueda avisar al cliente (CA-3).
- **FR-007**: El sistema DEBE determinar el estado de un mantenimiento según la antelación guardada en el propio mantenimiento (días y/o kilómetros, con valor por defecto cuando no se captura): dentro de la antelación → Próximo; objetivo de fecha o kilometraje cumplido → Vencido; el resto → Normal. Si el mantenimiento define fecha y kilometraje a la vez, se considera Vencido al cumplirse cualquiera de los dos (RN-11, RN-12, Clarificaciones).

**Inventario y refacciones**

- **FR-008**: El sistema DEBE permitir al administrador registrar y consultar refacciones con sus datos mínimos: código o número de parte (único), nombre, categoría, marca, stock actual, stock mínimo, precio de compra y precio de venta (CA-4).
- **FR-009**: El sistema DEBE permitir consultar el stock disponible por refacción, reflejando el saldo resultante de las entradas y salidas registradas (CA-4).
- **FR-010**: El sistema DEBE permitir al mecánico agregar refacciones con su cantidad únicamente a las órdenes que tiene asignadas y que aún no están ENTREGADAS, asociando cada refacción utilizada a la orden correspondiente (RN-6, RN-9, RN-15, Clarificaciones).
- **FR-011**: El sistema DEBE registrar automáticamente una salida de inventario cuando una refacción se agrega a una orden, descontando la cantidad utilizada del stock (RN-7, CA-5).
- **FR-012**: El sistema DEBE manejar los movimientos de inventario con tres tipos: IN (entrada o reposición, registrado solo por el administrador), OUT (salida, que se genera automáticamente cuando una refacción se usa en una orden) y ADJUSTMENT (corrección de stock, registrada solo por el administrador, con responsable); ningún otro rol registra movimientos (RN-7, Clarificaciones).
- **FR-013**: El sistema DEBE aplicar la política de stock negativo del proyecto: ninguna operación puede dejar el stock de una refacción por debajo de cero; una salida sin existencias suficientes se RECHAZA con mensaje en español (RN-8, CA-6, Clarificaciones).
- **FR-014**: El sistema DEBE mostrar alertas de stock bajo cuando el stock actual de una refacción sea menor o igual a su stock mínimo, con un stock mínimo configurable por refacción (CA-7).
- **FR-015**: El sistema DEBE conservar el historial de movimientos de inventario sin operación de borrado ordinario, para que quede constancia de cada entrada, salida o ajuste.

**Seguridad, permisos y transversal**

- **FR-016**: El sistema DEBE validar los permisos por rol en cada operación del backend, más allá de ocultar opciones en la interfaz: un rol sin permiso DEBE ser rechazado con mensaje en español aunque solicite la operación directamente (RN-15). La matriz base: administrador = catálogo y stock de refacciones, movimientos y alertas; mecánico = historial de vehículos, registro de kilometraje y próximo mantenimiento, y refacciones de sus órdenes mientras no estén ENTREGADAS; recepción = consulta de mantenimientos próximos y vencidos.
- **FR-017**: El sistema DEBE conservar las órdenes del Sprint 2 intactas: el historial solo las consulta y no las duplica, altera ni elimina (RN-9, RN-10).
- **FR-018**: Toda pantalla nueva DEBE seguir el sistema de diseño del proyecto (paleta, tipografía, tokens, transiciones y confirmaciones obligatorias), con estados vacío, cargando, error y éxito en español.
- **FR-019**: El producto DEBE instalarse con datos de ejemplo suficientes (refacciones con stock y stock mínimo, al menos un mantenimiento próximo o vencido y vehículos con historial consultable) y la carga DEBE ser idempotente: ejecutarla de nuevo no duplica registros ni deja el sistema sin datos (CA-4).
- **FR-020**: Solo el backend DEBE acceder a MySQL; toda validación de datos y de permisos ocurre en el backend con mensajes en español.

### Entidades clave

- **Historial del vehículo**: no es una entidad nueva en este sprint; es la lectura cronológica calculada en consulta a partir de las órdenes terminadas de un vehículo con sus datos de servicio, sin tabla propia ni copias (RN-10, Clarificaciones).
- **Mantenimiento programado**: el próximo mantenimiento de un vehículo; guarda vehículo, fecha objetivo y/o kilometraje objetivo, antelación de aviso en días y/o kilómetros (con valor por defecto), intervalo o recomendación del mecánico y estado (Normal, Próximo, Vencido) calculado con esa antelación. Uno pendiente vigente por vehículo.
- **Refacción**: una pieza del catálogo de inventario; guarda código o número de parte, nombre, categoría, marca, stock actual, stock mínimo, precio de compra y precio de venta. El código es único.
- **Movimiento de inventario**: cada entrada, salida o ajuste que modifica el stock de una refacción; guarda refacción, tipo (IN, OUT o ADJUSTMENT), cantidad, fecha, responsable y la orden de referencia cuando proviene de un uso en una orden. IN y ADJUSTMENT los registra el administrador; OUT se genera solo al usar la refacción en una orden.
- **Refacción de la orden**: cada refacción utilizada en una orden con su cantidad; varias por orden. Relación: pertenece a una orden de servicio (Sprint 2) y a una refacción del catálogo (RN-6).
- **Relaciones**: cada mantenimiento y cada refacción de la orden pertenecen a un registro existente (vehículo u orden); cada movimiento pertenece a una refacción y referencia una orden cuando aplica; el historial deriva de las órdenes sin copias.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Con al menos 3 órdenes terminadas para un vehículo, un mecánico consulta su historial completo (fecha, kilometraje, diagnóstico, servicios y refacciones por orden) en orden cronológico, con 0 registros duplicados frente a las órdenes originales (CA-1, RN-10).
- **SC-002**: Un mecánico registra un próximo mantenimiento por fecha y/o kilometraje en menos de 2 minutos y este queda consultable de inmediato (CA-2).
- **SC-003**: La consulta de mantenimientos próximos y vencidos devuelve el 100 % de los registros según los umbrales definidos, con sus estados Normal, Próximo y Vencido correctos (CA-3).
- **SC-004**: Registrar refacciones y consultar su stock funciona contra MySQL local: 100 % de las operaciones registradas se reflejan en el saldo (CA-4).
- **SC-005**: El 100 % de las refacciones agregadas a una orden genera su salida de inventario y decrementa el stock correspondiente (CA-5, RN-7).
- **SC-006**: 0 operaciones dejan el stock por debajo de cero: el 100 % de las salidas sin existencias suficientes se rechaza con mensaje en español, y las pruebas automatizadas de lógica de inventario y mantenimiento existen y pasan (CA-6, CA-8).
- **SC-007**: El 100 % de las refacciones con stock menor o igual al mínimo aparecen en las alertas de la interfaz del administrador (CA-7).
- **SC-008**: Cualquier operación solicitada sin el permiso del rol se rechaza en el backend aunque no pase por la interfaz: 0 accesos no autorizados en las pruebas de permisos (RN-15).
- **SC-009**: Tras una instalación limpia con dos cargas consecutivas de datos de ejemplo, existen refacciones con stock, al menos 1 mantenimiento próximo o vencido y 0 registros duplicados; la aplicación nunca arranca vacía (CA-4).

## Supuestos

- Se conservan los roles, el inicio de sesión y los permisos en backend ya existentes del MVP (administrador, recepción, mecánico; acceso con usuario o correo).
- Forman parte del historial las órdenes en estado TERMINADO o ENTREGADO; las órdenes en curso no aparecen hasta terminarse.
- El kilometraje de cada servicio proviene del kilometraje de entrada ya registrado en la orden (Sprint 2) y del kilometraje capturado al programar el mantenimiento; no se pide una captura adicional por servicio.
- Cada vehículo mantiene un solo mantenimiento pendiente vigente: registrar uno nuevo lo reemplaza como el pendiente a cumplir.
- Los estados visuales de mantenimiento son Normal, Próximo y Vencido (contexto maestro 6.6): la antelación de Próximo se guarda en cada mantenimiento con valor por defecto, y un mantenimiento define fecha, kilometraje o ambos; si define ambos, vencido al cumplirse cualquiera de los dos (FR-007).
- El stock mínimo es dato obligatorio por refacción y la alerta de stock bajo se activa cuando el stock actual es menor o igual a ese mínimo.
- El código o número de parte de una refacción es único en el catálogo.
- Las refacciones con movimientos u órdenes asociadas no se eliminan; las correcciones de stock se hacen mediante un movimiento ADJUSTMENT registrado por el administrador, que deja constancia del responsable (FR-012).
- La recepción solo consulta mantenimientos y avisos: no gestiona inventario ni historial en este sprint.
- Las alertas de stock bajo y los avisos al cliente son manuales en la interfaz: no hay notificaciones externas (correo, WhatsApp) en este sprint.
- Los precios de compra y venta de las refacciones se registran como dato, pero el cálculo de costos, totales y facturación de las órdenes queda fuera de este sprint.
- Los seeds incluyen datos de ejemplo suficientes y son idempotentes, como en los sprints anteriores.

## Fuera de alcance

- Pagos, Mercado Pago y tickets.
- Dashboard y reportes.
- Notificaciones externas (correo, WhatsApp).
- Cálculo de totales, costos y facturación de las órdenes.
- Gestión de proveedores y compras de refacciones (el inventario solo controla existencias, entradas y salidas).
- Alertas automáticas de reabastecimiento más allá de la vista de stock bajo.
