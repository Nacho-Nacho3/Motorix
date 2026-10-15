-- T005: libro de movimientos de inventario (Sprint 3, data-model.md, FR-012).
-- Catálogo cerrado de tipos (Q2): IN (reposición de ADMIN), OUT (salida
-- automatica al usar la refaccion en una orden, RN-6/RN-7) y ADJUSTMENT
-- (correccion con signo y motivo, solo ADMIN).
-- order_id solo se llena en el OUT por uso en orden; created_by es obligatorio
-- (auditoria: ADMIN en IN/ADJUSTMENT, mecanico en OUT automatico).
-- Sin borrado: es un libro de auditoria (FR-015, VI-06).
CREATE TABLE IF NOT EXISTS inventory_movements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  part_id INT UNSIGNED NOT NULL,
  movement_type ENUM('IN','OUT','ADJUSTMENT') NOT NULL,
  quantity INT NOT NULL,
  order_id INT UNSIGNED NULL,
  reason VARCHAR(200) NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_movements_part_id (part_id),
  KEY idx_inventory_movements_part_created (part_id, created_at),
  KEY idx_inventory_movements_order_id (order_id),
  CONSTRAINT chk_inventory_movements_quantity CHECK (quantity != 0),
  CONSTRAINT fk_inventory_movements_part FOREIGN KEY (part_id) REFERENCES parts (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_inventory_movements_order FOREIGN KEY (order_id) REFERENCES service_orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_inventory_movements_created_by FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
