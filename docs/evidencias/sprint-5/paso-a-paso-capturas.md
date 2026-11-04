# Paso a paso — capturas C-04, C-05 y C-12 (Sprint 5)

Estas tres son las únicas capturas PNG que faltan en el proyecto: la guía de `docs/aseguramiento-calidad-sprint-5.md` las asigna a Ignacio Joaquín Trejo porque se toman en la app con datos de demostración. Todo lo demás quedó como transcripción markdown (patrón del proyecto).

**Orden recomendado: C-12 → C-04 → C-05.** Los datos de demo se gastan (una orden cobrada no se cobra otra vez y no hay botón de reset): en ese orden cada captura aprovecha lo que dejó la anterior y no hace falta recrear la base. Si el flujo sale mal y necesitás empezar de cero, avisame y recreo la base `motorix` con migraciones y seed.

Los PNG van en esta misma carpeta (`docs/evidencias/sprint-5/`), en minúsculas y con guiones. Para capturar la pantalla usá `Win + Shift + S` (recorte) o `PrtScr`.

## 0. Preparación (una sola vez)

1. **MySQL**: levantar el servicio `MySQL96` si está detenido (`Get-Service MySQL96 | Start-Service` desde PowerShell como administrador, o desde `services.msc`).
2. **Datos de ejemplo**: desde `server/`, ejecutar `npm.cmd run seed`. Es idempotente y usa la base `motorix` del `.env`; entre sus líneas debe aparecer `Escenarios de precios (T045): línea en orden abierta creada, pago PENDING desfasado creado` (si ya existen, informa «ya existente u no disponible»).
3. **Backend**: desde `server/`, `npm.cmd start` y dejá la terminal abierta mientras dure la sesión.
4. **App**: la carpeta `client/build` todavía no existe, así que hay que compilar primero, desde `client/`:
   - `flutter build windows` → el ejecutable queda en `client\build\windows\x64\runner\Release\motorix_client.exe`;
   - o `flutter run -d windows` para correr en modo depuración (genera el `.exe` en la carpeta `Debug`).
5. **Cronómetro**: abrí la app **Reloj** de Windows y dejá la pestaña **Cronómetro** en 00:00, al lado de la ventana de Motorix.
6. **Usuarios** (usuario / contraseña): `admin` / `Admin2026!`, `recepcion` / `Recepcion2026!`, `mecanico` / `Mecanico2026!`.

## Las órdenes de ejemplo (cómo reconocerlas)

| Orden | Cómo se reconoce | Estado tras el seed |
|---|---|---|
| Placas **GHI9012**, «Vibración al frenar a alta velocidad» | Ya tiene pago y **ticket anterior** | Terminado, pagado, con ticket |
| Placas **ABC1234**, «Mantenimiento de 100,000 km y revisión general» | Terminado **sin cobrar**, con un pago pendiente de Mercado Pago desfasado | Terminado, sin ticket |
| Placas **ABC1234**, «Ruido al frenar al detener el vehículo» | **Diagnóstico** con la línea `BAL-001` a `850.00` | Abierta (es la que se usa en C-04 y C-12) |
| Placas **DEF5678**, «Falla eléctrica intermitente» | En reparación, sin líneas | Abierta (no se usa) |

## C-12 — cronómetro del SC-008 (flujo demostrable de extremo a extremo)

Archivo: `captura-tiempos-sc-008-flujo-demostrable.png` (y, opcional, `captura-tiempos-sc-008-inicio.png`).

El criterio SC-008 del `spec.md` es: «refacción con precios → uso en orden → total → pago → ticket → cambio de precio sin efectos retroactivos». Cronometrá ese flujo completo en la app:

