# Quickstart — Validación del Sprint 7

**Fecha**: 2026-11-24 | **Rama**: `007-reportes-configuracion`

Guía de puesta en marcha y validación de extremo a extremo de reportes, configuración, términos y seguridad: configuración del taller → ticket con instantánea → catálogo de tipos de servicio → próximo servicio → términos → bitácora, contraseñas e inactividad → reportes → exportación. Los contratos viven en [contracts/](contracts/) y las tablas en [data-model.md](data-model.md); este archivo no duplica ese detalle.

## Requisitos previos

- Windows con PowerShell (los scripts del entorno son `.ps1`).
- MySQL 8 o superior instalado de forma **local** (nativo, no Docker).
- Node.js LTS.
- Flutter 3.47 con soporte de escritorio.
- Entorno de los Sprints 1–6 ya creado (usuario dedicado `motorix_app`, `.env` completo, esquema 001–015 aplicado, seeds anteriores).
- La constitución 1.2.0 (que ya cubre este sprint) vigente.

## Puesta en marcha

```powershell
# 1. Esquema del Sprint 7: migración 016 (aditiva, registrada en schema_migrations)
database/scripts/aplicar-migraciones.ps1

# 2. Seeds ampliados: tipos de servicio, órdenes con fecha de terminación, costos y pagos del periodo
cd server
node scripts/seed.js          # segunda corrida: debe informar 0 registros nuevos

# 3. Backend
npm.cmd start                 # http://localhost:3000 (o el puerto del .env)

# 4. Frontend
cd ../client
flutter run -d windows
```

## Pruebas automatizadas

```powershell
# Backend (unit + integración + contrato contra motorix_test)
cd server
npm.cmd test                  # o: npx jest tests/integration/reports.test.js
npm.cmd run lint

# Frontend
cd client
flutter test
flutter analyze
```

**Resultado esperado**: todo en verde y sin regresiones frente a la línea base del cierre del Sprint 6 (56 suites y 479 pruebas de backend; 145 pruebas de Flutter). Incluye las suites de no exposición de datos e inyección (CA-24, CA-25).

## Escenarios de validación (extremo a extremo)

