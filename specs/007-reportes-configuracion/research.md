# Investigación — Sprint 7: Reportes, configuración, términos y seguridad

**Fecha**: 2026-11-24 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Fase 0 de `/speckit.plan`. No quedan `NEEDS CLARIFICATION` en el Contexto técnico: cada valor se verificó contra el repositorio el 2026-11-24 (migraciones 001–015, `server/config/{env,jwt,taller}.js`, `middlewares/authenticate.js`, `services/{auth,users,maintenances,tickets,payments,inventory,service_orders}.service.js`, `models/{maintenance,ticket,order_part,payment}.model.js`, `utils/maintenance-state.js`, `routes/*`, `tests/helpers/usuarios.js` y el cliente Flutter: `session_provider.dart`, `app_shell.dart`, `main.dart`). Las decisiones D-01 a D-19 de la especificación se resuelven o se confirman aquí.

## P-1. Una sola migración nueva: `016_settings_reports_security.sql`

**Decisión**: la siguiente migración numerada es la `016` (tras la `015_notifications.sql` del Sprint 6) y reúne todo el esquema del sprint: 5 tablas nuevas (`settings`, `service_types`, `terms_versions`, `terms_acceptances`, `audit_log`) y 12 columnas nuevas o modificadas en 6 tablas existentes (`maintenance`, `order_services`, `order_parts`, `service_orders`, `tickets` y `users`; P-3, P-4, P-6, P-7, P-8 y P-12).

**Justificación**: el insumo menciona `007_...sql`, pero 001–015 ya están ocupadas (mismo hallazgo que H-05 del Sprint 5 y el Sprint 6). El proyecto aplica una migración por sprint y sus partes dependen unas de otras (el ticket usa el tipo de servicio y la configuración), así que se validan juntas. Los cambios sobre tablas existentes son aditivos (columnas nuevas, una columna que pasa a admitir `NULL`) y siguen el precedente de la `014`.

**Alternativas consideradas**: dos migraciones (`016` configuración y seguridad, `017` reportes) para acompañar las dos entregas (rechazada: los reportes no agregan tablas, solo `finished_at` y `unit_cost`, que también usan el ticket y la bitácora; fragmentar no reduce el riesgo); modificar migraciones ya aplicadas (rechazada: inmutables, principio III).

## P-2. Configuración en una tabla clave-valor con respaldo en código (D-16, D-17, CA-3)

**Decisión**: tabla `settings` (`setting_key` PK, `setting_value`, `updated_by`, `updated_at`) con cinco claves: `shop.name`, `shop.address`, `shop.phone`, `maintenance.warn_days` y `maintenance.warn_km`. `settings.service.js` entrega siempre un objeto completo: el valor guardado o, si falta, el **valor de respaldo** (`config/taller.js` para el taller y 30 días y 500 km para los márgenes, que son los que ya rigen hoy, D-17). La tabla nace vacía: una instalación existente se comporta igual (CA-3, SC-003).

**Justificación**: el insumo supone variables `SHOP_*` y `MAINTENANCE_WARN_*` en `.env` que **no existen**: los datos del taller están fijos en `server/config/taller.js` y la antelación vive en cada fila de `maintenance`. Una tabla clave-valor evita una migración por cada ajuste futuro; el respaldo en código hace innecesario sembrar la tabla para que el sistema funcione. Límites validados con zod: nombre 1–100 caracteres, dirección ≤ 200, teléfono ≤ 30, días 0–365 y kilómetros 0–20,000.

**Alternativas consideradas**: una sola fila con columnas (rechazada: cada ajuste nuevo exige migración); variables de entorno nuevas (rechazada: cambiarlas exige reiniciar el servidor, que es justo la deuda); leer siempre la tabla y sembrarla (rechazada: una instalación sin seed fallaría).

## P-3. Márgenes de «Próximo»: columnas `NULL` = «usar el valor del taller» (D-16)

**Decisión**: `maintenance.warn_days` y `maintenance.warn_km` pasan a `INT UNSIGNED NULL` sin valor por omisión. `NULL` significa «sin antelación propia: rige el valor del taller»; un número significa «capturada a mano». La resolución ocurre en un solo lugar del servicio (`resolverMargenes`) que usan `maintenances.service.js` y `client-notices.service.js`; el dashboard y el centro de avisos ya consumen `listarMantenimientos()`, así que coinciden por construcción (SC-002). La API sigue devolviendo `warnDays` y `warnKm` **efectivos** y añade `warnDaysCustom` y `warnKmCustom` (booleanos) para que el formulario sepa si el campo se capturó a mano.

