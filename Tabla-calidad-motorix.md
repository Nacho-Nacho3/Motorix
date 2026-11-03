# Matriz de calidad — Motorix

| ID | Requisito | Criterio de aceptación | Prueba ejecutada | Resultado | Evidencia / defecto |
|---|---|---|---|---|---|
| RF-01 | Spec 001, FR-005: el usuario puede cambiar su propia contraseña; la nueva DEBE tener mínimo 8 caracteres con mayúscula, minúscula y número, y nunca guardarse en texto plano. | 400 `WEAK_PASSWORD` si no cumple la política; 201 y la nueva contraseña sirve para entrar si la cumple. | Backend: `tests/unit/auth-validation.test.js` y `tests/contract/users.contract.test.js` (solo prueban el mínimo). Verificación en vivo: usuario creado con contraseña de 74 caracteres y login con una contraseña que solo cambia en los últimos 2 caracteres. | **Fallido** | Defecto D-01: `server/validators/auth.js`, línea 4, no fija longitud máxima (`{8,}`); bcrypt solo usa los primeros 72 caracteres, así que dos contraseñas distintas abren la misma cuenta. Solución: limitar la política a 64 caracteres. |
| RF-02 | Spec 002, FR-001: recepción y administrador registran una cita con cliente, vehículo, fecha, hora y motivo; nace en estado Pendiente (apoya el FR-012 del spec 001: entradas validadas en servidor con mensajes claros). | Una cita con datos válidos se guarda (201); una fecha u hora imposibles se rechazan con 400 y un mensaje claro. | Backend: `tests/integration/appointments.test.js` (solo usa fechas válidas). Verificación en vivo: `POST /api/appointments` con fecha "2026-02-31" y, como control, con "2026-12-31". | **Fallido** | Defecto D-02: `server/validators/appointments.js`, líneas 7 a 15, solo revisa el patrón de la fecha y la hora; "2026-02-31" pasa el validador y revienta en MySQL con 500 INTERNAL_ERROR. Solución: validar la fecha real y el rango horario. |
| RF-03 | Spec 003, FR-007: el estado del mantenimiento es Próximo dentro de la antelación y Vencido al cumplirse el objetivo de fecha o de kilometraje (cualquiera de los dos). | Objetivo cumplido → Vencido; dentro de la antelación → Próximo; el resto → Normal. | Backend: `tests/unit/maintenance-state.test.js` (10 casos; ninguno con la fecha objetivo en el día exacto). Verificación en vivo: ejecución de la función con fecha objetivo = hoy y con kilometraje objetivo alcanzado. | **Fallido** | Defecto D-03: `server/utils/maintenance-state.js`, líneas 61 a 63, usa `daysRemaining < 0` para la fecha pero `mileageRemaining <= 0` para el kilometraje: el día objetivo queda como "Próximo", contradictorio con el FR-007. Solución: usar `daysRemaining <= 0` o aclarar la regla en el spec. |
| RF-04 | Spec 004, FR-005: el importe registrado corresponde al total de la orden; un único pago efectivo por orden, sin pagos parciales. | El cobro es exactamente el total; una vez pagada, el total no puede cambiar sin un nuevo cobro. | Backend: `tests/integration/order-work.test.js` (solo bloquea el trabajo en órdenes ENTREGADAS). Verificación en vivo: a una orden FINISHED pagada con 3195.00 se le agregó un servicio de $100 como ADMIN. | **Fallido** | Defecto D-04: `server/services/service_orders.service.js`, líneas 206 a 208 (`verificarTrabajador`), solo bloquea el trabajo en órdenes ENTREGADAS; la orden pagada aceptó el servicio extra: total 3195.00 → 3295.00 con `totalPaid` todavía en 3195.00. Solución: bloquear el trabajo cuando exista un pago PAID o exigir el cobro de la diferencia. |
| RF-05 | Spec 001, FR-002: el sistema rechaza las credenciales inválidas con un mensaje claro que no revele si falló el usuario o la contraseña. | Credenciales inválidas → 401 con mensaje genérico; el comportamiento de bloqueo tras varios intentos queda cubierto por pruebas. | Backend: `tests/integration/auth-lockout.test.js`, 5 casos (401 en los primeros fallos, 423 tras el quinto, sigue bloqueado con la contraseña correcta). Verificación en vivo repetida con el usuario `recepcion`. | **Aprobado con observación** | Observación O-01: el bloqueo es solo por cuenta (`server/services/auth.service.js`, líneas 26 a 42); cualquier persona que conozca el nombre de usuario puede dejar la cuenta inutilizable 15 minutos (DoS de cuenta), sin límite por IP ni desbloqueo administrativo. Solución: rate limiting por IP, backoff exponencial y desbloqueo desde el rol ADMIN. |

