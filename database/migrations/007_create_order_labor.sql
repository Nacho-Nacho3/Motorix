-- T053: tabla de mano de obra por orden (US5, FR-014, CA-4).
-- hours > 0 y ≤ 999.99 se validan en el backend (VS-06); sin totales.
CREATE TABLE IF NOT EXISTS order_labor (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  concept VARCHAR(200) NOT NULL,
  hours DECIMAL(6,2) NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_labor_order_id (order_id),
  CONSTRAINT fk_order_labor_order FOREIGN KEY (order_id) REFERENCES service_orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
