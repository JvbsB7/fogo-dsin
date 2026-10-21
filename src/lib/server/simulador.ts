// Simulador da telemetria IoT e da operação de campo. Faz o papel dos dispositivos reais:
// sinais de vida, falhas, furtos, deslocamento de agentes e viaturas, ocorrências nas vias
// e fluxo dos radares. Tudo passa pelos mesmos serviços que a API usa.
//
// Variáveis de ambiente:
//   FOGO_SIMULADOR=off            desliga o simulador
//   FOGO_SIM_INTERVALO_MS=4000    intervalo entre ciclos
//   FOGO_SIM_ACELERACAO=30        quantos segundos simulados passam a cada segundo real
//   FOGO_SIM_FATOR_FALHAS=20      multiplica a taxa de falhas para a demonstração ter movimento
import { REGIOES, TIPOS_POR_CODIGO, turnoDaHora, BAIRROS, type StatusEquipamento } from '@/lib/catalog';
import { avaliarEquipamento, varreduraPeriodica } from './alertas';
import { SIM_ACELERACAO, SIM_FATOR_FALHAS, SIM_INTERVALO_MS } from './config';
import { publicar } from './bus';
import { getDb } from './db';
import * as repo from './repo';
import { calcularResumo } from './resumo';
import { DIAS_HISTORICO, TAXA_BASE_REGIAO, fatorPadrao, perfilFluxo } from './seed';
import * as servicos from './servicos';
import { criarRng, partesLocais, type Rng } from './util';

const INTERVALO = SIM_INTERVALO_MS;
const ACEL = SIM_ACELERACAO;
const FATOR_FALHAS = SIM_FATOR_FALHAS;
const MOVEIS = ['patinete', 'veiculo_transporte', 'veiculo_fiscalizacao'];
const FROTA = ['moto_agente', 'viatura_gcm', 'viatura_pm'];
const PODE_SER_FURTADO = ['camera', 'totem_rotativo', 'patinete'];

interface Estado {
  timer?: NodeJS.Timeout;
  ultimoTick: number;
  ultimaVarredura: number;
  horaLeitura: number;
  silenciados: Map<number, number>;
  baseRadar: Map<number, number>;
  degradando: Set<number>;
  rng: Rng;
  ciclos: number;
}

const g = globalThis as unknown as { __fogoSim?: Estado };

export function simuladorAtivo() {
  return Boolean(g.__fogoSim?.timer);
}

export function iniciarSimulador() {
  if (g.__fogoSim?.timer) return;
  const db = getDb();
  const meta = db.prepare(`SELECT valor FROM meta WHERE chave = 'radares_degradando'`).get() as { valor: string } | undefined;
  const agora = Date.now();
  g.__fogoSim = {
    ultimoTick: agora, ultimaVarredura: 0, horaLeitura: Math.floor(agora / 3600000),
    silenciados: new Map(), baseRadar: new Map(), degradando: new Set(meta ? (JSON.parse(meta.valor) as number[]) : []),
    rng: criarRng(agora % 100000), ciclos: 0,
  };
  // Estado inicial dos alertas: equipamentos que já começam com problema.
  for (const e of repo.listarEquipamentos({ status: ['mau_funcionamento', 'furtado'] })) avaliarEquipamento(e);
  g.__fogoSim.timer = setInterval(() => {
    try {
      ciclo();
    } catch (err) {
      console.error('[simulador] erro no ciclo', err);
    }
  }, INTERVALO);
  g.__fogoSim.timer.unref?.();
  console.log(`[simulador] ativo: ciclo de ${INTERVALO} ms, aceleração ${ACEL}x`);
}

export function pararSimulador() {
  if (g.__fogoSim?.timer) clearInterval(g.__fogoSim.timer);
  if (g.__fogoSim) g.__fogoSim.timer = undefined;
}

function inicioHistorico() {
  const r = getDb().prepare(`SELECT valor FROM meta WHERE chave = 'seed_em'`).get() as { valor: string } | undefined;
  return (r ? Date.parse(r.valor) : Date.now()) - DIAS_HISTORICO * 86400000;
}

