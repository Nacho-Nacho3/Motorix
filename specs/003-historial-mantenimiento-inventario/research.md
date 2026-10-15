# Investigación — Sprint 3: Historial, mantenimiento e inventario

**Fecha**: 2026-10-14
**Rama**: `003-historial-mantenimiento-inventario`

Fuentes consultadas: `.specify/memory/constitution.md`, `docs/project-context.md`
(secciones 6.5, 6.6, 6.7 y las reglas 6–12 de la sección 13), `docs/design-system.md`,
`docs/sprints/sprint-3-historial-inventario.md` y las aclaraciones del spec (sesión
2026-10-14: Q1 stock negativo, Q2 tipos de movimiento, Q3 modelo de historial,
Q4 estados de mantenimiento, Q5 refacciones por orden).

Todas las incógnitas del Contexto Técnico quedan resueltas en esta fase: **0
`NEEDS CLARIFICATION` pendientes** (el stack se hereda completo de los Sprints 1–2).

## Decisiones

### R-01. Esquema del sprint: migraciones nuevas 008–011

- **Decisión**: cuatro scripts SQL numerados e inmutables en `database/migrations/`:
  `008_create_maintenance.sql`, `009_create_parts.sql`,
  `010_create_inventory_movements.sql` y `011_create_order_parts.sql`; se aplican con
  `aplicar-migraciones.ps1` y quedan registrados en `schema_migrations`.
- **Justificación**: Principio III (scripts numerados e inmutables, nada ya aplicado
  se edita); `inventory_movements` depende de `parts`, y `order_parts` depende de
  `parts` y de `service_orders`, por lo que van en scripts posteriores.
- **Alternativas consideradas**: un solo script con las 4 tablas (descartado: pierde
  granularidad de aplicación); editar un script de sprints anteriores (prohibido por
  la constitución).

### R-02. Historial del vehículo: cálculo en consulta, sin tabla derivada (Q3)

- **Decisión**: `GET /api/vehicles/{id}/history` arma el historial en el backend
  uniendo `service_orders` (solo `status IN ('FINISHED','DELIVERED')`) con
  `order_services`, `order_labor` y `order_parts` para cada vehículo, ordenado por
  `created_at` descendente; no existe tabla ni vista de historial (Q3). El modelo
  (`history.model.js`/`history.service.js`) vive en las capas existentes.
- **Justificación**: Q3 (2026-10-14) y RN-10: toda la información (fecha,
  kilometraje, diagnóstico, servicios, mano de obra, refacciones, observaciones y
  recomendaciones) ya vive en las tablas de los Sprints 1–2; calcularla en consulta
  evita duplicación y desincronización.
- **Alternativas consideradas**: tabla derivada `vehicle_history` poblada al
  terminar la orden (descartada en Q3: duplica datos y exige sincronización); vista
  SQL (descartada en Q3: oculta la lógica en la base y obliga a mantener objetos de
  esquema fuera del patrón de migraciones numeradas).

### R-03. Mantenimiento: una fila por vehículo con reemplazo (upsert)

- **Decisión**: `maintenance` guarda **un** registro vigente por vehículo
  (`vehicle_id` con índice único); registrar un nuevo mantenimiento reemplaza al
  anterior (upsert en `POST /api/maintenances`), tal como fija el supuesto del spec.
  Campos: `next_due_date` y/o `next_due_mileage` (al menos uno, con `CHECK`),
  `warn_days` y `warn_km` (antelación, con valores por defecto), `recommendations`,
  `registered_by` y marcas de tiempo.
- **Justificación**: CA-2 y el insumo (`maintenance`: crear, registrar, consultar,
  actualizar); el spec define «próximo mantenimiento» en singular por vehículo.
- **Alternativas consideradas**: N filas por vehículo con un indicador de «vigente»
  (descartado: MySQL no tiene índice único parcial y habría que auditar el
  vigente en cada lectura); tabla separada de intervalos por tipo de servicio
  (descartado: RN-12 se satisface porque cada registro guarda su propio objetivo y
  antelación, sin valores universales).

### R-04. Estados de mantenimiento calculados en el backend (Q4)

