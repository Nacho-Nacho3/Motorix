import { ok } from "../utils/response.js";
import * as servicio from "../services/reports.service.js";
import { reportQuerySchema } from "../validators/reports.js";
import { formatearError } from "../middlewares/validate.js";

// T099: controlador de reportes (delgado; la lógica vive en services/). Contrato:
// specs/007-reportes-configuracion/contracts/reports.md. Solo lectura y solo ADMIN.

/** Valida la consulta común sin reasignar `req.query` (solo lectura en Express 5). */
function leerConsulta(req) {
  const consulta = reportQuerySchema.safeParse(req.query);
  if (!consulta.success) throw formatearError(consulta.error);
  return consulta.data;
}

/**
 * Responde un reporte en JSON o, con `?format=csv`, como archivo CSV de la misma
 * estructura (Sprint 7, US7, CA-9). Un error de validación siempre es JSON.
 */
function reporte(nombre, calcular) {
  return async (req, res, next) => {
    try {
      const { from, to, format } = leerConsulta(req);
      const datos = await calcular({ from, to });
      if (format === "csv") {
        const { contenido, nombreArchivo } = servicio.exportarCsv(nombre, datos);
        res
          .status(200)
          .set({
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
          })
          .send(contenido);
        return;
      }
      ok(res, datos);
    } catch (error) {
      next(error);
    }
  };
}

export const getIngresos = reporte("income", servicio.ingresos);
export const getServicios = reporte("services", servicio.servicios);
export const getProductividad = reporte("productivity", servicio.productividad);

export const getMargenRefacciones = reporte("parts-margin", servicio.margenRefacciones);
export const getRotacionInventario = reporte(
  "inventory-rotation",
  servicio.rotacionInventario,
);
