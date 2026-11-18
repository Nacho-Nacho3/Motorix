# Investigación — Sprint 6: Notificaciones internas

**Fecha**: 2026-11-05 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Fase 0 de `/speckit.plan`. No quedan `NEEDS CLARIFICATION` en el Contexto técnico: cada valor se verificó contra el repositorio (migraciones 001–014, `dashboard.service.js`, `maintenances.service.js`, `part.model.js`, `service_orders`, rutas y `authorize(...)`, `app_shell.dart`, `states_view.dart`). Cada decisión se registra con **Decisión**, **Justificación** y **Alternativas consideradas**. Los identificadores `P-xx` son de este plan; no confundir con `D-xx` (decisiones de clarify) ni con `R-xx`/`CA-xx`/`FR-xx` (riesgos, aceptación y requisitos del spec).

## P-1. Avisos calculados en cada consulta, sin tabla de avisos

**Decisión**: los avisos del centro se construyen en `notifications.service.js` reutilizando los módulos existentes en la misma ejecución: `listarMantenimientos()` (que ya entrega `UPCOMING`/`OVERDUE` ordenado por urgencia), `part.listar({low:true})` (mismo filtro que `GET /api/parts?low=true`), la consulta de citas por `appointment_date` y las órdenes detenidas del criterio D-01. No existe tabla, caché ni job de avisos.

**Justificación**: es lo que exigen RN-10 («los avisos derivados no deben duplicar información»), CA-2 (cálculo al abrir) y CA-5 (el centro debe coincidir con el detalle de la pantalla de inicio y con Inventario). Reutilizar las mismas funciones elimina por construcción el desfase contador/detalle que ya resolvió el Sprint 4 en `dashboard.service.js`.

**Alternativas consideradas**: tabla materializada de avisos (rechazada: duplica datos que ya viven en sus tablas, viola RN-10 y se desincroniza como el `inventory_alerts` de la G-01); triggers que insertan filas al cambiar estado (rechazada: es lógica de negocio en la base de datos, fuera de la capa `services/`); caché en memoria con TTL (rechazada: CA-2 pide el cálculo en cada apertura y D-03 prohíbe actualización automática en segundo plano).

## P-2. Una sola migración nueva: `015_notifications.sql`

**Decisión**: la siguiente migración numerada es `015_notifications.sql` (tras la `014_order_parts_price.sql` del Sprint 5) y crea las dos tablas nuevas (`notification_reads` y `client_notices`) en un solo archivo, con registro idempotente en `schema_migrations`.

**Justificación**: el insumo del sprint menciona `006_...sql`, pero la numeración 006–013 ya está ocupada por los Sprints 1–4 (hallazgo anotado en Supuestos del spec, mismo patrón que H-05 del Sprint 4). El proyecto aplica una migración por sprint y las dos tablas se juegan y validan juntas.

**Alternativas consideradas**: editar o reutilizar una migración ya aplicada (rechazado: los scripts son inmutables, III.3); dos migraciones nuevas `015` y `016` (rechazada: se aplican en la misma corrida y solo fragmentan el registro); usar el número 006 que sugiere el insumo (rechazado: colisiona con `006_create_clients.sql`).

## P-3. Orden detenida sobre `service_orders.updated_at` (sin `order_status_history`)

**Decisión (D-01)**: orden detenida = `status NOT IN ('FINISHED','DELIVERED')` **y** `updated_at <= NOW() - INTERVAL 2 DAY`. El estado no terminal son los cuatro estados de trabajo (`RECEIVED`, `DIAGNOSIS`, `IN_REPAIR`, `WAITING_PART`); los terminales son `FINISHED` y `DELIVERED`.

**Justificación**: verificado el 2026-11-05: **no existe la tabla `order_status_history`** que el insumo supone (ninguna migración la crea; `grep` sin coincidencias), así que el único historial real de actividad de la orden es `service_orders.updated_at` (`ON UPDATE CURRENT_TIMESTAMP`). Con N=2 fijo sobre ese campo se cumple el texto de D-01 con la columna disponible, sin tocar los flujos de transición de estado existentes.

