// Validação de cadastros. Pura (sem Node): roda no servidor (fonte da verdade) e no
// formulário (retorno imediato ao usuário).
import {
  BAIRROS, FUNCOES_AGENTE, MANUTENCAO_TIPOS, ORGAOS, STATUS_AGENTE_CODIGOS, STATUS_CODIGOS, TIPOS_POR_CODIGO, TURNOS,
  type AtributoDef,
} from './catalog';
import type { AgenteEntrada, EquipamentoEntrada } from './types';

export type Resultado<T> = { ok: true; dado: T } | { ok: false; campos: Record<string, string> };

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const numero = (v: unknown) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizarCep(cep: string) {
  const d = cep.replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep;
}

function validarAtributo(def: AtributoDef, valor: unknown): { valor?: unknown; erro?: string } {
  const vazio = valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0);
  if (vazio) return def.obrigatorio ? { erro: 'Obrigatório' } : {};
  switch (def.tipo) {
    case 'number': {
      const n = Number(valor);
      if (!Number.isFinite(n)) return { erro: 'Informe um número' };
      if (def.min !== undefined && n < def.min) return { erro: `Mínimo ${def.min}` };
      if (def.max !== undefined && n > def.max) return { erro: `Máximo ${def.max}` };
      return { valor: n };
    }
    case 'bool':
      return { valor: valor === true || valor === 'true' };
    case 'select':
      return def.opcoes?.includes(String(valor)) ? { valor: String(valor) } : { erro: 'Opção inválida' };
    case 'multiselect': {
      const lista = Array.isArray(valor) ? valor.map(String) : [];
      return lista.every((v) => def.opcoes?.includes(v)) ? { valor: lista } : { erro: 'Opção inválida' };
    }
    default:
      return { valor: String(valor).trim() };
  }
}

export function validarEquipamento(corpo: Record<string, unknown>): Resultado<EquipamentoEntrada> {
  const campos: Record<string, string> = {};
  const tipo = texto(corpo.tipo);
  const def = TIPOS_POR_CODIGO[tipo];
  if (!def) campos.tipo = 'Tipo de equipamento inválido';

  const numeroSerie = texto(corpo.numeroSerie).toUpperCase();
  if (numeroSerie.length < 3) campos.numeroSerie = 'Informe o número de série (mín. 3 caracteres)';
  const marca = texto(corpo.marca);
  if (!marca) campos.marca = 'Informe a marca';
  const modelo = texto(corpo.modelo);
  if (!modelo) campos.modelo = 'Informe o modelo';
  const orgao = texto(corpo.orgao) || def?.orgao || '';
  if (!ORGAOS.some((o) => o.codigo === orgao)) campos.orgao = 'Órgão inválido';

  const status = texto(corpo.status) as EquipamentoEntrada['status'];
  if (!STATUS_CODIGOS.includes(status)) campos.status = 'Situação inválida';

  const cep = normalizarCep(texto(corpo.cep));
  if (!/^\d{5}-\d{3}$/.test(cep)) campos.cep = 'CEP no formato 00000-000';
  const bairro = texto(corpo.bairro);
  if (!BAIRROS.some((b) => b.nome === bairro)) campos.bairro = 'Selecione um bairro cadastrado';
  const logradouro = texto(corpo.logradouro);
  if (!logradouro) campos.logradouro = 'Informe a rua/avenida/rodovia';
  const referencia = texto(corpo.referencia);
  if (!referencia) campos.referencia = 'Informe a referência (ex.: "nº 181", "KM 203", "S/N")';

  const lat = numero(corpo.lat);
  const lng = numero(corpo.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) campos.lat = 'Latitude inválida';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) campos.lng = 'Longitude inválida';

  const manutencaoTipo = (texto(corpo.manutencaoTipo) || 'periodica') as EquipamentoEntrada['manutencaoTipo'];
  if (!MANUTENCAO_TIPOS.some((m) => m.codigo === manutencaoTipo)) campos.manutencaoTipo = 'Tipo de manutenção inválido';
  const manutencaoProxima = texto(corpo.manutencaoProxima) || null;
  if (manutencaoProxima && !DATA_RE.test(manutencaoProxima)) campos.manutencaoProxima = 'Data inválida';
  if ((manutencaoTipo === 'agendada' || manutencaoTipo === 'periodica') && !manutencaoProxima)
    campos.manutencaoProxima = 'Informe a data da próxima manutenção';
  const ultimaManutencao = texto(corpo.ultimaManutencao) || null;
  if (ultimaManutencao && !DATA_RE.test(ultimaManutencao)) campos.ultimaManutencao = 'Data inválida';
  const instaladoEm = texto(corpo.instaladoEm) || null;
  if (instaladoEm && !DATA_RE.test(instaladoEm)) campos.instaladoEm = 'Data inválida';
  if (status !== 'nao_instalado' && !instaladoEm) campos.instaladoEm = 'Informe a data de instalação';

  const atributos: Record<string, unknown> = {};
  const brutos = (corpo.atributos ?? {}) as Record<string, unknown>;
  for (const a of def?.atributos ?? []) {
    const r = validarAtributo(a, brutos[a.campo]);
    if (r.erro) campos[`atributos.${a.campo}`] = r.erro;
    else if (r.valor !== undefined) atributos[a.campo] = r.valor;
  }

  if (Object.keys(campos).length) return { ok: false, campos };
  return {
    ok: true,
    dado: {
      tipo, numeroSerie, marca, modelo, orgao, status, cep, bairro,
      cidade: texto(corpo.cidade) || 'Marília', uf: (texto(corpo.uf) || 'SP').toUpperCase(),
      logradouro, referencia, lat, lng, manutencaoTipo, manutencaoProxima, ultimaManutencao, instaladoEm, atributos,
      observacoes: texto(corpo.observacoes),
    },
  };
}

