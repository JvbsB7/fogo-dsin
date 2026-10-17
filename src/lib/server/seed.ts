// Gera a cidade de demonstração: equipamentos, agentes, 120 dias de ocorrências,
// histórico de falhas e fluxo dos radares. Os dados são sintéticos, mas têm padrões
// propositais (horários de pico, noites de fim de semana na Zona Norte, crescimento na
// Zona Leste, um modelo de radar problemático) para o módulo preditivo ter o que descobrir.
import {
  BAIRROS, FUNCOES_AGENTE, LOGRADOUROS, REGIOES, RODOVIAS, TIPOS_EQUIPAMENTO, TIPOS_OCORRENCIA, TIPOS_POR_CODIGO,
  turnoDaHora, type StatusEquipamento, type TipoEquipamentoDef, type Turno,
} from '@/lib/catalog';
import type { EquipamentoEntrada } from '@/lib/types';
import { getDb, limparBanco, type DB } from './db';
import { inserirAgente, inserirEquipamento, inserirOcorrencia, registrarEventoStatus } from './repo';
import { criarRng, partesLocais, type Rng } from './util';

export const DIAS_HISTORICO = 120;
const HORA = 3600 * 1000;
const DIA = 24 * HORA;

// Quantidade de cada tipo e peso de cada região na distribuição.
const QUANTIDADES: Record<string, number> = {
  radar_velocidade: 28, radar_semaforo: 16, radar_conversao: 8, camera: 60, semaforo: 45, balanca: 3, cancela: 8,
  totem_rotativo: 25, veiculo_fiscalizacao: 4, patinete: 60, veiculo_transporte: 30, moto_agente: 12, viatura_gcm: 10, viatura_pm: 10,
};
const PESO_REGIAO_EQUIP: Record<string, number> = { centro: 3, norte: 1.2, sul: 1.3, leste: 1, oeste: 1 };
const SIGLAS: Record<string, string> = {
  radar_velocidade: 'RVL', radar_semaforo: 'RSM', radar_conversao: 'RCV', camera: 'CAM', semaforo: 'SEM', balanca: 'BAL',
  cancela: 'CAN', totem_rotativo: 'TOT', veiculo_fiscalizacao: 'VFR', patinete: 'PAT', veiculo_transporte: 'VTR',
  moto_agente: 'MOT', viatura_gcm: 'VGM', viatura_pm: 'VPM',
};

/** Taxa média de ocorrências por hora em cada região (antes dos fatores de horário/dia). */
export const TAXA_BASE_REGIAO: Record<string, number> = { centro: 0.42, norte: 0.2, sul: 0.22, leste: 0.16, oeste: 0.14 };

/** Perfil do dia (média ≈ 1): picos de manhã e fim de tarde, madrugada calma. */
export const PERFIL_HORA = [
  0.35, 0.25, 0.2, 0.2, 0.25, 0.45, 0.9, 1.7, 1.9, 1.3, 1.0, 1.1,
  1.35, 1.2, 1.05, 1.1, 1.4, 1.95, 2.05, 1.5, 1.05, 0.8, 0.6, 0.45,
];

/** Fator do padrão "real" de ocorrências, usado pelo seed e pelo simulador. */
export function fatorPadrao(regiao: string, instante: number, inicioHistorico: number) {
  const { hora, diaSemana } = partesLocais(instante);
  let f = PERFIL_HORA[hora];
  const fimDeSemana = diaSemana === 0 || diaSemana === 6;
  if (fimDeSemana && hora >= 6 && hora < 20) f *= 0.7; // menos deslocamento casa-trabalho
  // Noites de sexta e sábado agitadas na Zona Norte (bares e eventos).
  const noiteAgitada = (diaSemana === 5 || diaSemana === 6) && (hora >= 21 || hora < 4);
  const madrugadaPos = (diaSemana === 6 || diaSemana === 0) && hora < 4;
  if (regiao === 'norte' && (noiteAgitada || madrugadaPos)) f *= 3.2;
  // Zona Leste em expansão: ocorrências crescem ao longo do período (até +80%).
  if (regiao === 'leste') {
    const progresso = Math.min(1, Math.max(0, (instante - inicioHistorico) / (DIAS_HISTORICO * DIA)));
    f *= 1 + 0.8 * progresso;
  }
  // Centro: segunda-feira de manhã costuma ser pior.
  if (regiao === 'centro' && diaSemana === 1 && hora >= 7 && hora <= 9) f *= 1.4;
  return f;
}

