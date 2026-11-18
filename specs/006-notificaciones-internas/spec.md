# Especificación de la funcionalidad: Notificaciones internas

**Feature Branch**: `006-notificaciones-internas`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Usa la descripcion de @docs/sprints/sprint-6-notificaciones-internas.md (Sprint 6 post-MVP de Motorix: notificaciones internas)"

## Escenarios de usuario y pruebas *(obligatorio)*

### User Story 1 - Campana y centro de avisos en el encabezado (Priority: P1)

Como administrador, quiero ver en el encabezado cuántos avisos pendientes tengo y abrir un centro que los muestre agrupados por tipo, para atenderlos sin recorrer cada módulo.

**Why this priority**: Es el corazón del sprint: sin la campana y el centro no existe el producto de este sprint, y el resto de las historias solo agregan cobertura por rol o tipos sobre este panel.

**Independent Test**: Puede probarse teniendo activos un mantenimiento vencido, una cita de hoy, una refacción con stock bajo y una orden detenida, iniciando sesión como administrador y verificando que la campana muestra el total y que el panel lista los cuatro avisos agrupados por tipo.

**Acceptance Scenarios**:

1. **Dado** un taller con un mantenimiento vencido, una cita para hoy, una refacción con stock bajo y una orden detenida, **Cuando** el administrador inicia sesión y observa el encabezado, **Entonces** la campana muestra el total de avisos no leídos.
2. **Dado** el administrador con la campana visible, **Cuando** abre el centro de notificaciones, **Entonces** ve los avisos agrupados por tipo con su detalle suficiente para reconocer el asunto.
3. **Dado** un administrador sin ningún aviso pendiente, **Cuando** abre el centro, **Entonces** ve el estado vacío definido en el sistema de diseño, sin errores.
4. **Dado** el centro abierto, **Cuando** la consulta de avisos falla, **Entonces** se muestra el estado de error del sistema de diseño con un mensaje claro en español y la aplicación no se bloquea.

---

### User Story 6 - Marcar como leído y abrir el módulo relacionado (Priority: P2)

Como usuario, quiero marcar un aviso como leído y abrir desde él la pantalla relacionada, para dar seguimiento rápido y que el contador refleje lo que ya atendí.

**Why this priority**: Completa el ciclo de uso del centro (marcar baja el contador y el enlace hace útil cada aviso); depende de que el centro exista (User Story 1) pero no de los demás tipos de aviso.

**Independent Test**: Puede probarse marcando un aviso como leído, verificando que el contador baja, cerrando y reabriendo sesión para comprobar que la lectura persiste, y seleccionando un aviso para verificar que abre su pantalla.

**Acceptance Scenarios**:

1. **Dado** un aviso no leído, **Cuando** el usuario lo marca como leído, **Entonces** el contador baja de inmediato y la lectura persiste tras cerrar y volver a iniciar sesión.
2. **Dado** un aviso, **Cuando** el usuario lo selecciona, **Entonces** se abre la pantalla relacionada (orden, cita, vehículo o inventario).
3. **Dado** dos usuarios con sesiones distintas, **Cuando** uno de ellos marca un aviso como leído, **Entonces** el otro sigue viéndolo como no leído: la lectura es por usuario.
4. **Dado** un aviso leído cuya condición deja de cumplirse (por ejemplo, se reabastece la refacción), **Cuando** se reconsulta el centro, **Entonces** el aviso ya no aparece; si la condición vuelve a cumplirse con otro estado, el aviso se muestra de nuevo como no leído.

---

### User Story 2 - Avisos de recepción: mantenimientos y citas (Priority: P3)

Como recepcionista, quiero ver los mantenimientos próximos y vencidos y las citas del día para avisar a los clientes a tiempo.

**Why this priority**: Es la cobertura de rol más usada en el día a día del taller y se prueba sobre el centro ya funcionando.

**Independent Test**: Puede probarse con una sesión de recepcionista verificando que el centro muestra mantenimientos y citas, que no muestra stock, y que los indicadores coinciden con la lista de Mantenimientos y el panel.

**Acceptance Scenarios**:

1. **Dado** una recepcionista con sesión iniciada, **Cuando** consulta el centro, **Entonces** ve los mantenimientos próximos y vencidos y las citas del día, y no recibe avisos de stock.
2. **Dado** un mantenimiento vencido y otro próximo, **Cuando** recepción los revisa en el centro, **Entonces** cada uno usa el mismo indicador (Vencido / Próximo) que la lista de Mantenimientos.
3. **Dado** el panel de control, la lista de Mantenimientos y el centro de notificaciones, **Cuando** se comparan sus números, **Entonces** coinciden sin diferencias.

