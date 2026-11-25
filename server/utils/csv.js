// T122: generación de CSV sin dependencias (Sprint 7, US7, research P-10, R-07).
//
// Reglas: BOM UTF-8 (para que Excel muestre acentos y eñes), separador coma,
// punto decimal, saltos CRLF, comillas dobles escapadas duplicándolas y
// neutralización de fórmulas: una celda de TEXTO que empieza con `=`, `+`, `-`
// o `@` (o con tabulador o retorno de carro) se antepone con una comilla simple
// para que un nombre malicioso no ejecute una fórmula al abrir el archivo.

const BOM = "﻿";

/** Importe o entero en texto (`-120.50`, `0.00`): es un dato, no una fórmula. */
const NUMERO_EN_TEXTO = /^-?\d+(\.\d+)?$/;

/** Prefijos que una hoja de cálculo interpreta como fórmula. */
const PELIGROSO = /^[=+\-@\t\r]/;

/** Convierte una celda a texto de CSV, neutralizada y con el escape que corresponda. */
function celda(valor) {
  if (valor === null || valor === undefined) return "";

  // Un número real pasa tal cual (su signo negativo no es una fórmula).
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : "";

  let texto = String(valor);
  if (PELIGROSO.test(texto) && !NUMERO_EN_TEXTO.test(texto)) {
    texto = `'${texto}`;
  }
  if (/[",\r\n]/.test(texto)) {
    return `"${texto.replaceAll('"', '""')}"`;
  }
  return texto;
}

const linea = (valores) => `${valores.map(celda).join(",")}\r\n`;

/**
 * @param {{ encabezados: string[], filas: Array<Array<string|number|null|undefined>> }} datos
 * @returns {string} contenido del archivo, con BOM; sin filas, solo los encabezados.
 */
export function filasACsv({ encabezados, filas = [] }) {
  return BOM + linea(encabezados) + filas.map(linea).join("");
}
