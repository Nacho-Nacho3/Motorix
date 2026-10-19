<!--
Insumo de especificacion para /speckit.specify.
Sprint 1 del MVP de Motorix: base del sistema, autenticacion, usuarios, clientes y vehiculos.
-->

# Insumo de especificacion - Sprint 1: Base del sistema, clientes y vehiculos

> Referencias obligatorias para el agente:
> - Contexto maestro: `docs/project-context.md`
> - Constitucion: `docs/reglas.md` y `.specify/memory/constitution.md`
> - Este documento describe unicamente el alcance del Sprint 1.

## 1. Contexto del sprint

Es el primer sprint del MVP. Establece la estructura del repositorio, la conexion con MySQL local, la autenticacion con JWT, la autorizacion por roles y los primeros modulos funcionales: clientes y vehiculos. Sin este sprint, los sprints 2, 3 y 4 no pueden construirse.

## 2. Objetivo

Permitir que un usuario autorizado inicie sesion, gestione clientes y registre vehiculos asociados a un propietario, con datos persistidos en MySQL local.

## 3. Historias de usuario del sprint

- **US1** - Como usuario del taller (administrador, recepcionista o mecanico), quiero iniciar sesion con mi usuario o correo 
    electronico y contrasena para acceder a las funciones segun mi rol.
- **US2** - Como administrador, quiero gestionar usuarios y roles de acceso para controlar quien puede usar el sistema.
- **US3** - Como recepcionista, quiero registrar y consultar clientes para mantener actualizada la informacion de los propietarios.
- **US4** - Como recepcionista, quiero editar la informacion de los clientes para corregir o actualizar sus datos.
- **US5** - Como recepcionista, quiero registrar vehiculos para llevar el control de los automoviles atendidos.
- **US6** - Como recepcionista, quiero asociar un vehiculo con su propietario para vincular la informacion correctamente.

## 4. Flujo demostrable al cierre del sprint

    Iniciar sesion
    -> registrar cliente
    -> registrar vehiculo
    -> asociarlo con el cliente
    -> consultar la informacion

## 5. Entidades y tablas que toca este sprint

| Entidad / tabla | Accion en este sprint |
|-----------------|-----------------------|
| `users`         | crear tabla (con `username` unico y `email` unico), registrar, consultar, autenticar por usuario o correo |
| `clients`       | crear tabla, registrar, consultar, editar |
| `vehicles`      | crear tabla, registrar, consultar, asociar a cliente |

## 6. Reglas de negocio aplicables

- RN-1: No crear un vehiculo sin propietario.
- RN-5: Solo usuarios autorizados pueden modificar registros.
- RN-15: Los permisos deben validarse en backend; ocultar botones en frontend no es seguridad suficiente.
- RN-16: El login acepta usuario o correo electronico en el mismo campo.
- RN-17: Las contrasenas del estandar del MVP solo aplican a las cuentas iniciales y en entornos locales; al cambiarlas, 
    deben cumplir la politica minima de seguridad.

## 7. Criterios de aceptacion

> Verificación de los criterios: marcados el 2026-10-18 tras reejecutar las suites automatizadas (backend 390/390 en verde, Flutter 120/120 en verde). Cuando la evidencia corresponde al registro del 14 de octubre o a una inspección estática, se indica explícitamente. Detalle de las ejecuciones en `docs/evidencias/`.