> **Para convertir a Word:** abre este archivo en VS Code, presiona `Ctrl+Shift+V` para ver el resultado renderizado, selecciona la tabla y cópiala; Word la pega como tabla real. El anexo va después de la tabla en el documento.

---

# Anexo de evidencias

Cada requisito tiene tres bloques: el texto del spec (Requisito), qué comprueba la prueba y su fragmento clave (Prueba), y el comando, las capturas y la conclusión de la ejecución (Resultado). Las pruebas de backend se ejecutaron el 2026-10-27 con `npm.cmd test` dentro de `server/`, y las verificaciones en vivo contra la base de pruebas `motorix_test` (los datos reales de `motorix` no se tocaron). Las capturas de pantalla están pendientes y se indican con el nombre sugerido en `docs/evidencias/`.

---

## RF-01 Requisito

Archivo: `specs/001-base-clientes-vehiculos/spec.md`, línea 215.

> **FR-005**: El sistema DEBE permitir al usuario autenticado cambiar su propia contraseña; la nueva DEBE tener 8 caracteres como mínimo y al menos una mayúscula, una minúscula y un número, y NUNCA guardarse en texto plano (RN-17).

## RF-01 Prueba

Archivo: `server/tests/unit/auth-validation.test.js`, líneas 42 a 88, y `server/tests/contract/users.contract.test.js`, líneas 254 a 268. La política está en `server/validators/auth.js`, línea 4.

Las pruebas automatizadas verifican el mínimo de la política (longitud, mayúscula, minúscula y número). Ninguna prueba envía una contraseña larga, así que se verificó en vivo contra la API: primero se creó un usuario con una contraseña de 74 caracteres (cumple la política) y luego se intentó iniciar sesión con otra contraseña que solo cambiaba en los últimos 2 caracteres.

| Caso | Qué comprueba | Resultado |
|---|---|---|
| Contraseña corta o sin mayúscula | Responde 400 `WEAK_PASSWORD` | Aprobado |
| Contraseña válida de 8 caracteres | Se guarda y sirve para entrar | Aprobado |
| Contraseña válida de 74 caracteres | Se acepta porque no hay máximo | Sin prueba automatizada |
| Contraseña que difiere solo en los últimos 2 caracteres | También inicia sesión (debería fallar) | Defecto demostrado |

Fragmento clave:

```js
// server/validators/auth.js, línea 4: el `{8,}` no tiene tope superior.
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
```

## RF-01 Resultado

Comando: `npm.cmd test -- tests/unit/auth-validation.test.js`

*[Captura de la terminal de PowerShell con la ejecución de la prueba]* (`docs/evidencias/captura-rf01-prueba-politica.png`)

*[Captura del código de `server/validators/auth.js` con la línea 4 resaltada]* (`docs/evidencias/captura-rf01-regex-sin-maximo.png`)

Pasaron las pruebas de la política (el mínimo está cubierto). La verificación en vivo demostró el defecto: el usuario se creó con 74 caracteres y el login aceptó una contraseña distinta que solo cambiaba después de la posición 72.

**Defecto D-01:** `server/validators/auth.js`, línea 4, no fija longitud máxima. `server/services/auth.service.js`, línea 31, compara con bcrypt, que por diseño solo usa los primeros 72 caracteres; el resto se descarta en silencio, así que dos contraseñas distintas abren la misma cuenta.