**Migración de los datos existentes**: antes del cambio todas las filas guardan un número (el formulario precarga 30 y 500). No se puede distinguir una captura deliberada de un valor precargado, así que la migración trata como «por omisión» (`NULL`) las filas cuyo valor **coincide con el predeterminado histórico** (30 días, 500 km), columna por columna; los valores distintos se conservan como propios. **Limitación aceptada y documentada**: un administrador que haya capturado a propósito exactamente 30 o 500 verá que su valor ahora sigue al del taller; el efecto práctico es nulo mientras el valor del taller no cambie.

**Justificación**: es lo que decidió clarify (opción B de la Session 2026-11-24) y evita un campo extra tipo `uses_default`. La función pura `calcularEstadoMantenimiento` no cambia: sigue recibiendo `warnDays` y `warnKm`.

**Alternativas consideradas**: columna booleana `warn_is_custom` (rechazada: duplica el significado de `NULL` y exige mantenerla sincronizada); reemplazar siempre la antelación de todos (rechazada en clarify: pisa ajustes hechos a mano); aplicar solo a mantenimientos nuevos (rechazada en clarify: el cambio no se nota).

## P-4. Catálogo `service_types` y enlace opcional desde `order_services` (D-04)

**Decisión**: tabla `service_types` (`name` único, `interval_days` y `interval_km` ambos `NULL`ables con `CHECK` de que al menos uno sea mayor que 0, `active`, `created_by`, marcas de tiempo). `order_services` gana `service_type_id INT UNSIGNED NULL` con FK `RESTRICT`: las líneas anteriores quedan sin tipo y siguen válidas. **No existe borrado** (solo `active = 0`), por lo que un tipo usado nunca se pierde (CA-4, SC-004). La lectura de tipos activos para el selector (`/lookup`) está abierta a los tres roles; el alta y la edición son solo de ADMIN.

**Justificación**: `order_services.description` hoy es texto libre, así que sin un enlace no hay forma fiable de contar «servicios más frecuentes» ni de proponer intervalos (RN-12). Mantener la columna opcional respeta las órdenes existentes y los flujos del Sprint 2 sin cambiar su comportamiento: si el usuario no elige tipo, todo funciona como antes.

**Alternativas consideradas**: reemplazar `description` por el tipo (rechazada: rompe órdenes y pruebas existentes); inferir el tipo por coincidencia de texto (rechazada: frágil e impredecible).

## P-5. «Próximo servicio» derivado de los tipos de la orden y guardado en el ticket (CA-5, CA-14)

**Decisión**: una función pura `calcularProximoServicio({ tipos, fechaBase, kilometrajeBase })` toma, entre los tipos de servicio con intervalo de la orden, el **intervalo en días más corto** y el **intervalo en kilómetros más corto** y devuelve `{ date, mileage }` (cualquiera puede ser `null`). Se usa en dos puntos con la misma regla: (a) el ticket al emitirse, con la fecha de emisión y el kilometraje de entrada de la orden (`entry_mileage`); (b) `GET /api/maintenances/suggestion?vehicleId=` para precargar el formulario de mantenimiento a partir de la última orden terminada o entregada del vehículo que tenga tipos con intervalo (CA-5; el usuario puede corregir los valores).

**Aclaración respecto de la spec**: el CA-14 pide que el ticket muestre el próximo servicio «cuando la orden tiene un tipo de servicio con intervalo», sin exigir que antes se haya registrado un mantenimiento. Este plan sigue el CA-14 y ajusta el texto del FR-008 de la spec en consecuencia (ver «Ajustes a la especificación» en `plan.md`).

**Justificación**: depender de un mantenimiento ya registrado haría que el ticket casi nunca mostrara la línea (el mantenimiento es un registro único por vehículo y hoy se captura aparte). Derivarlo de la orden hace la línea predecible y verificable.

**Alternativas consideradas**: leer el registro `maintenance` del vehículo (rechazada: acopla el ticket a un paso manual y a un registro que se reemplaza); calcularlo en cada lectura del ticket (rechazada: el ticket emitido cambiaría si luego cambian los intervalos, contra CA-14).

## P-6. Ticket con instantánea de los datos del taller y del próximo servicio (D-03)

