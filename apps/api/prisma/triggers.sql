-- Idempotente: se ejecuta en cada arranque después de `prisma db push`.
CREATE OR REPLACE FUNCTION bitacora_solo_adicion() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora es de solo adición (% no permitido)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bitacora_no_update_delete ON "Bitacora";
CREATE TRIGGER bitacora_no_update_delete
  BEFORE UPDATE OR DELETE ON "Bitacora"
  FOR EACH ROW EXECUTE FUNCTION bitacora_solo_adicion();
