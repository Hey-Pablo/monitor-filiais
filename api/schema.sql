CREATE TABLE IF NOT EXISTS filiais (
  id text PRIMARY KEY,
  nome text NOT NULL,
  token_hash text NOT NULL,
  criada_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS batimentos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filial_id text NOT NULL REFERENCES filiais(id),
  recebido_em timestamptz NOT NULL,
  dados jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS batimentos_filial_tempo ON batimentos (filial_id, recebido_em);
CREATE TABLE IF NOT EXISTS incidentes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filial_id text NOT NULL REFERENCES filiais(id),
  tipo text NOT NULL,
  aberto_em timestamptz NOT NULL,
  fechado_em timestamptz,
  CHECK (fechado_em IS NULL OR fechado_em >= aberto_em)
);
CREATE UNIQUE INDEX IF NOT EXISTS incidente_aberto_unico ON incidentes (filial_id, tipo) WHERE fechado_em IS NULL;
CREATE TABLE IF NOT EXISTS notificacoes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incidente_id bigint NOT NULL REFERENCES incidentes(id),
  evento text NOT NULL CHECK (evento IN ('abertura', 'normalizacao')),
  criada_em timestamptz NOT NULL DEFAULT now(),
  enviada_em timestamptz,
  UNIQUE (incidente_id, evento)
);
CREATE TABLE IF NOT EXISTS acessos_invalidos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  filial_id text,
  ocorrido_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS resumo_horario (
  filial_id text NOT NULL REFERENCES filiais(id),
  hora timestamptz NOT NULL,
  quantidade integer NOT NULL,
  cpu_media numeric,
  memoria_media numeric,
  disco_minimo numeric,
  PRIMARY KEY (filial_id, hora)
);
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS tentada_em timestamptz;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS falhou boolean NOT NULL DEFAULT false;
