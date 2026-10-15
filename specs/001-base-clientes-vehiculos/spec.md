# Especificación de la funcionalidad: Base del sistema, clientes y vehículos

**Rama de la funcionalidad**: `001-base-clientes-vehiculos`

**Creada**: 2026-10-13

**Estado**: Borrador

**Entrada**: Descripción del usuario: "usa la descripcion de docs/sprints/sprint-1-base-clientes-vehiculos.md"
— insumo de especificación del Sprint 1 de Motorix: base del sistema, autenticación,
usuarios, clientes y vehículos.

## Clarifications

### Session 2026-10-13

- Q: ¿Cómo debe estructurarse la navegación inicial (sidebar y pantallas) del Sprint 1?
  → A: Sidebar fijo con Inicio (resumen), Clientes, Vehículos y Usuarios; la sección
  Usuarios solo es visible para el rol ADMIN.
- Q: ¿Qué datos, además del nombre de usuario y el correo de los usuarios, deben ser
  únicos para rechazar duplicados en este sprint? → A: Solo las placas de vehículo; el
  correo de cliente puede repetirse.
- Q: ¿Qué librería complementaria de componentes de interfaz se usará en el frontend del
  Sprint 1, si acaso alguna? → A: Ninguna; solo los componentes nativos del sistema de
  diseño ya fijado por la constitución.
- Q: ¿Qué debe permitir el estado "activo/inactivo" de un cliente en este sprint? → A:
  Solo informativo: sin pantalla ni botón de baja en este sprint; la edición manual es
  suficiente.
- Q: ¿Qué set de íconos se usará en el frontend del Sprint 1? → A: Iconos nativos
  incluidos con el sistema de diseño actual (sin dependencia nueva).

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Inicio de sesión y acceso según el rol (Prioridad: P1)

Como usuario del taller (administrador, recepcionista o mecánico), quiero iniciar sesión
con mi nombre de usuario o mi correo electrónico y mi contraseña, para acceder a las
funciones que mi rol me permite.

**Por qué esta prioridad**: Es la puerta de entrada de todo el sistema; sin acceso no se
puede probar ningún otro módulo y de aquí depende la autorización por roles.

**Prueba independiente**: Puede probarse por completo iniciando sesión con nombre de
usuario y luego con el correo electrónico usando la misma contraseña, y verificando que
cada rol solo ve y ejecuta sus funciones.

**Escenarios de aceptación**:

1. **Dado** un usuario existente con su contraseña correcta, **Cuando** inicia sesión con
   su nombre de usuario, **Entonces** el sistema lo autentica y le muestra las funciones
   de su rol.
2. **Dado** un usuario existente, **Cuando** inicia sesión con su correo electrónico y la
   misma contraseña, **Entonces** el sistema lo autentica con el mismo resultado que con
   el nombre de usuario.
3. **Dado** un usuario inexistente o una contraseña incorrecta, **Cuando** intenta iniciar
   sesión, **Entonces** el sistema rechaza el acceso con un mensaje claro que no revela
   cuál de los dos datos es incorrecto.
4. **Dado** un usuario autenticado, **Cuando** cambia su contraseña por una que cumple la
   política mínima, **Entonces** el sistema la guarda de forma segura y el siguiente
   inicio de sesión usa la nueva contraseña.
5. **Dado** un usuario autenticado, **Cuando** intenta guardar una contraseña sin
   mayúscula, sin minúscula, sin número o con menos de 8 caracteres, **Entonces** el
   sistema rechaza el cambio e indica qué requisito falta.
6. **Dado** un usuario con la sesión iniciada, **Cuando** elige cerrar sesión o su sesión
   deja de ser válida, **Entonces** el sistema termina el acceso y vuelve a pedir
   credenciales para cualquier acción protegida.

---

### Historia de usuario 2 - Registrar y consultar clientes (Prioridad: P2)

Como recepcionista, quiero registrar un cliente nuevo y consultarlo junto con sus datos,
para mantener actualizada la información de los propietarios del taller.

**Por qué esta prioridad**: Sin clientes no hay a quién asociar los vehículos; es el
primer dato maestro del flujo demostrable del sprint.

**Prueba independiente**: Puede probarse registrando un cliente con nombre, teléfono y
correo, y luego encontrándolo en la consulta con esos datos.

**Escenarios de aceptación**:

1. **Dado** que aún no existe un cliente con esos datos, **Cuando** el recepcionista
   captura nombre, teléfono y correo electrónico y guarda, **Entonces** el sistema guarda
   el cliente y aparece en la lista de clientes con su fecha de registro.
