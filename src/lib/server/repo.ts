// Acesso ao banco: converte linhas (snake_case) em objetos de domínio (camelCase)
// e concentra as escritas que precisam gerar histórico (mudança de situação).
import { BAIRROS, type StatusAgente, type StatusEquipamento } from '@/lib/catalog';
import type { Agente, AgenteEntrada, Alerta, Equipamento, EquipamentoEntrada, NivelAlerta, Ocorrencia } from '@/lib/types';
import { getDb } from './db';
import { agoraISO } from './util';

type Linha = Record<string, unknown>;

const json = (v: unknown) => {
  try {
    return typeof v === 'string' ? JSON.parse(v) : {};
  } catch {
    return {};
  }
};

export const regiaoDoBairro = (bairro: string) => BAIRROS.find((b) => b.nome === bairro)?.regiao ?? 'centro';

export function linhaParaEquipamento(r: Linha): Equipamento {
  return {
    id: r.id as number,
    tipo: r.tipo as string,
    numeroSerie: r.numero_serie as string,
    marca: r.marca as string,
    modelo: r.modelo as string,
    orgao: r.orgao as string,
    status: r.status as StatusEquipamento,
    cep: r.cep as string,
    bairro: r.bairro as string,
    regiao: r.regiao as string,
    cidade: r.cidade as string,
    uf: r.uf as string,
    logradouro: r.logradouro as string,
    referencia: r.referencia as string,
    lat: r.lat as number,
    lng: r.lng as number,
    manutencaoTipo: r.manutencao_tipo as Equipamento['manutencaoTipo'],
    manutencaoProxima: (r.manutencao_proxima as string) ?? null,
    ultimaManutencao: (r.ultima_manutencao as string) ?? null,
    instaladoEm: (r.instalado_em as string) ?? null,
    atributos: json(r.atributos),
    telemetria: json(r.telemetria),
    ultimoSinal: (r.ultimo_sinal as string) ?? null,
    observacoes: (r.observacoes as string) ?? '',
    criadoEm: r.criado_em as string,
    atualizadoEm: r.atualizado_em as string,
  };
}

export function linhaParaAgente(r: Linha): Agente {
  return {
    id: r.id as number,
    nome: r.nome as string,
    matricula: r.matricula as string,
    funcao: r.funcao as string,
    orgao: r.orgao as string,
    status: r.status as StatusAgente,
    turno: r.turno as Agente['turno'],
    telefone: r.telefone as string,
    bairroBase: r.bairro_base as string,
    regiao: r.regiao as string,
    lat: r.lat as number,
    lng: r.lng as number,
    equipamentoId: (r.equipamento_id as number) ?? null,
    ocorrenciaId: (r.ocorrencia_id as number) ?? null,
    ultimaAtualizacao: r.ultima_atualizacao as string,
    criadoEm: r.criado_em as string,
  };
}

export function linhaParaOcorrencia(r: Linha): Ocorrencia {
  return {
    id: r.id as number,
    tipo: r.tipo as string,
    gravidade: r.gravidade as Ocorrencia['gravidade'],
    bairro: r.bairro as string,
    regiao: r.regiao as string,
    lat: r.lat as number,
    lng: r.lng as number,
    inicio: r.inicio as string,
    fim: (r.fim as string) ?? null,
    origem: r.origem as Ocorrencia['origem'],
    equipamentoId: (r.equipamento_id as number) ?? null,
    agenteId: (r.agente_id as number) ?? null,
    descricao: r.descricao as string,
  };
}

export function linhaParaAlerta(r: Linha): Alerta {
  return {
    id: r.id as number,
    nivel: r.nivel as NivelAlerta,
    categoria: r.categoria as string,
    titulo: r.titulo as string,
    descricao: r.descricao as string,
    equipamentoId: (r.equipamento_id as number) ?? null,
    agenteId: (r.agente_id as number) ?? null,
    ocorrenciaId: (r.ocorrencia_id as number) ?? null,
    bairro: (r.bairro as string) ?? null,
    regiao: (r.regiao as string) ?? null,
    criadoEm: r.criado_em as string,
    reconhecidoEm: (r.reconhecido_em as string) ?? null,
  };
}

