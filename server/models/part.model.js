import { pool } from "../config/db.js";

// T044: catálogo de refacciones (FR-008, FR-009). El stock actual solo lo
// mueven los movimientos (R-05); sin borrado (FR-015): no hay DELETE.

const DECIMAL = (valor) => (valor == null ? null : Number(valor).toFixed(2));

/** Fila → objeto refacción del contrato inventory.md (lowStock calculado). */
export function aParte(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    partCode: fila.partCode,
    name: fila.name,
    category: fila.category,
    brand: fila.brand,
    stockCurrent: fila.stockCurrent,
    stockMin: fila.stockMin,
    purchasePrice: DECIMAL(fila.purchasePrice),
    salePrice: DECIMAL(fila.salePrice),
    lowStock: fila.stockCurrent <= fila.stockMin,
    updatedAt: fila.updatedAt ? fila.updatedAt.replace(" ", "T") : null,
  };
}

/**
 * Inserta la refacción. Acepta una conexión para participar en la
 * transacción del alta (T046); por defecto usa el pool.
 */
export async function crear(
  { partCode, name, category, brand, stockCurrent, stockMin, purchasePrice, salePrice },
  conexion = pool,
) {
  const [resultado] = await conexion.query(
    `INSERT INTO parts
       (part_code, name, category, brand, stock_current, stock_min,
        purchase_price, sale_price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      partCode,
      name,
      category,
      brand ?? null,
      stockCurrent ?? 0,
      stockMin,
      purchasePrice ?? 0,
      salePrice ?? 0,
    ],
  );
  return resultado.insertId;
}

export async function buscarPorId(id) {
  const [filas] = await pool.query(
    "SELECT id, part_code AS partCode, name, category, brand, stock_current AS stockCurrent, stock_min AS stockMin, purchase_price AS purchasePrice, sale_price AS salePrice, updated_at AS updatedAt FROM parts WHERE id = ? LIMIT 1",
    [id],
  );
  return aParte(filas[0]);
}

export async function buscarPorCodigo(partCode) {
  const [filas] = await pool.query(
    "SELECT id, part_code AS partCode, name, category, brand, stock_current AS stockCurrent, stock_min AS stockMin, purchase_price AS purchasePrice, sale_price AS salePrice, updated_at AS updatedAt FROM parts WHERE part_code = ? LIMIT 1",
    [partCode],
  );
  return aParte(filas[0]);
}

/**
 * Listado con los filtros del contrato: `q` contra código, nombre o
 * categoría y `low` para solo stock bajo. El contrato no expone
 * paginación: el catálogo se devuelve completo (total = resultados).
 */
export async function listar({ q, low } = {}) {
  const condiciones = [];
  const parametros = [];

  if (q) {
    const like = `%${q}%`;
    condiciones.push("(part_code LIKE ? OR name LIKE ? OR category LIKE ?)");
    parametros.push(like, like, like);
  }
  if (low) {
    condiciones.push("stock_current <= stock_min");
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
  const [filas] = await pool.query(
    `SELECT id, part_code AS partCode, name, category, brand,
            stock_current AS stockCurrent, stock_min AS stockMin,
            purchase_price AS purchasePrice, sale_price AS salePrice,
            updated_at AS updatedAt
       FROM parts ${where}
      ORDER BY name`,
    parametros,
  );
  return filas.map(aParte);
}

/** Total GLOBAL de refacciones con stock bajo (contador de la interfaz, CA-7). */
export async function contarStockBajo() {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM parts WHERE stock_current <= stock_min",
  );
  return Number(filas[0].total);
}

/** Actualiza solo los campos editables; jamás part_code ni stock_current. */
export async function actualizar(id, campos) {
  const permitidos = {
    name: "name",
    category: "category",
    brand: "brand",
    stockMin: "stock_min",
    purchasePrice: "purchase_price",
    salePrice: "sale_price",
  };

  const columnas = [];
  const valores = [];
  for (const [clave, valor] of Object.entries(campos)) {
    if (valor === undefined || !permitidos[clave]) continue;
    columnas.push(`${permitidos[clave]} = ?`);
    valores.push(valor);
  }

  if (columnas.length > 0) {
    await pool.query(`UPDATE parts SET ${columnas.join(", ")} WHERE id = ?`, [
      ...valores,
      id,
    ]);
  }
  return buscarPorId(id);
}
