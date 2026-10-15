-- T044: tabla de vehículos (modelo Vehicle de data-model.md).
-- Propietario obligatorio (RN-1): FK a clients.id con ON DELETE RESTRICT.
-- license_plate único (VV-02); vin único solo si se captura (VV-03, permite NULL).
CREATE TABLE IF NOT EXISTS vehicles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL,
  brand VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  year SMALLINT NOT NULL,
  license_plate VARCHAR(20) NOT NULL,
  vin VARCHAR(20) NULL,
  current_mileage INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vehicles_license_plate (license_plate),
  UNIQUE KEY uq_vehicles_vin (vin),
  KEY idx_vehicles_client_id (client_id),
  CONSTRAINT fk_vehicles_client FOREIGN KEY (client_id) REFERENCES clients (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
