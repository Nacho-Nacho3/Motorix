import * as modelo from "../models/terms.model.js";
import { errores } from "../utils/errors.js";
import * as auditoria from "./audit.service.js";

// T070: términos y condiciones y aviso de privacidad (Sprint 7, US9, FR-018 a
// FR-021 y FR-032). Una versión publicada no se edita: cambiar el texto crea
// otra versión.

const PAGINA_POR_OMISION = 50;
const PAGINA_MAXIMA = 200;

async function vigenteORompe() {
  const vigente = await modelo.versionVigente();
  if (!vigente) {
    throw errores.notFound("NOT_FOUND", "Aún no hay términos publicados.");
  }
  return vigente;
}

/** Versión vigente y si el usuario del token ya la aceptó. */
export async function obtenerVigente(usuario) {
  const vigente = await vigenteORompe();
  const aceptada = await modelo.aceptacion(usuario.id, vigente.id);
  return {
    version: vigente.version,
    termsText: vigente.termsText,
    privacyText: vigente.privacyText,
    publishedAt: vigente.publishedAt,
    accepted: aceptada !== null,
  };
}

/**
 * Registra la aceptación de la versión vigente. Solo se acepta la vigente: si
 * se publicó otra mientras el usuario leía, la pantalla recarga.
 * @returns {Promise<{creada: boolean, version: number, acceptedAt: string}>}
 */
export async function aceptar(version, usuario) {
  const vigente = await vigenteORompe();
  if (version !== vigente.version) {
    throw errores.validation([
      {
        field: "version",
        message: `La versión vigente es la ${vigente.version}. Recarga los términos para aceptarla.`,
      },
    ]);
  }
  const { creada } = await modelo.registrarAceptacion(usuario.id, vigente.id);
  const constancia = await modelo.aceptacion(usuario.id, vigente.id);
  return { creada, version: vigente.version, acceptedAt: constancia.acceptedAt };
}

/** Publica una versión nueva (solo ADMIN) y la deja en la bitácora. */
export async function publicar({ termsText, privacyText }, usuario) {
  const terminos = termsText.trim();
  const privacidad = privacyText.trim();
  const vigente = await modelo.versionVigente();

  const vacios = terminos === "" || privacidad === "";
  const identicos =
    vigente !== null &&
    terminos === vigente.termsText.trim() &&
    privacidad === vigente.privacyText.trim();
  if (vacios || identicos) throw errores.termsUnchanged();

  const nueva = await modelo.publicar({
    termsText: terminos,
    privacyText: privacidad,
    publishedBy: usuario.id,
  });
  await auditoria.registrar({
    user: usuario,
    action: "TERMS_PUBLISHED",
    entityType: "TERMS",
    entityId: nueva.id,
    datos: { version: nueva.version },
  });
  return { version: nueva.version, publishedAt: nueva.publishedAt };
}

/** Aceptaciones paginadas y usuarios activos pendientes de una versión. */
export async function aceptaciones({ version, page, pageSize } = {}) {
  const objetivo =
    version === undefined ? await vigenteORompe() : await modelo.buscarVersion(version);
  if (!objetivo) {
    throw errores.notFound("NOT_FOUND", "La versión de los términos no existe.");
  }
  const pagina = page ?? 1;
  const tamano = Math.min(pageSize ?? PAGINA_POR_OMISION, PAGINA_MAXIMA);

  const { total, items } = await modelo.listarAceptaciones({
    versionId: objetivo.id,
    page: pagina,
    pageSize: tamano,
  });
  return {
    version: objetivo.version,
    page: pagina,
    pageSize: tamano,
    total,
    items,
    pendingUsers: await modelo.usuariosPendientes(objetivo.id),
  };
}

/** ¿El usuario aceptó la versión vigente? (login, me y el bloqueo). */
export const aceptoVigente = (userId) => modelo.tieneAceptacionVigente(userId);