/** Fluxo esperado de veículos/hora para um radar (perfil de dia útil x fim de semana). */
export function perfilFluxo(hora: number, fimDeSemana: boolean) {
  const util = [0.1, 0.06, 0.05, 0.05, 0.08, 0.25, 0.65, 1.0, 0.95, 0.7, 0.6, 0.65, 0.75, 0.7, 0.62, 0.65, 0.78, 0.98, 1.0, 0.8, 0.55, 0.4, 0.28, 0.17];
  const fds = [0.18, 0.12, 0.09, 0.07, 0.07, 0.1, 0.2, 0.32, 0.45, 0.55, 0.62, 0.68, 0.7, 0.66, 0.6, 0.6, 0.62, 0.65, 0.64, 0.6, 0.5, 0.42, 0.33, 0.24];
  return (fimDeSemana ? fds : util)[hora];
}

function tipoOcorrencia(rng: Rng, hora: number) {
  const noite = hora >= 22 || hora < 5;
  const pico = (hora >= 7 && hora <= 9) || (hora >= 17 && hora <= 19);
  const pesos: Record<string, number> = {
    acidente: noite ? 3 : 2,
    congestionamento: pico ? 5 : 1,
    semaforo_apagado: 0.8,
    veiculo_quebrado: 1.5,
    infracao_grave: noite ? 3 : 1.2,
    vandalismo: noite ? 1 : 0.2,
  };
  const total = Object.values(pesos).reduce((a, b) => a + b, 0);
  let x = rng.next() * total;
  for (const t of TIPOS_OCORRENCIA) {
    x -= pesos[t.codigo];
    if (x <= 0) return t;
  }
  return TIPOS_OCORRENCIA[0];
}

const DESCRICOES: Record<string, string[]> = {
  acidente: ['Colisão traseira entre dois veículos', 'Colisão moto x carro', 'Atropelamento sem gravidade', 'Capotamento de veículo'],
  congestionamento: ['Fluxo parado por mais de 15 minutos', 'Lentidão acima do normal', 'Fila extensa no cruzamento'],
  semaforo_apagado: ['Semáforo intermitente', 'Cruzamento sem sinalização luminosa'],
  veiculo_quebrado: ['Veículo com pane mecânica na faixa', 'Caminhão quebrado bloqueando faixa'],
  infracao_grave: ['Racha / disputa entre veículos', 'Condutor na contramão', 'Embriaguez ao volante suspeita'],
  vandalismo: ['Pichação em equipamento', 'Tentativa de furto de cabos', 'Equipamento danificado'],
};

const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Larissa', 'Marcos',
  'Natália', 'Otávio', 'Paula', 'Rafael', 'Sabrina', 'Thiago', 'Vanessa', 'Wagner', 'Camila', 'Rodrigo', 'Juliana', 'Lucas', 'Fernanda',
  'André', 'Patrícia', 'Gustavo', 'Renata', 'Mateus'];
const SOBRENOMES = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Lima', 'Carvalho', 'Ferreira', 'Rodrigues', 'Almeida', 'Costa',
  'Gomes', 'Martins', 'Araújo', 'Ribeiro', 'Barbosa', 'Rocha', 'Dias', 'Teixeira', 'Moreira'];

const REFERENCIAS = (rng: Rng) =>
  rng.pick([
    `nº ${rng.int(10, 2400)}`, `oposto ao nº ${rng.int(10, 2400)}`, 'S/N', `esquina com ${rng.pick(LOGRADOUROS)}`,
    'em frente ao Mercado do Tio', 'ao lado do ponto de ônibus', `próximo ao nº ${rng.int(10, 2400)}`, 'canteiro central',
  ]);

function bairroAleatorio(rng: Rng, pesos: Record<string, number>) {
  const total = BAIRROS.reduce((s, b) => s + (pesos[b.regiao] ?? 1), 0);
  let x = rng.next() * total;
  for (const b of BAIRROS) {
    x -= pesos[b.regiao] ?? 1;
    if (x <= 0) return b;
  }
  return BAIRROS[0];
}

const dataISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function atributosAleatorios(rng: Rng, def: TipoEquipamentoDef, idx: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const a of def.atributos) {
    if (a.tipo === 'number') {
      if (a.campo === 'velocidade_maxima_kmh') out[a.campo] = rng.pick([40, 50, 60, 60, 70, 80]);
      else if (a.campo === 'bateria_pct') out[a.campo] = rng.int(15, 100);
      else out[a.campo] = rng.int(a.min ?? 1, Math.min(a.max ?? 10, (a.min ?? 1) + 8));
    } else if (a.tipo === 'bool') out[a.campo] = rng.chance(0.6);
    else if (a.tipo === 'select') out[a.campo] = rng.pick(a.opcoes!);
    else if (a.tipo === 'multiselect') out[a.campo] = a.opcoes!.filter(() => rng.chance(0.6)).slice(0, 3);
    else if (a.campo === 'placa') out[a.campo] = `${String.fromCharCode(65 + rng.int(0, 25))}${String.fromCharCode(65 + rng.int(0, 25))}${String.fromCharCode(65 + rng.int(0, 25))}${rng.int(0, 9)}${String.fromCharCode(65 + rng.int(0, 25))}${rng.int(10, 99)}`;
    else if (a.campo === 'prefixo') out[a.campo] = `${def.codigo === 'viatura_pm' ? 'M' : 'GCM'}-${String(idx + 1).padStart(3, '0')}`;
    else if (a.campo === 'operadora') out[a.campo] = rng.pick(['Jet', 'Grow', 'Prefeitura']);
    else if (a.campo === 'certificado_inmetro') out[a.campo] = `INM-${rng.int(100000, 999999)}`;
    else if (a.campo === 'alvara') out[a.campo] = `ALV-${rng.int(1000, 9999)}`;
    else out[a.campo] = '';
  }
  return out;
}

/** Linha do tempo de falhas e reparos nos últimos 120 dias. Devolve a situação final. */
function simularHistorico(db: DB, rng: Rng, id: number, def: TipoEquipamentoDef, modelo: string, regiao: string, agora: number, instaladoEm: number) {
  const inicio = Math.max(instaladoEm, agora - DIAS_HISTORICO * DIA);
  // Modelo VT-X200 (VigiaTech) é propositalmente pior: o preditivo deve notar.
  const fatorModelo = modelo === 'VT-X200' ? 2.6 : modelo.startsWith('VT-') ? 1.6 : 1;
  const idadeAnos = (agora - instaladoEm) / (365 * DIA);
  let status: StatusEquipamento = 'operacional';
  let t = inicio;
  while (t < agora) {
    if (status === 'operacional') {
      // Zona Leste: falhas dobram nos últimos 30 dias (tendência de queda de disponibilidade).
      const recente = regiao === 'leste' && t > agora - 30 * DIA ? 3.5 : 1;
      const taxaDia = (def.falhasAno / 365) * fatorModelo * (1 + 0.12 * idadeAnos) * recente;
      const espera = -Math.log(1 - rng.next()) / taxaDia;
      t += espera * DIA;
      if (t >= agora) break;
      const furto = (def.codigo === 'camera' || def.codigo === 'totem_rotativo' || def.codigo === 'patinete') && rng.chance(0.06);
      const para: StatusEquipamento = furto ? 'furtado' : 'mau_funcionamento';
      registrarEventoStatus(id, status, para, new Date(t).toISOString(), furto ? 'equipamento furtado/vandalizado' : 'falha detectada');
      status = para;
    } else if (status === 'mau_funcionamento') {
      t += (0.3 + rng.next() * 1.5) * DIA;
      if (t >= agora) break;
      registrarEventoStatus(id, status, 'em_manutencao', new Date(t).toISOString(), 'equipe acionada');
      status = 'em_manutencao';
    } else if (status === 'em_manutencao') {
      t += (0.5 + rng.next() * 3) * DIA;
      if (t >= agora) break;
      registrarEventoStatus(id, status, 'operacional', new Date(t).toISOString(), 'reparo concluído');
      status = 'operacional';
    } else {
      // Furtado: reposição demora de 5 a 20 dias.
      t += (5 + rng.next() * 15) * DIA;
      if (t >= agora) break;
      registrarEventoStatus(id, status, 'operacional', new Date(t).toISOString(), 'equipamento reposto');
      status = 'operacional';
    }
  }
  return status;
}

