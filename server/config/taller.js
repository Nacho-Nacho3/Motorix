// Valores de respaldo del taller (Sprint 7, research P-2): rigen mientras el
// administrador no guarde un valor propio en la configuración. Antes de la
// configuración eran los datos fijos del ticket (Sprint 4, R-05); `address` y
// `phone` son null mientras no existan (contrato contracts/tickets.md).
export const taller = {
  name: "Motorix",
  address: null,
  phone: null,
};

// Márgenes de «Próximo» del mantenimiento que ya regían antes de la
// configuración (FR-004): 30 días y 500 km.
export const margenesMantenimiento = {
  warnDays: 30,
  warnKm: 500,
};
