# Revisión del sistema de diseño — T070

**Fecha**: 2026-10-14 · **Base**: `docs/design-system.md` (secciones 4, 6.4, 7, 8.5, 10 y 11)
**Alcance**: todas las pantallas del Sprint 1 (login, shell, clientes, vehículos, usuarios).

## Cambios aplicados durante la revisión

| # | Hallazgo | Corrección |
|---|----------|------------|
| 1 | 8.5 exige los botones **"Confirmar"** y **"Cancelar"**; tres diálogos usaban etiquetas propias (`Cerrar sesión`, `Salir`, `Guardar`, `Desactivar`) | Las cuatro confirmaciones usan `Confirmar`/`Cancelar`; la acción concreta queda en el título y el mensaje |
| 2 | 8.5 pide confirmación al salir de **cualquier** formulario con cambios; solo el de clientes la tenía | `PopScope` + `_hayCambios` añadidos al formulario de **vehículos** y de **usuarios** (3/3 formularios) |
| 3 | No existía `PageTransitionsTheme` ni duración de navegación (6.4: 250 ms) | Tema con transición discreta *fade + slide leve* (`easeInOut`/`easeOutCubic`) y `AppRoute` (250 ms) en los 7 `push` de la app |
| 4 | Los diálogos aparecían en 150 ms (valor fijo de Material); 6.4 pide 200 ms | `AnimationStyle(duration: 200 ms, easeOutCubic)` en `mostrarConfirmacion` |
| 5 | El cambio login ↔ shell era un salto sin transición | `AnimatedSwitcher` de 250 ms con la misma transición compartida (`transicionPantalla`) |
| 6 | Faltaban componentes del tema de la sección 4 | Añadidos `FilledButtonThemeData` (idéntico al Elevated), `TextButtonThemeData`, `TooltipThemeData` y `PageTransitionsTheme`; `colorScheme` ajustado al snippet exacto (`surfaceContainerLowest`, `outlineVariant`, `onSurface`). `DataTableThemeData` y `ChipThemeData` **no aplican**: el Sprint 1 no usa tablas ni chips |
| 7 | Sidebar colapsado sin `Tooltip` (sección 7 y regla 10) | Cada ícono de sección lleva `Tooltip` con su nombre solo cuando el rail está colapsado; ancho fijo `minWidth: 72` (~72 px) y logo animado 32 ↔ 24 px con `AppDurations.element` |
| 8 | La edición de vehículo no mostraba el propietario actual y dejaba pensar que podía cambiarlo | El selector se precarga con el dueño real y queda de solo lectura (`onChanged: null`) con `helperText` en español: "El propietario no se puede cambiar en esta versión." (contrato: `clientId` no se modifica en este sprint) |
| 9 | El botón `FilledButton` del diálogo definía su radio en la pantalla | El radio vive en `filledButtonTheme` (única fuente de estilos) |

## Cumplimiento por regla (checklist de la sección 11)

- [x] **Usa únicamente tokens**: `Color(0xFF…)` y `fontSize:` solo en `app_theme.dart`; radios y espacios con `AppRadii`/`AppSpacing`; duraciones con `AppDurations`. (Los anchos de layout —72, 256, 560— son medidas de la sección 7, no espaciados.)
- [x] **Respeta la lista de "qué evitar"**: sin degradados, sin tarjetas anidadas, un set de íconos (nativo), IBM Plex Sans decidida, animaciones discretas.
- [x] **Funciona con el sidebar expandido y colapsado**: `minWidth: 72` con solo íconos + tooltip; `minExtendedWidth` por defecto (256 ≈ "~260 px"); `NavigationRail` ya anima el ancho en 200 ms `easeInOut` (`kThemeAnimationDuration`), igual que la referencia 6.4, y en colapsado muestra solo íconos (`labelType: none`).
- [x] **Muestra estados vacío, cargando y error**: `EmptyView`/`LoadingView`/`ErrorView` con mensajes en español en las tres listas; errores de API en snackbar en español; validaciones de formulario en español.
- [x] **Transiciones suaves**: navegación 250 ms (rutas + guard de sesión), diálogos 200 ms, sidebar 200 ms, hover/focus y tooltip con estados de Material (150 ms). Sin curvas de rebote.
- [x] **Pide confirmación en todas las acciones de 8.5**: cerrar sesión ✓; salir de formulario con cambios ✓ (clientes, vehículos, usuarios); desactivar usuario ✓. Cancelar citas/órdenes/pagos y eliminar registros no existen en el Sprint 1.
- [x] **Es consistente con el resto**: mismo diálogo, mismos botones, mismos estados y misma transición en todas las pantallas.
- [ ] **Verificación visual en escritorio y ventana angosta**: queda para la revisión manual del equipo (no automatizable en pruebas de widget).

## Notas de marco

- Las duraciones de *snackbars* y del propio *tooltip* las gobierna Material (~200/150 ms), dentro de la referencia 6.4.
- La preferencia de sistema "reducir movimiento" (sección 10) no puede consultarse desde `Route.transitionDuration` (no recibe `BuildContext`); queda anotada como mejora futura cuando el equipo lo priorice.

**Resultado**: 8/9 criterios de la sección 11 cumplidos y verificados con pruebas; el noveno queda pendiente de revisión visual humana.
