-- T052: tabla de servicios realizados por orden (US5, FR-013, CA-4).
-- Se registra lo ejecutado; corregir una fila es borrarla y volver a agregarla
-- (no existe edición de fila). Sin totales ni cálculo de precio en este sprint.
CREATE TABLE IF NOT EXISTS order_services (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  description VARCHAR(200) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_services_order_id (order_id),
  CONSTRAINT fk_order_services_order FOREIGN KEY (order_id) REFERENCES service_orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