**Alternativas consideradas**: crear `order_status_history` para saber el instante exacto de cada cambio de estado (rechazada: exige escribir en cada transición — toca los flujos del Sprint 2 con riesgo alto —, duplica historia que el registro de la orden ya refleja (RN-10) y amplía el esquema sin que lo pida el spec); usar `created_at` (rechazada: una orden avanzada que existe hace 3 días no está detenida); columna nueva `last_status_change` mantenida por aplicación (rechazada: misma fricción que el historial y un dato que puede quedar desactualizado).

**Limitación conocida (aceptada)**: `updated_at` se actualiza con cualquier edición de la orden (diagnóstico, observaciones), no solo con cambios de estado; en la práctica «sin actividad durante 2 días» es un buen proxy de «detenida» y, si la orden se toca por cualquier motivo, deja de contar como detenida — el aviso desaparece (coherente con CA-6).

## P-4. Identidad de lectura por clave `TIPO:id:ESTADO` (D-04)

**Decisión (D-04)**: la identidad de un aviso es `{TIPO}:{id}:{ESTADO}` y la lectura se guarda en `notification_reads` con clave única `(user_id, notification_key)`. Formato por tipo:

| Tipo | Ejemplo de clave | Estado |
|------|------------------|--------|
| Mantenimiento | `MAINTENANCE:12:UPCOMING` / `MAINTENANCE:12:OVERDUE` | estado calculado del mantenimiento (D-06: con los `warn_days`/`warn_km` del propio registro, RN-11) |
| Cita | `APPOINTMENT:7:TODAY` | `TODAY` (fecha de hoy, cualquier estado, D-02) |
| Stock | `STOCK:3:LOW` / `STOCK:3:OUT` | `LOW` si `stock_current <= stock_min`; `OUT` si `stock_current = 0` |
| Orden detenida | `ORDER_STOPPED:42:WAITING_PART` | estado no terminal actual de la orden (D-01) |

**Justificación**: es la opción que resolvió clarify en D-04. Incluir el estado hace que el aviso se re-muestre si empeora (de `UPCOMING` a `OVERDUE`, de `LOW` a `OUT`, o si la orden detenida cambia de estado sin salir de los no terminales), que la clave describa de qué se trata sin consultar nada más y que la tabla de lectura no crezca por reordenar el mismo objeto.

**Alternativas consideradas**: tipo+objeto sin estado (`STOCK:3`) — rechazada en D-04 por perder la identidad del estado (CA-6); un `is_read` por fila de aviso (rechazada: no hay filas de aviso, P-1); un JSON con las claves leídas por usuario (rechazado: no se puede consultar por índice ni validar con clave única).

## P-5. Un solo endpoint de lectura: `GET /api/notifications` con contador y grupos

**Decisión**: `GET /api/notifications` devuelve `{ unreadCount, groups }` donde `groups` es el arreglo por tipo con sus ítems (cada ítem con `key`, campos de presentación y `read`). El contador es la cantidad de avisos calculados cuya clave no está en las lecturas del usuario. El endpoint se invoca al iniciar sesión, al abrir el panel y al navegar entre secciones (D-03), sin intervalo automático.

**Justificación**: una sola fuente garantiza que la campana y el panel muestren siempre el mismo número (CA-5) y cumple D-03 sin un segundo endpoint que pueda desfasarse. El costo en local es despreciable con el volumen de datos del MVP (CA-13 se valida con prueba de rendimiento).

**Alternativas consideradas**: endpoint separado solo para el contador (`/summary`) (rechazado: duplica el cálculo y añade un punto de desfase entre campana y panel); polling cada N segundos (rechazado explícitamente por D-03 y por la ausencia de SSE/WebSocket en el stack); SSE o WebSocket (rechazado: dependencia y complejidad nuevas sin necesidad; D-03 fija la actualización por interacción).

## P-6. Matriz de rol aplicada en el servicio, un solo endpoint

**Decisión (CA-4/FR-004)**: `notifications.service.js` filtra los grupos según el rol del usuario autenticado:

| Rol | Mantenimientos próximos/vencidos | Citas de hoy | Stock bajo/agotado | Órdenes detenidas |
|-----|----------------------------------|--------------|--------------------|-------------------|
| ADMIN | ✓ | ✓ | ✓ | ✓ (todas) |
| RECEPTIONIST | ✓ | ✓ | ✗ (solo ADMIN) | ✓ (todas) |
| MECHANIC | ✗ (D-08: sin avisos generales) | ✗ | ✗ | ✓ (solo de sus órdenes: `mechanic_id` = usuario) |

