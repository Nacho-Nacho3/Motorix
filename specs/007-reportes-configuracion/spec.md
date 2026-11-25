# Especificación de la funcionalidad: Reportes, configuración, términos y seguridad

**Feature Branch**: `007-reportes-configuracion`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Sprint 7: reportes, configuración, términos y seguridad. Usar como insumo docs/sprints/sprint-7-reportes-configuracion.md (con docs/sprints/propuesta-sprints-post-mvp.md, docs/project-context.md y la constitución). Las decisiones de la sección 9 del insumo se resuelven después en /speckit.clarify."

## Escenarios de usuario y pruebas *(obligatorio)*

> Las historias conservan la numeración del insumo (US1 a US10) para mantener la trazabilidad. La prioridad sigue el orden de entrega acordado en la propuesta de sprints: si el tiempo no alcanza, se entrega primero configuración, términos y seguridad (P1 a P6) y después reportes (P7 a P10).

### User Story 1 - Datos del taller editables desde la aplicación (Priority: P1)

Como administrador, quiero editar el nombre, la dirección y el teléfono del taller para que el ticket muestre datos correctos sin tocar el servidor.

**Por qué esta prioridad**: Es la base de la configuración y la deuda más visible: hoy el ticket sale siempre con el nombre «Motorix» y sin dirección ni teléfono, y cambiarlos exige modificar el código. Las demás historias de configuración reutilizan la misma pantalla y el mismo almacén de valores.

**Prueba independiente**: Con sesión de administrador, cambiar nombre y teléfono en Configuración, generar un ticket nuevo y comprobar que muestra los datos nuevos, mientras un ticket emitido antes conserva los datos con los que se emitió.

**Escenarios de aceptación**:

1. **Dado** un administrador en Configuración, **Cuando** guarda un nombre, una dirección y un teléfono válidos, **Entonces** quedan guardados y se muestran al volver a abrir la pantalla.
2. **Dado** los datos del taller actualizados, **Cuando** se genera un ticket nuevo, **Entonces** el ticket muestra los datos nuevos.
3. **Dado** un ticket emitido antes del cambio, **Cuando** se vuelve a abrir o reimprimir, **Entonces** conserva los datos del taller con los que se emitió.
4. **Dado** un nombre vacío o con longitud excesiva, **Cuando** el administrador intenta guardar, **Entonces** se muestra un mensaje claro en español y no se guarda nada.
5. **Dado** un recepcionista o un mecánico, **Cuando** intenta consultar o modificar la configuración, **Entonces** el sistema lo rechaza con acceso denegado (validado en el backend).

---

### User Story 2 - Márgenes de «Próximo» del mantenimiento (Priority: P2)

Como administrador, quiero ajustar los márgenes de «Próximo» del mantenimiento (días y kilómetros de antelación) para adaptarlos a la operación del taller.

**Por qué esta prioridad**: Reutiliza la pantalla y el almacén de la historia 1 y corrige una limitación real: hoy cada mantenimiento guarda su propia antelación y no existe un valor del taller que la gobierne.

**Prueba independiente**: Cambiar los márgenes en Configuración y comprobar que la lista de Mantenimientos, el panel de control y el centro de avisos clasifican como «Próximo» según los valores nuevos.

**Escenarios de aceptación**:

1. **Dado** un administrador en Configuración, **Cuando** guarda márgenes de días y kilómetros dentro de los límites válidos, **Entonces** quedan guardados y se aplican a las clasificaciones de «Próximo».
2. **Dado** un valor fuera de los límites (negativo, no entero o excesivo), **Cuando** intenta guardar, **Entonces** se rechaza con un mensaje claro y se conserva el valor anterior.
3. **Dado** una instalación sin ningún valor guardado, **Cuando** el sistema clasifica mantenimientos, **Entonces** usa los valores predeterminados que ya regían y nada cambia para el usuario.
4. **Dado** que se cambian los márgenes, **Cuando** se comparan la lista de Mantenimientos, el panel de control y el centro de avisos, **Entonces** los tres coinciden sin diferencias.
5. **Dado** un mantenimiento que usa el valor por omisión y otro con una antelación capturada a mano, **Cuando** el administrador cambia los márgenes del taller, **Entonces** el primero se clasifica con los márgenes nuevos y el segundo conserva su antelación propia.

---

### User Story 3 - Catálogo de tipos de servicio con intervalos (Priority: P3)

Como administrador, quiero mantener un catálogo de tipos de servicio con su intervalo en días y en kilómetros para que el próximo mantenimiento se proponga sin asumir intervalos universales (RN-12).

**Por qué esta prioridad**: Es la base de la propuesta automática de próximo mantenimiento (historia 8) y del reporte de servicios frecuentes; por sí sola ya permite mantener el catálogo.

**Prueba independiente**: Crear el tipo «Cambio de aceite» con 180 días y 5,000 km, editarlo, desactivarlo y verificar que un tipo ya usado en una orden nunca se borra.

**Escenarios de aceptación**:

1. **Dado** un administrador en el catálogo, **Cuando** crea un tipo con nombre y al menos un intervalo (días, kilómetros o ambos), **Entonces** queda disponible para usarse en órdenes.
2. **Dado** un tipo ya usado en órdenes, **Cuando** el administrador lo desactiva, **Entonces** deja de ofrecerse para órdenes nuevas pero las órdenes anteriores conservan su referencia.
3. **Dado** un nombre repetido o un intervalo inválido (cero, negativo o no entero), **Cuando** intenta guardar, **Entonces** se rechaza con un mensaje claro.
4. **Dado** un recepcionista o un mecánico, **Cuando** intenta administrar el catálogo, **Entonces** el sistema lo rechaza (validado en el backend); sí pueden elegir un tipo activo al registrar el servicio de una orden.