Solución propuesta: limitar la política a 64 caracteres (por ejemplo, agregando `.max(64)` al campo de contraseña del validador y ajustando el mensaje de `MENSAJE_POLITICA`).

Resultado: **Fallido** (el comportamiento contradice la intención de la política de seguridad).

---

## RF-02 Requisito

Archivo: `specs/002-citas-ordenes-servicio/spec.md`, línea 152.

> **FR-001**: El sistema DEBE permitir a los roles de recepción y administrador registrar una cita con cliente, vehículo, fecha, hora y motivo (observaciones opcionales); la cita nace en estado Pendiente.

## RF-02 Prueba

Archivo: `server/tests/integration/appointments.test.js`, líneas 63 a 150. El validador está en `server/validators/appointments.js`, líneas 7 a 15.

Las pruebas automatizadas cubren citas válidas, datos vacíos y referencias inexistentes, pero todas usan fechas bien formadas. Se verificó en vivo qué pasa con una fecha imposible: `POST /api/appointments` con `date = "2026-02-31"` y, como control, con `date = "2026-12-31"` (mismo cliente y vehículo).

| Caso | Qué comprueba | Resultado |
|---|---|---|
| Cita con cliente y vehículo válidos | Responde 201 en estado PENDING | Aprobado |
| Datos vacíos o referencias inexistentes | Responde 400 / 404 sin crear la cita | Aprobado |
| Fecha imposible "2026-02-31" | Debería responder 400; responde 500 | Defecto |
| Fecha válida "2026-12-31" (control) | Responde 201 | Aprobado |

Fragmento clave:

```js
// server/validators/appointments.js, líneas 7 a 10: solo revisa el patrón,
// no si la fecha existe en el calendario.
export const fecha = z
  .string({ required_error: "La fecha es obligatoria." })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato YYYY-MM-DD.");
```

## RF-02 Resultado

Comando: `npm.cmd test -- tests/integration/appointments.test.js`

*[Captura de la terminal con la ejecución de las pruebas de citas]* (`docs/evidencias/captura-rf02-prueba-citas.png`)

*[Captura del código de `server/validators/appointments.js` con las líneas 7 a 15 resaltadas]* (`docs/evidencias/captura-rf01-validador-fecha-hora.png`)

Pasaron las pruebas existentes (todas con fechas válidas). La verificación en vivo demostró el defecto: la fecha imposible respondió `500 INTERNAL_ERROR` y la fecha de control respondió 201.

**Defecto D-02:** `server/validators/appointments.js`, líneas 7 a 15, valida el formato de la fecha y la hora pero no su contenido; "2026-02-31" (y una hora como "99:99") pasan el validador y llegan hasta MySQL, que responde con error 500 en lugar de un 400 claro para la persona usuaria. Esto contradice el FR-012 del spec 001 (entradas validadas en servidor con mensajes claros).

Solución propuesta: validar que la fecha sea real (por ejemplo, con `z.coerce.date()`) y que la hora esté entre 00:00 y 23:59.

Resultado: **Fallido** (una entrada inválida provoca error interno en lugar de un rechazo claro).

---

## RF-03 Requisito

Archivo: `specs/003-historial-mantenimiento-inventario/spec.md`, línea 188.

> **FR-007**: El sistema DEBE determinar el estado de un mantenimiento según la antelación guardada en el propio mantenimiento (días y/o kilómetros, con valor por defecto cuando no se captura): dentro de la antelación → Próximo; objetivo de fecha o kilometraje cumplido → Vencido; el resto → Normal. Si el mantenimiento define fecha y kilometraje a la vez, se considera Vencido al cumplirse cualquiera de los dos (RN-11, RN-12, Clarificaciones).

## RF-03 Prueba

Archivo: `server/tests/unit/maintenance-state.test.js`, líneas 46 a 81. La lógica está en `server/utils/maintenance-state.js`, líneas 61 a 63.

Las 10 pruebas unitarias cubren Normal, Próximo por días y por kilometraje, y Vencido cuando la fecha ya pasó o el kilometraje se alcanzó. Ninguna prueba pone la fecha objetivo en el día exacto. Se ejecutó la función pura con dos escenarios: (A) fecha objetivo = hoy y (B) kilometraje actual = kilometraje objetivo.

