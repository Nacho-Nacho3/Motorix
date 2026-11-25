import { z } from "zod";
import { ACCIONES } from "../utils/audit-detail.js";

// T089: parámetros de GET /api/audit-log (Sprint 7, contracts/audit-log.md).
// Se validan sobre `req.query` sin reasignarlo (en Express 5 es de solo lectura).

const fecha = (rotulo) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${rotulo} debe tener el formato YYYY-MM-DD.`)
    .refine((valor) => {
      const [anio, mes, dia] = valor.split("-").map(Number);
      const real = new Date(Date.UTC(anio, mes - 1, dia));
      return (
        real.getUTCFullYear() === anio &&
        real.getUTCMonth() === mes - 1 &&
        real.getUTCDate() === dia
      );
    }, `${rotulo} no es una fecha válida.`);

const entero = (rotulo, minimo) =>
  z
    .string()
    .regex(/^\d+$/, `${rotulo} debe ser un número entero.`)
    .transform(Number)
    .refine((valor) => valor >= minimo, `${rotulo} debe ser mayor o igual que ${minimo}.`);

export const auditQuerySchema = z
  .object({
    from: fecha("La fecha inicial").optional(),
    to: fecha("La fecha final").optional(),
    userId: entero("El usuario", 1).optional(),
    action: z
      .string()
      .refine((valor) => ACCIONES.includes(valor), "La acción no es válida.")
      .optional(),
    page: entero("La página", 1).optional(),
    pageSize: entero("El tamaño de página", 1).optional(),
  })
  .refine((valor) => !valor.from || !valor.to || valor.to >= valor.from, {
    message: "La fecha final no puede ser anterior a la inicial.",
    path: ["to"],
  });
