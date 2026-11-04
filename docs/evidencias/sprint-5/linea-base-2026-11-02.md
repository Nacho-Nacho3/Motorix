# Evidencia — Línea base de regresión del Sprint 5 (2026-11-02)

- **Fecha de la línea base**: 2026-11-02, sobre el commit `fe587b5` de la rama `main`, antes de crear la rama `005-precios-refacciones-cobro`.
- **Base de datos**: las suites corren contra `motorix_test` (configuración de pruebas); los datos de demostración de `motorix` no se tocaron.
- **Correspondencia con la guía de capturas**: esta transcripción sustituye a las capturas **C-01**, **C-02** y **C-03**. No se tomaron PNG; el patrón del proyecto es el markdown con transcripción honesta, igual que `docs/evidencias/2026-10-18-suite-backend.md`.

## C-01 — Backend (Jest)

Comando: `npm.cmd test` dentro de `server/` (script oficial `test` de `server/package.json`).

| Métrica | Valor |
|---|---|
| Test Suites | 49 passed, 49 total |
| Tests | 390 passed, 390 total |
| Fallidas | 0 |
| Omitidas | 0 |
| Tiempo | 46.8 s |
| Código de salida | 0 |

## C-02 — Frontend (Flutter)

Comando: `flutter test` dentro de `client/`.

| Métrica | Valor |
|---|---|
| Pruebas | 120 aprobadas, mensaje final «All tests passed!» |
| Fallidas | 0 |

## C-03 — Análisis estático (Flutter)

Comando: `flutter analyze lib` dentro de `client/`.

| Resultado | Valor |
|---|---|
| Salida | «No issues found!» |

> Nota: transcripción de la línea base registrada el 2026-11-02 durante la puerta G-08 y anotada en la sección 8 de `docs/aseguramiento-calidad-sprint-5.md`. No es una salida de consola literal archivada ni una captura de pantalla; los PNG no se tomaron en esa fecha.