**Justificación**: la matriz vive en un solo lugar testeable; el controlador solo delega. Es exactamente lo que fija CA-4 y el resolve de D-08 («solo avisos ligados a sus órdenes asignadas; sin mantenimientos generales», tras rechazar la opción de incluir mantenimientos de sus vehículos).

**Alternativas consideradas**: endpoints distintos por rol (`/notifications/mechanic`, etc.) (rechazado: duplica rutas y contratos sin ganar nada, la matriz ya es un `switch` en el servicio); ocultar grupos solo en el frontend (rechazado: RN-15 exige que el backend sea quien valida permisos; el cliente podría pedir datos de otro rol).

## P-7. Marcar leído: `POST /api/notifications/read` con cuerpo `{ key }`

**Decisión**: `POST /api/notifications/read` recibe `{ "key": "STOCK:3:LOW" }`, valida el formato con `notificationKeySchema` (zod, mensajes en español) e inserta/upserta `(user_id, notification_key)` con `read_at` actual. Responde `{ ok: true, data: { read: true, unreadCount } }` con el contador recalculado para que la campana se actualice en el mismo viaje. Idempotente: repetir la llamada no cambia nada ni falla; una clave bien formada que hoy no corresponde a un aviso activo se acepta (la fila es inocua porque el contador se calcula como intersección de calculados y leídos).

**Justificación**: la semántica es «registrar lectura», no borrar; el cuerpo evita los dos puntos de la clave en la ruta (encoding frágil en URL); devolver `unreadCount` evita una segunda llamada solo para refrescar la campana (D-03).

**Alternativas consideradas**: `POST /notifications/:key/read` (rechazado: la clave contiene `:` y requiere escaping, frágil); `DELETE /api/notifications/:key` (rechazado: no se borra nada, se registra una lectura, y el mismo problema de ruta); marcar todo leído de una (`read-all`) (rechazado: D-04 fija identidad individual; «leído todo» rompería que un aviso nuevo reaparezca como no leído).

## P-8. Clientes por avisar: motivos, exclusión por hecho y registro idempotente

**Decisión (CA-10/CA-11, D-07)**: `GET /api/client-notices` devuelve una fila por `(cliente, hecho sin avisar)` con `phone`, `clientName`, `motive`, `sourceId` y `note`:

- `ORDER_READY`: órdenes con `status = 'FINISHED'` (terminada sin entregar; `DELIVERED` queda fuera) cuyo cliente no tenga ya un aviso `ORDER_READY` de **esa** orden.
- `APPOINTMENT_TOMORROW`: citas con `appointment_date = CURDATE() + 1` y `status NOT IN ('COMPLETED','CANCELED')` sin aviso de **esa** cita. El estado se acota a los no terminales porque una cita completada o cancelada ya no es motivo de llamada (el default documentado de diseño; D-02 se refiere a la campana del día, no a esta lista).
- `MAINTENANCE_UPCOMING` / `MAINTENANCE_OVERDUE`: vehículos con mantenimiento en estado calculado UPCOMING u OVERDUE (mismo cálculo de `listarMantenimientos`, CA-5) sin aviso de **ese** mantenimiento.

La exclusión se hace con `LEFT JOIN client_notices ON (client_id, notice_type, source_id) ... WHERE id IS NULL`: una vez por hecho (D-07). `POST /api/client-notices` registra `{ clientId, type, sourceId, note? }` con `notified_by` = usuario actual y clave única; responde **201** si se creó y **200** con la fila existente si ya estaba (idempotente). Roles: solo ADMIN y RECEPTIONIST; MECHANIC 403 (CA-10, FR-010).

**Justificación**: la clave única `(client_id, notice_type, source_id)` es la garantía estructural de «una vez por hecho» aunque dos personas registren a la vez (transacción con upsert). `note` opcional satisface el default de D-07 sin obligar a capturar nada.

**Alternativas consideradas**: excluir por cliente completo en cuanto se avisa una vez (rechazado en D-07: pierde el otro motivo del mismo cliente); tabla de «avisados» sin `source_id` (rechazada: no distingue hechos y rompe la unicidad por hecho); estado `notified` en las propias citas/órdenes/mantenimientos (rechazado: escribiría en tablas de otros módulos y mezclaría el aviso con el hecho (RN-10)).