// ---------------------------------------------------------------- equipamentos

export interface FiltroEquipamentos {
  tipo?: string[];
  status?: string[];
  regiao?: string[];
  bairro?: string[];
  orgao?: string[];
  busca?: string;
}

export function listarEquipamentos(f: FiltroEquipamentos = {}): Equipamento[] {
  const onde: string[] = [];
  const params: unknown[] = [];
  const lista = (coluna: string, valores?: string[]) => {
    if (valores?.length) {
      onde.push(`${coluna} IN (${valores.map(() => '?').join(',')})`);
      params.push(...valores);
    }
  };
  lista('tipo', f.tipo);
  lista('status', f.status);
  lista('regiao', f.regiao);
  lista('bairro', f.bairro);
  lista('orgao', f.orgao);
  if (f.busca) {
    onde.push('(numero_serie LIKE ? OR marca LIKE ? OR modelo LIKE ? OR logradouro LIKE ? OR bairro LIKE ?)');
    const b = `%${f.busca}%`;
    params.push(b, b, b, b, b);
  }
  const sql = `SELECT * FROM equipamentos ${onde.length ? 'WHERE ' + onde.join(' AND ') : ''} ORDER BY id`;
  return (getDb().prepare(sql).all(...params) as Linha[]).map(linhaParaEquipamento);
}

export function obterEquipamento(id: number): Equipamento | null {
  const r = getDb().prepare('SELECT * FROM equipamentos WHERE id = ?').get(id) as Linha | undefined;
  return r ? linhaParaEquipamento(r) : null;
}

export function numeroSerieEmUso(numeroSerie: string, ignorarId?: number) {
  const r = getDb()
    .prepare('SELECT id FROM equipamentos WHERE numero_serie = ? AND id IS NOT ?')
    .get(numeroSerie, ignorarId ?? null) as Linha | undefined;
  return Boolean(r);
}

export function inserirEquipamento(e: EquipamentoEntrada, quando = agoraISO(), extras: { telemetria?: object; ultimoSinal?: string | null } = {}) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO equipamentos (tipo, numero_serie, marca, modelo, orgao, status, cep, bairro, regiao, cidade, uf,
        logradouro, referencia, lat, lng, manutencao_tipo, manutencao_proxima, ultima_manutencao, instalado_em,
        atributos, telemetria, ultimo_sinal, observacoes, criado_em, atualizado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      e.tipo, e.numeroSerie, e.marca, e.modelo, e.orgao, e.status, e.cep, e.bairro, regiaoDoBairro(e.bairro), e.cidade, e.uf,
      e.logradouro, e.referencia, e.lat, e.lng, e.manutencaoTipo, e.manutencaoProxima, e.ultimaManutencao, e.instaladoEm,
      JSON.stringify(e.atributos ?? {}), JSON.stringify(extras.telemetria ?? {}),
      extras.ultimoSinal ?? (e.status === 'operacional' ? quando : null), e.observacoes ?? '', quando, quando,
    );
  const id = Number(info.lastInsertRowid);
  registrarEventoStatus(id, null, e.status, quando, 'cadastro');
  return id;
}