---

### User Story 8 - Ticket con el próximo servicio (Priority: P4)

Como cliente, quiero que mi ticket indique cuándo toca mi próximo servicio para recordarlo sin que nadie me escriba.

**Por qué esta prioridad**: Cierra el ciclo del catálogo (historia 3) con el beneficio para el cliente; depende de ella pero no de los reportes.

**Prueba independiente**: Terminar una orden con un servicio de tipo «Cambio de aceite» (180 días y 5,000 km), registrar el próximo mantenimiento con los valores propuestos y comprobar que el ticket nuevo muestra «Próximo servicio» con esa fecha y kilometraje, y que una orden sin tipo con intervalo no muestra la línea.

**Escenarios de aceptación**:

1. **Dado** una orden con un servicio cuyo tipo tiene intervalo, **Cuando** se registra el próximo mantenimiento, **Entonces** la fecha y el kilometraje se proponen a partir del intervalo y el usuario puede corregirlos antes de guardar.
2. **Dado** una orden con un servicio cuyo tipo tiene intervalo, **Cuando** se genera el ticket, **Entonces** muestra la línea «Próximo servicio» con la fecha, el kilometraje o ambos, calculados a partir de los intervalos de los tipos de la orden.
3. **Dado** una orden sin tipo de servicio con intervalo, **Cuando** se genera el ticket, **Entonces** no muestra la línea de próximo servicio.
4. **Dado** un ticket emitido antes de este sprint, **Cuando** se vuelve a abrir, **Entonces** no cambia.

---

### User Story 9 - Términos y condiciones y aviso de privacidad (Priority: P5)

Como usuario del taller, quiero leer y aceptar los términos y condiciones y el aviso de privacidad al ingresar al sistema para conocer las reglas de uso y cómo se protege la información de los clientes.

**Por qué esta prioridad**: Es un requisito de protección de datos que condiciona el acceso al sistema; es independiente de la configuración y de los reportes.

**Prueba independiente**: Iniciar sesión con un usuario que no ha aceptado, verificar la pantalla de aceptación, aceptar y comprobar que no se vuelve a pedir; publicar una versión nueva y comprobar que se pide de nuevo; rechazar y comprobar que no entra.

**Escenarios de aceptación**:

1. **Dado** un usuario que no ha aceptado la versión vigente, **Cuando** inicia sesión, **Entonces** ve los términos y el aviso de privacidad antes de usar el sistema.
2. **Dado** la pantalla de aceptación, **Cuando** el usuario acepta, **Entonces** se guarda quién aceptó, qué versión y cuándo, y entra al sistema sin que se le vuelva a pedir mientras la versión no cambie.
3. **Dado** la pantalla de aceptación, **Cuando** el usuario la rechaza, **Entonces** se cierra su sesión y no accede.
4. **Dado** un usuario sin aceptación vigente, **Cuando** intenta usar la API directamente, **Entonces** el backend rechaza sus operaciones, salvo ver los términos, aceptarlos y cerrar sesión.
5. **Dado** un administrador que publica una versión nueva de los términos, **Cuando** un usuario inicia sesión después, **Entonces** se le pide aceptar de nuevo.
6. **Dado** un administrador, **Cuando** consulta los términos, **Entonces** ve la versión vigente y la lista de aceptaciones (usuario, versión y fecha).
7. **Dado** un administrador que edita el texto de los términos o del aviso de privacidad, **Cuando** lo publica, **Entonces** se crea una versión nueva (las anteriores no se modifican), se vuelve la vigente y la publicación queda en la bitácora; un texto vacío se rechaza con un mensaje claro.
8. **Dado** un recepcionista o un mecánico, **Cuando** intenta publicar una versión de los términos, **Entonces** el backend lo rechaza.
9. **Dado** un usuario con la sesión abierta y la versión vigente aceptada, **Cuando** el administrador publica una versión nueva y el usuario hace su siguiente operación, **Entonces** la operación se rechaza por falta de aceptación, la aplicación muestra la pantalla de aceptación sin cerrar la sesión y, al aceptar, el usuario continúa.

---

### User Story 10 - Seguridad de la información (Priority: P6)

Como administrador, quiero que la información del sistema esté protegida (bitácora de acciones sensibles, política de contraseñas, cierre de sesión por inactividad y respuestas sin datos reservados) para detectar usos indebidos y proteger los datos del taller y de sus clientes.

**Por qué esta prioridad**: Complementa la seguridad del Sprint 1 (contraseñas con hash, vigencia de la sesión, bloqueo por intentos fallidos) y comparte con los términos el mismo bloque de entrega; es independiente de los reportes.

**Prueba independiente**: Cambiar un precio, un rol y la configuración y verificar que la bitácora lo registra sin datos sensibles; crear un usuario con una contraseña que incumple la política; dejar la sesión inactiva hasta que se cierre; y revisar que ninguna respuesta de la API expone hash, token ni precios reservados.

**Escenarios de aceptación**:

1. **Dado** un inicio de sesión fallido, un bloqueo de cuenta, el alta, baja o cambio de rol de un usuario, un cambio de configuración o de precios, o un pago cancelado, **Cuando** ocurre, **Entonces** queda registrado con usuario, acción, entidad afectada y fecha.
2. **Dado** la bitácora, **Cuando** el administrador la consulta, **Entonces** puede filtrar por fecha, usuario y acción; ningún rol puede editarla ni borrarla desde la aplicación.
3. **Dado** cualquier registro de la bitácora, **Cuando** se revisa su contenido, **Entonces** no contiene contraseñas, hashes, tokens ni datos de tarjeta.
4. **Dado** una contraseña que incumple la política, **Cuando** se crea o cambia una cuenta, **Entonces** se rechaza con un mensaje claro que indica el requisito faltante.
5. **Dado** una sesión sin actividad durante el tiempo de inactividad configurado, **Cuando** el usuario vuelve a actuar, **Entonces** la sesión se cierra y se pide iniciar sesión de nuevo; la expiración del token se mantiene validada en el backend.
6. **Dado** cualquier respuesta de la API de usuarios, refacciones, órdenes, pagos y tickets, **Cuando** se inspecciona, **Entonces** no incluye hash de contraseña, token ni precios reservados al rol.
7. **Dado** un texto de búsqueda con intento de inyección, **Cuando** se envía a un campo de búsqueda, **Entonces** se trata como texto y no altera la consulta.

---

### User Story 4 - Reporte de ingresos por periodo (Priority: P7)

Como administrador, quiero consultar los ingresos por periodo para conocer cómo avanza el taller.

**Por qué esta prioridad**: Es el reporte base que justifica la sección de Reportes; los demás reportes reutilizan su selector de periodo y su exportación.

**Prueba independiente**: Con pagos sembrados en distintos días, elegir el mes y comprobar que el total coincide con la suma de los pagos pagados del periodo.

**Escenarios de aceptación**:

1. **Dado** un administrador en Reportes, **Cuando** elige un periodo, **Entonces** ve los ingresos del periodo por día y por método de pago.
2. **Dado** pagos pendientes o cancelados, **Cuando** se calcula el reporte, **Entonces** no se cuentan como ingreso.
3. **Dado** un periodo sin pagos, **Cuando** se consulta, **Entonces** se muestra el estado vacío del sistema de diseño, no un error.
4. **Dado** un recepcionista o un mecánico, **Cuando** intenta abrir el reporte, **Entonces** el backend lo rechaza.

---

### User Story 5 - Servicios más frecuentes y productividad por mecánico (Priority: P8)

Como administrador, quiero ver los servicios más frecuentes y la productividad por mecánico para tomar decisiones de operación.

**Por qué esta prioridad**: Aporta decisión de operación sobre el mismo periodo del reporte de ingresos; usa el catálogo de la historia 3 cuando existe.

**Prueba independiente**: Con órdenes terminadas de varios mecánicos en un periodo, comprobar que el ranking de servicios y la tabla de productividad coinciden con las órdenes que los originan.

**Escenarios de aceptación**:

1. **Dado** un periodo con órdenes terminadas, **Cuando** el administrador abre el reporte, **Entonces** ve los servicios ordenados de más a menos frecuentes.
2. **Dado** el mismo periodo, **Cuando** consulta la productividad, **Entonces** ve por mecánico el número de órdenes terminadas en el periodo y el importe de mano de obra de esas órdenes, calculado solo con sus órdenes.
3. **Dado** líneas de servicio anteriores a este sprint sin tipo de servicio, **Cuando** se calcula el ranking, **Entonces** se agrupan de forma comprensible y no se pierden ni se duplican.

---

### User Story 6 - Costo, margen de refacciones y rotación de inventario (Priority: P9)

Como administrador, quiero ver el costo, el precio y el margen de las refacciones usadas y la rotación del inventario para controlar la rentabilidad.

**Por qué esta prioridad**: Es el reporte con más reglas de cálculo y de visibilidad por rol (el precio de compra es reservado), por lo que va después de los reportes base.

**Prueba independiente**: Con órdenes que usan refacciones con precio de compra y de venta, comprobar que costo, precio y margen coinciden con las líneas de orden, y que una refacción sin precio de compra se trata como se acuerde.

**Escenarios de aceptación**:

1. **Dado** un periodo con refacciones usadas en órdenes, **Cuando** el administrador abre el reporte, **Entonces** ve por refacción el costo, el precio de venta y el margen.
2. **Dado** una refacción sin precio de compra (líneas anteriores al Sprint 5), **Cuando** se calcula el margen, **Entonces** esa línea se excluye del margen, se marca «sin costo registrado» y sus ventas se muestran aparte; nunca se muestra un margen falso.
3. **Dado** el mismo periodo, **Cuando** el administrador consulta la rotación de inventario, **Entonces** ve por refacción la rotación calculada con la definición acordada.
4. **Dado** que el precio de compra es reservado, **Cuando** cualquier rol distinto del administrador intenta obtener este reporte, **Entonces** el backend lo rechaza.

---

### User Story 7 - Exportar cada reporte (Priority: P10)

Como administrador, quiero exportar cada reporte para compartirlo o archivarlo.

**Por qué esta prioridad**: Depende de que los reportes existan y no cambia sus cálculos.

**Prueba independiente**: Exportar cada reporte y comparar el contenido del archivo con la pantalla, fila por fila.

**Escenarios de aceptación**:

1. **Dado** un reporte en pantalla, **Cuando** el administrador lo exporta, **Entonces** obtiene un archivo CSV con el mismo contenido que la pantalla para los mismos filtros.
2. **Dado** un reporte sin datos, **Cuando** se exporta, **Entonces** el archivo contiene solo los encabezados, sin errores.
3. **Dado** un rango muy amplio, **Cuando** se pide exportar, **Entonces** el sistema lo limita o lo pagina de forma clara y no se queda sin responder.

---

### Casos límite

