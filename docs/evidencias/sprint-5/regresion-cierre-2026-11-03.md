# Evidencia — Regresión al cierre del Sprint 5 (2026-11-03)

- **Fecha de la ejecución**: 2026-11-03, sobre la rama `005-precios-refacciones-cobro`.
- **Base de datos**: las suites de backend corren contra `motorix_test`; los datos de demostración de `motorix` no se tocaron.
- **Correspondencia con la guía de capturas**: sustituye a las capturas **C-09** (regresión de backend) y **C-10** (regresión de frontend), y registra además el análisis estático que la guía pedía en C-03 para el después del sprint.

## Backend (Jest) — C-09

Comando: `npm.cmd test` dentro de `server/`.

| Métrica | Valor |
|---|---|
| Test Suites | 51 passed, 51 total |
| Tests | 423 passed, 423 total |
| Fallidas | 0 |
| Omitidas | 0 |
| Snapshots | 0 total |
| Tiempo | 39.162 s |
| Código de salida | 0 |

Transcripción del resumen:

```text
Test Suites: 51 passed, 51 total
Tests:       423 passed, 423 total
Snapshots:   0 total
Time:        39.162 s, estimated 44 s
```

## Frontend (Flutter) — C-10

Comando: `flutter test` dentro de `client/`.

| Métrica | Valor |
|---|---|
| Pruebas | 128 aprobadas, mensaje final «All tests passed!» |
| Fallidas | 0 |
| Tiempo observado | 00:10 |
| Código de salida | 0 |

Transcripción de la última línea:

```text
00:10 +128: C:/sdd/motorix/client/test/vehicles_test.dart: pide confirmación al salir del formulario con cambios sin guardar
00:10 +128: All tests passed!
```

## Análisis estático (Flutter)

Comando: `flutter analyze lib` dentro de `client/`.

```text
Analyzing lib...
No issues found! (ran in 4.7s)
```

Código de salida: 0.

## Comparación con la línea base (2026-11-02)

| Suite | Antes | Después | Diferencia |
|---|---|---|---|
| Backend (Jest) | 49 suites / 390 pruebas | 51 suites / 423 pruebas | +2 suites y +33 pruebas (las creadas en el Sprint 5), 0 en rojo |
| Frontend (Flutter) | 120 pruebas | 128 pruebas | +8 pruebas, 0 en rojo |
| Análisis estático | «No issues found!» | «No issues found!» | Sin diferencia |

Ninguna prueba de los sprints 1 a 4 pasó de verde a rojo.

> Nota: transcripción de las salidas observadas en las ejecuciones; no son archivos de consola literal ni capturas de pantalla.