---

### User Story 3 - Stock bajo y agotado para reabastecer (Priority: P4)

Como administrador, quiero ver las refacciones con stock bajo o agotado en el centro, para reabastecer a tiempo.

**Why this priority**: Reutiliza el cálculo de alertas ya existente y es independiente de las demás historias; solo el administrador la necesita.

**Independent Test**: Puede probarse teniendo una refacción por debajo de su existencia mínima y verificando que el aviso aparece para administrador y no para recepción ni mecánico.

**Acceptance Scenarios**:

1. **Dado** una refacción con existencia por debajo de la mínima o en cero, **Cuando** el administrador abre el centro, **Entonces** ve el aviso de stock con esa refacción identificada.
2. **Dado** una refacción cuya existencia está por encima de la mínima, **Cuando** se consulta el centro, **Entonces** no hay aviso de stock para esa refacción.
3. **Dado** una recepcionista o un mecánico con sesión iniciada, **Cuando** consultan el centro, **Entonces** no reciben avisos de stock, validado en el backend.

---

### User Story 4 - Órdenes detenidas para destrabarlas (Priority: P5)

Como administrador o recepcionista, quiero ver las órdenes detenidas en el centro, para destrabarlas antes de que se atrasen más.

**Why this priority**: Es un tipo de aviso nuevo sobre datos existentes; su criterio de "detenida" se define en Clarificaciones (D-01) y el resto del sprint no depende de él.

**Independent Test**: Puede probarse teniendo una orden sin cambios por encima del umbral definido y verificando que aparece como detenida para administrador y recepción, que no aparece una orden reciente y que el aviso abre esa orden.

**Acceptance Scenarios**:

1. **Dado** una orden sin cambio de estado por más del umbral definido (D-01), **Cuando** el administrador o la recepción abren el centro, **Entonces** ven el aviso de orden detenida con la orden identificable.
2. **Dado** una orden activa con cambio de estado reciente, **Cuando** se consulta el centro, **Entonces** no aparece como detenida.
3. **Dado** el aviso de una orden detenida, **Cuando** el usuario lo selecciona, **Entonces** se abre el detalle de esa orden.

---

### User Story 5 - Mecánico solo con avisos de sus órdenes (Priority: P6)

Como mecánico, quiero ver solo los avisos de mis órdenes asignadas para no recibir información que no me corresponde.

**Why this priority**: Es la capa de filtrado por rol más fina; se prueba sobre el centro y sus tipos ya existentes.

**Independent Test**: Puede probarse con una sesión de mecánico con órdenes asignadas verificando que solo ve avisos de esas órdenes, y con un mecánico sin órdenes verificando que ve el estado vacío.

**Acceptance Scenarios**:

1. **Dado** un mecánico con órdenes asignadas, **Cuando** consulta el centro, **Entonces** solo ve avisos relacionados con esas órdenes.
2. **Dado** un mecánico sin órdenes asignadas, **Cuando** consulta el centro, **Entonces** ve el estado vacío, sin errores.
3. **Dado** avisos que no le corresponden (stock, órdenes de otros mecánicos), **Cuando** consulta el centro desde el backend, **Entonces** no se los entrega.

---

### User Story 7 - Lista de clientes por avisar (Priority: P7)

Como recepcionista, quiero una lista de clientes por avisar (vehículo listo, cita de mañana, mantenimiento próximo o vencido) con su teléfono, y marcar cada uno como avisado, para contactarlos sin olvidar ni repetir avisos.

**Why this priority**: Es la única historia con una tabla nueva y una pantalla propia; se apoya en datos ya existentes y puede entregarse al final sin afectar las demás.

**Independent Test**: Puede probarse teniendo una orden terminada sin entregar, abriendo la lista como recepción, verificando que muestra cliente con teléfono, vehículo y motivo, marcando a un cliente como avisado y comprobando que desaparece, que queda registrado quién y cuándo, y que un hecho nuevo lo devuelve a la lista.

**Acceptance Scenarios**:

