// Ejecutado por Jest ANTES de importar cualquier módulo (T017):
// redirige la aplicación a la base de pruebas NUNCA a la principal.
process.env.DB_NAME = process.env.DB_TEST_NAME || "motorix_test";