**Decisión**: `tickets` gana `workshop_name`, `workshop_address`, `workshop_phone`, `next_service_date` y `next_service_mileage`, escritas **una sola vez al emitir**. `armarTicket` lee esos valores en lugar de `config/taller.js`. La migración rellena los tickets existentes con lo que mostraban hasta hoy: `Motorix`, sin dirección y sin teléfono, y sin próximo servicio.

**Justificación**: el ticket guarda hoy solo `order_id`, `issued_by` y la fecha; su contenido se calcula en cada lectura (R-05). Para que un cambio de configuración no altere tickets emitidos (CA-1, SC-001) los datos del taller **deben persistirse** al emitir. Es una excepción acotada a R-05: se guarda un encabezado, no el desglose, que sigue calculándose con la misma fórmula que el cobro.

**Alternativas consideradas**: guardar un JSON del ticket completo (rechazada: duplica el desglose y rompe la garantía de que ticket y cobro no divergen); no guardar nada y aceptar que el ticket cambie (rechazada: contradice CA-1).

## P-7. Fecha de terminación `service_orders.finished_at` (D-19)

**Decisión**: columnas `finished_at DATETIME NULL` y `finished_at_estimated TINYINT(1) NOT NULL DEFAULT 0`. `cambiarEstado` escribe `finished_at` y deja `finished_at_estimated = 0` en el momento en que la orden pasa a `FINISHED` (y no se vuelven a tocar al pasar a `DELIVERED`). La migración rellena `finished_at` para las órdenes ya `FINISHED` o `DELIVERED` con su `updated_at` y pone `finished_at_estimated = 1`: sin esa marca no habría forma de distinguir una fecha aproximada de una real, y el reporte de productividad necesita contarlas para avisarlo (caso límite de la spec).

**Justificación**: la orden solo tiene `created_at` y `updated_at`, y este último cambia con cualquier edición; «órdenes terminadas en el periodo» (D-07) y la imputación de servicios y refacciones a un periodo necesitan una fecha estable. Una columna es lo más simple y no exige una tabla de historial (mismo razonamiento que P-3 del Sprint 6).

**Alternativas consideradas**: tabla `order_status_history` (rechazada: escribe en cada transición, toca los flujos del Sprint 2 y duplica historia); usar `updated_at` (rechazada: se mueve con cualquier edición y falsea los periodos).

## P-8. Costo congelado por línea: `order_parts.unit_cost` (D-05)

**Decisión**: `order_parts` gana `unit_cost DECIMAL(10,2) NULL`, la instantánea del precio de compra al agregar la línea. Al agregar una línea se guarda el `purchase_price` vigente de la refacción, o `NULL` si es 0. La migración rellena las líneas existentes con el `purchase_price` actual de la refacción cuando es mayor que 0 y deja `NULL` en el resto (las de precio 0 anteriores al Sprint 5). En los reportes, `NULL` significa «sin costo registrado»: la línea se excluye del margen y sus ventas se muestran aparte (clarify D-05).

**Justificación**: sin la instantánea, un cambio posterior del precio de compra reescribiría el margen de todas las órdenes ya cerradas, igual que habría pasado con el precio de venta antes del Sprint 5 (precedente: `014_order_parts_price.sql`). El respaldo es una sola columna y una columna más en el `INSERT` de `order_part.model.js`.

**Alternativas consideradas**: usar siempre `parts.purchase_price` actual (rechazada: cambia el pasado); costo promedio ponderado por entradas de inventario (rechazada: fuera de alcance y de la regla del sprint).

## P-9. Reportes calculados en cada consulta, con importes en centavos (RN-10, CA-7)

**Decisión**: `reports.service.js` arma cinco reportes con consultas de agregación sobre los datos existentes, sin tablas nuevas:

| Reporte | Fuente y fecha de imputación |
|---------|------------------------------|
| Ingresos | `payments` con `status = 'PAID'`, por `DATE(updated_at)`; un pago `PAID` es terminal (`PAID: []` en `payments.service.js`), así que su `updated_at` es el momento en que quedó pagado. Se agrupa por día y por método |
| Servicios frecuentes | `order_services` de órdenes con `finished_at` en el rango, agrupadas por tipo de servicio; las líneas sin tipo van a un renglón «Sin tipo de servicio» |
| Productividad | órdenes `FINISHED` o `DELIVERED` con `finished_at` en el rango, por `mechanic_id`: conteo e importe de mano de obra con la regla de `order-total.service.js` (`horas × tarifa`, redondeada a centavos) |
| Costo y margen de refacciones | `order_parts` de órdenes con `finished_at` en el rango: ventas = `quantity × unit_price`; costo = `quantity × unit_cost` solo en líneas con costo; margen = ventas con costo − costo |
| Rotación de inventario | `inventory_movements`: unidades `OUT` del periodo ÷ existencia promedio (D-08) |

