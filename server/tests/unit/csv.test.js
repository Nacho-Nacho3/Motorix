import { filasACsv } from "../../utils/csv.js";

// T119: generación de CSV sin dependencias (US7, P-10, R-07, CA-9).

const BOM = "﻿";

describe("filasACsv", () => {
  test("empieza con BOM UTF-8, separa con coma y termina cada línea con CRLF", () => {
    const csv = filasACsv({
      encabezados: ["Código", "Refacción", "Unidades"],
      filas: [["FIL-002", "Filtro de aceite", 6]],
    });

    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}Código,Refacción,Unidades\r\nFIL-002,Filtro de aceite,6\r\n`);
  });

  test("conserva acentos y eñes", () => {
    const csv = filasACsv({
      encabezados: ["Método"],
      filas: [["Mecánico Peña"], ["Año"]],
    });

    expect(csv).toContain("Método");
    expect(csv).toContain("Mecánico Peña");
    expect(csv).toContain("Año");
    expect(Buffer.from(csv, "utf8").toString("utf8")).toBe(csv);
  });

  test("sin filas devuelve solo los encabezados", () => {
    const csv = filasACsv({ encabezados: ["Fecha", "Método", "Pagos", "Importe"], filas: [] });

    expect(csv).toBe(`${BOM}Fecha,Método,Pagos,Importe\r\n`);
  });

  test("escapa las comillas dobles duplicándolas y encierra el campo", () => {
    const csv = filasACsv({ encabezados: ["Nombre"], filas: [['Filtro 5" "premium"']] });

    expect(csv).toContain('"Filtro 5"" ""premium"""');
  });

  test("encierra entre comillas los campos con comas, saltos de línea o retorno de carro", () => {
    const csv = filasACsv({
      encabezados: ["A", "B", "C"],
      filas: [["uno, dos", "línea1\nlínea2", "x\ry"]],
    });

    expect(csv).toContain('"uno, dos","línea1\nlínea2","x\ry"');
  });

  test("usa punto decimal: los importes en cadena y los números pasan tal cual", () => {
    const csv = filasACsv({ encabezados: ["Importe", "Pagos"], filas: [["1250.15", 3]] });

    expect(csv).toContain("1250.15,3");
  });

  test.each(["=1+1", "+SUMA(A1)", "-2+3", "@usuario", "=HYPERLINK(\"http://x\")"])(
    "neutraliza con una comilla simple la celda de texto %s",
    (peligrosa) => {
      const csv = filasACsv({ encabezados: ["Nombre"], filas: [[peligrosa]] });
      const linea = csv.split("\r\n")[1];

      // Tras neutralizar, la celda ya no empieza con =, +, - ni @ (puede ir entre comillas).
      const sinComillas = linea.replace(/^"/, "");
      expect(sinComillas.startsWith("'")).toBe(true);
      expect(sinComillas).toContain(peligrosa.replaceAll('"', '""').replace(/^"/, ""));
    },
  );

  test("no neutraliza un importe negativo ni un número: son datos, no texto", () => {
    const csv = filasACsv({
      encabezados: ["Margen", "Cantidad"],
      filas: [["-120.50", -3], ["0.00", 0]],
    });

    expect(csv).toContain("-120.50,-3");
    expect(csv).not.toContain("'-120.50");
  });

  test("una celda de texto que contiene el símbolo en medio no se toca", () => {
    const csv = filasACsv({ encabezados: ["Nombre"], filas: [["Aceite = bueno"], ["a+b"]] });

    expect(csv).toContain("Aceite = bueno");
    expect(csv).not.toContain("'Aceite");
    expect(csv).toContain("\r\na+b\r\n");
  });

  test("valores nulos o indefinidos salen como celda vacía", () => {
    const csv = filasACsv({ encabezados: ["A", "B", "C"], filas: [["x", null, undefined]] });

    expect(csv).toContain("x,,\r\n");
  });

  test("neutraliza también los encabezados y un texto que empieza con tabulador o retorno", () => {
    const csv = filasACsv({ encabezados: ["=cmd"], filas: [["\t=1+1"]] });

    const [encabezado, fila] = csv.slice(1).split("\r\n");
    expect(encabezado.startsWith("'")).toBe(true);
    expect(fila.replace(/^"/, "").startsWith("'")).toBe(true);
  });

  test("es pura: no modifica sus entradas", () => {
    const entrada = { encabezados: ["A"], filas: [["=x"]] };
    const copia = JSON.parse(JSON.stringify(entrada));

    filasACsv(entrada);

    expect(entrada).toEqual(copia);
  });
});
