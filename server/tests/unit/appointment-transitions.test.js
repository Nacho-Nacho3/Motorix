import {
  estadosSiguientesCita,
  puedeTransicionarCita,
} from "../../services/appointments.service.js";

// T006: máquina de estados de citas (FR-004/FR-005, Q3) sin base de datos.
describe("Máquina de transiciones de citas", () => {
  test("una cita PENDING solo avanza a CONFIRMED o se cancela", () => {
    expect(estadosSiguientesCita("PENDING").sort()).toEqual([
      "CANCELED",
      "CONFIRMED",
    ]);
  });

  test("una cita CONFIRMED solo avanza a IN_PROGRESS o se cancela", () => {
    expect(estadosSiguientesCita("CONFIRMED").sort()).toEqual([
      "CANCELED",
      "IN_PROGRESS",
    ]);
  });

  test("una cita IN_PROGRESS solo avanza a COMPLETED o se cancela", () => {
    expect(estadosSiguientesCita("IN_PROGRESS").sort()).toEqual([
      "CANCELED",
      "COMPLETED",
    ]);
  });

  test("permite cancelar desde cualquier estado activo (FR-004)", () => {
    expect(puedeTransicionarCita("PENDING", "CANCELED")).toBe(true);
    expect(puedeTransicionarCita("CONFIRMED", "CANCELED")).toBe(true);
    expect(puedeTransicionarCita("IN_PROGRESS", "CANCELED")).toBe(true);
  });

  test("COMPLETED y CANCELED son estados finales sin salidas (VA-05)", () => {
    expect(estadosSiguientesCita("COMPLETED")).toEqual([]);
    expect(estadosSiguientesCita("CANCELED")).toEqual([]);
    expect(puedeTransicionarCita("COMPLETED", "PENDING")).toBe(false);
    expect(puedeTransicionarCita("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(puedeTransicionarCita("CANCELED", "PENDING")).toBe(false);
    expect(puedeTransicionarCita("CANCELED", "CONFIRMED")).toBe(false);
  });

  test("rechaza retrocesos (Q3: avance lineal sin retrocesos)", () => {
    expect(puedeTransicionarCita("CONFIRMED", "PENDING")).toBe(false);
    expect(puedeTransicionarCita("IN_PROGRESS", "CONFIRMED")).toBe(false);
    expect(puedeTransicionarCita("COMPLETED", "IN_PROGRESS")).toBe(false);
  });

  test("rechaza saltos intermedios hacia adelante", () => {
    expect(puedeTransicionarCita("PENDING", "IN_PROGRESS")).toBe(false);
    expect(puedeTransicionarCita("PENDING", "COMPLETED")).toBe(false);
    expect(puedeTransicionarCita("CONFIRMED", "COMPLETED")).toBe(false);
  });

  test("un estado desconocido no permite ninguna transición", () => {
    expect(estadosSiguientesCita("OTRO_ESTADO")).toEqual([]);
    expect(puedeTransicionarCita("OTRO_ESTADO", "PENDING")).toBe(false);
  });
});