**Cálculo en centavos**: los importes `DECIMAL(10,2)` se convierten a enteros en centavos antes de sumar y se devuelven como cadenas de 2 decimales, igual que tickets y pagos (`aCentavos` / `aCadena` de `order-total.service.js`). Una prueba compara cada reporte con la suma independiente de los registros de origen (SC-006).

**Rotación (D-08)**: la existencia al cierre del periodo es `stock_current − Σ movimientos posteriores al fin` y al inicio `existencia al cierre − Σ movimientos del periodo`, con el signo del movimiento (`IN` suma, `OUT` resta, `ADJUSTMENT` lleva signo; el `quantity` de `OUT` es positivo y el tipo da el signo, R-05 del Sprint 3). `rotación = unidades OUT / ((inicio + cierre) / 2)`; si la existencia promedio es 0 la rotación es `null` («sin existencia»).

**Periodo y huso horario (D-06)**: rango inclusivo `from`–`to` (`YYYY-MM-DD`), máximo 366 días, por omisión el mes en curso. Las fechas son `DATETIME` locales del servidor de MySQL, así que el corte diario sigue la hora local del taller sin conversión.

**Alternativas consideradas**: tablas de resumen precalculadas (rechazada: violan RN-10 y se desincronizan); calcular en el cliente (rechazada: RN-15, y el precio de compra no debe viajar).

## P-10. Exportación CSV en el mismo endpoint, sin dependencias (D-01)

**Decisión**: cada reporte acepta `?format=csv` y responde `text/csv; charset=utf-8` con `Content-Disposition: attachment`. El servicio produce **una sola estructura de filas** de la que salen tanto el JSON como el CSV, de modo que no pueden divergir (CA-9, SC-007). Reglas del CSV: BOM UTF-8 (para que Excel muestre acentos y eñes), separador coma, punto decimal, encabezados en español, comillas dobles escapadas y **neutralización de fórmulas** (una celda de texto que empieza con `=`, `+`, `-` o `@` se antepone con una comilla simple, para que un nombre de cliente o de refacción malicioso no ejecute una fórmula al abrir el archivo). Sin datos: solo encabezados.

**En el cliente** no se agrega ninguna dependencia: Flutter escribe el archivo con `dart:io` en la carpeta Documentos del usuario (`%USERPROFILE%\Documents\Motorix\reportes`) y muestra la ruta resultante.

**Alternativas consideradas**: `file_picker`/`file_selector` para elegir carpeta (rechazada: dependencia nueva que la constitución pide proponer antes; se puede añadir si el equipo lo pide); Excel con `exceljs` o PDF (rechazadas en clarify D-01).

## P-11. Términos y condiciones: versiones, aceptación y bloqueo en el backend (D-10, D-11, CA-19)

**Decisión**: tablas `terms_versions` (`version` entera única y creciente, `terms_text`, `privacy_text`, `published_by`, `published_at`) y `terms_acceptances` (`user_id`, `terms_version_id`, `accepted_at`, única por usuario y versión). La migración inserta la **versión 1** con una plantilla en español (uso permitido, confidencialidad de datos de clientes y vehículos, responsabilidad de las cuentas y aviso de privacidad, CA-18) para que el sistema nunca arranque sin términos. Se acepta **una sola vez por versión**; publicar una versión nueva (solo ADMIN, texto no vacío y distinto del vigente) obliga a aceptar de nuevo. Los usuarios existentes aceptan en su siguiente inicio de sesión (D-11), porque nadie tiene aceptaciones al migrar.

**Bloqueo en el backend**: `authenticate` verifica, tras cargar al usuario, que haya aceptado la versión vigente; si no, responde `403 TERMS_NOT_ACCEPTED`. Cuatro rutas usan la variante `authenticateSinTerminos` y quedan exentas: `GET /api/terms/current`, `POST /api/terms/accept`, `GET /api/auth/me` y `POST /api/auth/logout`. El `login` y `/auth/me` devuelven `termsAccepted` para que la pantalla muestre la aceptación antes de cargar nada más. **Rechazar** en el cliente cierra la sesión.

