# Especificación de la funcionalidad: Citas y órdenes de servicio (Sprint 2)

**Rama de la funcionalidad**: `002-citas-ordenes-servicio`

**Creado**: 2026-10-14

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripción de `docs/sprints/sprint-2-citas-ordenes.md` — Sprint 2 del MVP de Motorix: citas y órdenes de servicio."

## Clarificaciones

### Sesión 2026-10-14

- P: ¿Cómo deben validarse los cambios de estado de una orden de servicio: se permite solo avanzar por la secuencia o también retroceder, quién ejecuta cada cambio, y desde/hacia dónde entra y sale ESPERANDO_REFACCION? → R: Opción A — avance lineal sin retrocesos; ESPERANDO_REFACCION entra desde DIAGNOSTICO o EN_REPARACION y regresa al estado desde el que se salió; solo el mecánico (de sus órdenes) y el administrador cambian estados; recepción solo consulta y crea la orden.
- P: ¿Cómo se asigna el mecánico responsable de cada orden de servicio: lo elige manualmente recepción al crear o editar la orden, lo asigna el sistema automáticamente por disponibilidad, o ambas cosas? → R: Opción A — manual: recepción o administrador elige el mecánico al crear la orden y puede reasignarla editándola; el mecánico no se autoasigna.
- P: ¿Desde qué estados se puede cancelar una cita y qué efecto tiene cancelarla sobre las órdenes de servicio relacionadas con ella, si es que deben relacionarse cita y orden? → R: Opción A — sin vínculo cita↔orden en este sprint: cancelar desde cualquier estado activo (no Completada ni Cancelada) con confirmación; queda Cancelada, se conserva para consulta y no afecta órdenes existentes ni futuras.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Registrar y consultar citas (Prioridad: P1)

Como recepcionista, quiero registrar y consultar citas (cliente, vehículo, fecha, hora, motivo y observaciones) para organizar la llegada de los vehículos al taller.

**Por qué esta prioridad**: Es el primer paso del flujo demostrable del sprint y aporta valor por sí sola —organizar las llegadas— sin depender de las órdenes de servicio.

**Prueba independiente**: Se completa registrando una cita desde cero para un cliente y un vehículo existentes y verla aparecer en la consulta, sin crear ninguna orden.

**Escenarios de aceptación**:

1. **Dado** un cliente y un vehículo registrados, **Cuando** recepcionista captura fecha, hora y motivo y guarda, **Entonces** la cita queda registrada en estado Pendiente y aparece en la consulta.
2. **Dado** una cita registrada, **Cuando** se modifica su hora o motivo, **Entonces** el cambio se conserva al reabrir la consulta de citas.
3. **Dado** una cita Pendiente, **Cuando** se confirma, **Entonces** pasa al estado Confirmada conservando todos sus datos.
4. **Dado** una cita registrada, **Cuando** se cancela tras confirmación explícita, **Entonces** queda en estado Cancelada, sigue siendo consultable y no se elimina ningún registro.

---

### Historia de usuario 2 - Crear órdenes de servicio (Prioridad: P2)

Como recepcionista, quiero crear órdenes de servicio para registrar el trabajo a realizar: problema reportado, kilometraje de entrada y mecánico asignado.

**Por qué esta prioridad**: Es el núcleo del sprint: sin órdenes, el mecánico no tiene nada que consultar ni trabajar.

**Prueba independiente**: Se completa creando una orden para un cliente y vehículo existentes con su kilometraje de entrada y viéndola aparecer en el listado en estado RECIBIDO.

**Escenarios de aceptación**:

1. **Dado** un cliente y un vehículo existentes, **Cuando** recepcionista crea la orden con kilometraje de entrada, problema reportado y mecánico, **Entonces** la orden queda registrada en estado RECIBIDO con su fecha de creación.
2. **Dado** un kilometraje de entrada menor que el último kilometraje registrado del vehículo, **Cuando** se intenta guardar, **Entonces** el sistema lo rechaza con un mensaje en español (RN-4).
3. **Dado** una orden creada, **Cuando** se vuelve a consultar, **Entonces** conserva cliente, vehículo, kilometraje de entrada y problema reportado.

---