1. **Dado** una orden terminada sin entregar con su cliente, **Cuando** recepción abre la lista de clientes por avisar, **Entonces** ve cliente, teléfono, vehículo y motivo.
2. **Dado** un cliente en la lista, **Cuando** recepción lo contacta y lo marca como avisado, **Entonces** queda registrado quién lo avisó y cuándo, el cliente sale de la lista y no vuelve a aparecer por el mismo hecho.
3. **Dado** un cliente ya avisado, **Cuando** surge un hecho nuevo (otra orden u otra cita), **Entonces** vuelve a aparecer en la lista con el nuevo motivo.
4. **Dado** un mecánico con sesión iniciada, **Cuando** intenta acceder a la lista de clientes por avisar, **Entonces** el backend le niega el acceso.

---

### Casos límite

- Centro sin ningún aviso: campana en 0 y panel con estado vacío, no error.
- Aviso cuya condición desaparece sin haberse leído (se reabastece el stock, se entrega la orden): desaparece del centro.
- Aviso leído que empeora (mantenimiento de Próximo a Vencido): vuelve a mostrarse como no leído (D-05; el criterio se confirma en Clarificaciones; es coherente con la regla de reaparición del CA-6).
- Mismo aviso visto por dos usuarios: cada quien lo marca por su cuenta; la lectura de uno no afecta al otro.
- Rol sin ningún aviso de sus tipos (mecánico sin órdenes, recepción sin stock): estado vacío.
- Criterio de "orden detenida": umbral de días sin cambio de estado, valor y si es configurable (D-01).
- Alcance de "cita del día": solo hoy o también mañana; si incluye citas sin confirmar (D-02).
- Momento de actualización del contador: al navegar, con intervalo automático o solo al abrir el panel (D-03).
- Identidad de un aviso para guardar la lectura: por tipo y objeto, o por tipo y estado (D-04).
- Antelación del aviso de mantenimiento próximo: días previos y si la cita se avisa un día antes o el mismo día (D-06).
- Aviso de orden terminada para el cliente: una sola vez o repetible, y si el registro guarda una nota (D-07).
- Alcance de los avisos del mecánico: solo sus órdenes o también mantenimientos de los vehículos que atiende (D-08).
- Convivencia de la campana con la insignia actual de Inventario y el aviso de la pantalla de inicio: deben calcularse igual y no contradecirse (CA-8).
- Dos avisos distintos del mismo tipo (dos mantenimientos vencidos): cada hecho genera su propio aviso con su propia lectura.
- Cambio de fecha durante el día: los avisos de "citas del día" se recalculan en cada consulta.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El encabezado DEBE mostrar una campana con el total de avisos no leídos del usuario, y al abrirse DEBE mostrar un panel con los avisos agrupados por tipo.
- **FR-002**: Los avisos DEBEN calcularse en cada consulta con datos reales del sistema; NO deben copiarse a otra tabla de avisos: lo único que se persiste es la lectura (RN-10).
- **FR-003**: Los tipos de aviso incluidos DEBEN ser: mantenimientos próximos, mantenimientos vencidos, citas del día, stock bajo o agotado y órdenes detenidas.
- **FR-004**: El backend DEBE devolver a cada rol únicamente sus avisos: administrador todos; recepción mantenimientos, citas y órdenes detenidas (sin stock); mecánico solo avisos de órdenes asignadas a él. El stock NO se debe entregar a recepción ni a mecánico; la validación DEBE hacerse en el backend (RN-5, RN-15).
- **FR-005**: Los avisos DEBEN usar el mismo cálculo que el panel de control, la lista de Mantenimientos y las alertas de stock, y los números DEBEN coincidir entre pantallas.
- **FR-006**: Marcar un aviso como leído DEBE persistir por usuario; si la condición deja de cumplirse el aviso DEBE desaparecer, y si reaparece con otro estado DEBE mostrarse de nuevo como no leído (D-04, D-05, Clarificaciones).
- **FR-007**: Cada aviso DEBE abrir la pantalla relacionada (orden, cita, vehículo o inventario) desde el centro.
- **FR-008**: La insignia actual de Inventario y el aviso de la pantalla de inicio DEBEN seguir funcionando y NO deben contradecir los números del centro de notificaciones.
- **FR-009**: El centro DEBE manejar estados de carga, vacío y error conforme a `docs/design-system.md`, con mensajes claros en español.
- **FR-010**: RECEPTIONIST y ADMIN DEBEN poder consultar la lista de clientes por avisar con cliente, teléfono, vehículo y motivo (orden terminada sin entregar, cita de mañana, mantenimiento próximo o vencido); MECHANIC NO DEBE acceder, validado en el backend (RN-5, RN-15).
- **FR-011**: Marcar a un cliente como avisado DEBE guardar quién lo avisó y cuándo, sacarlo de la lista y evitar que vuelva a aparecer por el mismo hecho; un hecho nuevo (otra orden u otra cita) DEBE volver a mostrarlo (D-07, Clarificaciones).
- **FR-012**: Los datos de ejemplo del sprint DEBEN incluir al menos un caso de cada tipo de aviso y DEBEN poder ejecutarse de nuevo sin duplicar registros.
- **FR-013**: DEBEN existir y pasar pruebas automatizadas del cálculo de cada aviso, de los permisos por rol, de la lectura por usuario y del rendimiento de la consulta.
- **FR-014**: `docs/project-context.md` (sección 6.12) y `docs/design-system.md` DEBEN actualizarse en el mismo sprint si este comportamiento los modifica.

