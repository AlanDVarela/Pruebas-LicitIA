import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Valores ficticios: las pruebas unitarias no se conectan a ningún servicio.
    env: { DATABASE_URL: 'postgresql://x:x@localhost:5432/x', JWT_SECRET: 'solo-para-pruebas-unitarias-0000' },
  },
});