- **Decisión**: no hay columna de estado; `maintenances.service.js` calcula
  `NORMAL | UPCOMING | OVERDUE` en cada lectura con la fecha actual y
  `vehicles.current_mileage`:
  - `OVERDUE` (Vencido): `next_due_date < hoy` **o** `current_mileage >=
    next_due_mileage` (si define ambos objetivos, basta con cumplir uno).
  - `UPCOMING` (Próximo): dentro de la antelación del registro
    (`hoy + warn_days` alcanza la fecha objetivo, o `current_mileage + warn_km`
    alcanza el kilometraje objetivo).
  - `NORMAL` (Normal): el resto.
  El API devuelve el estado ya calculado junto con el registro.
- **Justificación**: Q4 (2026-10-14) y RN-11/RN-12 (antelación por registro, sin
  umbrales universales); un estado almacenado quedaría obsoleto con el paso del
  tiempo sin recalcularse.
- **Alternativas consideradas**: columna `status` ENUM actualizada por cron
  (descartado: proceso de fondo innecesario y fuente de desfase); cálculo en el
  frontend (descartado: duplica la regla de negocio fuera de `services/` y complica
  las pruebas de CA-3).

### R-05. Inventario: `stock_current` + movimientos en una transacción con bloqueo de fila

- **Decisión**: `parts.stock_current` es el saldo autoritativo y
  `inventory_movements` es el libro de auditoría; **toda** operación que modifica el
  stock corre en una transacción InnoDB que:
  1. bloquea la fila de la refacción con `SELECT ... FOR UPDATE`,
  2. valida la regla (RN-8: salida con `cantidad > stock_current` → 400
     `STOCK_INSUFFICIENT`, sin dejar saldo negativo — Q1),
  3. actualiza `stock_current` e inserta el movimiento en la misma transacción.
  Además la tabla tiene `CHECK (stock_current >= 0)` como defensa en profundidad.
  Tipos de movimiento (Q2): `IN` (reposición, solo ADMIN), `OUT` (generado
  automáticamente al usar la refacción en una orden, RN-7) y `ADJUSTMENT`
  (corrección firmada con motivo ≥ 10 caracteres, solo ADMIN). La alerta de stock
  bajo es `stock_current <= stock_min` (se calcula en la consulta).
- **Justificación**: Q1 y RN-8; el bloqueo de fila resuelve la concurrencia
  diferida en `/speckit.clarify` (dos escrituras simultáneas no pueden dejar el
  saldo fuera de la política); Principio V.
- **Alternativas consideradas**: saldo derivado solo de movimientos (descartado:
  obliga a recorrer el libro en cada lectura y complica seeds y índices); triggers
  de MySQL (descartados: la lógica de negocio debe vivir en el backend); bloqueo
  optimista con columna de versión (descartado: sin paralelismo real en el MVP local,
  el bloqueo simple es suficiente y más fácil de probar).

### R-06. Refacciones de la orden: filas múltiples y alta transaccional (Q5)

- **Decisión**: `order_parts` admite varias filas por orden (cada agregado es un
  evento con su propia salida `OUT`); `POST /api/service-orders/{id}/parts` corre en
  la misma transacción de R-05 (bloqueo → validar stock → insertar `order_parts` →
  insertar `OUT` → descontar saldo). Aplica **solo** al MECHANIC sobre sus órdenes
  que no estén `DELIVERED` (Q5); otros roles → 403, orden entregada → 400
  `ORDER_DELIVERED`. **No existe** `DELETE` de refacciones de la orden en este
  sprint: una corrección de saldo la hace ADMIN con `ADJUSTMENT` (Q2) y la fila
  usada se conserva para trazabilidad (RN-6).
- **Justificación**: Q5 (2026-10-14), RN-6 y RN-7; el spec no requiere borrar usos
  y un DELETE obligaría a un `IN` de reversión que Q2 reservó al administrador.
- **Alternativas consideradas**: upsert por `(order_id, part_id)` (descartado:
  oculta cuántas veces se usó la pieza); endpoint de eliminación para el mecánico
  (descartado: no está en el spec y rompería la simetría de movimientos Q2);
  registro de precio a fecha de uso (descartado: cálculo de costos fuera de alcance).

### R-07. Matriz de permisos del Sprint 3 (evaluada en backend)

- **Decisión** (middleware `authenticate` + `authorize` existentes):

