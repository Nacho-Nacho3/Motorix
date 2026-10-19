# Evidencia — Comprobación de las cuentas iniciales del MVP (18 de octubre de 2026)

- **Contexto**: comprobación en vivo contra la API local (`http://localhost:3000/api`) con el backend iniciado temporalmente desde `server/` y la base de datos local `motorix` (datos del seed). El backend se detuvo al terminar.
- **Solicitudes realizadas**: 4 peticiones `POST /api/auth/login` con el cuerpo de autenticación estándar de la API.

| # | Identificador enviado | Resultado |
|---|---|---|
| 1 | `admin` (usuario) | HTTP 201 |
| 2 | `recepcion` (usuario) | HTTP 201 |
| 3 | `mecanico` (usuario) | HTTP 201 |
| 4 | `admin@motorix.local` (correo, misma contraseña que `admin`) | HTTP 201 |

## Notas de manejo de datos sensibles

- Las contraseñas utilizadas corresponden a las cuentas de ejemplo del seed del MVP; **no se transcriben en este archivo**.
- Cada respuesta 201 incluyó un token JWT; **no se conserva ni se registra** ningún token aquí.
- La comprobación 4 verifica además el login por correo electrónico en el mismo campo (CA-9 del sprint 1).

> Nota: este archivo es una transcripción de las comprobaciones realizadas el 2026-10-18; no es una salida de consola literal archivada.
