// T034: datos fijos del taller para el ticket (US3, R-05, CA-4).
// Se mantienen en un módulo propio hasta que exista un módulo de ajustes
// que los gestione; `address` y `phone` son null mientras no existan
// (contrato contracts/tickets.md).
export const taller = {
  name: "Motorix",
  address: null,
  phone: null,
};