export function atualizarEquipamento(id: number, e: EquipamentoEntrada) {
  const atual = obterEquipamento(id);
  if (!atual) return null;
  const agora = agoraISO();
  getDb()
    .prepare(
      `UPDATE equipamentos SET tipo=?, numero_serie=?, marca=?, modelo=?, orgao=?, status=?, cep=?, bairro=?, regiao=?,
        cidade=?, uf=?, logradouro=?, referencia=?, lat=?, lng=?, manutencao_tipo=?, manutencao_proxima=?,
        ultima_manutencao=?, instalado_em=?, atributos=?, observacoes=?, atualizado_em=? WHERE id=?`,
    )
    .run(
      e.tipo, e.numeroSerie, e.marca, e.modelo, e.orgao, e.status, e.cep, e.bairro, regiaoDoBairro(e.bairro), e.cidade, e.uf,
      e.logradouro, e.referencia, e.lat, e.lng, e.manutencaoTipo, e.manutencaoProxima, e.ultimaManutencao, e.instaladoEm,
      JSON.stringify(e.atributos ?? {}), e.observacoes ?? '', agora, id,
    );
  if (atual.status !== e.status) registrarEventoStatus(id, atual.status, e.status, agora, 'edição manual');
  return obterEquipamento(id);
}

export function removerEquipamento(id: number) {
  const db = getDb();
  db.prepare('UPDATE agentes SET equipamento_id = NULL WHERE equipamento_id = ?').run(id);
  db.prepare('DELETE FROM leituras WHERE equipamento_id = ?').run(id);
  return db.prepare('DELETE FROM equipamentos WHERE id = ?').run(id).changes > 0;
}

export function registrarEventoStatus(id: number, de: string | null, para: string, em: string, motivo: string) {
  getDb().prepare('INSERT INTO eventos_status (equipamento_id, de, para, em, motivo) VALUES (?,?,?,?,?)').run(id, de, para, em, motivo);
}

/** Muda a situação, grava o histórico e ajusta a necessidade de manutenção. */
export function mudarStatusEquipamento(id: number, para: StatusEquipamento, motivo: string, quando = agoraISO()) {
  const atual = obterEquipamento(id);
  if (!atual || atual.status === para) return atual;
  const manut =
    para === 'mau_funcionamento' || para === 'furtado'
      ? { tipo: 'imediata', proxima: quando.slice(0, 10) }
      : para === 'operacional' && atual.manutencaoTipo === 'imediata'
        ? { tipo: 'periodica', proxima: atual.manutencaoProxima }
        : { tipo: atual.manutencaoTipo, proxima: atual.manutencaoProxima };
  getDb()
    .prepare('UPDATE equipamentos SET status=?, manutencao_tipo=?, manutencao_proxima=?, atualizado_em=?, ultimo_sinal=COALESCE(?, ultimo_sinal) WHERE id=?')
    .run(para, manut.tipo, manut.proxima, quando, para === 'operacional' ? quando : null, id);
  registrarEventoStatus(id, atual.status, para, quando, motivo);
  return obterEquipamento(id);
}

/** Registra manutenção concluída: volta a operar e agenda a próxima pelo intervalo do tipo. */
export function concluirManutencao(id: number, intervaloDias: number) {
  const atual = obterEquipamento(id);
  if (!atual) return null;
  const agora = agoraISO();
  const hoje = agora.slice(0, 10);
  const proxima = new Date(Date.now() + intervaloDias * 86400000).toISOString().slice(0, 10);
  getDb()
    .prepare(`UPDATE equipamentos SET ultima_manutencao=?, manutencao_proxima=?, manutencao_tipo='periodica', atualizado_em=? WHERE id=?`)
    .run(hoje, proxima, agora, id);
  if (['mau_funcionamento', 'em_manutencao'].includes(atual.status)) mudarStatusEquipamento(id, 'operacional', 'manutenção concluída', agora);
  return obterEquipamento(id);
}

export function atualizarTelemetria(id: number, telemetria: object, quando: string, pos?: { lat: number; lng: number }) {
  if (pos) {
    getDb().prepare('UPDATE equipamentos SET telemetria=?, ultimo_sinal=?, lat=?, lng=? WHERE id=?').run(JSON.stringify(telemetria), quando, pos.lat, pos.lng, id);
  } else {
    getDb().prepare('UPDATE equipamentos SET telemetria=?, ultimo_sinal=? WHERE id=?').run(JSON.stringify(telemetria), quando, id);
  }
}

// ---------------------------------------------------------------- agentes