### Entidades clave

- **Aviso**: hecho que requiere atención del usuario, derivado de datos existentes (mantenimiento, cita, refacción, orden). Atributos de negocio: tipo, el hecho que lo origina, descripción para reconocerlo y la pantalla a la que abre. No se almacena como registro: se calcula en cada consulta.
- **Lectura de aviso**: estado de atención de un aviso por un usuario concreto. Atributos: usuario, identidad del aviso y fecha de lectura. Es lo único que se persiste del centro (identidad del aviso: D-04, Clarificaciones).
- **Aviso a cliente**: registro de que recepción contactó a un cliente por un hecho concreto. Atributos: cliente, tipo de aviso, hecho que lo origina (orden, cita o mantenimiento), quién avisó, fecha y nota opcional (D-07, Clarificaciones). Evita repetir el mismo aviso y permite que un hecho nuevo lo genere de nuevo.
- **Entidades consultadas** (sin cambios): mantenimiento (con su indicador Próximo / Vencido), cita, refacción (con sus alertas de stock) y orden de servicio; más el cliente para el teléfono de la lista por avisar.

## Criterios de éxito *(obligatorio)*

### Measurable Outcomes

- **SC-001**: Con un mantenimiento vencido, una cita de hoy, una refacción con stock bajo y una orden detenida activos, el administrador ve la campana con el total exacto (0 avisos faltantes, 0 de más) y el centro lista los cuatro agrupados por tipo.
- **SC-002**: Los números del centro coinciden en 100 % con el panel de control, la lista de Mantenimientos y las alertas de Inventario: 0 diferencias entre pantallas.
- **SC-003**: 0 avisos entregados fuera de rol verificado en el backend (recepción y mecánico sin stock; mecánico sin avisos ajenos; mecánico sin acceso a la lista de clientes por avisar).
- **SC-004**: 100 % de las lecturas persisten por usuario entre sesiones y el contador baja de inmediato al marcar un aviso como leído (0 lecturas perdidas).
- **SC-005**: La lista de clientes por avisar presenta 0 duplicados por el mismo hecho, 100 % de los avisados quedan con quién y cuándo registrados, y 100 % de los hechos nuevos vuelven a mostrar al cliente.
- **SC-006**: El centro muestra sus avisos en menos de 2 segundos con los datos de ejemplo, sin esperas perceptibles para el usuario.
- **SC-007**: La regresión completa del proyecto pasa al cierre del sprint: ninguna prueba que estaba en verde en la línea base falla (0 regresiones).
- **SC-008**: El flujo demostrable del sprint (campana → centro agrupado → abrir módulo → marcar leído → visibilidad por rol → lista de clientes por avisar) se recorre de extremo a extremo sin errores.

## Clarificaciones

Decisiones del insumo (sección 9), por resolver en `/speckit.clarify`:

- **D-01**: criterio de "orden detenida": ¿más de N días sin cambio de estado, o solo `ESPERANDO_REFACCION` por más de N días? ¿Cuánto vale N y es configurable?
- **D-02**: qué considera "cita del día": ¿solo hoy o también mañana? ¿Incluye citas pendientes sin confirmar?
- **D-03**: actualización del contador: ¿al navegar, con un intervalo de consulta (por ejemplo cada 60 segundos) o solo al abrir el panel?
- **D-04**: identidad de un aviso para la lectura: ¿por tipo y objeto (por ejemplo `STOCK:parte-12`) o por tipo y estado?
- **D-05**: si un aviso leído debe volver a aparecer cuando empeora (de Próximo a Vencido).
- **D-06**: cuántos días antes se avisa de un mantenimiento próximo y si la cita se avisa un día antes o el mismo día.
- **D-07**: si el aviso de orden terminada se da una sola vez o puede repetirse, y si el registro guarda una nota (por ejemplo, "no contestó").
- **D-08**: si el mecánico debe ver avisos de mantenimiento de los vehículos que atiende o solo de órdenes.