| Caso | Qué comprueba | Resultado |
|---|---|---|
| Fecha objetivo ya pasada (5 días) | Responde OVERDUE | Aprobado |
| Kilometraje objetivo alcanzado (0 km restantes) | Responde OVERDUE | Aprobado |
| Fecha objetivo = hoy (0 días restantes) | Debería ser Vencido; responde UPCOMING | Defecto |
| Antelación propia del registro (warnDays/warnKm) | Se respeta la antelación configurada | Aprobado |

Fragmento clave:

```js
// server/utils/maintenance-state.js, líneas 61 a 63: la fecha exige que ya
// haya pasado (< 0), mientras el kilometraje basta con que se alcance (<= 0).
const vencido =
  (daysRemaining != null && daysRemaining < 0) ||
  (mileageRemaining != null && mileageRemaining <= 0);
```

## RF-03 Resultado

Comando: `npm.cmd test -- tests/unit/maintenance-state.test.js`

*[Captura de la terminal con la ejecución de las pruebas unitarias]* (`docs/evidencias/captura-rf03-prueba-estado.png`)

*[Captura del código de `server/utils/maintenance-state.js` con las líneas 61 a 63 resaltadas]* (`docs/evidencias/captura-rf03-comparacion-vencido.png`)

Las pruebas pasaron (cubren los casos que existen). La verificación en vivo demostró la inconsistencia: con la fecha de hoy como objetivo, el estado fue UPCOMING (Próximo); con el kilometraje objetivo alcanzado, el estado fue OVERDUE (Vencido).

**Defecto D-03:** `server/utils/maintenance-state.js`, líneas 61 a 63, trata distinto los dos criterios del mismo requisito: el kilometraje cuenta como vencido al alcanzarse (`<= 0`), pero la fecha solo cuando ya pasó (`< 0`). El día exacto del objetivo queda como "Próximo", y el FR-007 dice que el objetivo cumplido es "Vencido".

Solución propuesta: usar `daysRemaining <= 0`, o bien precisar en el spec que la fecha vence al día siguiente y aceptar el comportamiento actual.

Resultado: **Fallido** (el código contradice el FR-007 en el borde del día objetivo).

---

## RF-04 Requisito

Archivo: `specs/004-pagos-tickets-dashboard/spec.md`, línea 132.

> **FR-005**: El importe registrado DEBE corresponder al total de la orden; se admite un único pago efectivo por orden y NO se admiten pagos parciales (decidido en clarify, Q1).

## RF-04 Prueba

Archivo: `server/tests/integration/order-work.test.js`, líneas 108 a 248. La regla está en `server/services/service_orders.service.js`, líneas 198 a 210.

Las pruebas automatizadas cubren el trabajo del mecánico, los permisos por rol y el bloqueo de las órdenes ENTREGADAS. Ninguna prueba cubre una orden ya pagada. Se verificó en vivo contra la API: a una orden FINISHED con un pago PAID de 3195.00 se le agregó un servicio de $100 con el rol ADMIN y se volvieron a consultar el total y los pagos de la orden.

| Caso | Qué comprueba | Resultado |
|---|---|---|
| Mecánico agrega servicios y mano de obra (201) | Funciona en órdenes activas | Aprobado |
| Orden ENTREGADA | Solo ADMIN; el resto recibe 400 ORDER_DELIVERED | Aprobado |
| Orden TERMINADA ya pagada | Debería impedir el cambio; acepta el servicio extra | Defecto |
| Cobro del total antes de editar | El total antes de editar era 3195.00 = totalPaid | Aprobado |

Fragmento clave:

```js
// server/services/service_orders.service.js, líneas 206 a 208: el único
// bloqueo de estado es la orden ENTREGADA; una orden pagada en TERMINADO
// sigue abierta para recibir más trabajo.
if (orden.status === "DELIVERED" && usuario.role !== "ADMIN") {
  throw errores.orderDelivered();
}
```

## RF-04 Resultado

Comando: `npm.cmd test -- tests/integration/order-work.test.js`