export function validarAgente(corpo: Record<string, unknown>): Resultado<AgenteEntrada> {
  const campos: Record<string, string> = {};
  const nome = texto(corpo.nome);
  if (nome.split(/\s+/).length < 2) campos.nome = 'Informe nome e sobrenome';
  const matricula = texto(corpo.matricula).toUpperCase();
  if (matricula.length < 3) campos.matricula = 'Informe a matrícula';
  const funcao = texto(corpo.funcao);
  const defFuncao = FUNCOES_AGENTE.find((f) => f.codigo === funcao);
  if (!defFuncao) campos.funcao = 'Função inválida';
  const orgao = texto(corpo.orgao) || defFuncao?.orgao || '';
  if (!ORGAOS.some((o) => o.codigo === orgao)) campos.orgao = 'Órgão inválido';
  const status = texto(corpo.status) as AgenteEntrada['status'];
  if (!STATUS_AGENTE_CODIGOS.includes(status)) campos.status = 'Situação inválida';
  const turno = texto(corpo.turno) as AgenteEntrada['turno'];
  if (!TURNOS.some((t) => t.codigo === turno)) campos.turno = 'Turno inválido';
  const bairroBase = texto(corpo.bairroBase);
  const bairro = BAIRROS.find((b) => b.nome === bairroBase);
  if (!bairro) campos.bairroBase = 'Selecione o bairro da base';
  const telefone = texto(corpo.telefone);
  if (telefone && telefone.replace(/\D/g, '').length < 10) campos.telefone = 'Telefone com DDD';
  let lat = numero(corpo.lat);
  let lng = numero(corpo.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    lat = bairro?.lat ?? NaN;
    lng = bairro?.lng ?? NaN;
  }
  const equipamentoId = corpo.equipamentoId ? Number(corpo.equipamentoId) : null;
  if (equipamentoId !== null && !Number.isInteger(equipamentoId)) campos.equipamentoId = 'Veículo inválido';

  if (Object.keys(campos).length) return { ok: false, campos };
  return { ok: true, dado: { nome, matricula, funcao, orgao, status, turno, telefone, bairroBase, lat, lng, equipamentoId } };
}
