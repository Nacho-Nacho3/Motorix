# Verificación por API de V1 a V13 (Sprint 7)

Fecha: 2026-11-25. Servidor real en `http://localhost:3100` con la base `motorix_test` (aislada de la base principal), sembrada con `npm run seed`. Cuentas del seed: `admin`, `recepcion` y `mecanico`. Al terminar se vació la base de pruebas.

Resultado: **50 de 50 comprobaciones aprobadas.**

| Escenario | Comprobación | Resultado | Evidencia |
|---|---|---|---|
| V5 | Login devuelve termsAccepted=false antes de aceptar | Aprobado | termsAccepted: false |
| V5 | Una ruta cualquiera responde 403 TERMS_NOT_ACCEPTED sin aceptar | Aprobado | 403 TERMS_NOT_ACCEPTED |
| V5 | Las rutas exentas (terms/current y auth/me) funcionan sin aceptar | Aprobado | 200,200 |
| V5 | Tras aceptar se recupera el acceso y no se vuelve a pedir | Aprobado | 200 |
| V5 | auth/me devuelve termsAccepted=true tras aceptar | Aprobado |  |
| V1 | PATCH /settings guarda nombre y teléfono | Aprobado | 200 |
| V1 | El ticket nuevo usa los datos nuevos | Aprobado | {"name":"Taller Verificado","address":"Av. Principal 123, Centro","phone":"5598765432"} |
| V1 | El ticket anterior conserva los datos con los que se emitió | Aprobado | antes «Taller Motorix», después «Taller Motorix» |
| V1 | Recepción recibe 403 en /settings | Aprobado | 403 |
| V2 | Los mantenimientos sin antelación propia usan el valor del taller | Aprobado | 2 sin antelación propia con 90 días |
| V2 | El mantenimiento con antelación propia la conserva | Aprobado | 1 con antelación propia |
| V2 | Lista, dashboard y centro de avisos coinciden | Aprobado | próximos 1, vencidos 2, avisos 3 |
| V2 | Un margen fuera de rango da 400 | Aprobado |  |
| V2 | Restablecido a 30 días y 500 km | Aprobado |  |
| V3 | Alta de «Cambio de aceite» con 180 días y 5,000 km | Aprobado | 201 |
| V3 | Un nombre repetido da 409 | Aprobado | 409 |
| V3 | Sin intervalo da 400 | Aprobado |  |
| V4 | La propuesta devuelve fecha y kilometraje desde la orden | Aprobado | {"nextDueDate":"2027-05-24","nextDueMileage":205000,"basedOnOrderId":13500,"serviceTypes":["Cambio de aceite (V3)"]} |
| V4 | El ticket muestra «Próximo servicio» (nextService) | Aprobado | {"date":"2027-05-24","mileage":205000} |
| V4 | Recepción no puede pedir la propuesta (403) | Aprobado |  |
| V3 | Desactivado el tipo ya no está en el selector, pero la orden conserva su nombre | Aprobado |  |
| V3 | No existe ruta de borrado | Aprobado |  |
| V5 | ADMIN publica una versión nueva (2) | Aprobado |  |
| V5 | Con la versión nueva se vuelve a bloquear | Aprobado |  |
| V5 | Aceptar una versión que no es la vigente da 400 | Aprobado |  |
| V5 | Tras aceptar la versión 2 se recupera el acceso | Aprobado |  |
| V5 | La lista de aceptaciones y pendientes cuadra | Aprobado | total 3 |
| V5 | Recepción no puede publicar versiones (403) | Aprobado |  |
| V7 | Cada contraseña inválida se rechaza con WEAK_PASSWORD y el requisito | Aprobado | 8 caracteres: 400; mayúscula: 400; minúscula: 400; número: 400; 64 caracteres: 400 |
| V7 | Una contraseña válida de 64 caracteres se acepta | Aprobado |  |
| V7 | El login rechaza una contraseña de más de 128 caracteres (400) | Aprobado |  |
| V6 | Aparecen LOGIN_FAILED, PART_PRICE_CHANGED, USER_CREATED, USER_UPDATED, SETTINGS_UPDATED y TERMS_PUBLISHED | Aprobado | USER_UPDATED, PART_PRICE_CHANGED, LOGIN_FAILED, USER_CREATED, TERMS_PUBLISHED, SETTINGS_UPDATED |
| V6 | Ningún registro contiene contraseñas, hashes ni tokens | Aprobado |  |
| V6 | El filtro por acción funciona | Aprobado |  |
| V6 | No existe forma de crear, editar ni borrar registros | Aprobado | 404,404,404,404 |
| V8 | Pasados 30 minutos sin actividad la API responde 401 SESSION_IDLE | Aprobado | 401 SESSION_IDLE |
| V8 | Un login nuevo permite volver a trabajar | Aprobado |  |
| V9 | Ingresos coincide al centavo con la suma de pagos PAID | Aprobado | 16036.50 (10 pagos) |
| V9 | Servicios coincide con las líneas de origen | Aprobado | 3 líneas, $1900.00 |
| V9 | Productividad: mano de obra coincide con order_labor | Aprobado | $1575.00, 4 órdenes |
| V9 | Margen: ventas y costo coinciden con order_parts | Aprobado | ventas $8360.00, costo $4160.00, margen $3480.00 |
| V9 | Las líneas sin costo se muestran aparte | Aprobado | 4 unidades sin costo ($720.00) |
| V9 | Rotación devuelve filas con existencia promedio | Aprobado | 6 refacciones |
| V10 | Los cinco CSV traen BOM, cabeceras y las mismas filas que el JSON | Aprobado | income: 12 líneas; services: 4 líneas; productivity: 2 líneas; parts-margin: 6 líneas; inventory-rotation: 7 líneas |
| V11 | RECEPTIONIST y MECHANIC reciben 403 en configuración, catálogo (escritura), reportes y bitácora | Aprobado | 20 llamadas, todas 403: true |
| V12 | Ninguna respuesta expone hash, token ni precios reservados al rol | Aprobado |  |
| V12 | Las entradas de inyección dan 200 sin errores y las tablas siguen intactas | Aprobado | clientes: 3 |
| V13 | Cada reporte con un rango de un año responde en menos de 3 s | Aprobado | income 1 ms; services 3 ms; productivity 2 ms; parts-margin 1 ms; inventory-rotation 2 ms |
| V13 | Un rango de más de 366 días se rechaza con mensaje claro | Aprobado | [{"field":"to","message":"El periodo no puede pasar de 366 días."}] |
| Limpieza | La base motorix_test queda limpia | Aprobado | usuarios restantes: 0 |

No se comprobaron por API (requieren interfaz): la pantalla de aceptación, la campana y los selectores; eso es el recorrido manual (T131).
