# Quickstart — Validación del Sprint 1

**Fecha**: 2026-10-13 | **Rama**: `001-base-clientes-vehiculos`

Guía de puesta en marcha y validación de extremo a extremo. Los detalles de contrato
viven en [contracts/](contracts/) y las tablas en [data-model.md](data-model.md).

## Requisitos previos

- Windows con PowerShell (los scripts del entorno son `.ps1`).
- MySQL 8 instalado de forma **local** (nativo, no Docker).
- Node.js LTS.
- Flutter 3.47 con soporte de escritorio.
- Acceso de administrador de la máquina solo para crear el usuario de MySQL dedicado.

## Puesta en marcha

```powershell
# 1. Entorno de base de datos: crea el usuario dedicado motorix_app (nunca root)
database/scripts/crear-entorno.ps1

# 2. Esquema inicial (migraciones numeradas e idempotentes, registro en schema_migrations)
database/scripts/aplicar-migraciones.ps1

# 3. Variables de entorno (sin secretos versionados)
copy .env.example .env       # completar DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

# 4. Backend
cd server
npm install
npm run dev                  # debe escuchar el puerto definido en .env

# 5. Seeds (cuentas iniciales + datos de ejemplo; debe ser idempotente)
npm run seed                 # script de seeds del backend (ver package.json)

# 6. Frontend (escritorio Windows)
cd ../client
flutter pub get
flutter run -d windows
```

**Resultado esperado**: la aplicación arranca y la pantalla de login ofrece entrar con
usuario o correo. Con los seeds aplicados, la base **no** está vacía (SC-004).

## Comandos de prueba

```powershell
cd server
npm test                     # Jest: unit + integración + contrato (contra motorix_test)

cd ../client
flutter test                 # providers y widgets
```

> Las pruebas de integración NUNCA corren contra la base principal; solo contra
> `motorix_test` (Principio VII).

## Escenarios de validación

### V1. Login por usuario y por correo (SC-002, FR-001, RN-16)

1. Con `admin` / contraseña del estándar → 201 y token; entra a Inicio.
2. Repetir usando el **correo** del usuario en lugar del usuario → mismo resultado.
3. Contraseña incorrecta → 401 con mensaje genérico (no revela si falló el usuario).
4. **Resultado**: ambos logins funcionan y el inválido no da información sensible.

### V2. Bloqueo por intentos fallidos (R-03)

1. 5 logins fallidos consecutivos con la misma cuenta.
2. Sexto intento (incluso correcto) → 423 `ACCOUNT_LOCKED` con minutos restantes.
3. **Resultado**: la cuenta queda bloqueada 15 minutos; el contador se reinicia tras
   un login correcto.

### V3. Registro y consulta de clientes (HU2, SC-001)

1. Entrar como `recepcion` → Clientes → registrar "Juan Pérez" con teléfono y correo.
2. Guardar → aparece en la lista con fecha de registro.
3. Registrar otro cliente con el **mismo teléfono** → aviso de duplicado y petición de
   confirmación; confirmar → se guarda (409 `DUPLICATE_PHONE` sin confirmar).
4. **Resultado**: el cliente queda persistido y consultable tras reiniciar el backend.

### V4. Registro de vehículo con propietario (HU3, RN-1, FR-010, FR-020)

1. Vehículos → Nuevo vehículo **sin** seleccionar propietario → guardado rechazado
   (`CLIENT_REQUIRED`).
2. Seleccionar a Juan Pérez, capturar marca, modelo, año, placas y kilometraje → 201.
3. Intentar crear otro vehículo con **las mismas placas** → 409 `DUPLICATE_PLATE`.
4. Abrir la ficha de Juan Pérez → el vehículo aparece en su lista (FR-011).
5. **Resultado**: ningún vehículo queda sin propietario (SC-005).

### V5. Edición de clientes (HU4)

1. Editar el teléfono de Juan Pérez → guardar → 200.
2. Reabrir la ficha → el valor nuevo persiste y **siguen** asociados sus vehículos.
3. Dejar un campo obligatorio vacío → 400 con el campo señalado; no se guarda nada.

### V6. Permisos por rol (FR-003, FR-014, SC-003)

1. Entrar como `mecanico` → puede **consultar** clientes y vehículos; los botones de
   guardar no aparecen y el POST directo a la API responde 403.
2. Entrar como `recepcion` → la sección Usuarios **no** está en el sidebar; GET
   `/api/users` responde 403.
3. Entrar como `admin` → gestiona usuarios (crear, editar rol, desactivar).
4. **Resultado**: toda acción no autorizada se deniega en el backend, no solo en la UI.

### V7. Gestión de usuarios y política de contraseñas (HU5, FR-005, SC-006)

1. Como ADMIN crear usuario "ana" con rol RECEPTIONIST → 201; `ana` inicia sesión con
   su usuario **y** con su correo.
2. Intentar crear otro usuario con el mismo username o correo → 409.
3. Como `ana`, cambiar contraseña a una sin número → 400 `WEAK_PASSWORD`; con
   "Nueva2026!" → 200 y el siguiente login usa la nueva.
4. Desactivar `ana` → su login responde 403.
5. **Resultado**: 100% de políticas cumplidas (SC-006).

### V8. Navegación del Sprint 1 (Q1, FR-019)

1. Sidebar con Inicio, Clientes, Vehículos y Usuarios (esta última solo para ADMIN).
2. Tras el login se llega a Inicio y el flujo demostrable es navegable desde ahí.
3. **Resultado**: el flujo completo (login → cliente → vehículo → asociar → consultar)
   se completa en menos de 5 minutos (SC-001).

### V9. Instalación repetible (SC-004, CA-6, CA-8)

1. Borrar la base, re-ejecutar `aplicar-migraciones.ps1` y los seeds → todo aplica
   sin errores y sin duplicar registros.
2. Revisar que `.env` no está versionado y que `.env.example` no contiene secretos.
3. **Resultado**: la base se recrea desde cero y no hay secretos en el repositorio.

### V10. Interfaz según el sistema de diseño (FR-018, CA-12)

1. Verificar tokens de color, tipografía y espaciado según `docs/design-system.md`
   (sin valores sueltos).
2. Cerrar sesión y salir de un formulario con cambios → piden confirmación.
3. Estados vacío / cargando / error / éxito visibles en español y sin trazas.
4. **Resultado**: pantallas conformes antes de dar la historia por terminada.