- **Instalación existente sin configuración guardada**: el sistema usa los valores que ya regían (nombre «Motorix», sin dirección ni teléfono, márgenes actuales) y nada se rompe.
- **Tickets emitidos antes del sprint**: no tienen copia propia de los datos del taller; deben seguir mostrándose igual que antes (ver Clarificaciones, D-03).
- **Dirección o teléfono vacíos**: el ticket omite la línea correspondiente, igual que hoy.
- **Mantenimiento con antelación capturada a mano**: conserva su antelación aunque el administrador cambie los márgenes del taller (D-16).
- **Tipo de servicio desactivado**: sigue visible en las órdenes que ya lo usan y no se ofrece en las nuevas.
- **Servicios de orden sin tipo (texto libre anterior)**: siguen funcionando; no proponen próximo mantenimiento y se agrupan aparte en el reporte de servicios.
- **Orden con varios servicios con intervalo**: la propuesta de próximo mantenimiento debe ser comprensible (por ejemplo, el intervalo más corto) y el usuario puede corregirla.
- **Orden terminada sin fecha de terminación propia** (órdenes anteriores a este sprint): se cuenta en el periodo de su última modificación y el reporte lo documenta como aproximación (D-19).
- **Refacción sin precio de compra**: no debe inflar el margen; se excluye del margen, se marca «sin costo registrado» y sus ventas se muestran aparte (D-05).
- **Periodo con fecha final anterior a la inicial, o sin fechas**: se rechaza o se usa el periodo predeterminado, con un mensaje claro.
- **Cambio de huso horario o día de corte**: el corte diario sigue la hora local del taller (ver Clarificaciones, D-06).
- **Publicación de una versión nueva con texto vacío o idéntico a la vigente**: se rechaza con un mensaje claro y no se crea la versión.
- **Usuario que acepta los términos y su sesión expira antes de entrar**: debe iniciar sesión de nuevo; la aceptación guardada se conserva.
- **Usuario con aceptación vigente cuando se publica una versión nueva a mitad de su sesión**: su siguiente operación se rechaza por falta de aceptación y la aplicación le muestra de inmediato la pantalla de aceptación, sin cerrar su sesión; al aceptar continúa.
- **Cuenta bloqueada por intentos fallidos**: el bloqueo y el intento fallido quedan en la bitácora.
- **Bitácora sin resultados para el filtro**: se muestra el estado vacío, no un error.
- **Sesión que expira por inactividad con un formulario sin guardar**: se cierra la sesión y se avisa claramente; no se guarda nada a medias.
- **Contraseñas sembradas de demostración**: deben seguir permitiendo la demostración local; la política aplica a las contraseñas nuevas o cambiadas.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Configuración y catálogo (US1, US2, US3, US8)**

- **FR-001**: El administrador DEBE poder consultar y editar desde la aplicación el nombre, la dirección y el teléfono del taller, con validación de longitud y mensajes claros en español (CA-1).
- **FR-002**: Los tickets nuevos DEBEN usar los datos vigentes del taller; los tickets ya emitidos DEBEN conservar los datos con los que se emitieron (CA-1, CA-14).
- **FR-003**: El administrador DEBE poder ajustar los márgenes de «Próximo» del mantenimiento (días y kilómetros) con límites válidos; el valor del taller DEBE regir para todo mantenimiento que usa el valor por omisión y NO DEBE sobrescribir la antelación capturada a mano en un mantenimiento (D-16). La lista de Mantenimientos, el panel de control y el centro de avisos DEBEN respetarlos y coincidir entre sí (CA-2, RN-11).
- **FR-004**: Si no hay valor guardado, el sistema DEBE usar los valores que ya regían, de modo que una instalación existente siga funcionando sin intervención (CA-3).
- **FR-005**: El administrador DEBE poder crear, editar y desactivar tipos de servicio con nombre único y un intervalo en días, en kilómetros o en ambos; NO se puede borrar un tipo ya usado en órdenes (CA-4, RN-12).
- **FR-006**: El servicio de una orden DEBE poder enlazarse opcionalmente a un tipo de servicio activo; las líneas anteriores sin tipo DEBEN seguir siendo válidas (CA-4, D-04).
- **FR-007**: Al registrar el próximo mantenimiento de una orden con un tipo de servicio que tiene intervalo, el sistema DEBE proponer la fecha y el kilometraje y el usuario DEBE poder corregirlos (CA-5, RN-11).
- **FR-008**: El ticket nuevo DEBE mostrar «Próximo servicio» (fecha, kilometraje o ambos) cuando la orden tiene un servicio con un tipo que tiene intervalo, y NO mostrarlo cuando no lo tiene; el valor se calcula y se guarda una sola vez al emitir el ticket y los tickets emitidos NO cambian (CA-14).
- **FR-009**: Configuración y catálogo DEBEN ser exclusivos del administrador para modificarse, validado en el backend (CA-10, RN-5, RN-15); recepción y mecánico solo eligen tipos activos al registrar servicios.

**Reportes (US4, US5, US6, US7)**

