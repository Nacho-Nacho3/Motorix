import { sentenciasPorClausula } from "../../utils/sql-statements.js";

// Despliegue: TiDB no admite, en un mismo ALTER TABLE, usar una columna que se
// acaba de agregar; las migraciones son inmutables y se separan al aplicarlas.
describe("Separación de sentencias para TiDB", () => {
  test("un ALTER con varias cláusulas se divide en uno por cláusula y en orden", () => {
    const sql = `ALTER TABLE order_services
      ADD COLUMN service_type_id INT UNSIGNED NULL,
      ADD KEY idx_type (service_type_id),
      ADD CONSTRAINT fk_type FOREIGN KEY (service_type_id)
        REFERENCES service_types (id) ON DELETE RESTRICT;`;

    const sentencias = sentenciasPorClausula(sql);

    expect(sentencias).toHaveLength(3);
    expect(sentencias[0]).toBe(
      "ALTER TABLE order_services ADD COLUMN service_type_id INT UNSIGNED NULL",
    );
    expect(sentencias[1]).toBe("ALTER TABLE order_services ADD KEY idx_type (service_type_id)");
    expect(sentencias[2]).toMatch(/^ALTER TABLE order_services ADD CONSTRAINT fk_type/);
  });

  test("no divide en las comas de paréntesis ni de textos", () => {
    const sql = `ALTER TABLE tickets
      ADD COLUMN precio DECIMAL(10,2) NOT NULL,
      ADD COLUMN nombre VARCHAR(100) NOT NULL DEFAULT 'Motorix, S.A.';`;

    expect(sentenciasPorClausula(sql)).toEqual([
      "ALTER TABLE tickets ADD COLUMN precio DECIMAL(10,2) NOT NULL",
      "ALTER TABLE tickets ADD COLUMN nombre VARCHAR(100) NOT NULL DEFAULT 'Motorix, S.A.'",
    ]);
  });

  test("ignora comentarios con punto y coma o apóstrofos y no toca otras sentencias", () => {
    const sql = `-- comentario; con 'apóstrofo
      CREATE TABLE a (id INT, nota VARCHAR(20) DEFAULT 'x;y');
      /* otro; comentario */
      INSERT INTO a (id, nota) VALUES (1, 'it''s, ok');
      `;

    expect(sentenciasPorClausula(sql)).toEqual([
      "CREATE TABLE a (id INT, nota VARCHAR(20) DEFAULT 'x;y')",
      "INSERT INTO a (id, nota) VALUES (1, 'it''s, ok')",
    ]);
  });
});
