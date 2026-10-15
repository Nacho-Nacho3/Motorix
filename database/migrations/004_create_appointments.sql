-- T003: tabla de citas (Appointment de data-model.md, Sprint 2).
-- Cliente y vehículo obligatorios (VA-02): FK con ON DELETE RESTRICT y
-- validación de propiedad VEHICLE_CLIENT_MISMATCH en el backend (VA-03).
-- Sin appointment_id relacionado: las citas no se vinculan con órdenes (Q3).
CREATE TABLE IF NOT EXISTS appointments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL,
  vehicle_id INT UNSIGNED NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  reason VARCHAR(150) NOT NULL,
  notes VARCHAR(500) NULL,
  status ENUM('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_appointments_client_id (client_id),
  KEY idx_appointments_vehicle_id (vehicle_id),
  KEY idx_appointments_status (status),
  KEY idx_appointments_date_time (appointment_date, appointment_time),
  CONSTRAINT fk_appointments_client FOREIGN KEY (client_id) REFERENCES clients (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appointments_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
