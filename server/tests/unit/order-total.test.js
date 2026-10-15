import { sumarTotales } from "../../services/order-total.service.js";

// T006: cálculo del total de la orden (US1, R-03, CA-4, RN-10).
// La fórmula única alimenta el cobro (VN-03) y el ticket; nada se almacena:
// total = Σ servicios + Σ (horas × tarifa) + Σ (cantidad × precio vigente).

describe("cálculo del total de la orden", () => {
  test("suma servicios, mano de obra y refacciones con precio vigente", () => {
    const totales = sumarTotales({
      servicios: [{ unitPrice: "850.00" }, { unitPrice: "150.50" }],
      manoDeObra: [
        { hours: "2.00", hourlyRate: "300.00" },
        { hours: "1.50", hourlyRate: "200.00" },
      ],
      refacciones: [
        { quantity: 2, salePrice: "850.00" },
        { quantity: 1, salePrice: "120.25" },
      ],
    });

    expect(totales.servicesSubtotal).toBe("1000.50");
    expect(totales.laborSubtotal).toBe("900.00");
    expect(totales.partsSubtotal).toBe("1820.25");
    expect(totales.total).toBe("3720.75");
  });

  test("una orden sin filas devuelve 0.00 en todos los campos", () => {
    const totales = sumarTotales({ servicios: [], manoDeObra: [], refacciones: [] });

    expect(totales.servicesSubtotal).toBe("0.00");
    expect(totales.laborSubtotal).toBe("0.00");
    expect(totales.partsSubtotal).toBe("0.00");
    expect(totales.total).toBe("0.00");
  });

  test("los importes siempre salen como cadena con 2 decimales", () => {
    const totales = sumarTotales({
      servicios: [{ unitPrice: "0.10" }],
      manoDeObra: [{ hours: "0.30", hourlyRate: "0.10" }],
      refacciones: [{ quantity: 3, salePrice: "0.10" }],
    });

    expect(totales.laborSubtotal).toBe("0.03");
    expect(totales.total).toBe("0.43"); // 0.10 servicios + 0.03 mano de obra + 0.30 refacciones
    for (const valor of Object.values(totales)) {
      expect(valor).toMatch(/^\d+\.\d{2}$/);
    }
  });

  test("una fila con precio ausente se cuenta como 0.00", () => {
    const totales = sumarTotales({
      servicios: [{ unitPrice: null }],
      manoDeObra: [{ hours: "2.00", hourlyRate: null }],
      refacciones: [],
    });

    expect(totales.servicesSubtotal).toBe("0.00");
    expect(totales.laborSubtotal).toBe("0.00");
    expect(totales.total).toBe("0.00");
  });
});