## P-9. `notice_type` como `VARCHAR(40)` y no como `ENUM`

**Decisión**: `client_notices.notice_type` es `VARCHAR(40) NOT NULL` con los cuatro valores documentados (`ORDER_READY`, `APPOINTMENT_TOMORROW`, `MAINTENANCE_UPCOMING`, `MAINTENANCE_OVERDUE`); la validación de dominio está en zod (backend) y en el modelo Dart.

**Justificación**: los motivos pueden crecer (nuevo tipo de aviso a cliente) sin emitir un `ALTER TABLE` que reescriba la definición; a diferencia de los estados de negocio (siempre `ENUM` en este proyecto) los motivos son categorías abiertas de una tabla nueva. La restricción de valores vive en la capa de validación, que es donde el proyecto ya valida dominios (zod).

**Alternativas consideradas**: `ENUM(...)` (rechazado: cada motivo nuevo exige migración sobre tabla ya aplicada y encadena el backlog de esquema); tabla `notice_types` normalizada (rechazada: sobrediseño para cuatro categorías sin altas bajas).

## P-10. Routers propios en `index.js` (`/api/notifications` y `/api/client-notices`)

**Decisión**: dos routers nuevos montados en `server/routes/index.js`: `rutas.use("/notifications", rutasNotifications)` y `rutas.use("/client-notices", rutasClientNotices)`, siguiendo el patrón de «cada historia añade su router aquí».

**Justificación**: `/api/clients/notices` competiría con `GET /clients/:id` (el fijo debe ir antes que el paramétrico y el orden actual ya tiene su propio contrato); un recurso propio evita tocar `clients.routes.js` y deja la lista de avisos a cliente con su controlador, validador y contrato independientes, como los demás módulos.

**Alternativas consideradas**: subrecurso `/api/clients/notices` (rechazado: obliga a reordenar rutas existentes y a metar lógica de otro módulo dentro de `clients.routes.js`); montar en el router de dashboard (rechazado: el dashboard es exclusivo de ADMIN y estos endpoints aceptan también RECEPTIONIST).

## P-11. Frontend: campana en `app_shell.dart`, panel con `states_view.dart`

**Decisión**: la campana con contador vive en el encabezado de `app_shell.dart` (compartido por todas las secciones); al tocarla se abre `notifications_panel.dart`, que agrupa por tipo y reutiliza `states_view.dart` para carga/vacío/error (CA-9). `notifications_provider.dart` expone `unreadCount`, `groups`, `cargar()` y `marcarComoLeido(key)`; se refresca al iniciar sesión, al abrir el panel y al cambiar de sección (D-03). La entrada «Clientes por avisar» (`client_notice_screen.dart` + `client_notices_provider.dart`) aparece en el menú solo para ADMIN y recepción (CA-10) y navega con `app_route.dart`.

**Justificación**: es el mismo patrón que ya usan `dashboard_provider` y `parts_provider`; el encabezado es el único lugar visible desde cualquier sección (CA-1); los estados ya estandarizados del Sprint 4 evitan pantallas de carga caseras.

**Alternativas consideradas**: pantalla de notificaciones como sección de primer nivel (rechazada: ocupa un lugar de navegación para un complemento; el panel accesible desde la campana es menos intrusivo); badge solo en la pantalla de inicio (rechazado: CA-1 pide campana en el encabezado de todas las pantallas); refresco automático por timer (rechazado por D-03).

## P-12. Seeds ampliados: un caso por tipo, idempotentes (CA-12)

**Decisión**: `server/scripts/seed.js` gana bloques idempotentes que garantizan al menos un caso por tipo: una cita con `appointment_date = CURDATE()` (o `CURDATE()+1` para el motivo de la lista por avisar), una orden existente con `updated_at` retrotraído 3 días en estado no terminal (detección por marcador en `reported_problem`/`observations`, como los seeds del Sprint 4), y verificación de que exista al menos una refacción con `stock_current <= stock_min` y un mantenimiento UPCOMING u OVERDUE (ya los hay con los seeds del Sprint 3/4; si faltara, se ajusta uno existente sin crear duplicados).

