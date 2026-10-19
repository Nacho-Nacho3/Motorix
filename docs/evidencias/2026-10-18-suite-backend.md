# Evidencia — Suite de pruebas del backend (18 de octubre de 2026)

- **Comando ejecutado**: `npm.cmd test` dentro de `server/`, que invoca el script oficial `test` de `server/package.json`:
  `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand`.
- **Base de datos**: las pruebas se ejecutan contra `motorix_test` (lo fuerza `server/tests/helpers/setup-env.js`); la base principal `motorix` no se utiliza.
- **Fecha de la ejecución**: 2026-10-18.

## Resultado de la ejecución válida

| Métrica | Valor |
|---|---|
| Test Suites | 49 passed, 49 total |
| Tests | 390 passed, 390 total |
| Fallidas | 0 |
| Omitidas | 0 |
| Snapshots | 0 total |
| Tiempo | 18.261 s |
| Código de salida | 0 |

## Primer intento fallido (no se usa como resultado válido)

Antes de la ejecución registrada arriba, un primer intento del mismo comando arrojó **321 pruebas fallidas de 390** (49 suites: 40 fallidas), todas con el error `connect ECONNREFUSED 127.0.0.1:3306`.

- **Causa**: fallo de entorno, no de código. El servicio `MySQL96` estaba detenido tras un reinicio del equipo (su arranque es Manual) y no había ningún proceso escuchando en el puerto 3306.
- **Resolución**: con autorización del equipo se inició el servicio `MySQL96` y se volvió a ejecutar **el mismo comando**, obteniendo la ejecución válida de la tabla anterior.
- **Criterio aplicado**: este primer intento queda documentado por transparencia y **NO** se utiliza como evidencia del resultado satisfactorio; las 69 pruebas que pasaron sin base de datos corresponden a las unitarias que no requieren MySQL.

> Nota: este archivo es una transcripción de los resultados observados en la ejecución; no es una salida de consola literal archivada.
