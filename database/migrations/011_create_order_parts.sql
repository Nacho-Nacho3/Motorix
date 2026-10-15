-- T006: refacciones utilizadas en una orden (Sprint 3, data-model.md, FR-010).
-- Filas multiples por orden sin unicidad (R-06): cada agregado es un evento con
-- su propia salida OUT; repetir la misma refaccion crea otra fila.
-- quantity > 0 se valida en el backend (VO-02) y aqui con CHECK.
-- created_by: el mecanico que la agrego (Q5). Sin DELETE (R-06).
CREATE TABLE IF NOT EXISTS order_parts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  part_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_parts_order_id (order_id),
  KEY idx_order_parts_part_id (part_id),
  CONSTRAINT chk_order_parts_quantity CHECK (quantity > 0),
  CONSTRAINT fk_order_parts_order FOREIGN KEY (order_id) REFERENCES service_orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_order_parts_part FOREIGN KEY (part_id) REFERENCES parts (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_order_parts_created_by FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