**Justificación**: CA-12 pide «al menos un caso por tipo» y que «ejecutar dos veces no duplique»; los datos de los Sprints 1–4 no garantizan cita de hoy ni orden detenida, y el resto (stock bajo, mantenimientos) sí existe pero se re-verifica para que la prueba sea estable en instalaciones nuevas.

**Alternativas consideradas**: crear entidades nuevas cada corrida (rechazado por CA-12); depender de que el evaluador cree los casos a mano (rechazado: el escenario manual debe poder arrancar de cero; es el mismo criterio con el que el Sprint 4 arregló sus seeds); una migración con datos de ejemplo (rechazado: las migraciones no llevan datos de negocio y alterarían instalaciones existentes).

## P-13. Estrategia de pruebas y rendimiento (FR-013, CA-13)

**Decisión**:

- **Unit** (`server/tests/unit/notification-rules.test.js`): construcción de la clave D-04 por tipo/estado (incluida la transición `LOW→OUT` y `UPCOMING→OVERDUE`), criterio de orden detenida D-01 (no terminal + 2 días, con `FINISHED`/`DELIVERED` excluidos y con órdenes recientes incluidas), motivos y filtro de estado de la lista por avisar.
- **Integración** (`notifications.test.js`, `client-notices.test.js` contra `motorix_test`): cálculo de cada tipo con seeds, matriz de rol completa (403/204/alcance por rol), lectura individual por usuario (no afecta a otro usuario), idempotencia de `read` y del registro de aviso (201→200), exclusión por hecho ya avisado, y **rendimiento**: `GET /api/notifications` responde en < 1000 ms con los datos sembrados (umbral generoso para CI local, CA-13).
- **Contrato** (`contract/`): sobre `{ok,data}`/`{ok,error}`, códigos HTTP y de error existentes, campos exactos de cada respuesta, token obligatorio.
- **Flutter** (`flutter test`): campana muestra y limpia el contador, panel agrupa por tipo con sus estados, lista por avisar marca avisado y actualiza.

**Justificación**: cubre FR-013 y CA-13 con la misma pirámide del proyecto (unit → integración → contrato → UI); el umbral de rendimiento con margen amplio mide regresiones groseras (N+1, consulta que se dispara) sin volverse frágil en CI.

**Alternativas consideradas**: prueba de rendimiento con percentiles p95 sobre muchas corridas (rechazada: ruidosa en máquinas variadas); omitir la prueba de rendimiento (rechazado: CA-13 la pide explícitamente); mocks del modelo en integración (rechazado: el proyecto prueba contra `motorix_test` real para que el cálculo y el esquema se validen juntos).

## P-14. Defaults de las decisiones diferidas (D-06, D-07)

**Decisión**: mientras clarify no las pregunte, valen los defaults constreñidos por el spec:

- **D-06 (antelación de mantenimientos)**: los avisos próximos/vencidos usan el cálculo de `listarMantenimientos()` con los `warn_days`/`warn_km` de **cada** registro (RN-11), que es además lo que exige CA-5 para coincidir con la pantalla de inicio. Un único umbral global quedaría descartado de todos modos por esa coincidencia.
- **D-07 (avisar una vez por hecho)**: una fila de `client_notices` por `(cliente, tipo, fuente)` con nota opcional (P-8).

**Justificación**: ambos defaults son los únicos compatibles con las reglas ya cerradas (CA-5/CA-11); cambiarlos después requeriría reabrir esas CA.

**Alternativas consideradas**: umbral fijo global para mantenimientos (rechazado: rompe CA-5 y RN-11); re-avisar por cliente completo (rechazado: rompe CA-11).

## P-15. Filas de lectura huérfanas: se conservan, sin purga

**Decisión**: cuando un aviso desaparece (la orden se entrega, el stock sube), su fila en `notification_reads` queda. El contador nunca la ve porque se calcula como «avisos actuales que no están leídos». No hay purga ni job de limpieza.

**Justificación**: las filas pesan unos bytes y no afectan ninguna consulta (la tabla se consulta solo por `user_id` + clave); un DELETE en segundo plano contradiría D-03 (sin tareas automáticas) y añadiría código sin beneficio observable.

**Alternativas consideradas**: purgar al recalcular el contador (rechazado: muta datos en una consulta GET y complica la idempotencia); TTL sobre `read_at` (rechazado: misma fricción y rompería la unicidad estable de D-04).