- **FR-010**: DEBEN existir reportes de ingresos por periodo, servicios más frecuentes, productividad por mecánico (órdenes terminadas e importe de mano de obra), costo y margen de refacciones y rotación de inventario, todos con filtro por rango de fechas (CA-6, D-07).
- **FR-011**: Los reportes DEBEN calcularse en cada consulta con datos existentes, sin copiarlos a otras tablas (RN-10); los importes DEBEN calcularse en centavos enteros y coincidir con los pagos, órdenes y líneas que los originan (CA-7).
- **FR-012**: El reporte de ingresos DEBE contar solo pagos efectivamente pagados y NO contar los pendientes ni los cancelados.
- **FR-013**: El reporte de refacciones DEBE mostrar costo, precio de venta y margen; el precio de compra DEBE ser visible solo para el administrador, y una refacción sin precio de compra NO DEBE producir un margen falso: DEBE excluirse del margen, marcarse «sin costo registrado» y mostrar sus ventas aparte (CA-8, D-05).
- **FR-014**: Cada reporte DEBE poder exportarse a un archivo CSV cuyo contenido coincida con la pantalla para los mismos filtros, con encabezados en español y que se abra correctamente en una hoja de cálculo con acentos y eñes (CA-9, D-01).
- **FR-015**: Los reportes DEBEN ser exclusivos del administrador, validado en el backend; recepción y mecánico reciben acceso denegado (CA-10, D-09).
- **FR-016**: Los reportes con muchos datos DEBEN responder en un tiempo razonable y limitar o paginar el rango (CA-11).
- **FR-017**: Toda pantalla nueva DEBE manejar los estados de carga, vacío y error conforme a `docs/design-system.md`, con mensajes claros en español, y todo formulario nuevo (configuración, tipos de servicio y términos) DEBE pedir confirmación antes de salir con cambios sin guardar.

**Términos y condiciones (US9)**

- **FR-018**: Al iniciar sesión, un usuario que no ha aceptado la versión vigente de los términos y del aviso de privacidad DEBE ver la pantalla de aceptación antes de usar el sistema; si la rechaza, se cierra su sesión (CA-16).
- **FR-019**: La aceptación DEBE guardar usuario, versión y fecha; NO se vuelve a pedir mientras la versión no cambie, y se pide de nuevo cuando el administrador publica una versión nueva (CA-17, D-10).
- **FR-020**: Los términos DEBEN describir el uso permitido del sistema, la confidencialidad de los datos de clientes y vehículos, la responsabilidad de las cuentas personales y el aviso de privacidad; el administrador DEBE poder consultar la versión vigente y las aceptaciones (CA-18).
- **FR-021**: La aceptación DEBE validarse en el backend: sin aceptación vigente, la API DEBE rechazar las operaciones del usuario, excepto ver los términos, aceptarlos y cerrar sesión (CA-19).

**Seguridad (US10)**

- **FR-022**: DEBE existir una bitácora de acciones sensibles que registre, como mínimo, inicios de sesión fallidos y bloqueos, altas, bajas y cambios de rol de usuarios, cambios de configuración y de precios, pagos cancelados y publicaciones de versiones de los términos, con usuario, acción, entidad afectada y fecha (CA-20).
- **FR-023**: El administrador DEBE poder consultar la bitácora con filtros por fecha, usuario y acción; NADIE DEBE poder editarla ni borrarla desde la aplicación (CA-20).
- **FR-024**: La bitácora NO DEBE guardar contraseñas, hashes, tokens ni datos de tarjeta (CA-21, RN-14).
- **FR-025**: La política de contraseñas DEBE aplicarse al crear y al cambiar la contraseña, con un mensaje claro del requisito faltante, e incluir una longitud máxima para que dos contraseñas distintas no abran la misma cuenta; las contraseñas siguen guardándose solo con hash (CA-22, D-13).
- **FR-026**: La sesión DEBE cerrarse tras un periodo de inactividad y pedir iniciar sesión de nuevo; la expiración del token DEBE seguir validándose en el backend (CA-23, D-14).
- **FR-027**: Ninguna respuesta de la API DEBE incluir el hash de contraseña, el token ni los precios reservados al rol, y DEBEN existir pruebas que lo verifiquen en cada endpoint de usuarios, refacciones, órdenes, pagos y tickets (CA-24).
- **FR-028**: Las consultas DEBEN usar parámetros y las entradas DEBEN validarse en el backend; una prueba automática DEBE comprobar intentos de inyección en los campos de búsqueda (CA-25).

**Datos de ejemplo, pruebas y documentación**

- **FR-029**: Los datos de ejemplo del sprint DEBEN incluir configuración inicial, tipos de servicio, una versión de los términos y datos suficientes para que los reportes muestren información, y DEBEN poder ejecutarse de nuevo sin duplicar registros (CA-12).
- **FR-030**: DEBEN existir y pasar pruebas automatizadas de las reglas de configuración, el cálculo de reportes, los permisos por rol, la exportación, la aceptación de términos, la bitácora, la política de contraseñas, la inactividad y la no exposición de datos (CA-13, CA-26).
- **FR-031**: `docs/project-context.md` y `docs/design-system.md` DEBEN actualizarse en el mismo sprint si este comportamiento los modifica, y DEBE documentarse qué queda como valor de respaldo (CA-15).
- **FR-032**: El administrador DEBE poder publicar desde la aplicación una versión nueva del texto de los términos y del aviso de privacidad; cada publicación DEBE crear una versión nueva sin modificar las anteriores y las aceptaciones ya guardadas DEBEN conservarse; solo el administrador puede publicar, validado en el backend (CA-17, CA-18, D-10).

### Entidades clave