### Historia de usuario 3 - Vincular cada orden con cliente y vehículo (Prioridad: P3)

Como recepcionista, quiero asociar cada orden con un cliente y un vehículo para vincular correctamente la información de la visita.

**Por qué esta prioridad**: Garantiza la integridad del dato: una orden sin vehículo correcto no tiene significado y rompe el historial futuro (RN-2).

**Prueba independiente**: Se completa intentando crear una orden con un vehículo inexistente y comprobando que se rechaza sin crear ningún registro, y luego con un vehículo válido y comprobando que se asocia.

**Escenarios de aceptación**:

1. **Dado** un vehículo inexistente o no disponible, **Cuando** se intenta crear la orden, **Entonces** el sistema la rechaza, no crea ningún registro y muestra el error en español (RN-2).
2. **Dado** un vehículo con kilometraje ya registrado, **Cuando** la orden se guarda, **Entonces** el kilometraje de entrada queda asociado a esa orden (RN-3) y alimenta la validación de la siguiente visita (RN-4).
3. **Dado** una orden válida, **Cuando** se consulta desde la ficha del vehículo, **Entonces** la orden aparece vinculada a ese vehículo.

---

### Historia de usuario 4 - Consultar las órdenes asignadas (Prioridad: P4)

Como mecánico, quiero consultar únicamente las órdenes que tengo asignadas para saber qué trabajar.

**Por qué esta prioridad**: Es la puerta de entrada del trabajo del mecánico; el resto de historias de mecánico (diagnóstico, estados, observaciones) ocurren dentro de una orden asignada.

**Prueba independiente**: Se completa iniciando sesión como mecánico y verificando que el listado muestra solo sus órdenes, con sus estados y problemas reportados.

**Escenarios de aceptación**:

1. **Dado** un mecánico con órdenes asignadas, **Cuando** abre su listado de órdenes, **Entonces** ve solo las suyas con estado, vehículo y problema reportado (CA-3).
2. **Dado** un mecánico sin órdenes asignadas, **Cuando** abre su listado, **Entonces** ve un estado vacío con mensaje en español y una acción sugerida.
3. **Dado** órdenes asignadas a otros mecánicos, **Cuando** el sistema responde la consulta del mecánico, **Entonces** esas órdenes no aparecen en ningún caso.

---

### Historia de usuario 5 - Registrar diagnósticos y servicios realizados (Prioridad: P5)

Como mecánico, quiero registrar el diagnóstico y los servicios realizados (incluida la mano de obra) para documentar el trabajo.

**Por qué esta prioridad**: Documenta el trabajo realizado; sin esto, la orden solo dice qué se iba a hacer, no qué se hizo.

**Prueba independiente**: Se completa abriendo una orden asignada, escribiendo el diagnóstico, agregando uno o más servicios con su mano de obra y reabriendo la orden para ver todo persistido.

**Escenarios de aceptación**:

1. **Dado** una orden asignada en curso, **Cuando** el mecánico escribe el diagnóstico y guarda, **Entonces** queda guardado y visible al reabrir la orden.
2. **Dado** una orden asignada, **Cuando** el mecánico agrega servicios realizados y conceptos de mano de obra, **Entonces** cada registro queda asociado a la orden y es consultable desde ella.
3. **Dado** un campo obligatorio vacío, **Cuando** se intenta guardar, **Entonces** aparece una validación en español y lo ya capturado no se pierde.

---

### Historia de usuario 6 - Cambiar el estado de la orden (Prioridad: P6)

Como mecánico, quiero cambiar el estado de la orden para reflejar su avance hasta terminar el trabajo.

**Por qué esta prioridad**: Es la señal de progreso del taller; depende de que exista la orden y de poder trabajar en ella.

**Prueba independiente**: Se completa tomando una orden asignada en RECIBIDO y avanzándola por la secuencia hasta TERMINADO, rechazando un salto inválido.

**Escenarios de aceptación**:

1. **Dado** una orden asignada en estado RECIBIDO, **Cuando** el mecánico la pasa a DIAGNOSTICO, **Entonces** el cambio se aplica y queda visible para quien consulte la orden.
2. **Dado** una orden, **Cuando** se intenta una transición que no está permitida por el modelo de estados (por ejemplo un salto o un retroceso no autorizado), **Entonces** el sistema la rechaza con un mensaje en español (CA-5).
3. **Dado** una orden en estado ENTREGADO, **Cuando** se la consulta, **Entonces** se conserva íntegra como historial y no existe operación ordinaria que la elimine (RN-9).

---

### Historia de usuario 7 - Agregar observaciones y recomendaciones (Prioridad: P7)

Como mecánico, quiero agregar observaciones y recomendaciones a la orden para dejar constancia del estado del vehículo.

**Por qué esta prioridad**: Es el complemento documental del trabajo; aporta valor una vez que la orden ya existe y se está atendiendo.

**Prueba independiente**: Se completa agregando observaciones y recomendaciones a una orden asignada y reabriéndolas para verlas persistidas.

**Escenarios de aceptación**:

1. **Dado** una orden asignada, **Cuando** el mecánico escribe observaciones y recomendaciones y guarda, **Entonces** quedan en la orden y se muestran al consultarla.
2. **Dado** una orden con observaciones, **Cuando** se reabre, **Entonces** el texto anterior aparece sin cambios y se puede ampliar.

---

### Casos límite

- ¿Qué ocurre al crear una cita u orden con un cliente o vehículo inexistente o dado de baja? → se rechaza con mensaje en español y no se crea el registro.
- ¿Qué ocurre al cancelar una cita? → solo se permite desde un estado activo con confirmación; en este sprint las órdenes no dependen de las citas, así que cancelar no afecta órdenes existentes ni futuras (ver FR-004).
- ¿Qué ocurre si dos citas del mismo vehículo o del mismo cliente se solapan en hora? → en este sprint se permiten (se reflejan tal cual en la consulta); no hay bloqueo de solapamiento.
- ¿Qué ocurre si el vehículo no tiene kilometraje previo registrado (primera visita o valor cero)? → se acepta el kilometraje capturado siempre que sea ≥ 0 (ver supuestos).
- ¿Qué ocurre si hay que corregir a la baja un kilometraje por error de captura? → solo una corrección explícita autorizada permite guardar un valor menor (RN-4); queda registrado quién corrigió y por qué.
- ¿Qué ocurre ante un intento de salto de estado (RECIBIDO → ENTREGADO)? → se rechaza (CA-5).
- ¿Qué ocurre si un mecánico intenta ver o modificar una orden que no es suya, o crear órdenes o tocar citas? → se rechaza aunque la interfaz no le muestre la opción (RN-5, RN-15).
- ¿Qué ocurre al pulsar guardar dos veces seguidas? → el botón queda inactivo mientras se guarda; no se crean órdenes duplicadas por doble pulsación.
- ¿Qué ocurre si el mecánico no tiene órdenes asignadas? → listado vacío con mensaje en español, sin errores.
- ¿Qué ocurre con una orden ya ENTREGADA? → se conserva sin eliminación ordinaria; las correcciones posteriores las hace únicamente el administrador (ver supuestos).

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Gestión de citas**

- **FR-001**: El sistema DEBE permitir a los roles de recepción y administrador registrar una cita con cliente, vehículo, fecha, hora y motivo (observaciones opcionales); la cita nace en estado Pendiente.
- **FR-002**: El sistema DEBE permitir consultar las citas con filtros por fecha y estado, y con búsqueda por cliente o vehículo, sin perder los resultados al reabrir la vista.
- **FR-003**: El sistema DEBE permitir modificar una cita existente (fecha, hora, motivo, observaciones y estado) conservando su historial de datos.
- **FR-004**: El sistema DEBE permitir cancelar una cita desde cualquier estado activo (no Completada ni Cancelada) únicamente tras una confirmación explícita, dejándola en estado Cancelada y conservándola para consulta (sin borrado). En este sprint no existe vínculo cita↔orden: cancelar una cita no afecta órdenes existentes ni futuras (decisión registrada en Clarificaciones).
- **FR-005**: El sistema DEBE manejar los estados de cita Pendiente, Confirmada, En proceso, Completada y Cancelada, avanzando en esa dirección; Cancelada queda reservada para la cancelación confirmada.

