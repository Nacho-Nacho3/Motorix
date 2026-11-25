import * as audit from "../models/audit.model.js";
import { esAccionValida, sanearDetalle } from "../utils/audit-detail.js";

// T016: registro en la bitácora (Sprint 7, CA-20, research P-13). Un fallo al
// auditar NUNCA debe romper la operación que se audita: se captura y se deja
// en consola.

/**
 * Registra una acción sensible.
 * @param {{ user?: {id:number, username?:string}, actor?: string, action: string,
 *   entityType?: string, entityId?: number, datos?: object }} registro
 * @param {object} [conexion] conexión de la transacción de la operación auditada
 */
export async function registrar(
  { user, actor, action, entityType = null, entityId = null, datos = {} },
  conexion,
) {
  try {
    if (!esAccionValida(action)) {
      throw new Error(`Acción de bitácora fuera del catálogo: ${action}`);
    }
    await audit.insertar(
      {
        userId: user?.id ?? null,
        actor: String(actor ?? user?.username ?? "desconocido").slice(0, 100),
        action,
        entityType,
        entityId,
        detail: sanearDetalle(action, datos) || null,
      },
      conexion,
    );
  } catch (error) {
    console.error(`[bitácora] no se pudo registrar ${action}:`, error.message);
  }
}