- **Configuración del taller**: pares de valor nombrado que gobiernan el comportamiento del taller: nombre, dirección y teléfono, y los márgenes de «Próximo» (días y kilómetros). Atributos: nombre del valor, valor y quién y cuándo lo cambió. Si falta un valor, rige el predeterminado. Los márgenes del taller aplican a todo mantenimiento sin antelación propia (D-16).
- **Tipo de servicio**: catálogo de servicios con su intervalo. Atributos: nombre único, intervalo en días, intervalo en kilómetros (al menos uno) y estado activo o inactivo. Se enlaza opcionalmente a los servicios de una orden.
- **Datos del taller en el ticket**: copia de nombre, dirección y teléfono vigentes al emitir el ticket, para que un cambio posterior no altere los tickets ya emitidos (D-03).
- **Versión de términos**: texto vigente de los términos y condiciones y del aviso de privacidad. Atributos: número de versión, texto, fecha de publicación y quién la publicó.
- **Aceptación de términos**: registro de que un usuario aceptó una versión. Atributos: usuario, versión y fecha de aceptación.
- **Registro de bitácora**: acción sensible ocurrida en el sistema. Atributos: usuario (o intento anónimo), acción, entidad afectada y su identificador, fecha y un detalle sin datos reservados. Solo se agrega; nunca se edita ni se borra.
- **Reporte**: consulta calculada en el momento sobre pagos, órdenes, servicios, refacciones y movimientos de inventario; no se almacena.
- **Entidades consultadas** (sin cambios de estructura salvo lo indicado): pagos, órdenes de servicio, servicios y refacciones de la orden, refacciones, movimientos de inventario, mantenimientos, tickets y usuarios.

## Criterios de éxito *(obligatorio)*

### Measurable Outcomes

- **SC-001**: El administrador cambia el nombre y el teléfono del taller y el siguiente ticket los muestra, mientras 100 % de los tickets emitidos antes conservan sus datos originales (0 tickets alterados).
- **SC-002**: Tras cambiar los márgenes de «Próximo», la lista de Mantenimientos, el panel de control y el centro de avisos coinciden en 100 % de los mantenimientos (0 diferencias entre pantallas), y 100 % de los mantenimientos con antelación propia la conservan.
- **SC-003**: Una instalación existente sin ningún valor guardado se comporta igual que antes del sprint: 0 cambios de comportamiento observables en tickets y mantenimientos.
- **SC-004**: 100 % de los tipos de servicio usados en órdenes permanecen consultables tras desactivarlos (0 tipos borrados con uso).
- **SC-005**: Con un tipo de servicio con intervalo, el próximo mantenimiento se propone sin que el usuario capture fecha ni kilometraje, y el ticket lo muestra; sin tipo con intervalo, el ticket nunca muestra la línea.
- **SC-006**: Los importes de cada reporte coinciden con la suma de los registros que los originan: 0 diferencias de centavos con los pagos, órdenes y líneas de ejemplo.
- **SC-007**: El contenido de cada archivo CSV exportado coincide en 100 % con la pantalla para los mismos filtros, y se abre en una hoja de cálculo sin caracteres dañados.
- **SC-008**: Con los datos de ejemplo, cada reporte se muestra en menos de 3 segundos y un rango amplio se limita o pagina sin bloquear la aplicación.
- **SC-009**: 0 accesos indebidos verificados en el backend: configuración, catálogo (escritura), reportes y bitácora rechazan a recepción y mecánico; el precio de compra nunca llega a un rol que no sea administrador.
- **SC-010**: 100 % de los usuarios sin aceptación vigente no pueden operar el sistema (ni por pantalla ni por API) hasta aceptar; tras aceptar, no se les vuelve a pedir mientras la versión no cambie.
- **SC-011**: 100 % de las acciones sensibles definidas quedan en la bitácora con usuario y fecha, 0 registros contienen contraseñas, hashes, tokens ni datos de tarjeta, y 0 registros se pueden editar o borrar desde la aplicación.
- **SC-012**: 100 % de las contraseñas que incumplen la política se rechazan con el requisito faltante indicado, y una sesión inactiva se cierra al cumplirse el tiempo acordado.
- **SC-013**: 0 respuestas de la API exponen hash de contraseña, token o precios reservados en los endpoints verificados, y 0 intentos de inyección de los campos de búsqueda alteran la consulta.
- **SC-014**: La regresión completa del proyecto pasa al cierre del sprint: ninguna prueba que estaba en verde en la línea base falla (0 regresiones).
- **SC-015**: El flujo demostrable del sprint (configuración → ticket → catálogo → próximo servicio → reportes → exportación, y términos → contraseña → bitácora → inactividad) se recorre de extremo a extremo sin errores.

## Clarificaciones

Decisiones del insumo (sección 9), por resolver en `/speckit.clarify`. Cada una tiene un valor por omisión documentado en Supuestos para poder planificar mientras se resuelven. Las decisiones D-16 a D-18 salen de la verificación contra el código y no estaban en el insumo.

### Session 2026-11-24

- Q: Cuando el administrador cambie los márgenes de «Próximo» del taller, ¿deben aplicarse también a los mantenimientos que ya existen o solo a los nuevos? → A: **a todos los que usan el valor por omisión; los que tienen una antelación capturada a mano la conservan** (opción B): el cambio se nota de inmediato en la lista de Mantenimientos, el panel y el centro de avisos, y nadie pierde un ajuste hecho a propósito.
- Q: Cuando haya una versión nueva de los términos y condiciones, ¿quién la publica y cómo? → A: **el administrador edita y publica versiones nuevas desde la aplicación** (opción A): coincide con el CA-17, permite que el taller revise y ajuste la plantilla sin tocar el sistema, y cada publicación genera una versión nueva y queda en la bitácora.
- Q: ¿En qué formato debe descargar el administrador los reportes? → A: **CSV, sin dependencias nuevas** (opción A): se abre directo en una hoja de cálculo, no agrega librerías y su contenido se compara fila por fila con la pantalla en una prueba automática; Excel y PDF quedan fuera de este sprint.
- Q: En el reporte de productividad por mecánico, ¿qué debe medirse? → A: **órdenes terminadas por mecánico en el periodo más el importe de mano de obra de esas órdenes** (opción A): ambos datos salen de lo que ya se guarda, se comparan al centavo con las órdenes que los originan y el tiempo promedio queda fuera. Nota de verificación: la orden solo guarda fecha de creación y de última modificación, así que «terminada en el periodo» exige una fecha de terminación confiable (ver Supuestos).
- Q: En el reporte de refacciones, cuando una refacción no tiene precio de compra registrado (líneas anteriores al Sprint 5), ¿cómo debe calcularse su margen? → A: **se excluyen del margen y se marcan «sin costo registrado», mostrando sus ventas aparte** (opción A): es lo único que no inventa un dato; el administrador ve que hay ventas sin costo conocido y los totales de margen solo incluyen lo que sí se puede calcular.

