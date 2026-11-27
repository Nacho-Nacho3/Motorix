// Despliegue: separa un script SQL en sentencias y cada ALTER TABLE en una
// sentencia por cláusula. TiDB no permite agregar una columna y usarla (índice,
// llave foránea) dentro del mismo ALTER, y las migraciones no se editan.

/** Parte el texto en `separador`, fuera de comillas y paréntesis; quita comentarios. */
function dividir(texto, separador) {
  const partes = [];
  let actual = "";
  let nivel = 0;
  let comilla = null;

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];

    if (comilla) {
      actual += c;
      if (c === "\\" && comilla !== "`") {
        actual += texto[i + 1] ?? "";
        i += 1;
      } else if (c === comilla) {
        comilla = null;
      }
      continue;
    }

    if (c === "-" && texto[i + 1] === "-" && /\s|^$/.test(texto[i + 2] ?? "")) {
      const fin = texto.indexOf("\n", i);
      i = fin === -1 ? texto.length : fin - 1;
      continue;
    }
    if (c === "/" && texto[i + 1] === "*") {
      const fin = texto.indexOf("*/", i + 2);
      i = fin === -1 ? texto.length : fin + 1;
      continue;
    }

    if (c === "'" || c === '"' || c === "`") comilla = c;
    else if (c === "(") nivel += 1;
    else if (c === ")") nivel -= 1;

    if (c === separador && nivel === 0) {
      partes.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  partes.push(actual);
  return partes.map((parte) => parte.trim()).filter(Boolean);
}

export function sentenciasPorClausula(sql) {
  return dividir(sql, ";").flatMap((sentencia) => {
    const alter = /^(ALTER\s+TABLE\s+\S+)\s+([\s\S]+)$/i.exec(sentencia);
    if (!alter) return [sentencia];
    const encabezado = alter[1].replace(/\s+/g, " ");
    return dividir(alter[2], ",").map((clausula) => `${encabezado} ${clausula}`);
  });
}