**Creación y consulta de órdenes de servicio**

- **FR-006**: El sistema DEBE permitir a los roles de recepción y administrador crear una orden de servicio con cliente, vehículo, kilometraje de entrada obligatorio, problema reportado y mecánico asignado; la orden nace en estado RECIBIDO con fecha de creación.
- **FR-007**: El sistema DEBE rechazar la creación de una orden cuyo vehículo no exista o no esté disponible, sin crear ningún registro (RN-2).
- **FR-008**: El sistema DEBE exigir el kilometraje de entrada (RN-3) y DEBE rechazar un kilometraje menor que el último kilometraje registrado del vehículo salvo corrección explícita autorizada y justificada (RN-4); si el vehículo todavía no tiene kilometraje previo, se acepta el valor capturado siempre que sea ≥ 0.
- **FR-009**: El sistema DEBE asociar cada orden a un cliente y a un vehículo de forma inseparable: la orden siempre se consulta con ambos datos resueltos (US3, CA-2).
- **FR-010**: El sistema DEBE permitir asignar el mecánico responsable de la orden de forma manual: lo eligen recepción o administrador al crear la orden y pueden reasignarlo al editarla; el mecánico no se autoasigna (decisión registrada en Clarificaciones).
- **FR-011**: El sistema DEBE permitir consultar las órdenes con filtros por estado; el administrador y recepción ven todas las órdenes, y el mecánico únicamente las suyas (CA-3).

**Trabajo del mecánico**

- **FR-012**: El sistema DEBE permitir al mecánico registrar el diagnóstico de sus órdenes y consultarlo posteriormente.
- **FR-013**: El sistema DEBE permitir al mecánico agregar uno o más servicios realizados por orden, cada uno con su descripción y precio unitario.
- **FR-014**: El sistema DEBE permitir al mecánico registrar mano de obra por orden con su concepto, horas y tarifa.
- **FR-015**: El sistema DEBE permitir al mecánico agregar observaciones y recomendaciones en sus órdenes y consultarlas después (US7).
- **FR-016**: El sistema DEBE validar los cambios de estado de la orden contra la secuencia RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO → ENTREGADO, con ESPERANDO_REFACCION disponible cuando aplique, y rechazar cualquier transición no permitida con mensaje en español (CA-5, CA-8). Reglas decididas en la clarificación: avance lineal sin retrocesos; ESPERANDO_REFACCION entra desde DIAGNOSTICO o EN_REPARACION y regresa al estado desde el que se salió; solo el mecánico (de sus órdenes) y el administrador cambian estados; recepción solo consulta y crea la orden.

**Seguridad, historial y entrega**

- **FR-017**: El sistema DEBE validar los permisos por rol en cada operación del sistema, más allá de ocultar opciones en la interfaz: un rol sin permiso DEBE ser rechazado aunque solicite la operación directamente (RN-5, RN-15, CA-7). La matriz base: administrador = todo; recepción = citas, creación y consulta de órdenes y asignación de mecánico; mecánico = consultar sus órdenes y registrar su trabajo (diagnóstico, servicios, mano de obra, observaciones y estados), sin crear órdenes ni tocar citas.
- **FR-018**: El sistema DEBE conservar las órdenes sin operación de borrado ordinario: una orden ENTREGADA permanece como historial consultable (RN-9).
- **FR-019**: Toda pantalla nueva DEBE seguir el sistema de diseño del proyecto (paleta, tipografía, tokens, transiciones y confirmaciones obligatorias), con estados vacío, cargando, error y éxito en español.
- **FR-020**: El producto DEBE instalarse con datos de ejemplo suficientes (citas y órdenes con servicios y mano de obra) para que la aplicación muestre información al arrancar, y la carga de datos de ejemplo DEBE ser idempotente: ejecutarla de nuevo no duplica registros ni deja el sistema sin datos.

### Entidades clave

