# Checklist de calidad de requisitos: Precios de refacciones y cobro completo

**Purpose**: Pruebas unitarias de la redacción de los requisitos del Sprint 5 (calidad, claridad, consistencia, medibilidad y cobertura), no de la implementación.
**Created**: 2026-11-03
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [contracts/](../contracts/)

**Note**: Este checklist personalizado lo genera el comando `/speckit.checklist` a partir del contexto de la funcionalidad.
**Review Ownership**: Artefacto de revisión de calidad de requisitos propiedad del revisor. Marca un ítem `[x]` solo cuando el revisor determina que el criterio de calidad se cumple.
**Marker Semantics**: `[x]` significa que el criterio fue revisado y satisfecho en calidad de requisitos; **no** significa que la implementación esté terminada.

<!-- Los ítems de muestra de la plantilla fueron reemplazados por ítems reales
     derivados de spec.md, plan.md, research.md y contracts/. -->

## Completitud de requisitos

- [x] CHK001 ¿Está especificado dónde queda guardado el precio de cada refacción usada y en qué momento se fija? [Completitud, Spec §FR-003]
- [x] CHK002 ¿Están definidos los campos de la línea de refacción (precio guardado y metadatos de corrección) con sus reglas? [Completitud, Spec §Entidades clave; data-model.md]
- [x] CHK003 ¿Está definido el comportamiento ante un pago pendiente cuyo importe ya no coincide con el total de la orden? [Completitud, Spec §FR-009, D-04]
- [x] CHK004 ¿Están cuantificados los límites de los precios (máximo aceptado y número de decimales)? [Completitud, Spec §FR-002, D-08]
- [x] CHK005 ¿Están definidos qué roles pueden ver cada tipo de precio en sus consultas? [Completitud, Spec §FR-010, D-10]
- [x] CHK006 ¿Está especificada la actualización de la documentación que contradiga el comportamiento nuevo? [Completitud, Spec §FR-014]
- [x] CHK007 ¿Están definidos los datos de ejemplo que el sprint debe dejar instalados? [Completitud, Spec §FR-012]
- [x] CHK008 ¿Está especificada la cobertura mínima de pruebas automatizadas exigida? [Completitud, Spec §FR-013]

## Claridad de requisitos

- [x] CHK009 ¿El término «precio vigente al migrar» está definido de forma verificable (qué precio y para qué filas)? [Claridad, Spec §Clarificaciones D-01/D-03]
- [x] CHK010 ¿Está claro quién puede corregir el precio de una línea y qué dato es obligatorio para hacerlo? [Claridad, Spec §FR-003, D-05]
- [x] CHK011 ¿Está definida la «orden abierta» con estados concretos para admitir la corrección de precio? [Claridad, Spec §FR-003; contracts/order-parts.md]
- [x] CHK012 ¿Los importes tienen formato y presentación definidos (cadena con exactamente 2 decimales)? [Claridad, Spec §FR-004; contracts/README.md]
- [x] CHK013 ¿Está previsto el mensaje de rechazo de precios inválidos, en español y sin ambigüedad? [Claridad, Spec §FR-002, US1 esc. 3 y 4]
- [x] CHK014 ¿Está cuantificada la longitud mínima del motivo de una corrección de precio? [Claridad, contracts/order-parts.md (10 a 200 caracteres)]

## Consistencia de requisitos

- [x] CHK015 ¿El total, el pago y el ticket usan la misma fuente de precio sin contradicciones entre sí? [Consistencia, Spec §FR-004/FR-005/FR-007; research.md P-3]
- [x] CHK016 ¿El límite máximo de precio es el mismo en catálogo, línea y corrección? [Consistencia, Spec §FR-002/FR-003, D-08]
- [x] CHK017 ¿La regla de «un solo pago vigente» convive sin conflicto con la cancelación por desfase? [Consistencia, Spec §FR-008/FR-009; contracts/payments.md]
- [x] CHK018 ¿Los escenarios de US5 concuerdan con FR-010 sobre la ausencia total de precios del mecánico? [Consistencia, Spec §US5/FR-010]
- [x] CHK019 ¿El alcance declarado fuera del sprint está sin solaparse con los requisitos dentro del alcance? [Consistencia, Spec §Fuera de alcance vs §Requisitos]

## Calidad de los criterios de aceptación

