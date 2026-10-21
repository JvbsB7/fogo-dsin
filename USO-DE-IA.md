# Uso de IA no projeto

O regulamento pede que o uso de IA seja declarado. Declaramos:

- **Ferramenta:** Claude Code (Anthropic), modelo Claude Opus 5.5.
- **Como foi usada:** como par de programação. Ajudou a montar a estrutura do projeto, a escrever código das telas, da API, do simulador e do módulo preditivo, a escrever os testes e esta documentação, e a revisar erros encontrados durante os testes no navegador.
- **Decisões tomadas pela equipe:** escopo das três partes, stack (Next.js, shadcn/ui, Zustand, SQLite, Leaflet), cenário (Marília/SP) e a escolha por modelos estatísticos explicáveis em vez de caixa-preta.

## O que conferimos e entendemos

Os pontos centrais que a equipe estudou e consegue explicar:

1. **Fluxo em tempo real**: simulador ou API → `servicos.ts` → banco + motor de alertas → `bus.ts` → `/api/tempo-real` (SSE) → store Zustand (`stores/operacao.ts`) → telas.
2. **Modelo de risco** (`lib/server/predict/risco.ts`): taxa de Poisson por região × hora da semana, com decaimento exponencial e suavização bayesiana. O índice é relativo ao percentil 99.
3. **Por que as ocorrências simuladas pesam 1/30**: o simulador comprime 30 horas em 1. Sem o peso, a hora atual pareceria sempre crítica (bug que encontramos e corrigimos).
4. **Reforço de agentes** (`predict/reforco.ts`): horas-agente necessárias ÷ capacidade do turno e remanejamento guloso.
5. **Anomalias** (`predict/anomalias.ts`): teste de Poisson, razão fluxo/mediana dos radares e heartbeat perdido.
6. **Manutenção preditiva** (`predict/manutencao.ts`): taxa por modelo suavizada, probabilidade 1 − e^(−λt), disponibilidade reconstruída do histórico de eventos.

<!-- Equipe: completem com o que cada integrante revisou ou alterou e com qualquer outra IA usada. -->
