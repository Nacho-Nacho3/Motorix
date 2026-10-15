# Resultados del quickstart — Sprint 1

**Fecha**: 2026-10-14 | **Rama**: `001-base-clientes-vehiculos`
**Guía**: [quickstart.md](quickstart.md) | **Script reutilizable**: [validate-quickstart.mjs](validate-quickstart.mjs)

Cómo se ejecutó: backend con `npm start` en `http://localhost:3000` y
`node validate-quickstart.mjs` (Node 25, fetch nativo). V1–V7 se comprobaron
contra la base `motorix` real; V8 con las pruebas de Flutter; V9 con los
scripts de `database/scripts/`; V10 en la revisión de diseño (T070).

## Resumen

| Escenario | Resultado | Comprobaciones |
|-----------|-----------|----------------|
| V1 Login por usuario y correo | SUPERADO | 3/3 |
| V2 Bloqueo por intentos fallidos | SUPERADO | 3/3 |
| V3 Registro y consulta de clientes | SUPERADO | 5/5 |
| V4 Vehículo con propietario | SUPERADO | 4/4 |
| V5 Edición de clientes | SUPERADO | 5/5 |
| V6 Permisos por rol | SUPERADO | 6/6 |
| V7 Usuarios y política de contraseñas | SUPERADO | 12/12 |
| V8 Navegación | SUPERADO (pruebas automatizadas) | — |
| V9 Instalación repetible | SUPERADO (ejecutado) | — |
| V10 Interfaz Material 3 | SUPERADO (T070) | — |

**Total V1–V7 en vivo: 39 comprobaciones, 39 superadas, 0 fallidas.**

## V1. Login por usuario y por correo (SC-002, RN-16)

- `POST /auth/login` con `admin` → 201 con token y usuario.
- `POST /auth/login` con `admin@motorix.local` → 201 (mismo resultado).
- Contraseña incorrecta → 401 `INVALID_CREDENTIALS` con el mensaje genérico
  "Usuario o contraseña incorrectos." (no revela si falló el usuario).

## V2. Bloqueo por intentos fallidos (R-03)

- Cuenta temporal `bloqueotmp` creada por ADMIN → 201.
- Cinco logins fallidos y luego un intento correcto → 423 `ACCOUNT_LOCKED`.
- El mensaje indica "Intenta de nuevo en 15 minutos."
- Tras la validación, `failed_login_attempts` de `admin` quedó en 0 (los
  logins correctos reinician el contador).

## V3. Registro y consulta de clientes (HU2, SC-001)

- Login de `recepcion` → 201.
- Registrar "Laura Ramírez" → 201 con `data.client` (fecha de registro presente
  en la lista).
- Mismo teléfono sin confirmar → 409 `DUPLICATE_PHONE` con aviso "Confirma…".
- Mismo teléfono con `confirmDuplicatePhone: true` → 201 (el duplicado queda
  registrado solo si se confirma).

## V4. Vehículo con propietario (HU3, RN-1, SC-005)

- Vehículo sin `clientId` → 400 `CLIENT_REQUIRED` (nunca
  `VALIDATION_ERROR`).
- Con propietario → 201 con `clientName` resuelto ("Laura Ramírez").
- Mismas placas → 409 `DUPLICATE_PLATE`.
- El vehículo aparece en la ficha del cliente (`GET /clients/{id}` →
  `vehicles` con 1 elemento).
- Verificación SQL posterior: `COUNT(*) FROM vehicles WHERE client_id IS NULL`
  = **0** (SC-005).

## V5. Edición de clientes (HU4)

- `PATCH /clients/{id}` con teléfono nuevo → 200 y el valor visible al reabrir
  la ficha.
- Los vehículos siguen asociados tras editar (1 antes, 1 después).
- `name: ""` → 400 `VALIDATION_ERROR` con `details[0].field = "name"` y sin
  tocar la base (el nombre se conserva).

## V6. Permisos por rol (FR-003, FR-014, SC-003)

- `MECHANIC`: consulta clientes → 200; crear cliente → 403 `FORBIDDEN`;
  crear vehículo → 403.
- `RECEPTIONIST` en `/api/users` → 403 `FORBIDDEN`.
- `ADMIN` en `/api/users` → 200.
- La sección "Usuarios" del sidebar solo se ve y se navega para ADMIN, lo
  cubren `app_shell_test.dart` y `users_test.dart` (Q1-A, FR-019).

## V7. Gestión de usuarios y política de contraseñas (HU5, SC-006)

- Crear usuaria `ana` `RECEPTIONIST` → 201.
- `ana` inicia sesión con usuario y con correo → 201 en ambos casos.
- Username repetido → 409 `DUPLICATE_USERNAME`; correo repetido → 409
  `DUPLICATE_EMAIL`.
- Cambio de contraseña sin número → 400 `WEAK_PASSWORD` con
  `details[0].field = "newPassword"` y el requisito faltante.
- Cambio válido (`Nueva2026!`) → 200 con `data.message = "PASSWORD_UPDATED"`;
  el siguiente login usa la nueva y la anterior deja de servir → 401.
- `PATCH active:false` → 200 con `active=false`; el login posterior → 403
  `ACCOUNT_DISABLED` (y el token vigente también, verificado en la suite).

## V8. Navegación (FR-016, FR-017, FR-018)

- Validado con pruebas automatizadas de Flutter: `app_shell_test.dart`
  (sidebar colapsable, secciones, Usuarios solo para ADMIN),
  `login_screen_test.dart`, `clients_test.dart`, `vehicles_test.dart`,
  `client_edit_test.dart` y `users_test.dart` (29 pruebas).
- El recorrido manual en menos de 5 minutos (SC-001) se apoya en que todas las
  pantallas arrancan desde el sidebar y cada acción de negocio tiene su
  prueba de extremo a extremo en la interfaz.

## V9. Instalación repetible (SC-004, CA-6/CA-8)

Ejecutado el 2026-10-14 sobre la base principal, borrada antes:

1. `DROP DATABASE motorix` → `database/scripts/crear-entorno.ps1` → bases
   `motorix` y `motorix_test` + usuario dedicado `motorix_app` (nunca root).
2. `database/scripts/aplicar-migraciones.ps1` → 3 migraciones aplicadas
   (`001`, `002`, `003`) y registradas en `schema_migrations`.
3. `npm run seed` (1ª vez) → 3 usuarios, 3 clientes y 3 vehículos creados.
4. `npm run seed` (2ª vez) → 0 creados, todos "ya existentes" (idempotente).
5. `npm run create-admin` → ninguna cuenta nueva.

La base nunca queda vacía tras la instalación (SC-004) y `.env` no está
versionado (`.gitignore` lo excluye).

## V10. Interfaz Material 3 (FR-018, R-08)

Revisión completa registrada en [design-review.md](design-review.md)
(checklist de la sección 11 de `docs/design-system.md`): tokens sin valores
sueltos, estados en español, confirmaciones obligatorias de 8.5 con
"Confirmar"/"Cancelar" y transiciones de 150/200/250 ms. 8/9 criterios
cumplidos y verificados con pruebas; la verificación visual en escritorio y
ventana angosta queda para el equipo.

## Limpieza tras la validación

Los datos de prueba creados por V2–V5 se eliminaron; `ana` se conserva
**desactivada** como ejemplo real del estado inactivo. Estado final:

- `clients` = 3 (seed) · `vehicles` = 3 (seed) · `users` = 4 (seed + `ana`).
- 0 vehículos sin propietario.