**Impacto en pruebas (riesgo principal)**: como ningún usuario de prueba habrá aceptado, todas las suites autenticadas recibirían 403. La creación de usuarios de prueba está centralizada en `tests/helpers/usuarios.js` (`crearUsuarioPrueba`), así que el helper registra la aceptación de la versión vigente; solo dos suites crean usuarios fuera del helper (`auth.contract.test.js` y `auth-lockout.test.js`) y ambas prueban el login, que está exento.

**Alternativas consideradas**: bloquear solo en el cliente (rechazada: CA-19 exige el backend); un middleware aparte en cada router (rechazada: hay 14 routers y se olvidaría uno; una variante del middleware común es más segura por defecto); aceptar en cada sesión (rechazada: fricción innecesaria, clarify D-10).

## P-12. Cierre por inactividad: reloj en el backend y temporizador en la interfaz (D-14, CA-23)

**Decisión**: `users` gana `last_activity_at DATETIME NULL`. `authenticate` rechaza con `401 SESSION_IDLE` cuando la última actividad tiene más de **30 minutos** (valor `idleMinutes` en `config/env.js`, igual para todos los roles) y, si no, la refresca como máximo una vez por minuto para no escribir en cada petición. `login` la fija al iniciar; un valor `NULL` (sesiones previas a la migración) se trata como activo. La expiración del token de 8 horas sigue validándose igual. En Flutter, un detector de actividad (puntero y teclado) en `main.dart` cierra la sesión local a los 30 minutos y avisa al usuario; el 401 del backend usa el manejo de sesión existente (`procesarErrorSesion`).

**Justificación**: un temporizador solo en pantalla se puede saltar usando la API con el token (CA-23 pide validación en el backend); el reloj del backend es la autoridad y el de la interfaz es cortesía.

**Alternativas consideradas**: acortar el JWT a 30 minutos con renovación (rechazada: cambia el flujo de sesión del Sprint 1 y exige un endpoint de renovación); tabla de sesiones (rechazada: más piezas que una columna).

## P-13. Bitácora `audit_log` de solo inserción (D-12, CA-20, CA-21)

**Decisión**: tabla `audit_log` (`id`, `user_id` nulo, `actor` texto con el usuario o el identificador intentado, `action`, `entity_type`, `entity_id`, `detail` ≤ 500 caracteres, `created_at`). Un único `audit.service.js` expone `registrar(...)`; el modelo solo tiene `insertar` y `listar`, y **no hay ruta ni función de edición o borrado** (una prueba recorre las rutas y confirma que ninguna escribe en la bitácora fuera de `registrar`). Acciones (catálogo cerrado): `LOGIN_FAILED`, `ACCOUNT_LOCKED`, `USER_CREATED`, `USER_UPDATED` (incluye cambio de rol y baja o reactivación, con `detail` indicando el campo), `SETTINGS_UPDATED`, `PART_PRICE_CHANGED`, `ORDER_PART_PRICE_CORRECTED`, `PAYMENT_CANCELLED` y `TERMS_PUBLISHED`. Se conservan **sin purga** en este sprint, y la consulta se **pagina** (50 por página, máximo 200) con filtros de fecha, usuario y acción; no se exporta.

**Sin datos reservados (CA-21)**: `detail` se construye solo con campos de una lista blanca por acción (por ejemplo, para precios, el valor anterior y el nuevo; para rol, el rol anterior y el nuevo) y el servicio descarta cualquier clave que parezca reservada (`password`, `hash`, `token`, `card`). El identificador de un inicio de sesión fallido se guarda recortado a 100 caracteres.

**Puntos de enlace** (cada uno es una llamada a `registrar` dentro de un servicio existente): `auth.service.login` (fallo y bloqueo), `users.service.create/update`, `settings.service.actualizar`, `inventory.service`/`parts` (cambio de `purchase_price` o `sale_price`), la corrección de precio de línea de `order_parts`, `payments.service` al cancelar y `terms.service.publicar`.

**Alternativas consideradas**: triggers de MySQL para auditar (rechazada, mismo criterio que el Sprint 6: lógica de negocio fuera de la capa de servicios); archivo de registro en disco (rechazada: no consultable por filtros); revocar `UPDATE/DELETE` al usuario de base de datos (rechazada para este sprint: cambia el entorno de instalación; queda como mejora).