2. **Dado** un cliente registrado, **Cuando** lo selecciona en la consulta, **Entonces**
   el sistema muestra su ficha con los datos y la lista de sus vehículos asociados.
3. **Dado** un formulario con campos obligatorios vacíos o con formatos inválidos,
   **Cuando** se intenta guardar, **Entonces** el sistema no guarda nada y señala qué
   campo debe corregirse, aunque la interfaz no lo haya detectado primero.
4. **Dado** una instalación nueva con datos de ejemplo, **Cuando** el recepcionista abre
   la consulta de clientes, **Entonces** ve clientes de ejemplo en lugar de una lista
   vacía.

---

### Historia de usuario 3 - Registrar vehículos y asociarlos con su propietario (Prioridad: P3)

Como recepcionista, quiero registrar un vehículo y vincularlo con su propietario
(cliente), para que el taller tenga el control de los automóviles atendidos.

**Por qué esta prioridad**: Completa el flujo demostrable del sprint (cliente → vehículo
→ asociación → consulta) y protege una regla de negocio innegociable.

**Prueba independiente**: Puede probarse registrando un vehículo con un cliente como
propietario y verificando que el vehículo aparece en la ficha de ese cliente.

**Escenarios de aceptación**:

1. **Dado** un cliente existente, **Cuando** el recepcionista registra un vehículo con
   propietario, marca, modelo, año, placas, VIN (si está disponible) y kilometraje
   actual, **Entonces** el sistema guarda el vehículo y queda asociado a ese cliente.
2. **Dado** un formulario de vehículo sin propietario seleccionado, **Cuando** se intenta
   guardar, **Entonces** el sistema rechaza el registro y pide elegir un propietario
   (RN-1).
3. **Dado** un vehículo registrado, **Cuando** se consulta la ficha del cliente
   propietario, **Entonces** el vehículo aparece en su lista de vehículos.
4. **Dado** un vehículo con las mismas placas que uno ya registrado, **Cuando** se
   intenta guardarlo, **Entonces** el sistema rechaza el registro e indica que esas
   placas ya están en uso.

---

### Historia de usuario 4 - Editar información de clientes (Prioridad: P4)

Como recepcionista, quiero editar la información de un cliente registrado, para corregir
o actualizar sus datos sin perder el historial de sus vehículos.

**Por qué esta prioridad**: Los datos cambian con el tiempo; sin edición, la información
del taller se degrada, pero el flujo básico ya funciona sin ella.

**Prueba independiente**: Puede probarse modificando el teléfono de un cliente y
verificando que la consulta muestra el valor nuevo.

**Escenarios de aceptación**:

1. **Dado** un cliente registrado, **Cuando** el recepcionista modifica su teléfono o
   correo y guarda, **Entonces** el sistema conserva los cambios y los muestra en la
   siguiente consulta.
2. **Dado** un cliente con vehículos asociados, **Cuando** se editan sus datos de
   contacto, **Entonces** los vehículos siguen asociados a ese cliente.
3. **Dado** una edición con campos obligatorios vacíos o inválidos, **Cuando** se intenta
   guardar, **Entonces** el sistema no aplica cambios y señala el campo a corregir.
4. **Dado** un registro que ya no existe (por ejemplo, modificado por otro usuario),
   **Cuando** se intenta guardar la edición, **Entonces** el sistema muestra un error
   claro y no pierde lo capturado.

---

### Historia de usuario 5 - Gestionar usuarios y roles (Prioridad: P5)

Como administrador, quiero crear y modificar usuarios con su rol, para controlar quién
puede usar el sistema y qué puede hacer.

**Por qué esta prioridad**: Las cuentas iniciales permiten trabajar desde el primer día;
la gestión completa de usuarios es necesaria, pero su valor se nota cuando el equipo
crece, por eso va después de los módulos operativos.

**Prueba independiente**: Puede probarse creando un usuario nuevo, iniciando sesión con
él y verificando que solo ejecuta las acciones de su rol.

**Escenarios de aceptación**:

1. **Dado** un administrador autenticado, **Cuando** crea un usuario con nombre de
   usuario único, nombre, correo y rol (ADMIN, RECEPTIONIST o MECHANIC), **Entonces** el
   nuevo usuario puede iniciar sesión con su usuario o su correo y accede solo a las
   funciones de su rol.
2. **Dado** un usuario existente, **Cuando** el administrador cambia su rol o lo
   desactiva, **Entonces** el sistema aplica el cambio en el siguiente acceso.
