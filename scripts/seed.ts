// Recria o banco de demonstração do zero: `npm run seed`.
import { caminhoBanco } from '@/lib/server/db';
import { popularBanco } from '@/lib/server/seed';

const inicio = Date.now();
const stats = popularBanco();
console.log(`Banco: ${caminhoBanco()}`);
console.log(
  `Gerados ${stats.equipamentos} equipamentos (${stats.tipos} tipos), ${stats.agentes} agentes, ` +
    `${stats.ocorrencias} ocorrências históricas, ${stats.eventosStatus} eventos de situação e ` +
    `${stats.leituras} leituras de radar em ${((Date.now() - inicio) / 1000).toFixed(1)}s.`,
);