- [X] CA-1: El login devuelve un token JWT valido y funciona con contrasenas hasheadas con bcrypt. *(Ejecución 18 oct: suite backend verde — `server/tests/contract/auth.contract.test.js` «devuelve 201 con token, expiresIn y usuario sin datos sensibles» (estructura JWT de 3 partes) y «401 INVALID_CREDENTIALS»; login en vivo `admin` → 201, registrado en `docs/evidencias/2026-10-18-login-cuentas-iniciales.md`.)*
- [X] CA-2: Los roles ADMIN, RECEPTIONIST y MECHANIC se validan en el backend en cada endpoint protegido. *(Ejecución 18 oct: suite backend verde — `server/tests/integration/clients.test.js` y `vehicles.test.js` «MECHANIC puede leer pero no escribir (403 en POST y PATCH)», «sin token la lista responde 401», y `server/tests/contract/mechanic-scope.contract.test.js` (403 en orden ajena); las pruebas de rol se repiten por módulo del MVP.)*
- [X] CA-3: Registrar cliente, registrar vehiculo y asociarlo funciona de extremo a extremo contra MySQL local. *(Ejecución 18 oct: suite backend contra `motorix_test` (MySQL real) verde — `clients.test.js` «RECEPTIONIST registra y consulta clientes (201/200)» y `vehicles.test.js` «RECEPTIONIST registra vehículos (201)», con `client_id NOT NULL`.)*
- [X] CA-4: Consultar cliente devuelve sus datos y los vehiculos asociados. *(Ejecución 18 oct: suite backend verde — `vehicles.test.js` «GET /api/clients/:id lista los vehículos del cliente» y «el listado de clientes cuenta los vehículos (vehicleCount)».)*
- [X] CA-5: La estructura del backend usa ES Modules (`import`/`export`) y el `package.json` declara `"type": "module"`. *(Inspección estática 18 oct — NO es una prueba automatizada: `server/package.json` declara `"type": "module"` y el código del backend usa `import/export`; la suite ESM de 390 pruebas ejecutada ese día confirma que todo el sistema carga bajo ES Modules.)*
- [X] CA-6: El esquema inicial de la base de datos esta en `database/migrations/` y se puede recrear desde cero. *(Ejecución 18 oct: las 13 migraciones `001`–`013` se volvieron a aplicar sobre `motorix_test` durante la suite verde, con verificación de checksum y registro en `schema_migrations` (`server/tests/helpers/db.js`); scripts `database/scripts/aplicar-migraciones.ps1` y `crear-entorno.ps1`. Evidencia registrada 14 oct: quickstart V9 «Instalación repetible — ejecutado».)*
- [X] CA-7: Existe `.env.example` con las variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` sin valores sensibles. *(Inspección estática 18 oct — NO es una prueba automatizada: `.env.example` contiene las cinco variables con placeholders `cambiar_en_local` y sin secretos reales.)*
- [X] CA-8: No hay secretos reales identificados en el repositorio y .env está contemplado en .gitignore. *(Inspección estática del 18 de octubre; no es una prueba automatizada: se revisó que .env está ignorado por Git y se buscaron posibles tokens APP_USR- en el repositorio, sin encontrar secretos reales en los resultados revisados; solo se encontraron menciones documentales.)*
- [X] CA-9: El login acepta usuario o correo electronico en el mismo campo, para todos los roles. *(Ejecución 18 oct: suite backend verde — `auth.contract.test.js` «acepta el correo como identificador»; logins en vivo `admin` y `admin@motorix.local` → 201, en `docs/evidencias/2026-10-18-login-cuentas-iniciales.md`.)*
- [X] CA-10: Las cuentas iniciales del MVP (`admin`, `recepcion`, `mecanico`) existen con sus contrasenas del estandar,
    hasheadas con bcrypt en la base. *(Ejecución 18 oct: los tres logins en vivo → 201, en `docs/evidencias/2026-10-18-login-cuentas-iniciales.md`; las crea y hashea `server/scripts/seed.js`.)*
- [X] CA-11: El sistema permite cambiar la contrasena y valida la politica minima (8 caracteres, mayuscula, minuscula y numero). *(Ejecución 18 oct: suite backend verde — `server/tests/unit/auth-validation.test.js` (acepta contraseña de 8 caracteres con mayúscula, minúscula y número; rechaza sin mayúscula), `server/tests/contract/users.contract.test.js` «400 WEAK_PASSWORD fuera de la política mínima» y `auth.contract.test.js` «actualiza la contraseña y la nueva sirve para iniciar sesión».)*
- [X] CA-12: Toda pantalla del frontend sigue `docs/design-system.md` (paleta, tipografia, tokens, transiciones suaves y
    confirmaciones obligatorias). *(Evidencia REGISTRADA el 14 oct: `specs/001-base-clientes-vehiculos/design-review.md` (revisión de diseño T070) y quickstart V10 «Interfaz Material 3 — SUPERADO (T070)». El 18 oct solo se reejecutó la suite de widget de Flutter: 120/120 en verde; esto NO constituye una nueva revisión visual.)*

## 8. Fuera de alcance de este sprint

- Citas.
- Ordenes de servicio.
- Inventario y refacciones.
- Pagos y Mercado Pago.
- Tickets.
- Dashboard.
- Chatbot de WhatsApp.
- Recuperacion de contrasena.
- Registro publico de usuarios.
- Modo oscuro.
- Recuperacion de contrasena por correo.

## 9. Decisiones pendientes que deben resolverse en /speckit.clarify

Estas decisiones ya estan resueltas para el MVP y NO deben reabrirse sin aprobacion del equipo:

- **Frontend**: Flutter + Dart con Material Design 3 y Provider para estado. Sistema de diseno en `docs/design-system.md`.
- **Acceso a datos desde Node.js**: driver `mysql2` directo, sin ORM ni query builder. Debe ser compatible con ES Modules.
- **MySQL local**: instalacion nativa, no Docker, con usuario dedicado `motorix_app`.
- **Herramienta de migraciones**: scripts SQL numerados e inmutables en `database/migrations/`, ejecutados por scripts idempotentes con registro en `schema_migrations`.
- **Pruebas**: Jest + supertest en backend (unit, integracion y contrato contra `motorix_test`); `flutter test` en frontend.

Decisiones que si se resuelven en `/speckit.clarify` para este sprint:

- Libreria complementaria de componentes de UI en Flutter (o ninguna).
- Set de iconos definitivo.
- Estructura exacta del sidebar y pantallas iniciales del Sprint 1.

## 10. Restricciones tecnicas heredadas

- Backend en ES Modules, nunca CommonJS.
- Solo el backend accede a MySQL; el frontend nunca se conecta directo.
- Permisos validados en backend, no solo en UI.
- Sin secretos en el repositorio.
- Idioma: espanol en chat, docs, comentarios y pruebas.
- MySQL local, InnoDB, llaves foraneas, `utf8mb4`.
- Login acepta usuario o correo electronico en el mismo campo.
- Toda pantalla del frontend sigue `docs/design-system.md`.
- Pruebas de integracion contra `motorix_test`, nunca contra la base principal.
- Los seeds del sprint DEBEN incluir datos de ejemplo suficientes para que la aplicacion muestre informacion al arrancar. La base no puede quedar vacia tras la instalacion.
- Los seeds DEBEN ser idempotentes: si se corren de nuevo, no duplican registros.