- **Cita**: una visita programada de un cliente con su vehículo en fecha y hora determinadas; guarda motivo, observaciones y estado (Pendiente, Confirmada, En proceso, Completada, Cancelada). Se relaciona con un cliente y un vehículo ya registrados.
- **Orden de servicio**: el trabajo realizado (o por realizar) durante una visita; guarda cliente, vehículo, kilometraje de entrada, problema reportado, mecánico asignado, diagnóstico, observaciones, recomendaciones, estado (RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION, TERMINADO, ENTREGADO) y fechas. Es el registro histórico que no se elimina.
- **Servicio de la orden**: cada servicio realizado aplicado a una orden (descripción y precio unitario); varios por orden.
- **Mano de obra de la orden**: cada concepto de trabajo humano cobrado en la orden (concepto, horas y tarifa); varios por orden.
- **Relaciones**: cada orden pertenece a un cliente y a un vehículo; cada servicio y cada concepto de mano de obra pertenecen a una sola orden; una cita referencia un cliente y un vehículo, sin vínculo con órdenes en este sprint.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Una persona con credenciales puede recorrer el flujo completo —registrar cita, recibir el vehículo, crear la orden, asignarla, registrar diagnóstico, registrar servicios, avanzar estados y terminar el trabajo— en menos de 5 minutos.
- **SC-002**: Una recepcionista registra una cita válida (cliente, vehículo, fecha, hora y motivo) en menos de 2 minutos.
- **SC-003**: El 100 % de los intentos de cambio de estado no permitidos se rechaza, y las pruebas automatizadas de la lógica de transiciones existen y pasan (CA-8).
- **SC-004**: Un mecánico ve 0 órdenes que no estén asignadas a él en todas sus vistas (CA-3).
- **SC-005**: Cualquier operación solicitada sin el permiso del rol se rechaza aunque no pase por la interfaz: 0 accesos no autorizados en las pruebas de permisos (CA-7).
- **SC-006**: El 100 % de las órdenes creadas tiene un kilometraje de entrada válido: mayor o igual al previo del vehículo, o el primer registro cuando aún no existe valor previo (CA-6).
- **SC-007**: Tras una instalación limpia con dos cargas consecutivas de datos de ejemplo, existen al menos 1 cita, 1 orden con servicios y mano de obra, y 0 registros duplicados; la aplicación nunca arranca vacía.

## Supuestos

- Se conservan los roles y el inicio de sesión ya existentes del MVP (administrador, recepción, mecánico; acceso con usuario o correo).
- Estados de órdenes según CA-5: avance lineal sin retrocesos y ESPERANDO_REFACCION reversible a su estado anterior, con cambios de estado solo por el mecánico (de sus órdenes) y el administrador (decisión registrada en Clarificaciones).
- Estados de citas y su avance (FR-005): Pendiente → Confirmada → En proceso → Completada, pudiendo cancelarse desde cualquier estado activo con confirmación.
- Kilometraje sin valor previo: si el vehículo nunca registró kilometraje, se acepta cualquier valor ≥ 0 como primer registro.
- Corrección explícita de kilometraje a la baja (RN-4): reservada al administrador, con motivo escrito, para que quede constancia.
- No se bloquean citas solapadas del mismo vehículo o cliente en este sprint.
- La mecánica no gestiona citas en este sprint (no está requerido); solo recepción y administrador.
- Sin vínculo cita ↔ orden en este sprint: se pueden crear órdenes sin cita de origen (llegada sin cita) y cancelar una cita nunca afecta a las órdenes existentes ni futuras.
- Servicios y mano de obra se capturan como datos de registro (descripción, precio unitario, horas, tarifa); el cálculo de totales, costos y pagos queda fuera de este sprint.
- Las refacciones utilizadas en una orden quedan para el sprint de inventario.
- Una orden ENTREGADA no se elimina; las correcciones posteriores las realiza únicamente el administrador.
- Los listados ofrecen filtros básicos (citas por fecha y estado; órdenes por estado) y búsqueda por cliente o vehículo, en línea con las pantallas ya existentes.

## Fuera de alcance

- Historial de mantenimiento por vehículo y próximo mantenimiento.
- Inventario y refacciones (incluidas las refacciones usadas en una orden).
- Pagos, Mercado Pago y tickets.
- Dashboard y reportes.
- Cálculo de totales, costos y facturación de las órdenes.
- Expediente e historial consolidado del vehículo (se construye en sprints posteriores).