export function popularBanco(opcoes: { semente?: number; agora?: number } = {}) {
  const db = getDb();
  const rng = criarRng(opcoes.semente ?? 2026);
  const agora = opcoes.agora ?? Date.now();
  const inicioHistorico = agora - DIAS_HISTORICO * DIA;
  const criadoEm = new Date(inicioHistorico).toISOString();

  const transacao = db.transaction(() => {
    limparBanco(db);
    const radares: { id: number; base: number; degradando: boolean }[] = [];
    const frota: Record<string, number[]> = { moto_agente: [], viatura_gcm: [], viatura_pm: [] };
    let serial = 0;

    for (const def of TIPOS_EQUIPAMENTO) {
      const n = QUANTIDADES[def.codigo] ?? 0;
      const marcas = Object.keys(def.marcas);
      for (let i = 0; i < n; i++) {
        const rodovia = def.codigo === 'balanca';
        const b = rodovia ? rng.pick(BAIRROS.filter((x) => x.nome === 'Distrito Industrial' || x.nome === 'Aeroporto')) : bairroAleatorio(rng, PESO_REGIAO_EQUIP);
        const marca = rng.pick(marcas);
        const modelo = rng.pick(def.marcas[marca]);
        const instalado = agora - rng.int(60, 6 * 365) * DIA;
        let status: StatusEquipamento = 'operacional';
        const naoInstalado = def.categoria === 'fixo' && rng.chance(0.03);
        const desativado = !naoInstalado && rng.chance(0.015);
        const intervalo = def.intervaloManutencaoDias;
        // ~10% com manutenção periódica vencida.
        const ultima = agora - (rng.chance(0.1) ? intervalo + rng.int(3, 40) : rng.int(5, intervalo - 3)) * DIA;
        const entrada: EquipamentoEntrada = {
          tipo: def.codigo,
          numeroSerie: `${SIGLAS[def.codigo]}-${new Date(instalado).getUTCFullYear()}-${String(++serial).padStart(5, '0')}`,
          marca, modelo, orgao: def.orgao, status: naoInstalado ? 'nao_instalado' : desativado ? 'desativado' : 'operacional',
          cep: `${b.cep}-${String(rng.int(0, 999)).padStart(3, '0')}`,
          bairro: b.nome, cidade: 'Marília', uf: 'SP',
          logradouro: rodovia ? rng.pick(RODOVIAS) : rng.pick(LOGRADOUROS),
          referencia: rodovia ? `KM ${rng.int(320, 345)}` : REFERENCIAS(rng),
          lat: b.lat + rng.normal() * 0.0035, lng: b.lng + rng.normal() * 0.0035,
          manutencaoTipo: naoInstalado || desativado ? 'nenhuma' : 'periodica',
          manutencaoProxima: naoInstalado || desativado ? null : dataISO(ultima + intervalo * DIA),
          ultimaManutencao: naoInstalado ? null : dataISO(ultima),
          instaladoEm: naoInstalado ? null : dataISO(instalado),
          atributos: atributosAleatorios(rng, def, i),
          observacoes: naoInstalado ? 'Aguardando instalação pela empresa contratada.' : '',
        };
        const id = inserirEquipamento(entrada, criadoEm, { ultimoSinal: null });
        if (!naoInstalado && !desativado) {
          status = simularHistorico(db, rng, id, def, modelo, b.regiao, agora, instalado);
          const manut = status === 'mau_funcionamento' || status === 'furtado' ? { tipo: 'imediata', proxima: dataISO(agora) } : null;
          db.prepare(`UPDATE equipamentos SET status=?, ultimo_sinal=?, atualizado_em=?${manut ? ", manutencao_tipo='imediata', manutencao_proxima=?" : ''} WHERE id=?`)
            .run(...[status, status === 'operacional' ? new Date(agora).toISOString() : new Date(agora - rng.int(2, 30) * HORA).toISOString(), new Date(agora).toISOString(), ...(manut ? [manut.proxima] : []), id]);
        }
        if (def.codigo.startsWith('radar_') && status === 'operacional') radares.push({ id, base: rng.int(250, 950), degradando: false });
        if (def.codigo in frota) frota[def.codigo].push(id);
      }
    }

    // Fluxo horário dos radares nos últimos 14 dias. Dois radares começam a "morrer"
    // nas últimas horas (fluxo despencando) — sinal precoce que a detecção de anomalias pega.
    radares.slice(0, 2).forEach((r) => (r.degradando = true));
    const ins = db.prepare('INSERT INTO leituras (equipamento_id, hora, fluxo) VALUES (?,?,?)');
    const horaAtual = Math.floor(agora / HORA) * HORA;
    for (const r of radares) {
      for (let h = 14 * 24; h >= 1; h--) {
        const t = horaAtual - h * HORA;
        const { hora, diaSemana } = partesLocais(t);
        let fluxo = r.base * perfilFluxo(hora, diaSemana === 0 || diaSemana === 6) * (1 + rng.normal() * 0.08);
        if (r.degradando && h <= 5) fluxo *= 0.12;
        ins.run(r.id, new Date(t).toISOString(), Math.max(0, Math.round(fluxo)));
      }
    }
    if (radares.length) {
      db.prepare('INSERT INTO meta (chave, valor) VALUES (?, ?)').run('radares_degradando', JSON.stringify(radares.filter((r) => r.degradando).map((r) => r.id)));
    }

    // Ocorrências históricas (processo de Poisson por região e hora).
    const bairrosPorRegiao = Object.fromEntries(REGIOES.map((r) => [r.codigo, BAIRROS.filter((b) => b.regiao === r.codigo)]));
    for (let t = inicioHistorico; t < agora - HORA; t += HORA) {
      for (const reg of REGIOES) {
        const lambda = TAXA_BASE_REGIAO[reg.codigo] * fatorPadrao(reg.codigo, t, inicioHistorico);
        const n = rng.poisson(lambda);
        for (let k = 0; k < n; k++) {
          const inicio = t + rng.next() * HORA;
          const { hora } = partesLocais(inicio);
          const tipo = tipoOcorrencia(rng, hora);
          const b = rng.pick(bairrosPorRegiao[reg.codigo]);
          const gravidade = (tipo.codigo === 'acidente' ? rng.pick([2, 3, 3]) : tipo.peso >= 2 ? rng.pick([1, 2]) : 1) as 1 | 2 | 3;
          inserirOcorrencia({
            tipo: tipo.codigo, gravidade, bairro: b.nome, regiao: reg.codigo,
            lat: b.lat + rng.normal() * 0.004, lng: b.lng + rng.normal() * 0.004,
            inicio: new Date(inicio).toISOString(), fim: new Date(inicio + rng.int(15, 150) * 60000).toISOString(),
            origem: 'historico', equipamentoId: null, agenteId: null, descricao: rng.pick(DESCRICOES[tipo.codigo]),
          });
        }
      }
    }

    // Agentes. A lotação por região é propositalmente desequilibrada (Leste e Norte com
    // pouca gente) para a recomendação de reforço ter o que sugerir.
    const lotacao: Record<string, number> = { centro: 0.34, norte: 0.14, sul: 0.22, leste: 0.12, oeste: 0.18 };
    const qtdFuncao: Record<string, number> = { agente_transito: 26, guarda_municipal: 20, policial_militar: 16 };
    const turnoAtual = turnoDaHora(partesLocais(agora).hora);
    const veiculoPorFuncao: Record<string, string> = { agente_transito: 'moto_agente', guarda_municipal: 'viatura_gcm', policial_militar: 'viatura_pm' };
    const usados = new Set<string>();
    let seq = 1;
    for (const f of FUNCOES_AGENTE) {
      for (let i = 0; i < qtdFuncao[f.codigo]; i++) {
        let nome = '';
        do nome = `${rng.pick(NOMES)} ${rng.pick(SOBRENOMES)}`;
        while (usados.has(nome));
        usados.add(nome);
        const b = bairroAleatorio(rng, lotacao);
        const turno = (['manha', 'tarde', 'noite'] as Turno[])[i % 3];
        const emServico = turno === turnoAtual;
        const veiculos = frota[veiculoPorFuncao[f.codigo]];
        inserirAgente(
          {
            nome, matricula: `${f.orgao}-${String(seq++).padStart(4, '0')}`, funcao: f.codigo, orgao: f.orgao,
            status: emServico ? (rng.chance(0.12) ? 'em_pausa' : 'em_patrulha') : 'fora_de_servico',
            turno, telefone: `(14) 9${rng.int(8000, 9999)}-${rng.int(1000, 9999)}`, bairroBase: b.nome,
            lat: b.lat + rng.normal() * 0.003, lng: b.lng + rng.normal() * 0.003,
            equipamentoId: veiculos.length ? veiculos[i % veiculos.length] : null,
          },
          criadoEm,
        );
      }
    }
    db.prepare('INSERT OR REPLACE INTO meta (chave, valor) VALUES (?, ?)').run('seed_em', new Date(agora).toISOString());
  });
  transacao();
  return estatisticas(db);
}

export function estatisticas(db: DB = getDb()) {
  const c = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  return {
    equipamentos: c('equipamentos'), agentes: c('agentes'), ocorrencias: c('ocorrencias'),
    eventosStatus: c('eventos_status'), leituras: c('leituras'), tipos: Object.keys(TIPOS_POR_CODIGO).length,
  };
}
