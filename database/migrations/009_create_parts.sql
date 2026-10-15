-- T004: catálogo de refacciones (Sprint 3, data-model.md, FR-008).
-- part_code unico: un codigo repetido responde 400 PART_CODE_DUPLICATED.
-- stock_current es el saldo autoritativo con CHECK >= 0 (RN-8, Q1): ninguna
-- operacion lo baja de cero. Sin borrado (FR-015): no hay columna logica ni
-- endpoint DELETE.
CREATE TABLE IF NOT EXISTS parts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  part_code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  brand VARCHAR(50) NULL,
  stock_current INT NOT NULL DEFAULT 0,
  stock_min INT UNSIGNED NOT NULL,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  sale_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_parts_part_code (part_code),
  KEY idx_parts_stock_current (stock_current),
  CONSTRAINT chk_parts_stock_current CHECK (stock_current >= 0),
  CONSTRAINT chk_parts_stock_min CHECK (stock_min >= 0),
  CONSTRAINT chk_parts_purchase_price CHECK (purchase_price >= 0),
  CONSTRAINT chk_parts_sale_price CHECK (sale_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