| Recurso | ADMIN | RECEPTIONIST | MECHANIC |
|---------|-------|--------------|----------|
| Historial del vehículo (lectura) | sí | **403** | sí |
| Mantenimientos: listar/consultar | sí | sí (su caso de uso: avisar al cliente) | sí |
| Mantenimientos: registrar/actualizar | sí | **403** | sí |
| Inventario: catálogo, stock, alertas, movimientos (lectura) | sí | **403** | **403** |
| Inventario: alta/edición de refacciones, `IN` y `ADJUSTMENT` | sí | **403** | **403** |
| Refacciones de una orden: agregar | **403** | **403** | solo sus órdenes no ENTREGADAS |
| Refacciones de una orden: consultar | sí | sí | solo las suyas (403 si es ajena) |

- **Justificación**: FR-016/RN-15 (matriz base del spec), US4 (recepción solo
  consulta mantenimientos), US5/US6/US8 (inventario de administrador) y Q5
  (solo mecánico agrega refacciones).
- **Alternativas consideradas**: permisos granulares por usuario (descartado: 3
  roles fijos); dar recepción acceso de lectura al inventario (descartado: el spec
  no lo incluye y CA-7 castiga el exceso tanto como la omisión).

### R-08. Superficie de API y códigos de error nuevos

- **Decisión**: sobre el sobre JSON y los middlewares existentes:
  `GET /api/vehicles/{id}/history`;
  `GET /api/maintenances` (filtro `?state=NORMAL|UPCOMING|OVERDUE`) y
  `POST /api/maintenances` (upsert por vehículo);
  `GET /api/parts` (búsqueda `?q=`, filtro `?low=true`), `POST /api/parts`,
  `PATCH /api/parts/{id}`, `GET/POST /api/parts/{id}/movements`;
  `GET/POST /api/service-orders/{id}/parts`. Códigos nuevos:
  `PART_NOT_FOUND` (404), `PART_REQUIRED` (400), `PART_CODE_DUPLICATED` (400),
  `STOCK_INSUFFICIENT` (400), `MAINTENANCE_TARGET_REQUIRED` (400). Reutiliza
  `VALIDATION_ERROR`, `FORBIDDEN`, `UNAUTHORIZED`, `VEHICLE_REQUIRED`,
  `VEHICLE_NOT_FOUND`, `SERVICE_ORDER_NOT_FOUND`,
  `ORDER_DELIVERED` (400: uso de refacciones en orden entregada) e
  `INTERNAL_ERROR`.
- **Justificación**: Principio VI (rutas coherentes, códigos apropiados) y el patrón
  de contrato de los Sprints 1–2; `POST .../movements` distingue `IN`/`ADJUSTMENT`
  por el cuerpo, sin endpoint por tipo.
- **Alternativas consideradas**: `POST /api/parts/{id}/restock` para entradas
  (descartado: duplicaría la validación de un solo handler de movimientos);
  `DELETE /api/parts/{id}` (descartado: las refacciones con movimientos u órdenes
  asociadas no se eliminan y el spec no pide borrado del catálogo); `DELETE
  .../{id}/parts` (ver R-06).

### R-09. Fechas, kilometraje y cantidades: tipos nativos e ISO en la API

- **Decisión**: `next_due_date` como `DATE` (`YYYY-MM-DD` en JSON), kilometrajes y
  stock como enteros, precios como `DECIMAL(10,2)`; el estado de mantenimiento se
  calcula con la fecha local del equipo en el backend. El frontend usa
  `showDatePicker` y campos numéricos nativos (sin dependencia nueva). Los estados
  se pintan con los tokens del design system: ámbar para `UPCOMING`, rojo para
  `OVERDUE`, verde para `NORMAL`.
- **Justificación**: MVP local de un solo huso horario; Principio VIII (tokens y sin
  dependencias nuevas para lo que resuelven los widgets nativos).
- **Alternativas consideradas**: `DATETIME` para el objetivo (descartado: no se
  programa por hora); librerías de fechas (descartadas: dependencia innecesaria);
  calcular el estado en Flutter (descartado en R-04).

### R-10. Seeds del sprint: inventario, mantenimientos y una orden terminada

- **Decisión**: ampliar `server/scripts/seed.js` con datos de ejemplo idempotentes:
  ~6 refacciones (una por debajo de su stock mínimo para ver alertas), sus movimientos
  `IN` iniciales, ~3 mantenimientos (al menos uno Vencido y otro Próximo) y al menos
  **una orden en estado TERMINADO o ENTREGADO** con servicios, mano de obra y una
  refacción usada, de modo que el historial y las alertas muestren información al
  arrancar. Re-ejecutar `npm run seed` no crea registros duplicados.