export function listarAgentes(f: { regiao?: string[]; status?: string[]; funcao?: string[]; busca?: string } = {}): Agente[] {
  const onde: string[] = [];
  const params: unknown[] = [];
  for (const [col, vals] of [['regiao', f.regiao], ['status', f.status], ['funcao', f.funcao]] as const) {
    if (vals?.length) {
      onde.push(`${col} IN (${vals.map(() => '?').join(',')})`);
      params.push(...vals);
    }
  }
  if (f.busca) {
    onde.push('(nome LIKE ? OR matricula LIKE ?)');
    params.push(`%${f.busca}%`, `%${f.busca}%`);
  }
  const sql = `SELECT * FROM agentes ${onde.length ? 'WHERE ' + onde.join(' AND ') : ''} ORDER BY nome`;
  return (getDb().prepare(sql).all(...params) as Linha[]).map(linhaParaAgente);
}

export function obterAgente(id: number): Agente | null {
  const r = getDb().prepare('SELECT * FROM agentes WHERE id = ?').get(id) as Linha | undefined;
  return r ? linhaParaAgente(r) : null;
}

export function matriculaEmUso(matricula: string, ignorarId?: number) {
  return Boolean(getDb().prepare('SELECT id FROM agentes WHERE matricula = ? AND id IS NOT ?').get(matricula, ignorarId ?? null));
}