3. **Dado** un nombre de usuario o un correo ya registrado, **Cuando** se intenta crear o
   renombrar otro usuario con esos datos, **Entonces** el sistema rechaza la operación e
   indica el conflicto.
4. **Dado** una persona con un rol distinto de administrador, **Cuando** intenta acceder
   a la gestión de usuarios, **Entonces** el sistema le niega el acceso.
5. **Dado** un usuario recién creado por el administrador, **Cuando** inicia sesión por
   primera vez, **Entonces** puede cambiar su contraseña y la nueva debe cumplir la
   política mínima de seguridad.

---

### Casos límite

- ¿Qué ocurre cuando se intenta iniciar sesión con un correo o usuario que no existe? →
  rechazo con mensaje genérico de credenciales incorrectas, sin revelar si el usuario
  existe.
- ¿Qué ocurre si dos personas capturan al mismo tiempo un usuario con el mismo nombre de
  usuario o correo? → el sistema rechaza el segundo registro e informa el conflicto.
- ¿Qué ocurre si se registra un vehículo con placas ya existentes? → el sistema rechaza el
  registro e indica que esas placas ya están en uso.
- ¿Cómo se evita un vehículo sin propietario? → el guardado se rechaza en el servidor,
  aunque se omita el dato en la interfaz.
- ¿Qué ocurre si la conexión se interrumpe durante un guardado? → no se guarda un
  registro a medias; se muestra un error recuperable y la persona puede reintentar.
- ¿Qué ocurre si la sesión expira mientras se captura un formulario? → el sistema vuelve
  a pedir inicio de sesión antes de aceptar la acción protegida.
- ¿Se puede dar de baja un cliente en este sprint? → No; el estado del cliente es solo
  informativo y sus datos se corrigen mediante la edición.
- ¿Qué ve un usuario que conoce la dirección directa de una pantalla sin permiso? → el
  acceso se deniega con un mensaje claro, sin mostrar datos protegidos.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El sistema DEBE permitir iniciar sesión con nombre de usuario o correo
  electrónico en el mismo campo, más la contraseña, para los roles ADMIN, RECEPTIONIST y
  MECHANIC (RN-16).
- **FR-002**: El sistema DEBE rechazar credenciales inválidas con un mensaje claro que no
  revele si falló el usuario o la contraseña.
- **FR-003**: El sistema DEBE aplicar en el servidor los permisos de cada rol antes de
  ejecutar cualquier acción protegida; ocultar botones en la interfaz no es seguridad
  suficiente (RN-5, RN-15).
- **FR-004**: El sistema DEBE permitir cerrar sesión y DEBE volver a exigir credenciales
  cuando la sesión deja de ser válida.
- **FR-005**: El sistema DEBE permitir al usuario autenticado cambiar su propia
  contraseña; la nueva DEBE tener 8 caracteres como mínimo y al menos una mayúscula, una
  minúscula y un número, y NUNCA guardarse en texto plano (RN-17).
- **FR-006**: El sistema DEBE permitir registrar clientes con al menos nombre, teléfono y
  correo electrónico, conservando fecha de registro y estado.
- **FR-007**: El sistema DEBE permitir consultar la lista de clientes y ver la ficha de un
  cliente con sus vehículos asociados.
- **FR-008**: El sistema DEBE permitir editar los datos de un cliente existente
  conservando su relación con los vehículos.
- **FR-009**: El sistema DEBE permitir registrar vehículos con propietario, marca, modelo,
  año, placas, VIN cuando esté disponible y kilometraje actual.
- **FR-010**: El sistema NO DEBE permitir guardar un vehículo sin propietario ni con un
  propietario inexistente (RN-1).
- **FR-011**: El sistema DEBE mantener la relación vehículo–propietario: cada vehículo
  aparece en la ficha de su cliente.
- **FR-012**: El sistema DEBE validar todas las entradas también en el servidor, con
  mensajes de error claros y sin exponer detalles internos.
- **FR-013**: El administrador DEBE poder crear y modificar usuarios con nombre de
  usuario único, correo único, nombre, rol y estado activo.
- **FR-014**: El sistema DEBE denegar la gestión de usuarios a los roles distintos de
  administrador, también fuera de la interfaz.
- **FR-015**: El sistema DEBE incluir las cuentas iniciales del MVP (`admin`, `recepcion`
  y `mecanico`) con las contraseñas del estándar del proyecto, exclusivas de entornos
  locales, y DEBE permitir cambiarlas.
- **FR-016**: Tras una instalación nueva, el sistema DEBE mostrar datos de ejemplo de
  clientes y vehículos sin captura manual, y la instalación DEBE poder repetirse sin
  duplicar registros.