- **Justificación**: Principio III (la app nunca arranca vacía), restricción de
  idempotencia del insumo, SC-009 y CA-1 (sin orden terminada el historial arrancaría
  vacío).
- **Alternativas consideradas**: script de seeds separado por sprint (descartado:
  duplicaría la lógica de idempotencia ya resuelta); dejar el historial a su suerte
  con las órdenes del Sprint 2 (descartado: esas órdenes se crean en RECIBIDO y no
  demostrarían CA-1).

### R-11. Pantallas, navegación y estado: nuevas secciones en el rail

- **Decisión**: se agregan al `NavigationRail` las entradas **Historial** (ADMIN y
  MECHANIC), **Mantenimientos** (los 3 roles) e **Inventario** (solo ADMIN), con
  visibilidad filtrada por rol en `app_shell.dart`; pantallas
  `screens/history/vehicle_history_screen.dart` (selector de vehículo + lista
  cronológica con los datos de cada servicio), `screens/maintenance/` (lista con
  estados Normal/Próximo/Vencido + formulario de registro) e `screens/inventory/`
  (lista de refacciones con `FilterChip` «Stock bajo» + formulario de alta/edición);
  el detalle de orden gana la sección «Refacciones» (agregar y consultar, Q5);
  providers `vehicle_history_provider.dart`, `maintenances_provider.dart` y
  `parts_provider.dart`; modelos `maintenance.dart`, `part.dart`,
  `inventory_movement.dart` y `history_entry.dart`; rutas nuevas con el patrón
  `AppRoute`/`transicionPantalla()` y reutilización de `states_view.dart`,
  `confirm_dialog.dart` y `estado_orden_chip.dart`. **Sin dependencias nuevas** en
  `pubspec.yaml`.
- **Justificación**: Principio VIII (mismo sistema de diseño y tokens), FR-018 y la
  navegación por rail resuelta en el Sprint 1; el filtro `FilterChip` nativo cubre
  CA-7 sin una pantalla extra.
- **Alternativas consideradas**: pantalla dedicada de alertas de stock (descartada:
  duplica el listado de inventario; el filtro con contador de resultados cubre CA-7);
  historial como pestaña del detalle de orden (descartado: US1 pide ver el historial
  de un vehículo completo, con sus órdenes varias); secciones dentro de Inicio
  (descartado: crece rápido y rompe la navegación existente).

### R-12. Pruebas del Sprint 3

- **Decisión**:
  - Unit (`server/tests/unit/`): `maintenance-state.test.js` (Normal/Próximo/Vencido
    por fecha y kilometraje, regla de «cualquiera de los dos», antelación por
    registro) e `inventory-stock.test.js` (salida sin stock → rechazo sin saldo
    negativo, `ADJUSTMENT` firmado con motivo, `IN` solo admin).
  - Integración (`server/tests/integration/`): `vehicle-history.test.js` (CA-1,
    RN-10, estados incluidos/excluidos), `maintenances.test.js` (CA-2/CA-3, upsert y
    estados), `parts-inventory.test.js` (CA-4/CA-6, códigos, permisos) y
    `order-parts.test.js` (CA-5, RN-6/RN-7, Q5: rol, orden ajena y entregada).
  - Contrato (`server/tests/contract/`): `vehicle-history.contract.test.js`,
    `maintenances.contract.test.js` e `inventory.contract.test.js` (sobre JSON,
    códigos y roles por endpoint).
  - Frontend (`client/test/`): providers nuevos, visibilidad de secciones del rail
    por rol y filtro «Stock bajo». Nombres y mensajes de aserción en español.
- **Justificación**: Principio VII (toda lógica de negocio — estados de
  mantenimiento, stock, permisos — debe tener pruebas) y CA-8.
- **Alternativas consideradas**: E2E automatizado con Playwright/Cypress (descartado:
  fuera del alcance definido en el Sprint 1; la validación E2E es el quickstart).

## Pendientes fuera de esta fase

- Actualizar `docs/project-context.md` si el equipo desea reflejar las decisiones
  nuevas (histórico calculado, `maintenance` de fila única, tipos de movimiento,
  rechazo de stock negativo) — trazabilidad del Principio I al momento de
  implementar.
- No hay incógnitas técnicas abiertas: **0 `NEEDS CLARIFICATION`**.
