-- 效能優化：為所有未建索引的單欄外鍵自動補上索引。idempotent，可安全重跑。
DO $$
DECLARE r record; v_idx text;
BEGIN
  FOR r IN
    SELECT con.conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attnum = ANY(con.conkey)
    JOIN pg_namespace n ON n.oid=con.connamespace
    WHERE con.contype='f' AND n.nspname='public' AND array_length(con.conkey,1)=1
      AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=con.conrelid AND i.indkey[0]=a.attnum)
  LOOP
    v_idx := 'idx_'||replace(r.tbl,'public.','')||'_'||r.col;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%s (%I)', v_idx, r.tbl, r.col);
  END LOOP;
END $$;