function ciclo() {
  const s = g.__fogoSim!;
  const agora = Date.now();
  const dt = Math.min(30, (agora - s.ultimoTick) / 1000);
  s.ultimoTick = agora;
  s.ciclos++;
  const dtSim = dt * ACEL;
  const iso = new Date(agora).toISOString();
  const db = getDb();

  trocaDeTurno(agora);

  // 1. Sinal de vida de tudo que está operando (menos os que "pararam de responder").
  const silenciados = [...s.silenciados.keys()];
  db.prepare(`UPDATE equipamentos SET ultimo_sinal = ? WHERE status = 'operacional' ${silenciados.length ? `AND id NOT IN (${silenciados.join(',')})` : ''}`).run(iso);

  moverAgentes(s.rng);
  moverEquipamentosMoveis(s.rng, iso);
  ocorrencias(s.rng, agora, dtSim);
  falhasEReparos(s, agora, dtSim);
  leiturasRadar(s, agora);

  if (agora - s.ultimaVarredura > 30000) {
    s.ultimaVarredura = agora;
    varreduraPeriodica(agora);
  }
  publicar({ tipo: 'resumo', dado: calcularResumo() });
}

function trocaDeTurno(agora: number) {
  const turno = turnoDaHora(partesLocais(agora).hora);
  const db = getDb();
  const entrando = db.prepare(`SELECT id FROM agentes WHERE turno = ? AND status = 'fora_de_servico'`).all(turno) as { id: number }[];
  const saindo = db.prepare(`SELECT id FROM agentes WHERE turno != ? AND status IN ('em_patrulha', 'em_pausa')`).all(turno) as { id: number }[];
  if (!entrando.length && !saindo.length) return;
  db.prepare(`UPDATE agentes SET status = 'em_patrulha' WHERE turno = ? AND status = 'fora_de_servico'`).run(turno);
  db.prepare(`UPDATE agentes SET status = 'fora_de_servico' WHERE turno != ? AND status IN ('em_patrulha', 'em_pausa')`).run(turno);
  for (const { id } of [...entrando, ...saindo]) publicar({ tipo: 'agente', dado: repo.obterAgente(id)! });
}

function moverAgentes(rng: Rng) {
  const ativos = repo.listarAgentes({ status: ['em_patrulha', 'em_ocorrencia'] });
  const db = getDb();
  for (const a of ativos) {
    let { lat, lng } = a;
    if (a.status === 'em_ocorrencia' && a.ocorrenciaId) {
      const o = repo.obterOcorrencia(a.ocorrenciaId);
      if (o && !o.fim) {
        lat += (o.lat - lat) * 0.5;
        lng += (o.lng - lng) * 0.5;
      }
    } else {
      const base = BAIRROS.find((b) => b.nome === a.bairroBase);
      lat += (base ? (base.lat - lat) * 0.04 : 0) + rng.normal() * 0.0005;
      lng += (base ? (base.lng - lng) * 0.04 : 0) + rng.normal() * 0.0005;
    }
    repo.moverAgente(a.id, lat, lng, a.status, a.ocorrenciaId);
    // Viatura/moto vinculada acompanha o agente.
    if (a.equipamentoId) db.prepare(`UPDATE equipamentos SET lat = ?, lng = ? WHERE id = ? AND status = 'operacional'`).run(lat, lng, a.equipamentoId);
    publicar({ tipo: 'agente', dado: repo.obterAgente(a.id)! });
  }
  // Publica a frota que se moveu junto.
  const frota = repo.listarEquipamentos({ tipo: FROTA, status: ['operacional'] });
  const comAgenteAtivo = new Set(ativos.map((a) => a.equipamentoId).filter(Boolean));
  for (const e of frota) if (comAgenteAtivo.has(e.id)) publicar({ tipo: 'equipamento', dado: e });
}