| # | Escenario | Acción | Resultado esperado |
|---|-----------|--------|--------------------|
| V1 | Datos del taller y ticket (CA-1) | ADMIN cambia nombre y teléfono en Configuración; genera el ticket de una orden terminada nueva; abre un ticket anterior | El ticket nuevo muestra los datos nuevos; el anterior conserva `Motorix` sin dirección ni teléfono |
| V2 | Márgenes de «Próximo» (CA-2, CA-3, D-16) | ADMIN cambia los días y kilómetros; compara Mantenimientos, Inicio y el centro de avisos; captura una antelación propia en un mantenimiento | Los tres coinciden; el mantenimiento con antelación propia la conserva; sin valor guardado rige 30 días y 500 km |
| V3 | Catálogo (CA-4) | ADMIN crea «Cambio de aceite» (180 días y 5,000 km), lo edita y lo desactiva; intenta repetir el nombre | Se crea y edita; desactivarlo no toca las órdenes que lo usan; el nombre repetido da 409 |
| V4 | Próximo servicio (CA-5, CA-14) | Con un servicio de ese tipo en una orden, abrir el formulario de mantenimiento del vehículo y emitir el ticket; repetir con una orden sin tipo | Se propone fecha y kilometraje (corregibles); el ticket muestra «Próximo servicio»; la orden sin tipo no lo muestra |
| V5 | Términos (CA-16, CA-17, CA-19) | Iniciar sesión con un usuario que no ha aceptado; llamar a la API sin aceptar; aceptar; ADMIN publica una versión nueva | Se ve la pantalla de aceptación; la API responde 403 `TERMS_NOT_ACCEPTED` salvo las rutas exentas; tras aceptar no se vuelve a pedir; con la versión nueva se pide de nuevo; rechazar cierra la sesión |
| V6 | Bitácora (CA-20, CA-21) | ADMIN cambia un precio, un rol y la configuración, cancela un pago y falla un inicio de sesión; abre la bitácora y filtra | Cada acción aparece con usuario y fecha; ningún registro contiene contraseñas, hashes ni tokens; no hay forma de editar ni borrar |
| V7 | Contraseñas (CA-22) | Crear o cambiar una contraseña corta, sin mayúscula, sin número y de 70 caracteres | Cada caso se rechaza con el requisito faltante; una válida se acepta |
| V8 | Inactividad (CA-23) | Dejar la sesión sin actividad 30 minutos (o ajustar la hora de última actividad en `motorix_test`); luego usar la API con el mismo token | La interfaz cierra la sesión y avisa; la API responde 401 `SESSION_IDLE` |
| V9 | Reportes (CA-6, CA-7, CA-8) | ADMIN elige el mes en Reportes y recorre ingresos, servicios, productividad, margen y rotación | Los importes coinciden al centavo con los pagos, órdenes y líneas de origen; las líneas sin costo se marcan y se muestran aparte |
| V10 | Exportación (CA-9) | Exportar cada reporte y abrirlo en una hoja de cálculo; comparar con la pantalla | Mismas filas y totales; acentos y eñes correctos; sin datos solo hay encabezados |
| V11 | Permisos (CA-10) | Con RECEPTIONIST y MECHANIC llamar a configuración, catálogo (escritura), reportes y bitácora | 403 `FORBIDDEN`; el menú de ADMIN (Configuración, Reportes, Bitácora) no aparece |
| V12 | No exposición e inyección (CA-24, CA-25) | Prueba automatizada y revisión de respuestas | Ninguna respuesta trae hash, token ni precios reservados al rol; los intentos de inyección en las búsquedas no alteran la consulta |
| V13 | Rendimiento (CA-11) | Abrir cada reporte con los datos sembrados y con un rango de un año | Respuesta en menos de 3 segundos; un rango mayor de 366 días se rechaza con mensaje claro |

## Recorrido manual sugerido

1. Aplicar la migración 016 y correr los seeds hasta informar 0 duplicados.
2. Iniciar sesión como `admin`: aceptar los términos (V5), cambiar el nombre del taller (V1), ajustar los márgenes (V2) y crear un tipo de servicio (V3).
3. Con un servicio de ese tipo, registrar el próximo mantenimiento y emitir el ticket (V4).
4. Abrir Reportes, recorrer los cinco y exportar uno (V9, V10); abrir la Bitácora (V6).
5. Con `recepcion` y `mecanico`: aceptar los términos, confirmar el 403 de las rutas de ADMIN y que no ven las secciones (V11).
6. Probar contraseñas inválidas (V7) y la inactividad (V8).
7. Correr `npm.cmd test` y `flutter test` completos (resultado esperado en verde).

## Solución de problemas

- **Todas las rutas responden 403 `TERMS_NOT_ACCEPTED`**: el usuario no ha aceptado la versión vigente; aceptar en la pantalla o con `POST /api/terms/accept`. En pruebas automáticas, usar el helper de `tests/helpers/usuarios.js`, que registra la aceptación.
- **Un reporte sale vacío**: revisar que haya órdenes con `finished_at` dentro del rango y pagos `PAID`; correr de nuevo el seed (informa 0 duplicados si ya estaba).
- **Un mantenimiento no cambia con los márgenes nuevos**: tiene una antelación capturada a mano (`warnDaysCustom` o `warnKmCustom` verdadero); dejarla vacía para usar el valor del taller.
- **La migración no registra**: basta con reejecutar `aplicar-migraciones.ps1` (usa `schema_migrations`).
- **El CSV muestra caracteres raros en Excel**: abrirlo con «Datos > Desde texto/CSV» y codificación UTF-8; el archivo ya incluye BOM.