export function inserirAgente(a: AgenteEntrada, quando = agoraISO()) {
  const info = getDb()
    .prepare(
      `INSERT INTO agentes (nome, matricula, funcao, orgao, status, turno, telefone, bairro_base, regiao, lat, lng,
        equipamento_id, ultima_atualizacao, criado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(a.nome, a.matricula, a.funcao, a.orgao, a.status, a.turno, a.telefone, a.bairroBase, regiaoDoBairro(a.bairroBase), a.lat, a.lng, a.equipamentoId, quando, quando);
  return Number(info.lastInsertRowid);
}

export function atualizarAgente(id: number, a: AgenteEntrada) {
  getDb()
    .prepare(
      `UPDATE agentes SET nome=?, matricula=?, funcao=?, orgao=?, status=?, turno=?, telefone=?, bairro_base=?, regiao=?,
        lat=?, lng=?, equipamento_id=?, ultima_atualizacao=? WHERE id=?`,
    )
    .run(a.nome, a.matricula, a.funcao, a.orgao, a.status, a.turno, a.telefone, a.bairroBase, regiaoDoBairro(a.bairroBase), a.lat, a.lng, a.equipamentoId, agoraISO(), id);
  return obterAgente(id);
}

export function removerAgente(id: number) {
  return getDb().prepare('DELETE FROM agentes WHERE id = ?').run(id).changes > 0;
}

export function moverAgente(id: number, lat: number, lng: number, status: StatusAgente, ocorrenciaId: number | null, quando = agoraISO()) {
  getDb().prepare('UPDATE agentes SET lat=?, lng=?, status=?, ocorrencia_id=?, ultima_atualizacao=? WHERE id=?').run(lat, lng, status, ocorrenciaId, quando, id);
}

// ---------------------------------------------------------------- ocorrências

export function listarOcorrencias(f: { ativas?: boolean; desde?: string; limite?: number } = {}): Ocorrencia[] {
  const onde: string[] = [];
  const params: unknown[] = [];
  if (f.ativas) onde.push('fim IS NULL');
  if (f.desde) {
    onde.push('inicio >= ?');
    params.push(f.desde);
  }
  const sql = `SELECT * FROM ocorrencias ${onde.length ? 'WHERE ' + onde.join(' AND ') : ''} ORDER BY inicio DESC LIMIT ?`;
  return (getDb().prepare(sql).all(...params, f.limite ?? 500) as Linha[]).map(linhaParaOcorrencia);
}

export function inserirOcorrencia(o: Omit<Ocorrencia, 'id'>) {
  const info = getDb()
    .prepare(
      `INSERT INTO ocorrencias (tipo, gravidade, bairro, regiao, lat, lng, inicio, fim, origem, equipamento_id, agente_id, descricao)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(o.tipo, o.gravidade, o.bairro, o.regiao, o.lat, o.lng, o.inicio, o.fim, o.origem, o.equipamentoId, o.agenteId, o.descricao);
  return Number(info.lastInsertRowid);
}

export function obterOcorrencia(id: number) {
  const r = getDb().prepare('SELECT * FROM ocorrencias WHERE id = ?').get(id) as Linha | undefined;
  return r ? linhaParaOcorrencia(r) : null;
}

export function encerrarOcorrencia(id: number, quando = agoraISO()) {
  getDb().prepare('UPDATE ocorrencias SET fim = ? WHERE id = ? AND fim IS NULL').run(quando, id);
  return obterOcorrencia(id);
}

export function atribuirAgenteOcorrencia(ocorrenciaId: number, agenteId: number | null) {
  getDb().prepare('UPDATE ocorrencias SET agente_id = ? WHERE id = ?').run(agenteId, ocorrenciaId);
}

// ---------------------------------------------------------------- alertas

export function listarAlertas(f: { abertos?: boolean; limite?: number } = {}): Alerta[] {
  const sql = `SELECT * FROM alertas ${f.abertos ? 'WHERE reconhecido_em IS NULL' : ''}
    ORDER BY CASE nivel WHEN 'critico' THEN 0 WHEN 'alto' THEN 1 WHEN 'medio' THEN 2 ELSE 3 END, criado_em DESC LIMIT ?`;
  return (getDb().prepare(sql).all(f.limite ?? 200) as Linha[]).map(linhaParaAlerta);
}

export interface NovoAlerta {
  nivel: NivelAlerta;
  categoria: string;
  /** Identifica o problema: enquanto houver um alerta aberto com a mesma chave, não se cria outro. */
  chave: string;
  titulo: string;
  descricao: string;
  equipamentoId?: number | null;
  agenteId?: number | null;
  ocorrenciaId?: number | null;
  bairro?: string | null;
  regiao?: string | null;
}

/** Cria o alerta se não existir um aberto com a mesma chave. Devolve o novo alerta ou null. */
export function abrirAlerta(a: NovoAlerta, quando = agoraISO()): Alerta | null {
  const db = getDb();
  const existe = db.prepare('SELECT id FROM alertas WHERE chave = ? AND reconhecido_em IS NULL').get(a.chave);
  if (existe) return null;
  const info = db
    .prepare(
      `INSERT INTO alertas (nivel, categoria, chave, titulo, descricao, equipamento_id, agente_id, ocorrencia_id, bairro, regiao, criado_em)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(a.nivel, a.categoria, a.chave, a.titulo, a.descricao, a.equipamentoId ?? null, a.agenteId ?? null, a.ocorrenciaId ?? null, a.bairro ?? null, a.regiao ?? null, quando);
  return linhaParaAlerta(db.prepare('SELECT * FROM alertas WHERE id = ?').get(info.lastInsertRowid) as Linha);
}

export function reconhecerAlerta(id: number) {
  const db = getDb();
  db.prepare('UPDATE alertas SET reconhecido_em = ? WHERE id = ? AND reconhecido_em IS NULL').run(agoraISO(), id);
  const r = db.prepare('SELECT * FROM alertas WHERE id = ?').get(id) as Linha | undefined;
  return r ? linhaParaAlerta(r) : null;
}

/** Fecha automaticamente alertas cuja causa deixou de existir (ex.: equipamento voltou a operar). */
export function resolverAlertasPorChave(chave: string) {
  const db = getDb();
  const ids = (db.prepare('SELECT id FROM alertas WHERE chave = ? AND reconhecido_em IS NULL').all(chave) as { id: number }[]).map((r) => r.id);
  if (ids.length) db.prepare('UPDATE alertas SET reconhecido_em = ? WHERE chave = ? AND reconhecido_em IS NULL').run(agoraISO(), chave);
  return ids;
}
