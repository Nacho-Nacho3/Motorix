# Checklist de calidad de la especificación: Reportes, configuración, términos y seguridad (Sprint 7)

**Propósito**: Validar la completitud y calidad de la especificación antes de pasar a planificación
**Creado**: 2026-11-24
**Funcionalidad**: [spec.md](../spec.md)

## Calidad del contenido

- [x] Sin detalles de implementación (lenguajes, frameworks, APIs) — los requisitos y criterios de éxito no los nombran; las rutas de archivo y columnas solo aparecen en Supuestos como estado verificado del código, igual que en el Sprint 6
- [x] Centrado en el valor de usuario y las necesidades del negocio
- [x] Redactado para partes interesadas no técnicas
- [x] Secciones obligatorias completadas

## Completitud de los requisitos

- [x] Sin marcadores [NEEDS CLARIFICATION] pendientes — las 18 decisiones (15 del insumo y 3 halladas al verificar el código) quedaron en la sección Clarificaciones con un valor por omisión en Supuestos, para resolverlas en `/speckit.clarify`
- [x] Requisitos comprobables y sin ambigüedades
- [x] Criterios de éxito medibles
- [x] Criterios de éxito tecnológicamente agnósticos
- [x] Todos los escenarios de aceptación definidos
- [x] Casos límite identificados
- [x] Alcance claramente delimitado (incluye sección "Fuera de alcance")
- [x] Dependencias y supuestos identificados

## Preparación de la funcionalidad

- [x] Todos los requisitos funcionales tienen criterios de aceptación claros (cada FR remite a su CA del insumo)
- [x] Las historias de usuario cubren los flujos principales (US1 a US10 del insumo, con su numeración)
- [x] La funcionalidad cumple los resultados medibles definidos en Criterios de éxito
- [x] No hay detalles de implementación en la especificación

## Notas

- **17/17 ítems cumplidos.** Validación de la especificación del Sprint 7 (2026-11-24).
- **Verificación contra el código antes de escribir** (corrige al insumo):
  - Los datos del taller del ticket están fijos en `server/config/taller.js` (nombre «Motorix», dirección y teléfono vacíos), no en `.env`; el ticket no guarda copia de ellos.
  - Los márgenes de «Próximo» no son globales: cada mantenimiento guarda `warn_days` (30) y `warn_km` (500); el insumo habla de 1,000 km y de variables `MAINTENANCE_WARN_*` que no existen.
  - La política de contraseñas y el bloqueo por intentos fallidos YA existen; falta una longitud máxima. No hay `helmet` ni cabeceras de seguridad, aunque el insumo dice que sí.
  - La migración del sprint es la 016, no la `007_...sql` del insumo.
- **Orden de entrega**: P1 a P6 (configuración, catálogo, ticket, términos y seguridad) y P7 a P10 (reportes y exportación), según la propuesta de sprints.
- **Clarify pendiente**: D-01 y D-03 a D-14 y D-16 a D-18 (D-02 y D-15 ya resueltas por la propuesta de sprints).
- **Gobernanza**: la constitución 1.2.0 ya cubre este sprint; no requiere enmienda.
- Especificación validada y lista para `/speckit.clarify` (siguiente paso).