## Fuera de alcance

- Envío automático de avisos al cliente por cualquier canal (WhatsApp, correo, SMS): el aviso lo hace la persona de recepción y el sistema solo lo registra.
- Notificaciones en tiempo real por WebSocket o notificaciones del sistema operativo.
- Preferencias por usuario sobre qué avisos recibir.
- Historial o bitácora de avisos pasados.
- Reportes y configuración del taller (Sprint 7).

## Supuestos

- **Estado real verificado**: el panel de control YA calcula contadores de mantenimientos próximos y vencidos, citas y stock bajo (`server/services/dashboard.service.js`, `upcomingMaintenances` / `overdueMaintenances` / `lowStockCount`); la lista de Mantenimientos YA muestra el indicador Próximo / Vencido (Sprint 3); el aviso de stock bajo YA existe en la pantalla de Inventario con `PartsProvider.totalStockBajo` y las alertas en la pantalla de inicio (`dashboard_screen.dart`, `_seccionAlertas`). El insumo nombra una clase `StockAlertsProvider` que NO existe en el código; el comportamiento descrito sí existe bajo esos nombres. NO existen tablas ni endpoints de notificaciones (verificado en `database/migrations/` y `server/routes/`); este sprint añade el centro sobre lo que ya hay.
- **Numeración de migración**: el repositorio ya tiene migraciones 001 a 014; la del sprint debe ser la siguiente en la serie (`015_...sql`), aditiva y sin tocar migraciones ya aplicadas. El `006_...sql` que menciona el insumo es un número obsoleto (misma corrección que el hallazgo H-05 del Sprint 5).
- **Datos de ejemplo**: el archivo de seeds ya existe; el sprint lo amplía con al menos un caso por tipo de aviso, manteniendo la idempotencia.
- **Defaults mientras se resuelven las decisiones** (se actualizarán con las respuestas de clarify):
  - D-01: orden detenida = sin cambio de estado por más de 2 días naturales (N = 2, fijo en el sistema; hacer N configurable queda para el Sprint 7 de configuración).
  - D-02: "cita del día" = citas con fecha de hoy, sin importar su estado; la lista de clientes por avisar usa "cita de mañana" (fecha de mañana) como motivo, según el CA-10.
  - D-03: el contador se actualiza al iniciar sesión, al abrir el panel y al navegar entre pantallas; sin intervalo automático.
  - D-04: identidad del aviso = tipo + hecho que lo origina + estado; la lectura se guarda con esa clave por usuario (permite que el mismo hecho con estado distinto sea un aviso nuevo).
  - D-05: sí vuelve a aparecer como no leído cuando empeora (coherente con la regla de reaparición del CA-6).
  - D-06: los mantenimientos próximos usan la antelación ya guardada en cada mantenimiento (RN-11), sin valor global nuevo; la cita se avisa el mismo día (coherente con D-02).
  - D-07: el aviso de orden terminada para el cliente es una sola vez por hecho (coherente con el CA-11); el registro guarda quién y cuándo, con una nota opcional.
  - D-08: el mecánico solo ve avisos ligados a sus órdenes asignadas (coherente con US5 y CA-4), sin mantenimientos generales de vehículos que no le corresponden.
- **Constitución**: la constitución 1.1.0 cubre cinco sprints (1 al 5); este Sprint 6 es posterior a esa enmienda y DEBE incorporarse al alcance con una enmienda aprobada antes de implementar, igual que el hallazgo H-01 del Sprint 5. El borrador de alcance vive en `docs/sprints/propuesta-sprints-post-mvp.md`.
- **Dependencias heredadas**: se apoya en el panel y tickets (Sprint 4), en mantenimientos e inventario (Sprint 3) y en citas y órdenes (Sprint 2); no se tocan sus reglas (RN-5, RN-8, RN-10, RN-11, RN-15).
- **Entorno**: MySQL local con datos de demostración; las pruebas del proyecto corren contra su base de pruebas, nunca contra la base principal.