Decisiones pendientes y resueltas:

- **D-01** (resuelta en Session 2026-11-24): formato de exportación (CSV, Excel o PDF) y con qué librería si no es CSV → respuesta: CSV, sin dependencias nuevas; Excel y PDF quedan fuera de este sprint.
- **D-02** (resuelta por la propuesta de sprints, 2026-11-24): prioridad si el sprint se divide → configuración, términos y seguridad primero, y reportes después.
- **D-03**: si los datos del taller deben guardarse en cada ticket emitido (instantánea) para que un cambio posterior no altere los tickets, y qué datos se asignan a los tickets ya existentes.
- **D-04**: si el tipo de servicio se enlaza a las líneas de servicio de la orden (hoy texto libre) y qué pasa con las líneas existentes sin tipo.
- **D-05** (resuelta en Session 2026-11-24): cómo se calcula el margen cuando una refacción no tiene precio de compra (líneas anteriores al Sprint 5 con precio 0) → respuesta: se excluyen del margen y se marcan «sin costo registrado»; sus ventas se muestran aparte.
- **D-06**: periodos disponibles en los reportes (día, semana, mes, rango libre) y huso horario de corte.
- **D-07** (resuelta en Session 2026-11-24): definición de productividad por mecánico (órdenes terminadas, importe de mano de obra o tiempo promedio) → respuesta: órdenes terminadas por mecánico en el periodo y el importe de mano de obra de esas órdenes; el tiempo promedio queda fuera.
- **D-08**: definición de rotación de inventario (salidas del periodo sobre existencia promedio u otra).
- **D-09**: si los reportes se muestran también a recepción en una versión reducida.
- **D-10** (parcialmente resuelta en Session 2026-11-24): términos y condiciones: quién redacta el texto, en qué idioma y extensión, si se edita desde la aplicación o se publica con una migración, y si se acepta una sola vez por versión o en cada sesión → respuesta: el administrador edita y publica versiones nuevas desde la aplicación; el idioma, la extensión y la frecuencia de aceptación siguen con su valor por omisión (español, plantilla breve, una sola vez por versión).
- **D-11**: qué hacer con los usuarios ya existentes: si deben aceptar en su siguiente inicio de sesión.
- **D-12**: bitácora: qué acciones exactas se registran, cuánto tiempo se conserva y si se pagina o se exporta.
- **D-13**: política de contraseñas: longitud mínima y máxima, complejidad y si se obliga a cambiar la contraseña de los usuarios sembrados.
- **D-14**: tiempo de inactividad para cerrar la sesión (por ejemplo, 15 o 30 minutos) y si aplica igual a todos los roles.
- **D-15** (resuelta por la propuesta de sprints, 2026-11-24): prioridad si el sprint no alcanza → términos y seguridad antes que reportes (misma respuesta que D-02).
- **D-16** (resuelta en Session 2026-11-24): relación entre los márgenes globales de «Próximo» y la antelación que hoy guarda cada mantenimiento (`warn_days` y `warn_km`) → respuesta: el valor del taller rige para todo mantenimiento que usa el valor por omisión; el que tiene una antelación capturada a mano la conserva.
- **D-17**: valor predeterminado de instalación de los márgenes: el insumo dice 30 días y 1,000 km; el código y la base usan hoy 30 días y 500 km.
- **D-18**: cabeceras de seguridad del servidor: el insumo dice que ya existen, pero no se encontraron en el código; si entran en el alcance de la seguridad de este sprint.

## Fuera de alcance

- Gráficas avanzadas, tableros personalizables y analítica predictiva.
- Impuestos, facturación electrónica y contabilidad.
- Gestión de usuarios y roles (ya existe desde el Sprint 1); el sprint solo agrega la bitácora de sus cambios y la política de contraseñas.
- Configuración de credenciales de Mercado Pago o de proveedores externos: siguen en variables de entorno.
- Notificaciones (Sprint 6) y mensajes al cliente (fuera del alcance del proyecto).
- Programación o envío automático de reportes por correo.
- Cifrado de la base de datos en disco, respaldos, HTTPS y despliegue (se descartó el antiguo Sprint 8).
- Autenticación de dos factores y recuperación de contraseña por correo.
- Asesoría legal: el texto de los términos es una plantilla que el taller debe revisar con quien corresponda.

## Supuestos

- **Estado real verificado en el código (2026-11-24)**, que corrige tres afirmaciones del insumo:
  - Los datos del taller del ticket NO viven en variables de entorno: están fijos en `server/config/taller.js` (nombre «Motorix», dirección y teléfono vacíos) y el ticket los lee de ahí al consultarse, sin guardar copia. No existen `SHOP_NAME`, `SHOP_ADDRESS` ni `SHOP_PHONE`.
  - Los márgenes de «Próximo» NO son variables globales: cada mantenimiento guarda su propia antelación (`warn_days`, 30 por omisión, y `warn_km`, 500 por omisión). No existen `MAINTENANCE_WARN_DAYS` ni `MAINTENANCE_WARN_KM`. Por eso se agregan D-16 y D-17.
  - La política de contraseñas YA existe (mínimo 8 caracteres con mayúscula, minúscula y número, con respuesta `WEAK_PASSWORD` y el requisito faltante) y el bloqueo temporal tras 5 intentos fallidos durante 15 minutos también; lo que NO existe es una longitud máxima, por lo que dos contraseñas largas que solo difieren después del carácter 72 abrirían la misma cuenta. No se encontró `helmet` ni otras cabeceras de seguridad (D-18).
