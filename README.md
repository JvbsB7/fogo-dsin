# 🔥 F.O.G.O. — Ferramenta Onisciente de Gestão e Operações

Solução para a **Etapa Bônus do DSIN Coder Challenge 2026**: um sistema único que cobre as três partes do desafio.

| Parte | O que o F.O.G.O. entrega | Onde ver |
|---|---|---|
| **1. Inventário inteligente** | Cadastro de 14 tipos de equipamento (radares, câmeras, semáforos, balanças, cancelas, totens, patinetes, viaturas…) com atributos próprios por tipo, endereço completo + GPS escolhido no mapa, situação, manutenção (imediata/agendada/periódica) e cadastro de agentes (trânsito, GCM, PM). | `/equipamentos`, `/agentes` |
| **2. Central de Operações** | Mapa em tempo real (SSE) com equipamentos, agentes e ocorrências; indicadores (total, operacionais, indisponíveis, % disponibilidade, agentes ativos); filtros por tipo, situação, região, órgão e manutenção; alertas priorizados; ficha de detalhes com ações; visão consolidada por região (normal / atenção / crítico). | `/` e `/alertas` |
| **3. Cidade preditiva** | Risco por região e hora (próximas 24h), mapa de calor semanal, tendência por região, reforço de agentes por turno com sugestão de remanejamento, anomalias agora (picos, radar “morrendo”, equipamento mudo) e manutenção preditiva (chance de falha em 7 dias, modelos problemáticos, projeção da disponibilidade). Cada previsão explica **o que prevê, com quais dados, como calcula e como ajuda a decidir**. | `/previsoes` |

## Como rodar

Pré-requisito: **Node.js 20.9 ou superior** (testado no 22). Não precisa de banco externo, Docker nem chave de API.

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>. Na primeira execução o banco SQLite (`data/fogo.db`) é criado e populado sozinho com uma cidade de demonstração (Marília/SP), e o simulador IoT começa a gerar telemetria, falhas e ocorrências.

Versão de produção:

```bash
npm run build
npm start
```

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run seed` | Recria o banco do zero (use se ficar dias sem rodar: o histórico é gerado relativo à data atual) |
| `npm test` | 27 testes do módulo preditivo e da validação (`node:test`) |
| `npm run diagnostico` | Imprime no terminal um resumo das previsões |
| `npm run typecheck` / `npm run lint` | TypeScript e ESLint |

### Variáveis de ambiente (opcionais)

| Variável | Padrão | Efeito |
|---|---|---|
| `FOGO_SIMULADOR` | ligado | `off` desliga o simulador IoT |
| `FOGO_SIM_ACELERACAO` | `30` | Segundos simulados por segundo real (ocorrências e reparos) |
| `FOGO_SIM_FATOR_FALHAS` | `20` | Multiplica a taxa de falhas para a demonstração ter movimento |
| `FOGO_SIM_INTERVALO_MS` | `4000` | Intervalo entre ciclos do simulador |
| `FOGO_DB` | `data/fogo.db` | Caminho do banco SQLite |

## Arquitetura

```
Navegador (React 19 + shadcn/ui + Leaflet + Zustand)
   │  REST (/api/*)            ▲ SSE (/api/tempo-real)
   ▼                           │
Next.js 16 — route handlers ──► serviços ──► motor de alertas ──► barramento de eventos
   │                               ▲                                   ▲
   ▼                               │                                   │
SQLite (better-sqlite3)      módulo preditivo                  simulador IoT (instrumentation.ts)
```

- **Um único app Next.js**: telas e API no mesmo projeto. O simulador sobe junto com o servidor (`src/instrumentation.ts`).
- **Tempo real**: toda mudança (equipamento, agente, ocorrência, alerta, indicadores) é publicada num barramento em memória e empurrada às telas por Server-Sent Events. Uma única conexão alimenta um store Zustand compartilhado por todas as páginas.
- **Mesma regra em todo lugar**: a API e o simulador usam os mesmos serviços (`src/lib/server/servicos.ts`). Um furto registrado pela tela ou detectado pela telemetria gera exatamente o mesmo histórico, alerta e evento.
- **Validação compartilhada**: `src/lib/validacao.ts` roda no formulário (retorno imediato) e na API (fonte da verdade).

```
src/
├─ app/                 páginas e rotas da API (route handlers)
├─ components/fogo/     telas do F.O.G.O. (central, mapa, inventário, formulários, previsões)
├─ components/ui/       componentes shadcn/ui
├─ stores/              Zustand: operação em tempo real e filtros
└─ lib/
   ├─ catalog.ts        domínio: tipos de equipamento e seus atributos, situações, órgãos, bairros
   ├─ validacao.ts      regras de cadastro
   └─ server/           banco, repositório, serviços, alertas, simulador, seed, previsões
      └─ predict/       modelos puros (testados): risco, reforço, anomalias, manutenção
tests/                  testes do módulo preditivo e da validação
```

## Como as previsões funcionam

Todos os modelos são estatísticos e explicáveis, sem caixa-preta, e cada bloco da tela traz a própria explicação.

- **Risco por região e hora**: as ocorrências seguem um processo de Poisson cuja taxa depende da região e da hora da semana (segunda 8h ≠ sábado 23h). A taxa é estimada do histórico com **decaimento exponencial** (meia-vida de 4 semanas, para acompanhar mudanças) e **suavização bayesiana** pela média da mesma hora do dia (evita picos por acaso). O índice 0–100 compara a taxa ponderada pela gravidade com o percentil 99 da cidade e sobe até 60% quando semáforos e radares da região estão fora do ar.
- **Reforço de agentes**: agentes necessários = ocorrências esperadas no turno × 3 horas-agente ÷ (8 h × 35% de ocupação-alvo), com mínimo de uma dupla por região. Compara com a escala real e sugere remanejamentos de quem sobra para quem falta.
- **Anomalias**: (1) pico de ocorrências nas últimas 2h com chance menor que 1% de ser acaso (teste de Poisson); (2) radar contando menos de 40% do fluxo normal da hora em 2 das últimas 3 horas, ou seja, sensor falhando antes de parar de vez; (3) equipamento “operacional” que perdeu 4 sinais de vida.
- **Manutenção preditiva**: taxa de falhas por modelo (falhas ÷ tempo em operação, suavizada pela taxa do tipo), ajustada por idade e manutenção vencida; probabilidade de falha em 7 dias = 1 − e^(−taxa × 7). A disponibilidade diária é reconstruída do histórico de situações e projetada por regressão linear.
- **Tendências**: regressão linear das ocorrências semanais; só marca alta ou queda quando R² ≥ 0,3.

## Dados de demonstração

O seed (`src/lib/server/seed.ts`) gera, de forma reprodutível, 319 equipamentos, 62 agentes, 120 dias de ocorrências (~3.200), histórico de falhas e 14 dias de fluxo dos radares. Os dados são sintéticos, mas têm **padrões propositais** para o módulo preditivo descobrir: picos de manhã e fim de tarde, noites de sexta e sábado agitadas na Zona Norte, crescimento de ocorrências e falhas na Zona Leste, um modelo de radar (VT-X200) que falha acima da média e dois radares que começam a “morrer”. As coordenadas dos bairros de Marília são aproximadas.

O simulador acelera o tempo (30× por padrão). Para não distorcer as estatísticas, cada ocorrência simulada conta 1/30 no treino dos modelos; registros manuais contam 1.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET / POST | `/api/equipamentos` | Lista (filtros `tipo`, `status`, `regiao`, `bairro`, `orgao`, `busca`) / cadastra |
| GET / PUT / DELETE | `/api/equipamentos/:id` | Ficha (com histórico, fluxo e risco de falha) / edita / exclui |
| PATCH | `/api/equipamentos/:id/status` | Muda a situação `{ status, motivo }` |
| POST | `/api/equipamentos/:id/manutencao` | Registra manutenção concluída |
| GET / POST | `/api/agentes` | Lista / cadastra agentes |
| GET / PUT / DELETE | `/api/agentes/:id` | Ficha / edita / remove |
| GET / POST | `/api/ocorrencias` | Lista (`ativas=1`, `horas`) / registra (despacha o agente mais próximo) |
| PATCH | `/api/ocorrencias/:id` | Encerra a ocorrência |
| GET / PATCH | `/api/alertas`, `/api/alertas/:id` | Lista / reconhece |
| GET | `/api/resumo`, `/api/estado` | Indicadores / fotografia completa da operação |
| GET | `/api/previsoes/{risco,reforco,anomalias,manutencao}` | Previsões com explicação |
| GET | `/api/tempo-real` | Fluxo SSE de eventos |
| GET | `/api/catalogo` | Tipos, situações, órgãos, bairros |

## Limitações conhecidas

- Sem autenticação: a central é tratada como ferramenta interna. Num cenário real entraria login com perfis (gestor, operador, campo).
- O barramento de eventos é em memória: funciona com um servidor só. Para várias instâncias, trocar por Redis pub/sub.
- O mapa usa tiles públicos do OpenStreetMap (precisa de internet para o fundo do mapa; o resto funciona offline).
- O banco local guarda a data em que foi gerado. Depois de alguns dias sem rodar, use `npm run seed` para o histórico ficar alinhado com “hoje”.

## Uso de IA

Veja [USO-DE-IA.md](USO-DE-IA.md).

## Tecnologias

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) · Zustand · Leaflet / react-leaflet · Recharts · better-sqlite3 · node:test
