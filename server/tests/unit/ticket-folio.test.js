// T029: folio del ticket derivado del id (US3, R-05, FR-011, CA-5).
// Sin contador ni columna propia: el mismo id produce siempre el mismo folio,
// por reabrir o reimprimir el comprobante nunca se duplica.
import { folioDeTicket } from "../../services/tickets.service.js";

describe("folio del ticket (US3, R-05)", () => {
  test("deriva el folio con 6 dígitos desde el id", () => {
    expect(folioDeTicket(1)).toBe("TCK-000001");
    expect(folioDeTicket(123)).toBe("TCK-000123");
  });

  test("es determinista: dos consultas del mismo id dan el mismo folio", () => {
    expect(folioDeTicket(7)).toBe(folioDeTicket(7));
    expect(folioDeTicket(7)).toBe("TCK-000007");
  });

  test("acepta ids de más de 6 dígitos sin perder información", () => {
    expect(folioDeTicket(1234567)).toBe("TCK-1234567");
  });
});
