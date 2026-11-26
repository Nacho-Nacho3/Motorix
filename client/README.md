# Motorix — aplicación de escritorio

Cliente Flutter para Windows del Sistema de Gestión para Taller Mecánico
Motorix. La puesta en marcha completa (base de datos, backend y cliente) está
en el [README principal](../README.md).

## Estructura de `lib/`

- `models/` — datos que devuelve la API.
- `services/` — cliente HTTP.
- `providers/` — estado de la aplicación con `provider`.
- `screens/` — pantallas por módulo.
- `widgets/` y `utils/` — componentes y utilidades compartidas.

El diseño de la interfaz sigue [`docs/design-system.md`](../docs/design-system.md).

## Comandos

```powershell
flutter pub get
flutter run -d windows   # necesita el backend en http://localhost:3000
flutter analyze
flutter test
```

La carpeta `tool/` contiene los guiones que generan las capturas de
evidencia; no forman parte del producto.
