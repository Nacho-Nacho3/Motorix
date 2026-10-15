-- T004: tabla de órdenes de servicio (ServiceOrder de data-model.md, Sprint 2).
-- mechanic_id NOT NULL: asignación manual de recepción/administrador (Q2).
-- waiting_origin recuerda el estado de origen al entrar en WAITING_PART para
-- regresar exactamente a él (Q1, CA-5). Sin retrocesos y sin appointment_id (Q3).
-- RN-9: la orden no tiene borrado ordinario (no existe columna de baja lógica).
CREATE TABLE IF NOT EXISTS service_orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL,
  vehicle_id INT UNSIGNED NOT NULL,
  mechanic_id INT UNSIGNED NOT NULL,
  entry_mileage INT UNSIGNED NOT NULL,
  mileage_correction_reason VARCHAR(200) NULL,
  reported_problem VARCHAR(500) NOT NULL,
  diagnosis VARCHAR(1000) NULL,
  observations VARCHAR(1000) NULL,
  recommendations VARCHAR(1000) NULL,
  status ENUM('RECEIVED','DIAGNOSIS','IN_REPAIR','WAITING_PART','FINISHED','DELIVERED') NOT NULL DEFAULT 'RECEIVED',
  waiting_origin ENUM('DIAGNOSIS','IN_REPAIR') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_service_orders_client_id (client_id),
  KEY idx_service_orders_vehicle_id (vehicle_id),
  KEY idx_service_orders_mechanic_id (mechanic_id),
  KEY idx_service_orders_status (status),
  KEY idx_service_orders_created_at (created_at),
  CONSTRAINT fk_service_orders_client FOREIGN KEY (client_id) REFERENCES clients (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_service_orders_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_service_orders_mechanic FOREIGN KEY (mechanic_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
