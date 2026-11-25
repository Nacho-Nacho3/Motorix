import { z } from "zod";

// T096: consulta común de los reportes (Sprint 7, contracts/reports.md).
// `from` y `to` son fechas locales `YYYY-MM-DD` inclusivas; por omisión el mes en
// curso. El rango no puede pasar de 366 días. Se valida sobre `req.query` sin
// reasignarlo (en Express 5 es de solo lectura).

export const MAX_DIAS_REPORTE = 366;

function aTexto(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

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

/** Días entre dos fechas `YYYY-MM-DD`, contando ambos extremos. */
function diasInclusivos(desde, hasta) {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000) + 1;
}

export const reportQuerySchema = z
  .object({
    from: fecha("La fecha inicial").optional(),
    to: fecha("La fecha final").optional(),
    format: z
      .enum(["json", "csv"], {
        errorMap: () => ({ message: "El formato debe ser json o csv." }),
      })
      .optional(),
  })
  .superRefine((valor, contexto) => {
    const { from, to } = rangoPorOmision(valor);
    if (to < from) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "La fecha final no puede ser anterior a la inicial.",
      });
    } else if (diasInclusivos(from, to) > MAX_DIAS_REPORTE) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: `El periodo no puede pasar de ${MAX_DIAS_REPORTE} días.`,
      });
    }
  })
  .transform((valor) => ({ ...rangoPorOmision(valor), format: valor.format ?? "json" }));

/** Completa el rango: sin `from`, el primer día del mes de `to` (o del mes en curso); sin `to`, hoy. */
function rangoPorOmision({ from, to }) {
  const hoy = new Date();
  const hasta = to ?? aTexto(hoy);
  const base = to ? to.split("-").map(Number) : [hoy.getFullYear(), hoy.getMonth() + 1];
  const desde =
    from ?? `${String(base[0]).padStart(4, "0")}-${String(base[1]).padStart(2, "0")}-01`;
  return { from: desde, to: hasta };
}