1. **Inicio del cronómetro (pantalla de inicio)**: en la app Reloj, arrancá el Cronómetro en 00:00 con el login de Motorix visible al lado. Captura opcional: `captura-tiempos-sc-008-inicio.png`.
2. **Refacción con precios**: entrá con `admin` → sección **Inventario** → buscá `BAL-001` → abrilo y confirmá que el **Precio de venta** es `850.00`.
3. **Uso en orden**: cerrá sesión y entrá con `mecanico` → **Órdenes** → abrí la orden en **Diagnóstico** con el problema «Ruido al frenar al detener el vehículo» → en la sección **Refacciones** elegí una refacción del desplegable (el selector muestra el precio), **Cantidad** `1` → botón **Agregar** → aparece la línea con su precio.
4. **Total**: verificá en el resumen de la orden que el total incluye la refacción y sale con 2 decimales.
5. **Avance a Terminado**: en «Siguiente estado» elegí **En reparación** → botón **Cambiar estado** → confirmá; repetí hasta llegar a **Terminado** (el cambio de estado lo hace el mecánico o el admin; recepción no mueve estados).
6. **Pago**: cerrá sesión y entrá con `recepcion` → **Órdenes** → la misma orden → botón **Registrar pago** → pago en efectivo por el importe total → confirmá. El chip de pago queda en `PAID`.
7. **Ticket**: en la misma orden, botón **Generar / Ver ticket** → se abre el ticket con las refacciones, sus cantidades, precios e importe.
8. **Cambio de precio sin efectos retroactivos**: cerrá sesión y entrá con `admin` → **Inventario** → `BAL-001` → cambiá el **Precio de venta** a `950.00` → Guardar → volvé a **Órdenes** → abrí la misma orden → en **Refacciones** la línea sigue mostrando `850.00`.
9. **Fin del cronómetro**: detenelo con la app en el detalle de la orden del paso 8 y el cronómetro visible con el tiempo final → captura `captura-tiempos-sc-008-flujo-demostrable.png`.

Nota: el pago pendiente desfasado de Mercado Pago no afecta a esta orden (está en la otra orden Terminado). Si en el paso 6 apareciera un error de pago, revisá que el importe coincida con el total que muestra la orden.

## C-04 — RF-01: la línea conserva su precio (SC-001)

Archivo: `captura-rf-01-instantanea-precio.png`

Después del C-12 el estado ya es el correcto: el catálogo de `BAL-001` está en `950.00` y la línea de la orden sigue en `850.00`. Solo falta capturarlo junto:

1. Entrá con `admin` → **Inventario** → `BAL-001` con **Precio de venta** `950.00` (si querés demostrar el cambio en vivo, cambialo a otro valor distinto de `850.00` justo antes de capturar).
2. Abrí una **segunda instancia** de la app (ejecutá dos veces el `.exe`) y entrá con `admin` en ambas: en una quedá en **Inventario**, en la otra andá a **Órdenes** → orden «Ruido al frenar al detener el vehículo» (su línea `BAL-001` sigue en `850.00`).
3. Dejá las dos ventanas **lado a lado** y capturá: catálogo con el precio nuevo + línea con el precio viejo → `captura-rf-01-instantanea-precio.png`.
4. Si no podés abrir dos instancias, hacé dos capturas: `captura-rf-01-instantanea-precio-catalogo.png` (Inventario) y `captura-rf-01-instantanea-precio-linea.png` (detalle de la orden), y avisame para que actualice la guía con los dos nombres.

## C-05 — RF-02: ticket anterior y ticket nuevo (SC-002)

Archivo: `captura-rf-02-ticket-anterior-y-nuevo.png`

La app no tiene un listado de tickets: cada uno se abre desde su orden con el botón **Generar / Ver ticket**. Por eso la captura muestra los dos tickets uno al lado del otro:

1. Entrá con `recepcion` → **Órdenes**.
2. **Ticket anterior**: abrí la orden de placas **GHI9012** («Vibración al frenar a alta velocidad») → **Generar / Ver ticket** → es el ticket que ya existía, con sus importes originales.
3. **Ticket nuevo**: abrí la orden de placas **ABC1234** con el problema «Ruido al frenar al detener el vehículo» (la que cobraste y de la que generaste el ticket en el paso 7 del C-12) → **Generar / Ver ticket**.
4. Dejá las dos ventanas lado a lado (anterior a la izquierda, nuevo a la derecha) → `captura-rf-02-ticket-anterior-y-nuevo.png`.

Alternativa si no hiciste el C-12: en la orden de placas **ABC1234** con «Mantenimiento de 100,000 km y revisión general» (Terminado, sin cobrar) usá primero **Registrar pago**; eso deja listo el ticket nuevo.

## Guardado y verificación

1. Guardá los PNG en `docs/evidencias/sprint-5/` con los nombres exactos de arriba.
2. Abrí cada uno y confirmá que se ve lo que dice el paso (no sirve una captura borrosa o de otra pantalla).
3. Compará los hash para detectar imágenes idénticas con nombres distintos: `Get-FileHash docs\evidencias\sprint-5\*.png`.
4. Avisame y actualizo la guía de capturas de `docs/aseguramiento-calidad-sprint-5.md` con los enlaces finales y marco C-04, C-05 y C-12 como tomadas.
