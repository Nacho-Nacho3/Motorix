-- T003: tabla de próximo mantenimiento por vehículo (Sprint 3, data-model.md).
-- UNICO registro vigente por vehículo: registrar otro lo reemplaza (R-03).
-- CHECK: al menos un objetivo, fecha y/o kilometraje (RN-11, Q4).
-- Sin columna de estado: NORMAL/UPCOMING/OVERDUE se calcula en cada lectura
-- (VM-06, R-04) y no existe endpoint de borrado.
CREATE TABLE IF NOT EXISTS maintenance (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vehicle_id INT UNSIGNED NOT NULL,
  next_due_date DATE NULL,
  next_due_mileage INT UNSIGNED NULL,
  warn_days INT UNSIGNED NOT NULL DEFAULT 30,
  warn_km INT UNSIGNED NOT NULL DEFAULT 500,
  recommendations VARCHAR(1000) NULL,
  registered_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_maintenance_vehicle_id (vehicle_id),
  KEY idx_maintenance_next_due_date (next_due_date),
  CONSTRAINT chk_maintenance_target
    CHECK (next_due_date IS NOT NULL OR next_due_mileage IS NOT NULL),
  CONSTRAINT chk_maintenance_next_due_mileage
    CHECK (next_due_mileage IS NULL OR next_due_mileage >= 0),
  CONSTRAINT chk_maintenance_warn_days CHECK (warn_days >= 0),
  CONSTRAINT chk_maintenance_warn_km CHECK (warn_km >= 0),
  CONSTRAINT fk_maintenance_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_maintenance_registered_by FOREIGN KEY (registered_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