## P-14. Política de contraseñas: conservar y limitar la longitud (D-13)

**Decisión**: se conserva la política vigente (8 o más caracteres con mayúscula, minúscula y número) y se agrega un **máximo de 64 caracteres** en `requisitoFaltantePassword`, que ya usan tanto `auth.service` (cambio) como `users.service` (alta), con el mismo `400 WEAK_PASSWORD` y el requisito faltante. El `loginSchema` acota la contraseña a 128 caracteres para no calcular hashes de cuerpos enormes. No se obliga a cambiar las contraseñas sembradas de demostración.

**Justificación**: `bcryptjs` solo usa los primeros 72 bytes, por lo que hoy dos contraseñas largas que difieren después abren la misma cuenta (hallazgo de la tabla de calidad del Sprint 1). Con 64 de máximo se evita sin romper ninguna contraseña razonable. Las cuentas que ya tengan una contraseña más larga siguen entrando; la política aplica al crear o cambiar.

## P-15. No exposición de datos y entradas (CA-24, CA-25)

**Decisión**: dos suites de pruebas nuevas, sin cambios de comportamiento esperados: una recorre los endpoints de usuarios, refacciones, órdenes, pagos y tickets con cada rol y verifica que ninguna respuesta contenga `password`, `passwordHash`, `password_hash` ni `token` (salvo el del login), y que `purchasePrice` y los costos solo lleguen a ADMIN; la otra envía intentos de inyección (`' OR 1=1 --`, `%`, `_`, comillas y punto y coma) a todos los campos de búsqueda y comprueba que la respuesta es normal y no devuelve filas de más. Verificado: todas las búsquedas (`clients`, `vehicles`, `appointments`, `service_orders`, `parts`, `users`) ya usan parámetros con `LIKE ?`.

**Cabeceras de seguridad (D-18)**: no se agrega `helmet` ni otras cabeceras; el insumo afirma que existen pero no están en `app.js` ni en `package.json`. Queda fuera por decisión documentada en la spec; si el equipo lo pide es una dependencia nueva que debe proponerse antes (constitución, sección de Tecnologías).

## P-16. Frontend: secciones de ADMIN al final del menú, puerta de términos y sin dependencias nuevas

**Decisión**: tres secciones nuevas solo para ADMIN, al final de `app_shell.dart` para no recorrer los índices existentes (patrón del Sprint 6): **Configuración** (índice 11: datos del taller, márgenes, catálogo de tipos de servicio y términos con sus aceptaciones), **Reportes** (12) y **Bitácora** (13). La aceptación de términos es una pantalla de pantalla completa en `_Raiz` de `main.dart`, que se muestra tras iniciar sesión mientras `termsAccepted` sea falso. El selector de tipo de servicio se agrega al formulario de servicios del detalle de la orden y la propuesta de próximo mantenimiento al formulario de mantenimiento. Todas las pantallas usan `states_view.dart` y los tokens existentes; sin dependencias nuevas (P-10).

**Alternativas consideradas**: un menú desplegable «Administración» (rechazada: cambia la navegación existente); pantallas separadas para tipos de servicio y términos (rechazada: la Configuración es el lugar natural y reduce secciones).

## P-17. Datos de ejemplo (CA-12)

**Decisión**: `server/scripts/seed.js` se amplía, idempotente por claves naturales: tipos de servicio (Cambio de aceite 180 días y 5,000 km; Afinación 365 días y 10,000 km; Revisión de frenos 180 días), enlace de algunos servicios de órdenes existentes a sus tipos, `finished_at` y `unit_cost` coherentes en las órdenes de ejemplo, pagos `PAID` repartidos entre el mes en curso y el anterior (sin tocar los existentes), una línea de refacción sin costo (caso D-05) y valores iniciales de configuración. **No** se pre-aceptan los términos para los usuarios de demostración: la primera sesión muestra la pantalla de aceptación, que es parte del flujo demostrable.

## P-18. Entrega en dos bloques

**Decisión**: el plan se organiza para entregar en este orden y que cada bloque cierre con la regresión completa en verde: **bloque A** (P1–P6 de la spec: configuración, márgenes, catálogo, ticket con próximo servicio, términos y seguridad) y **bloque B** (P7–P10: los cinco reportes y la exportación). La migración `016` es única y se aplica completa en el bloque A; el bloque B solo agrega código. Esto respeta la propuesta de sprints (si el tiempo no alcanza, los reportes son lo que se aplaza).
