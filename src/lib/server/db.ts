import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS equipamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  numero_serie TEXT NOT NULL UNIQUE,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  orgao TEXT NOT NULL,
  status TEXT NOT NULL,
  cep TEXT NOT NULL,
  bairro TEXT NOT NULL,
  regiao TEXT NOT NULL,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  logradouro TEXT NOT NULL,
  referencia TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  manutencao_tipo TEXT NOT NULL DEFAULT 'periodica',
  manutencao_proxima TEXT,
  ultima_manutencao TEXT,
  instalado_em TEXT,
  atributos TEXT NOT NULL DEFAULT '{}',
  telemetria TEXT NOT NULL DEFAULT '{}',
  ultimo_sinal TEXT,
  observacoes TEXT NOT NULL DEFAULT '',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_equip_status ON equipamentos(status);
CREATE INDEX IF NOT EXISTS ix_equip_regiao ON equipamentos(regiao);

CREATE TABLE IF NOT EXISTS agentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  matricula TEXT NOT NULL UNIQUE,
  funcao TEXT NOT NULL,
  orgao TEXT NOT NULL,
  status TEXT NOT NULL,
  turno TEXT NOT NULL,
  telefone TEXT NOT NULL DEFAULT '',
  bairro_base TEXT NOT NULL,
  regiao TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  equipamento_id INTEGER REFERENCES equipamentos(id) ON DELETE SET NULL,
  ocorrencia_id INTEGER,
  ultima_atualizacao TEXT NOT NULL,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ocorrencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  gravidade INTEGER NOT NULL,
  bairro TEXT NOT NULL,
  regiao TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  inicio TEXT NOT NULL,
  fim TEXT,
  origem TEXT NOT NULL,
  equipamento_id INTEGER,
  agente_id INTEGER,
  descricao TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_ocorr_inicio ON ocorrencias(inicio);
CREATE INDEX IF NOT EXISTS ix_ocorr_aberta ON ocorrencias(fim);

-- Histórico de mudanças de situação: base para disponibilidade ao longo do tempo e MTBF.
CREATE TABLE IF NOT EXISTS eventos_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipamento_id INTEGER NOT NULL,
  de TEXT,
  para TEXT NOT NULL,
  em TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_evst_equip ON eventos_status(equipamento_id, em);
CREATE INDEX IF NOT EXISTS ix_evst_em ON eventos_status(em);

-- Fluxo de veículos por hora medido pelos radares (telemetria agregada).
CREATE TABLE IF NOT EXISTS leituras (
  equipamento_id INTEGER NOT NULL,
  hora TEXT NOT NULL,
  fluxo INTEGER NOT NULL,
  PRIMARY KEY (equipamento_id, hora)
);

CREATE TABLE IF NOT EXISTS alertas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nivel TEXT NOT NULL,
  categoria TEXT NOT NULL,
  chave TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  equipamento_id INTEGER,
  agente_id INTEGER,
  ocorrencia_id INTEGER,
  bairro TEXT,
  regiao TEXT,
  criado_em TEXT NOT NULL,
  reconhecido_em TEXT
);
CREATE INDEX IF NOT EXISTS ix_alerta_aberto ON alertas(reconhecido_em, chave);

CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
`;

export type DB = Database.Database;

const globalParaDb = globalThis as unknown as { __fogoDb?: DB };

export function caminhoBanco() {
  return process.env.FOGO_DB ?? path.join(process.cwd(), 'data', 'fogo.db');
}

/** Conexão única por processo (sobrevive ao hot reload do `next dev`). */
export function getDb(): DB {
  if (globalParaDb.__fogoDb) return globalParaDb.__fogoDb;
  const arquivo = caminhoBanco();
  if (arquivo !== ':memory:') fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const db = new Database(arquivo);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  globalParaDb.__fogoDb = db;
  return db;
}

export function bancoVazio(db: DB = getDb()) {
  const r = db.prepare('SELECT COUNT(*) AS n FROM equipamentos').get() as { n: number };
  return r.n === 0;
}

export function limparBanco(db: DB = getDb()) {
  db.exec(`
    DELETE FROM alertas; DELETE FROM leituras; DELETE FROM eventos_status; DELETE FROM ocorrencias;
    DELETE FROM agentes; DELETE FROM equipamentos; DELETE FROM meta;
    DELETE FROM sqlite_sequence;
  `);
}
