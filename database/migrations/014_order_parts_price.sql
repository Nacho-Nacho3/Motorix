-- T004: precio de venta guardado en cada linea de refaccion y correccion
-- administrativa de precio (Sprint 5, data-model.md, FR-003 y FR-002).
-- unit_price: precio de venta de la refaccion AL MOMENTO de agregarla a la
-- orden (instantanea D-01/D-03): el total y el ticket leen esta columna y ya
-- no dependen del precio vigente del catalogo. Se hace backfill con el precio
-- vigente de `parts` para las lineas existentes (D-03).
-- price_correction_*: correccion administrativa de precio con motivo obligatorio
-- (D-05): unico MUTATE admitido sobre order_parts; sigue sin DELETE (R-06).
-- Tope $99,999.99 en precios (D-08), validado en backend y aqui con CHECK.
ALTER TABLE order_parts
  ADD COLUMN unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN price_correction_reason VARCHAR(200) NULL,
  ADD COLUMN price_corrected_by INT UNSIGNED NULL,
  ADD COLUMN price_corrected_at DATETIME NULL;

-- Backfill (D-03): las lineas que existen antes de este sprint reciben el
-- precio vigente de su refaccion; el CHECK de tope se anade despues para no
-- frenar la carga si hubiera datos previos a corregir.
UPDATE order_parts op
  JOIN parts p ON p.id = op.part_id
  SET op.unit_price = p.sale_price;

ALTER TABLE order_parts
  ADD CONSTRAINT chk_order_parts_unit_price
    CHECK (unit_price >= 0 AND unit_price <= 99999.99),
  ADD CONSTRAINT fk_order_parts_price_corrected_by
    FOREIGN KEY (price_corrected_by) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tope $99,999.99 sobre los precios del catalogo (D-08); los CHECK de >= 0 ya
-- existen en 009 y se mantienen.
ALTER TABLE parts
  ADD CONSTRAINT chk_parts_purchase_price_max
    CHECK (purchase_price <= 99999.99),
  ADD CONSTRAINT chk_parts_sale_price_max
    CHECK (sale_price <= 99999.99);