- [x] CHK020 ¿Cada criterio de éxito es medible con un número o una comparación verificable? [Medibilidad, Spec §SC-001 a SC-008]
- [x] CHK021 ¿Los criterios que prometen «100 %» o «0» definen su forma de conteo? [Medibilidad, Spec §SC-001, SC-002, SC-003]
- [x] CHK022 ¿El criterio de regresión está ligado a una línea base fechada y concretada? [Medibilidad, Spec §SC-006; aseguramiento §8]

## Cobertura de escenarios

- [x] CHK023 ¿Están cubiertos los escenarios primarios de las 5 historias con Dado/Cuando/Entonces? [Cobertura, Spec §Escenarios US1-US5]
- [x] CHK024 ¿Está cubierto el flujo alternativo de pago con Mercado Pago pendiente? [Cobertura, Spec §US3 esc. 3]
- [x] CHK025 ¿Están cubiertos los flujos de error de precios inválidos y de permisos denegados? [Cobertura, Spec §US1 esc. 3 y 4, US5 esc. 3]
- [x] CHK026 ¿Está prevista la recuperación ante una captura errónea de precio (corrección con motivo)? [Cobertura, Spec §US4 esc. 4, D-05]

## Cobertura de casos límite

- [x] CHK027 ¿Los casos límite del insumo están trasladados a la sección de casos límite con su estado de resolución? [Cobertura, Spec §Casos límite (D-01 a D-10)]
- [x] CHK028 ¿Están definidos los casos de líneas repetidas, cambio de precio cercano al cobro y orden sin trabajo? [Cobertura, Spec §Casos límite; US2 esc. 4]
- [x] CHK029 ¿Está definido el caso de una orden solo con refacciones y su cobrabilidad? [Cobertura, Spec §Casos límite D-02]

## Requisitos no funcionales

- [x] CHK030 ¿Está especificada la validación de permisos en el backend y no solo en la interfaz? [No funcional, Spec §FR-010, RN-15]
- [x] CHK031 ¿Está especificada la ausencia de datos de tarjeta en todo el flujo de cobro? [No funcional, Spec §FR-008]
- [x] CHK032 ¿Están definidos el idioma de los mensajes y la presentación de los importes? [No funcional, Spec §FR-002/FR-004; contracts/README.md]

## Dependencias y supuestos

- [x] CHK033 ¿Las dependencias con sprints anteriores están declaradas sin tocar sus reglas? [Dependencia, Spec §Supuestos (RN-6 a RN-15)]
- [x] CHK034 ¿Los supuestos con defaults de las decisiones diferidas están documentados uno por uno? [Supuesto, Spec §Supuestos (D-02, D-06, D-07, D-09)]
- [x] CHK035 ¿El supuesto de la enmienda a la constitución está declarado como condición de entrada? [Supuesto, Spec §Supuestos; aseguramiento §2 (H-01)]

## Ambigüedades y conflictos

- [x] CHK036 ¿Quedan marcadores `[NEEDS CLARIFICATION]` sin resolver en la especificación? [Ambigüedad, Spec] — verificado por búsqueda: ninguno.
- [x] CHK037 ¿Está resuelto el conflicto entre el insumo original y el estado real del código? [Conflicto, Spec §Supuestos (H-02, H-03, H-06)]
- [x] CHK038 ¿Las decisiones resueltas en clarify no dejan texto contradictorio en supuestos o casos límite? [Conflicto, Spec §Clarificaciones vs §Supuestos]

## Notes

- **Evaluación**: 38/38 ítems cumplidos, evaluados el 2026-11-03. La revisión la asistió el agente por **delegación explícita del revisor** (Ignacio Joaquín Trejo, responsable del documento de calidad) quien pidió continuar el proceso hasta terminar el archivo; los marcadores se fijan con esa autorización y significan calidad de requisitos, no implementación.
- Las decisiones de negocio **D-02, D-06, D-07 y D-09** siguen diferidas: sus defaults están escritos en `spec.md` (Supuestos), por eso CHK034 se cumple; si el negocio cambia un default, hay que actualizar el spec antes de implementar ese comportamiento.
- CHK011 y CHK014 se cumplen con la **cuantificación** que vive en `contracts/order-parts.md` (orden no entregada y sin pago `PAID`; motivo de 10 a 200 caracteres), no en el cuerpo del spec: si se modifica el contrato, hay que revisar esos dos ítems.
- `/speckit.implement` lee el estado de las casillas como puerta y no debe modificarlos.
- `checklists/requirements.md` mantiene su propio ciclo (lo crearon `/speckit.specify` y `/speckit.clarify`); este archivo es adicional.
