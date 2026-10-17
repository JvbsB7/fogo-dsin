// Mostra no terminal um resumo das previsões — útil para conferir o modelo sem abrir a tela.
import { detectarAnomalias, previsaoManutencao, previsaoReforco, previsaoRisco, riscoAgora } from '@/lib/server/previsoes';

const r = previsaoRisco(24);
console.log('Risco agora:', riscoAgora());
console.log('Picos 24h:', r.picos.map((p) => `${p.nome} ${p.indice} (${p.nivel}) às ${p.hora}h`).join(' | '));
console.log('Tendências:', r.tendencias.map((t) => `${t.nome}: ${t.variacaoPctSemana}%/sem r2=${t.r2} ${t.direcao}`).join(' | '));
const f = previsaoReforco();
for (const t of f.turnos) console.log(t.rotulo, t.linhas.map((l) => `${l.nome} esp=${l.esperado} nec=${l.necessarios} esc=${l.escalados}`).join(' | '), '=>', t.sugestoes.map((s) => `${s.quantidade} ${s.deNome}→${s.paraNome}`).join(', '));
const m = previsaoManutencao();
console.log('Modelos:', m.modelos.slice(0, 4).map((x) => `${x.modelo}(${x.tipo}) ${x.razao.toFixed(2)}x`).join(' | '));
console.log('Top risco:', m.topRisco.slice(0, 3).map((x) => `${x.numeroSerie} ${(x.probabilidade7d * 100).toFixed(1)}% [${x.fatores.join('; ')}]`));
console.log('Disponibilidade cidade:', m.disponibilidade.cidade.dias.slice(-3), 'incl', m.disponibilidade.cidade.inclinacaoPpDia, 'proj', m.disponibilidade.cidade.projecao7d);
console.log('Disp regiões:', m.disponibilidade.regioes.map((s) => `${s.nome} ${s.inclinacaoPpDia}pp/dia r2=${s.r2}`).join(' | '));
console.log('Anomalias:', detectarAnomalias().map((a) => `${a.tipo}: ${a.titulo}`));