*[Captura de la terminal con la ejecución de las pruebas de trabajo de la orden]* (`docs/evidencias/captura-rf04-prueba-trabajo.png`)

*[Captura del código de `server/services/service_orders.service.js` con las líneas 198 a 210 resaltadas]* (`docs/evidencias/captura-rf04-guarda-entregada.png`)

*[Captura (opcional) de la app: pantalla de detalle de la orden con el total nuevo y el cobro viejo]* (`docs/evidencias/captura-rf04-orden-pagada-editada.png`)

Las pruebas pasaron (cubren el bloqueo de ENTREGADAS). La verificación en vivo demostró el defecto: el servicio extra se agregó con 201, el total pasó de 3195.00 a 3295.00 y el `totalPaid` siguió en 3195.00.

**Defecto D-04:** `server/services/service_orders.service.js`, líneas 206 a 208 (`verificarTrabajador`), solo bloquea el trabajo en órdenes ENTREGADAS; una orden TERMINADA ya pagada admite más servicios y mano de obra, así que el total deja de corresponder al importe cobrado y el ticket (FR-009) mostraría un total mayor al que pagó la persona cliente.

Solución propuesta: bloquear el trabajo de la orden cuando exista un pago en estado PAID, o bien exigir un cobro adicional por la diferencia antes de permitir el cambio.

Resultado: **Fallido** (el total puede cambiar después del cobro, contra la intención del FR-005).

---

## RF-05 Requisito

Archivo: `specs/001-base-clientes-vehiculos/spec.md`, línea 208.

> **FR-002**: El sistema DEBE rechazar credenciales inválidas con un mensaje claro que no revele si falló el usuario o la contraseña.

## RF-05 Prueba

Archivo: `server/tests/integration/auth-lockout.test.js`, líneas 48 a 123. La regla está en `server/services/auth.service.js`, líneas 26 a 42.

El bloqueo tras varios intentos fallidos está bien cubierto por pruebas. Se repitió el caso en vivo con el usuario `recepcion`: cinco contraseñas incorrectas seguidas y, después, un intento con la contraseña correcta.

| Caso | Qué comprueba | Resultado |
|---|---|---|
| Primeros 4 fallos | 401 con mensaje genérico y contador acumulado | Aprobado |
| Quinto fallo | 423 ACCOUNT_LOCKED | Aprobado |
| Sexto intento con la contraseña correcta | Sigue respondiendo 423 (la cuenta quedó bloqueada) | Aprobado (ver O-01) |
| Tras expirar el bloqueo | El login correcto funciona y reinicia el contador | Aprobado |

Fragmento clave:

```js
// server/services/auth.service.js, líneas 31 a 42: el contador y el bloqueo
// son por cuenta; no distingue quién está intentando entrar.
const coincide = await bcrypt.compare(password, usuario.passwordHash);
if (!coincide) {
  const intentos = usuario.failedLoginAttempts + 1;
  const bloqueo = await usuarios.registrarFalloLogin(
    usuario.id, intentos, env.maxLoginAttempts, env.lockoutMinutes,
  );
  if (bloqueo) throw errores.locked(env.lockoutMinutes);
  throw errores.invalidCredentials();
}
```

## RF-05 Resultado

Comando: `npm.cmd test -- tests/integration/auth-lockout.test.js`

*[Captura de la terminal con la ejecución de las pruebas de bloqueo]* (`docs/evidencias/captura-rf05-prueba-bloqueo.png`)

*[Captura (opcional) de la app: pantalla de login con el mensaje de cuenta bloqueada]* (`docs/evidencias/captura-rf05-login-bloqueado.png`)

Pasaron las 5 pruebas del archivo. La verificación en vivo confirmó el comportamiento: cinco fallos → 423, y con la contraseña correcta la cuenta siguió bloqueada.

**Observación O-01:** el requisito se cumple (mensaje genérico y bloqueo cubierto), pero el bloqueo es solo por cuenta (`server/services/auth.service.js`, líneas 26 a 42): una persona que conozca el nombre de usuario puede bloquear la cuenta 15 minutos a propósito, y la aplicación no ofrece un desbloqueo administrativo ni limita los intentos por computadora.