function moverEquipamentosMoveis(rng: Rng, iso: string) {
  for (const e of repo.listarEquipamentos({ tipo: MOVEIS, status: ['operacional'] })) {
    if (!rng.chance(0.25)) continue;
    const tel = { ...e.telemetria };
    if (e.tipo === 'patinete') {
      const bat = Number(e.atributos.bateria_pct ?? tel.bateria_pct ?? 80);
      tel.bateria_pct = Math.max(5, Math.round(bat - rng.next() * 2));
      tel.em_uso = rng.chance(0.4);
    } else {
      tel.velocidade_kmh = Math.round(rng.next() * 50);
    }
    const pos = { lat: e.lat + rng.normal() * 0.0006, lng: e.lng + rng.normal() * 0.0006 };
    repo.atualizarTelemetria(e.id, tel, iso, pos);
    publicar({ tipo: 'equipamento', dado: repo.obterEquipamento(e.id)! });
  }
}

const DESCRICOES: Record<string, string> = {
  acidente: 'Colisão entre veículos', congestionamento: 'Lentidão acima do normal', veiculo_quebrado: 'Veículo com pane na faixa',
  infracao_grave: 'Condutor em alta velocidade', vandalismo: 'Equipamento danificado', semaforo_apagado: 'Semáforo apagado',
};

function ocorrencias(rng: Rng, agora: number, dtSim: number) {
  // Encerra as que já duraram o suficiente (20 a 120 minutos simulados).
  for (const o of repo.listarOcorrencias({ ativas: true })) {
    const duracaoMin = 20 + ((o.id * 37) % 100);
    if ((agora - Date.parse(o.inicio)) / 1000 > (duracaoMin * 60) / ACEL) servicos.finalizarOcorrencia(o.id);
  }
  const inicio = inicioHistorico();
  for (const r of REGIOES) {
    const lambda = TAXA_BASE_REGIAO[r.codigo] * fatorPadrao(r.codigo, agora, inicio) * (dtSim / 3600);
    const n = rng.poisson(lambda);
    for (let i = 0; i < n; i++) {
      const b = rng.pick(BAIRROS.filter((x) => x.regiao === r.codigo));
      const tipo = rng.pick(['acidente', 'congestionamento', 'congestionamento', 'veiculo_quebrado', 'infracao_grave', 'acidente']);
      servicos.registrarOcorrencia({
        tipo, gravidade: (tipo === 'acidente' ? rng.pick([2, 3]) : rng.pick([1, 1, 2])) as 1 | 2 | 3,
        bairro: b.nome, regiao: r.codigo, lat: b.lat + rng.normal() * 0.004, lng: b.lng + rng.normal() * 0.004,
        inicio: new Date(agora).toISOString(), origem: 'simulador', equipamentoId: null, descricao: DESCRICOES[tipo],
      });
    }
  }
}

