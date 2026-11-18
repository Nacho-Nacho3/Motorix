# Quickstart — Validación del Sprint 6

**Fecha**: 2026-11-05 | **Rama**: `006-notificaciones-internas`

Guía de puesta en marcha y validación de extremo a extremo de las notificaciones internas: campana con contador por rol → panel agrupado → marcar leído (sin afectar a otros usuarios) → lista de clientes por avisar → registro de aviso idempotente. Los contratos viven en [contracts/](contracts/) y las tablas en [data-model.md](data-model.md); este archivo no duplica ese detalle.

## Requisitos previos

- Windows con PowerShell (los scripts del entorno son `.ps1`).
- MySQL 8 o superior instalado de forma **local** (nativo, no Docker).
- Node.js LTS.
- Flutter 3.47 con soporte de escritorio.
- Entorno de los Sprints 1–5 ya creado (usuario dedicado `motorix_app`, `.env` completo, esquema 001–014 aplicado, seeds de los sprints anteriores).
- **Enmienda de la constitución aprobada** para los sprints 6–7 (criterio de entrada, puerta I del [plan.md](plan.md)).

## Puesta en marcha

```powershell
# 1. Esquema del Sprint 6: migración nueva 015 (aditiva, idempotente, registro en schema_migrations)
database/scripts/aplicar-migraciones.ps1

# 2. Seeds ampliados: ≥1 caso por tipo de aviso y cita de mañana para la lista (idempotentes)
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
npm.cmd test                  # o: npx jest tests/unit/notification-rules.test.js

# Frontend
cd client
flutter test                  # o un archivo: flutter test test/notifications_test.dart
```

**Resultado esperado**: todo en verde, incluida la prueba de rendimiento de `GET /api/notifications` (< 1000 ms con datos sembrados).

## Escenarios de validación (extremo a extremo)

| # | Escenario | Acción | Resultado esperado |
|---|-----------|--------|--------------------|
| V1 | Campana por rol (CA-4) | Entrar como ADMIN, después como RECEPTIONIST y como MECHANIC | Cada rol ve la campana; el grupo de Stock solo aparece con datos para ADMIN; el MECHANIC solo ve «Órdenes detenidas» de sus órdenes (D-08) |
| V2 | Contador sin polling (D-03) | Entrar y dejar la ventana abierta sin tocar nada | El contador **no** cambia solo; se actualiza al abrir el panel o navegar de sección |
| V3 | Aviso por tipo (CA-3, CA-12) | Con ADMIN, abrir el panel | Hay al menos un ítem de cada tipo disponible para su rol: mantenimiento (próximo o vencido), cita de hoy, stock bajo/agotado y orden detenida > 2 días (D-01) |
| V4 | Coincidencia con módulos (CA-5) | Comparar panel ↔ pantalla de inicio ↔ Inventario | Mismos números: el stock del panel es la misma lista de Inventario y los mantenimientos coinciden con la pantalla de inicio |
| V5 | Lectura individual (D-04) | Marcar leído un aviso; navegar y volver; entrar con otro usuario | El ítem sigue visible pero como leído; el contador baja; **el otro usuario no se ve afectado** |
| V6 | Reaparición por empeoramiento (CA-6, D-04) | Que un mantenimiento pase de UPCOMING a OVERDUE o el stock de LOW a OUT | Clave nueva → el aviso vuelve a contar como no leído; si el hecho desaparece (orden entregada, stock normal), el aviso no se muestra |
| V7 | Lista por avisar (CA-10) | Entrar como MECHANIC y buscar «Clientes por avisar» | 403 en la API y la entrada no está en el menú; con ADMIN o recepción, la lista muestra teléfono, motivo y contexto |
| V8 | Registro idempotente (CA-11) | Marcar «Ya lo hablé» en una fila; repetir en la API | Primera vez 201; la fila sale de la lista; repetir el mismo `(cliente, tipo, fuente)` devuelve 200 sin duplicar |
| V9 | Una vez por hecho (CA-11/D-07) | Que un cliente tenga dos motivos (p. ej. orden lista y cita mañana) | Puede avisar cada motivo por separado; avisar uno no elimina al otro de la lista |
| V10 | Rendimiento (CA-13) | Prueba automatizada + abrir el panel con datos sembrados | Respuesta < 1000 ms (prueba) y panel visible en < 2 s (SC-006) |

## Recorrido manual sugerido

1. Aplicar la migración 015 y correr los seeds hasta informar 0 duplicados (V3).
2. Con ADMIN: abrir la campana (V1, V3), cruzar números con inicio e Inventario (V4), marcar un aviso (V5) y verificar la reaparición al empeorar el hecho (V6).
3. Con MECHANIC: confirmar que su campana solo trae sus órdenes detenidas y que la lista por avisar no existe (V1, V7).
4. Con recepción: abrir «Clientes por avisar», registrar un aviso con nota, repetir el registro y confirmar 200 sin duplicado (V8, V9).
5. Correr `npm.cmd test` y `flutter test` completos (resultado esperado en verde).

## Solución de problemas

- **La campana no aparece**: verificar el token/rol (401/403) y que `app_shell.dart` reciba el `unreadCount` del proveedor (D-03: se carga en login/navegación).
- **Falta un caso de aviso en V3**: revisar que el seed del tipo correspondiente haya informado «0 duplicados» (CA-12); la orden detenida usa `updated_at` retrotraído 3 días (P-3).
- **La migración no registra**: basta con reejecutar `aplicar-migraciones.ps1` (idempotente por `IF NOT EXISTS` + `schema_migrations`).