Solución propuesta: agregar rate limiting por IP, esperas crecientes (backoff exponencial) y un endpoint de desbloqueo reservado al rol ADMIN.

Resultado: **Aprobado con observación** (5 de 5 casos; el comportamiento cumple el FR-002 pero presenta el riesgo O-01).

---

# Guía de capturas de pantalla

| Captura | Qué debe mostrar | Dónde pegarla en el documento | De dónde sacarla |
|---|---|---|---|
| C-01 | La política de contraseña sin límite máximo | Anexo, sección *RF-01 Resultado* (o celda "Evidencia / defecto" de la fila RF-01) | VS Code: `server\validators\auth.js`, línea 4; resalta el `{8,}` de la regex |
| C-02 | Las pruebas de la política pasando | Anexo, sección *RF-01 Resultado* | PowerShell en `server\`: `npm.cmd test -- tests/unit/auth-validation.test.js` |
| C-03 | El validador de fecha y hora que solo revisa el formato | Anexo, sección *RF-02 Resultado* | VS Code: `server\validators\appointments.js`, líneas 7 a 15 |
| C-04 | Las pruebas de citas pasando | Anexo, sección *RF-02 Resultado* | PowerShell en `server\`: `npm.cmd test -- tests/integration/appointments.test.js` |
| C-05 | La comparación desigual de fecha y kilometraje | Anexo, sección *RF-03 Resultado* | VS Code: `server\utils\maintenance-state.js`, líneas 61 a 63 |
| C-06 | Las pruebas del estado del mantenimiento pasando | Anexo, sección *RF-03 Resultado* | PowerShell en `server\`: `npm.cmd test -- tests/unit/maintenance-state.test.js` |
| C-07 | La guarda que solo bloquea órdenes ENTREGADAS | Anexo, sección *RF-04 Resultado* | VS Code: `server\services\service_orders.service.js`, líneas 198 a 210 |
| C-08 | Una orden pagada con el total modificado (opcional) | Anexo, sección *RF-04 Resultado* | App: pantalla de detalle de la orden (`client\lib\screens\orders\order_detail_screen.dart`); pasos abajo |
| C-09 | Las pruebas del bloqueo de cuenta pasando | Anexo, sección *RF-05 Resultado* | PowerShell en `server\`: `npm.cmd test -- tests/integration/auth-lockout.test.js` |
| C-10 | El login de la app mostrando "cuenta bloqueada" (opcional) | Anexo, sección *RF-05 Resultado* | App: pantalla de login (`client\lib\screens\login\login_screen.dart`); pasos abajo |

Consejos para las capturas: usa VS Code con tema oscuro y tamaño de letra legible, recorta la imagen al panel del código y deja visible el nombre del archivo. Nombra cada archivo con el nombre sugerido en la sección correspondiente y guárdalos en `docs/evidencias/`.

## Pasos para las capturas de la app (C-08 y C-10)

1. Abre MySQL (servicio `MySQL96`) y arranca el backend: PowerShell en `server\` con `npm.cmd start`.
2. Abre la app: `client\build\windows\x64\runner\Debug\motorix_client.exe`.

**C-10 (login bloqueado):** entra con cualquier cuenta y cierra sesión; después escribe el usuario `recepcion` con una contraseña incorrecta cinco veces. Al quinto intento aparece el aviso de cuenta bloqueada: haz la captura. Advertencia: esa cuenta queda bloqueada 15 minutos; usa una cuenta de prueba o haz esta captura al final.

**C-08 (orden pagada editada):** con el rol recepción, cobra el total de una orden TERMINADA; después, con el rol mecánico, agrega un servicio más a esa misma orden; vuelve a abrir el detalle: el total ya es mayor que el cobro. Advertencia: este caso modifica una orden de la base `motorix`; hazlo sobre una orden de prueba o al final de la entrega.

---

*Reporte individual · Gestión de Proyectos de Software · Análisis de calidad del MVP Motorix · Pruebas y verificaciones: 2026-10-27.*