- **Otros datos verificados**: la sesión dura 8 horas; los servicios de la orden son texto libre sin tipo; no existen módulo de reportes, de configuración, de términos ni bitácora.
- **Numeración de migración**: el repositorio ya tiene migraciones 001 a 015; la del sprint DEBE ser la siguiente (`016_...sql`), aditiva y sin tocar migraciones ya aplicadas. El `007_...sql` que menciona el insumo es un número obsoleto (misma corrección que H-05 del Sprint 5 y que en el Sprint 6).
- **Defaults mientras se resuelven las decisiones** (se actualizarán con las respuestas de clarify):
  - D-01: RESUELTA en Clarificaciones (Session 2026-11-24): archivo CSV que abre una hoja de cálculo, sin dependencias nuevas; Excel y PDF quedan fuera de este sprint.
  - D-02 y D-15: RESUELTAS por la propuesta de sprints: primero configuración, términos y seguridad; después reportes.
  - D-03: sí, cada ticket guarda una copia de los datos del taller al emitirse; los tickets existentes conservan lo que mostraban (nombre «Motorix», sin dirección ni teléfono).
  - D-04: el enlace al tipo de servicio es opcional; las líneas existentes quedan sin tipo y no proponen próximo mantenimiento.
  - D-05: RESUELTA en Clarificaciones (Session 2026-11-24): la línea sin precio de compra se excluye del cálculo del margen y se marca «sin costo registrado»; sus ventas se muestran aparte y nunca cuenta como utilidad completa.
  - D-06: periodo por rango libre de fechas con atajos (hoy, semana, mes); la hora local del taller define el corte diario y el rango máximo es de un año.
  - D-07: RESUELTA en Clarificaciones (Session 2026-11-24): productividad = órdenes terminadas por mecánico en el periodo y el importe de mano de obra de esas órdenes; el tiempo promedio queda fuera.
  - D-19 (derivada de D-07): una orden «terminada en el periodo» se determina por la fecha en que pasó a terminada. Hoy la orden solo guarda fecha de creación y de última modificación (que cambia con cualquier edición), por lo que esa fecha no es confiable. Valor por omisión: guardar la fecha de terminación al momento del cambio de estado, y para las órdenes ya terminadas usar su última modificación como aproximación documentada y marcada como estimada para poder contarlas en el reporte. Se confirma en el plan.
  - D-08: rotación = unidades salidas en el periodo entre la existencia promedio del periodo.
  - D-09: los reportes son solo del administrador (coherente con CA-10); sin versión reducida para recepción.
  - D-10: PARCIALMENTE RESUELTA en Clarificaciones (Session 2026-11-24): el administrador publica versiones nuevas desde la aplicación. Valores por omisión de lo demás: el texto inicial es una plantilla en español redactada por el equipo y se acepta una sola vez por versión.
  - D-11: los usuarios existentes aceptan en su siguiente inicio de sesión.
  - D-12: se registran las acciones del CA-20; sin purga en este sprint; la consulta se pagina y no se exporta.
  - D-13: se conserva la política actual (8 o más caracteres con mayúscula, minúscula y número) y se agrega un máximo de 64 caracteres; no se obliga a cambiar las contraseñas de demostración sembradas.
  - D-14: 30 minutos de inactividad, igual para todos los roles.
  - D-16: RESUELTA en Clarificaciones (Session 2026-11-24): el valor del taller rige para todo mantenimiento que usa el valor por omisión; el que tiene una antelación capturada a mano la conserva. Los mantenimientos existentes cuya antelación coincide con el valor por omisión actual (30 días y 500 km) y no fue capturada a propósito se tratan como «valor por omisión»; cómo se distingue en los datos existentes se define en el plan.
  - D-17: el valor predeterminado de instalación es el que ya rige hoy (30 días y 500 km), para no cambiar el comportamiento de una instalación existente (CA-3).
  - D-18: las cabeceras de seguridad no se consideran obligatorias en este sprint; el alcance de seguridad es el de las historias y los CA del insumo.
- **Constitución**: la enmienda 1.2.0 (2026-11-18) ya amplía el alcance a siete sprints e incluye este sprint; no requiere nueva enmienda. Su alcance de seguridad (principio IV) y de pruebas (principio VII) se cumple con FR-022 a FR-030. La ratificación formal del equipo sigue pendiente, como en sprints anteriores.
- **Datos de ejemplo**: el archivo de seeds ya existe; el sprint lo amplía con configuración, tipos de servicio, una versión de términos y pagos, órdenes y refacciones suficientes para los reportes, manteniendo la idempotencia.
- **Dependencias heredadas**: se apoya en usuarios y sesión (Sprint 1), citas y órdenes (Sprint 2), mantenimientos e inventario (Sprint 3), pagos, tickets y panel (Sprint 4), precios y precio guardado por línea (Sprint 5) y centro de avisos (Sprint 6); no se tocan sus reglas (RN-5, RN-9, RN-10, RN-11, RN-12, RN-14, RN-15).
- **Entorno**: MySQL local con datos de demostración; las pruebas del proyecto corren contra su base de pruebas, nunca contra la base principal.