- **FR-017**: La configuración con credenciales DEBE mantenerse fuera del repositorio
  compartido; NO DEBE haber secretos versionados.
- **FR-018**: Toda pantalla del Sprint 1 DEBE seguir el sistema de diseño del proyecto
  (`docs/design-system.md`): paleta, tipografía, tokens, transiciones suaves y
  confirmaciones obligatorias en acciones destructivas (CA-12).
- **FR-019**: El sistema DEBE mostrar una navegación con sidebar fijo con las secciones
  Inicio (resumen), Clientes, Vehículos y Usuarios; la sección Usuarios SOLO debe estar
  visible y ser accesible para el rol ADMIN, y tras iniciar sesión el sistema DEBE llevar
  a Inicio desde donde el flujo demostrable es navegable.
- **FR-020**: El sistema DEBE rechazar el registro de un vehículo cuyas placas ya estén
  registradas, indicando el conflicto; el correo electrónico de un cliente NO DEBE ser
  único (puede repetirse entre clientes).

### Entidades clave *(incluida porque la funcionalidad maneja datos)*

- **Usuario**: persona con acceso al sistema. Se identifica por un nombre de usuario
  único y un correo único; tiene nombre, rol (ADMIN, RECEPTIONIST, MECHANIC), estado
  activo y credenciales que nunca se guardan en texto plano.
- **Cliente**: propietario registrado en el taller. Nombre, teléfono, correo electrónico,
  fecha de registro y estado. Puede tener uno o varios vehículos; no inicia sesión en el
  sistema. Su correo NO es único: puede repetirse entre clientes. El estado es solo
  informativo: este sprint no incluye un flujo de baja.
- **Vehículo**: automóvil atendido por el taller. Marca, modelo, año, placas (únicas entre
  vehículos), VIN (opcional), kilometraje actual y fecha de registro. Siempre tiene un
  propietario (cliente); un cliente puede tener varios vehículos.

## Fuera de alcance

- Citas, órdenes de servicio, inventario y refacciones, pagos y Mercado Pago, tickets,
  dashboard y chatbot de WhatsApp.
- Recuperación de contraseña y registro público de usuarios.
- Modo oscuro.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Un usuario con acceso completa el flujo demostrable (iniciar sesión →
  registrar cliente → registrar vehículo → asociarlo → consultar la información) en menos
  de 5 minutos en una primera prueba guiada.
- **SC-002**: El 100% de los inicios de sesión con credenciales válidas (usuario o correo)
  tienen éxito y el 100% de los intentos con credenciales inválidas son rechazados en las
  pruebas de aceptación.
- **SC-003**: En las pruebas de aceptación, el 100% de las acciones ejecutadas desde un
  rol sin permiso son denegadas por el sistema, incluso cuando se intentan fuera de la
  interfaz.
- **SC-004**: Tras una instalación nueva, la interfaz muestra clientes y vehículos de
  ejemplo sin que nadie capture datos a mano, y repetir la instalación no duplica
  registros.
- **SC-005**: Después de las pruebas del sprint no existe ningún vehículo sin propietario
  y ninguna contraseña visible en texto plano.
- **SC-006**: El 100% de los usuarios creados desde la interfaz cumplen la política de
  contraseña (8 caracteres, mayúscula, minúscula y número) y el 100% de los intentos de
  gestión de usuarios desde roles no autorizados son rechazados.

## Supuestos

- Los roles del sistema son únicamente ADMIN, RECEPTIONIST y MECHANIC; los clientes son
  beneficiarios externos y no inician sesión.
- El cierre de sesión y la expiración de sesión se consideran parte del inicio de sesión;
  el insumo no los detalla.
- Cada usuario puede cambiar su propia contraseña; el administrador define las
  contraseñas al crear o editar usuarios.
- Un cliente puede tener varios vehículos y un vehículo tiene un solo propietario.
- La interfaz está en español para el personal del taller, con prioridad en escritorio.
- El entorno del MVP es local, con una instancia por integrante, y los datos de ejemplo
  se cargan de forma repetible sin duplicados.
- La pila técnica (base de datos, autenticación, estructura del código, módulos y
  pruebas) está fijada por la constitución (`docs/reglas.md`) y por
  `docs/project-context.md`; esta especificación no la reabre.
- Decisiones de interfaz del Sprint 1: todas quedaron resueltas en la sección
  "Clarifications" (navegación, librería de componentes, set de íconos y estado del
  cliente); no queda ninguna pendiente para `/speckit.clarify`.