function falhasEReparos(s: Estado, agora: number, dtSim: number) {
  const { rng } = s;
  const equips = repo.listarEquipamentos({ status: ['operacional', 'mau_funcionamento', 'em_manutencao', 'furtado'] });
  for (const e of equips) {
    const def = TIPOS_POR_CODIGO[e.tipo];
    if (!def) continue;
    if (e.status === 'operacional') {
      if (s.silenciados.has(e.id)) {
        // Parou de responder: depois de um tempo, confirma-se a falha (ou volta sozinho).
        const desde = s.silenciados.get(e.id)!;
        if (agora - desde > 8 * 60000) {
          s.silenciados.delete(e.id);
          if (rng.chance(0.7)) servicos.alterarStatusEquipamento(e.id, 'mau_funcionamento', 'sem comunicação prolongada');
        }
        continue;
      }
      const p = (def.falhasAno / (365 * 86400)) * dtSim * FATOR_FALHAS;
      if (!rng.chance(p)) continue;
      const sorteio = rng.next();
      if (sorteio < 0.15) {
        s.silenciados.set(e.id, agora); // falha "silenciosa": só a detecção de anomalias percebe
      } else if (sorteio < 0.25 && PODE_SER_FURTADO.includes(e.tipo)) {
        servicos.alterarStatusEquipamento(e.id, 'furtado', 'telemetria: violação/remoção detectada');
        servicos.registrarOcorrencia({
          tipo: 'vandalismo', gravidade: 2, bairro: e.bairro, regiao: e.regiao, lat: e.lat, lng: e.lng,
          inicio: new Date(agora).toISOString(), origem: 'simulador', equipamentoId: e.id, descricao: `Furto/vandalismo: ${def.nome} ${e.numeroSerie}`,
        });
      } else {
        servicos.alterarStatusEquipamento(e.id, 'mau_funcionamento', 'telemetria: autodiagnóstico com erro');
        if (e.tipo === 'semaforo') {
          servicos.registrarOcorrencia({
            tipo: 'semaforo_apagado', gravidade: 2, bairro: e.bairro, regiao: e.regiao, lat: e.lat, lng: e.lng,
            inicio: new Date(agora).toISOString(), origem: 'simulador', equipamentoId: e.id, descricao: `Semáforo ${e.numeroSerie} apagado`,
          });
        }
      }
    } else {
      const proximo: Partial<Record<StatusEquipamento, [StatusEquipamento, number, string]>> = {
        mau_funcionamento: ['em_manutencao', 0.02, 'equipe de manutenção no local'],
        em_manutencao: ['operacional', 0.02, 'reparo concluído'],
        furtado: ['operacional', 0.002, 'equipamento reposto'],
      };
      const regra = proximo[e.status];
      if (regra && rng.chance(regra[1])) {
        if (regra[0] === 'operacional' && e.status === 'em_manutencao') servicos.registrarManutencaoConcluida(e.id);
        else servicos.alterarStatusEquipamento(e.id, regra[0], regra[2]);
      }
    }
  }
}

function leiturasRadar(s: Estado, agora: number) {
  const horaAtual = Math.floor(agora / 3600000);
  if (horaAtual === s.horaLeitura) return;
  const db = getDb();
  const ins = db.prepare('INSERT OR REPLACE INTO leituras (equipamento_id, hora, fluxo) VALUES (?,?,?)');
  // Fecha as horas que passaram desde a última leitura gravada.
  for (let h = s.horaLeitura; h < horaAtual; h++) {
    const t = h * 3600000;
    const { hora, diaSemana } = partesLocais(t);
    const perfil = perfilFluxo(hora, diaSemana === 0 || diaSemana === 6);
    for (const r of repo.listarEquipamentos({ tipo: ['radar_velocidade', 'radar_semaforo', 'radar_conversao'], status: ['operacional'] })) {
      if (!s.baseRadar.has(r.id)) s.baseRadar.set(r.id, baseDoRadar(r.id));
      let fluxo = s.baseRadar.get(r.id)! * perfil * (1 + s.rng.normal() * 0.08);
      if (s.degradando.has(r.id)) fluxo *= 0.12;
      ins.run(r.id, new Date(t).toISOString(), Math.max(0, Math.round(fluxo)));
    }
  }
  s.horaLeitura = horaAtual;
}

/** Volume "típico" do radar: média de fluxo/perfil no histórico (ou um padrão, se for novo). */
function baseDoRadar(id: number) {
  const linhas = getDb().prepare('SELECT hora, fluxo FROM leituras WHERE equipamento_id = ? ORDER BY hora DESC LIMIT 72').all(id) as { hora: string; fluxo: number }[];
  const razoes = linhas
    .map((l) => {
      const { hora, diaSemana } = partesLocais(l.hora);
      const p = perfilFluxo(hora, diaSemana === 0 || diaSemana === 6);
      return p > 0.3 ? l.fluxo / p : null;
    })
    .filter((x): x is number => x !== null);
  return razoes.length ? razoes.sort((a, b) => a - b)[Math.floor(razoes.length / 2)] : 500;
}
