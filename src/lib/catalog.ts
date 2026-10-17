// Catálogo de domínio do F.O.G.O.: tipos de equipamento (com atributos próprios),
// situações, órgãos, funções de agentes e a divisão territorial da cidade.
// Tudo aqui é dado de referência: o banco guarda só as instâncias.
// É importado tanto pelo servidor quanto pelas telas (não depende de nada do Node).

export type StatusEquipamento =
  | 'operacional' | 'mau_funcionamento' | 'em_manutencao' | 'desativado' | 'furtado' | 'nao_instalado';
export type StatusAgente = 'em_patrulha' | 'em_ocorrencia' | 'em_pausa' | 'fora_de_servico';
export type Turno = 'manha' | 'tarde' | 'noite';
export type ManutencaoTipo = 'nenhuma' | 'imediata' | 'agendada' | 'periodica';

export interface AtributoDef {
  campo: string;
  rotulo: string;
  tipo: 'number' | 'text' | 'bool' | 'select' | 'multiselect';
  opcoes?: string[];
  obrigatorio?: boolean;
  min?: number;
  max?: number;
}

export interface TipoEquipamentoDef {
  codigo: string;
  nome: string;
  grupo: string;
  icone: string;
  categoria: 'fixo' | 'movel';
  orgao: string;
  intervaloManutencaoDias: number;
  /** De quanto em quanto tempo o dispositivo IoT manda sinal de vida. */
  heartbeatSeg: number;
  /** Taxa média de falhas por ano usada pelo gerador de histórico e pelo simulador. */
  falhasAno: number;
  marcas: Record<string, string[]>;
  atributos: AtributoDef[];
}

export const CIDADE = { nome: 'Marília', uf: 'SP', centro: [-22.2171, -49.9501] as [number, number] };

export const STATUS_EQUIPAMENTO: { codigo: StatusEquipamento; rotulo: string; cor: string }[] = [
  { codigo: 'operacional', rotulo: 'Operacional', cor: '#22c55e' },
  { codigo: 'mau_funcionamento', rotulo: 'Mau funcionamento', cor: '#f97316' },
  { codigo: 'em_manutencao', rotulo: 'Em manutenção', cor: '#eab308' },
  { codigo: 'furtado', rotulo: 'Furtado / vandalizado', cor: '#ef4444' },
  { codigo: 'desativado', rotulo: 'Desativado', cor: '#64748b' },
  { codigo: 'nao_instalado', rotulo: 'Ainda não instalado', cor: '#a78bfa' },
];
export const STATUS_CODIGOS = STATUS_EQUIPAMENTO.map((s) => s.codigo);
export const STATUS_POR_CODIGO = Object.fromEntries(STATUS_EQUIPAMENTO.map((s) => [s.codigo, s])) as Record<
  StatusEquipamento,
  (typeof STATUS_EQUIPAMENTO)[number]
>;

// Situações que entram no denominador da disponibilidade: o equipamento deveria estar
// funcionando. "Não instalado" e "desativado" ficam de fora de propósito.
export const STATUS_EM_SERVICO: StatusEquipamento[] = ['operacional', 'mau_funcionamento', 'em_manutencao', 'furtado'];

export const MANUTENCAO_TIPOS: { codigo: ManutencaoTipo; rotulo: string }[] = [
  { codigo: 'nenhuma', rotulo: 'Sem necessidade' },
  { codigo: 'imediata', rotulo: 'Imediata' },
  { codigo: 'agendada', rotulo: 'Agendada' },
  { codigo: 'periodica', rotulo: 'Periódica' },
];

export const ORGAOS = [
  { codigo: 'SEMOB', nome: 'Secretaria de Mobilidade Urbana' },
  { codigo: 'GCM', nome: 'Guarda Civil Municipal' },
  { codigo: 'PM', nome: 'Polícia Militar' },
  { codigo: 'CONC', nome: 'Concessionária de rodovias' },
  { codigo: 'MICRO', nome: 'Operadora de micromobilidade' },
  { codigo: 'TRANSP', nome: 'Permissionários de transporte' },
];

const num = (campo: string, rotulo: string, extra: Partial<AtributoDef> = {}): AtributoDef => ({ campo, rotulo, tipo: 'number', ...extra });
const bool = (campo: string, rotulo: string): AtributoDef => ({ campo, rotulo, tipo: 'bool' });
const txt = (campo: string, rotulo: string, extra: Partial<AtributoDef> = {}): AtributoDef => ({ campo, rotulo, tipo: 'text', ...extra });
const sel = (campo: string, rotulo: string, opcoes: string[], extra: Partial<AtributoDef> = {}): AtributoDef => ({
  campo, rotulo, tipo: 'select', opcoes, ...extra,
});
const multi = (campo: string, rotulo: string, opcoes: string[]): AtributoDef => ({ campo, rotulo, tipo: 'multiselect', opcoes });

export const TIPOS_EQUIPAMENTO: TipoEquipamentoDef[] = [
  {
    codigo: 'radar_velocidade', nome: 'Radar de velocidade', grupo: 'Fiscalização', icone: '📸',
    categoria: 'fixo', orgao: 'SEMOB', intervaloManutencaoDias: 365, heartbeatSeg: 60, falhasAno: 2.2,
    marcas: { Perkons: ['PK-Speed 4', 'PK-Speed 5'], Velsis: ['VS-R300'], VigiaTech: ['VT-X200'] },
    atributos: [
      num('velocidade_maxima_kmh', 'Velocidade máxima (km/h)', { obrigatorio: true, min: 20, max: 120 }),
      num('faixas_monitoradas', 'Faixas monitoradas', { min: 1, max: 6 }),
      sel('sentido', 'Sentido', ['Bairro → Centro', 'Centro → Bairro', 'Ambos']),
      txt('certificado_inmetro', 'Certificado de aferição (INMETRO)'),
    ],
  },
  {
    codigo: 'radar_semaforo', nome: 'Radar de avanço de semáforo', grupo: 'Fiscalização', icone: '🚦',
    categoria: 'fixo', orgao: 'SEMOB', intervaloManutencaoDias: 365, heartbeatSeg: 60, falhasAno: 2.0,
    marcas: { Perkons: ['PK-Red 2'], Velsis: ['VS-Sinal'] },
    atributos: [
      num('faixas_monitoradas', 'Faixas monitoradas', { min: 1, max: 6 }),
      bool('fiscaliza_parada_faixa', 'Fiscaliza parada sobre a faixa'),
      bool('captura_noturna', 'Captura noturna (infravermelho)'),
    ],
  },
  {
    codigo: 'radar_conversao', nome: 'Radar de conversão/retorno proibido', grupo: 'Fiscalização', icone: '↩️',
    categoria: 'fixo', orgao: 'SEMOB', intervaloManutencaoDias: 365, heartbeatSeg: 60, falhasAno: 1.8,
    marcas: { Velsis: ['VS-Conv'], VigiaTech: ['VT-X200'] },
    atributos: [
      sel('infracao', 'Infração fiscalizada', ['Retorno proibido', 'Conversão proibida', 'Faixa exclusiva de ônibus'], { obrigatorio: true }),
    ],
  },
  {
    codigo: 'camera', nome: 'Câmera de videomonitoramento', grupo: 'Monitoramento', icone: '🎥',
    categoria: 'fixo', orgao: 'GCM', intervaloManutencaoDias: 180, heartbeatSeg: 30, falhasAno: 1.6,
    marcas: { Intelbras: ['VIP 5450', 'VIP 9250 PTZ'], Hikvision: ['DS-2CD2T47'], VigiaTech: ['VT-Cam 4K'] },
    atributos: [
      sel('resolucao', 'Resolução', ['720p', '1080p', '4MP', '4K'], { obrigatorio: true }),
      bool('visao_noturna', 'Visão noturna'),
      bool('colorida', 'Imagem colorida'),
      bool('ptz', 'PTZ (giro e zoom remoto)'),
      bool('leitura_placas', 'Leitura automática de placas (LPR)'),
    ],
  },
  {
    codigo: 'semaforo', nome: 'Semáforo inteligente', grupo: 'Controle de tráfego', icone: '🚥',
    categoria: 'fixo', orgao: 'SEMOB', intervaloManutencaoDias: 120, heartbeatSeg: 60, falhasAno: 2.5,
    marcas: { Tesc: ['SmartSem 3'], Digicon: ['DS-Traffic'] },
    atributos: [
      num('fases', 'Número de fases', { min: 2, max: 8 }),
      bool('botoeira_pedestre', 'Botoeira para pedestre'),
      bool('nobreak', 'Nobreak (continua sem energia)'),
      bool('tempo_adaptativo', 'Tempo adaptativo ao fluxo'),
    ],
  },
  {
    codigo: 'balanca', nome: 'Balança de caminhão', grupo: 'Fiscalização', icone: '⚖️',
    categoria: 'fixo', orgao: 'CONC', intervaloManutencaoDias: 180, heartbeatSeg: 60, falhasAno: 1.2,
    marcas: { Toledo: ['WIM-2000'], Kistler: ['Lineas WIM'] },
    atributos: [
      sel('modalidade', 'Modalidade', ['Pesagem em movimento (WIM)', 'Estática'], { obrigatorio: true }),
      num('capacidade_t', 'Capacidade (t)', { min: 10, max: 120 }),
    ],
  },
  {
    codigo: 'cancela', nome: 'Cancela automatizada', grupo: 'Acesso', icone: '🚧',
    categoria: 'fixo', orgao: 'SEMOB', intervaloManutencaoDias: 90, heartbeatSeg: 60, falhasAno: 3.0,
    marcas: { Nice: ['Wil 4'], PPA: ['Cancela Plus'] },
    atributos: [
      sel('local_tipo', 'Tipo de local', ['Estacionamento público', 'Terminal rodoviário', 'Área restrita'], { obrigatorio: true }),
      multi('leitura', 'Liberação por', ['Tag', 'Placa (LPR)', 'Ticket', 'QR Code']),
    ],
  },
  {
    codigo: 'totem_rotativo', nome: 'Totem de estacionamento rotativo', grupo: 'Estacionamento', icone: '🅿️',
    categoria: 'fixo', orgao: 'SEMOB', intervaloManutencaoDias: 90, heartbeatSeg: 120, falhasAno: 2.8,
    marcas: { Digicon: ['Totem ZA'], Parkimetro: ['PK-500'] },
    atributos: [
      multi('pagamento', 'Formas de pagamento', ['Pix', 'Cartão', 'Moedas', 'Aplicativo']),
      num('vagas_area', 'Vagas na área atendida', { min: 1, max: 500 }),
    ],
  },
  {
    codigo: 'veiculo_fiscalizacao', nome: 'Veículo autônomo de fiscalização do rotativo', grupo: 'Estacionamento', icone: '🤖',
    categoria: 'movel', orgao: 'SEMOB', intervaloManutencaoDias: 60, heartbeatSeg: 15, falhasAno: 3.5,
    marcas: { AutoScan: ['AS-1'], VigiaTech: ['VT-Rover'] },
    atributos: [
      num('autonomia_km', 'Autonomia (km)', { min: 10, max: 400 }),
      num('cameras_lpr', 'Câmeras LPR', { min: 1, max: 8 }),
    ],
  },
  {
    codigo: 'patinete', nome: 'Patinete elétrico compartilhado', grupo: 'Micromobilidade', icone: '🛴',
    categoria: 'movel', orgao: 'MICRO', intervaloManutencaoDias: 30, heartbeatSeg: 30, falhasAno: 4.0,
    marcas: { Jet: ['Jet One'], Grow: ['Grin 3'] },
    atributos: [
      num('bateria_pct', 'Bateria (%)', { min: 0, max: 100 }),
      txt('operadora', 'Operadora'),
      bool('publico', 'Público (prefeitura)'),
    ],
  },
  {
    codigo: 'veiculo_transporte', nome: 'Veículo de transporte (táxi, mototáxi, escolar)', grupo: 'Transporte', icone: '🚕',
    categoria: 'movel', orgao: 'TRANSP', intervaloManutencaoDias: 180, heartbeatSeg: 30, falhasAno: 1.0,
    marcas: { Chevrolet: ['Spin', 'Onix'], Honda: ['CG 160'], Volkswagen: ['Kombi Escolar', 'Voyage'] },
    atributos: [
      sel('modalidade', 'Modalidade', ['Táxi', 'Mototáxi', 'Transporte escolar'], { obrigatorio: true }),
      txt('placa', 'Placa', { obrigatorio: true }),
      txt('alvara', 'Alvará'),
      num('capacidade', 'Capacidade (passageiros)', { min: 1, max: 40 }),
    ],
  },
  {
    codigo: 'moto_agente', nome: 'Moto de agente de trânsito', grupo: 'Frota operacional', icone: '🏍️',
    categoria: 'movel', orgao: 'SEMOB', intervaloManutencaoDias: 90, heartbeatSeg: 15, falhasAno: 1.0,
    marcas: { Honda: ['XRE 300', 'NC 750X'], Yamaha: ['Lander 250'] },
    atributos: [txt('placa', 'Placa', { obrigatorio: true }), num('cilindrada', 'Cilindrada (cc)', { min: 50, max: 1300 })],
  },
  {
    codigo: 'viatura_gcm', nome: 'Viatura da Guarda Municipal', grupo: 'Frota operacional', icone: '🚓',
    categoria: 'movel', orgao: 'GCM', intervaloManutencaoDias: 90, heartbeatSeg: 15, falhasAno: 1.0,
    marcas: { Toyota: ['Hilux'], Renault: ['Duster'] },
    atributos: [txt('placa', 'Placa', { obrigatorio: true }), txt('prefixo', 'Prefixo')],
  },
  {
    codigo: 'viatura_pm', nome: 'Viatura da Polícia Militar', grupo: 'Frota operacional', icone: '🚔',
    categoria: 'movel', orgao: 'PM', intervaloManutencaoDias: 90, heartbeatSeg: 15, falhasAno: 1.0,
    marcas: { Chevrolet: ['Trailblazer'], Toyota: ['Corolla Cross'] },
    atributos: [txt('placa', 'Placa', { obrigatorio: true }), txt('prefixo', 'Prefixo')],
  },
];
export const TIPOS_POR_CODIGO: Record<string, TipoEquipamentoDef> = Object.fromEntries(
  TIPOS_EQUIPAMENTO.map((t) => [t.codigo, t]),
);

export const FUNCOES_AGENTE = [
  { codigo: 'agente_transito', rotulo: 'Agente de trânsito', orgao: 'SEMOB', icone: '🦺' },
  { codigo: 'guarda_municipal', rotulo: 'Guarda municipal', orgao: 'GCM', icone: '🛡️' },
  { codigo: 'policial_militar', rotulo: 'Policial militar', orgao: 'PM', icone: '👮' },
];
export const FUNCAO_POR_CODIGO = Object.fromEntries(FUNCOES_AGENTE.map((f) => [f.codigo, f]));

export const STATUS_AGENTE: { codigo: StatusAgente; rotulo: string; cor: string; ativo: boolean }[] = [
  { codigo: 'em_patrulha', rotulo: 'Em patrulha', cor: '#22c55e', ativo: true },
  { codigo: 'em_ocorrencia', rotulo: 'Atendendo ocorrência', cor: '#f97316', ativo: true },
  { codigo: 'em_pausa', rotulo: 'Em pausa', cor: '#eab308', ativo: false },
  { codigo: 'fora_de_servico', rotulo: 'Fora de serviço', cor: '#64748b', ativo: false },
];
export const STATUS_AGENTE_CODIGOS = STATUS_AGENTE.map((s) => s.codigo);
export const STATUS_AGENTE_ATIVOS = STATUS_AGENTE.filter((s) => s.ativo).map((s) => s.codigo);
export const STATUS_AGENTE_POR_CODIGO = Object.fromEntries(STATUS_AGENTE.map((s) => [s.codigo, s])) as Record<
  StatusAgente,
  (typeof STATUS_AGENTE)[number]
>;

export const TURNOS: { codigo: Turno; rotulo: string; inicio: number; fim: number }[] = [
  { codigo: 'manha', rotulo: 'Manhã (06h–14h)', inicio: 6, fim: 14 },
  { codigo: 'tarde', rotulo: 'Tarde (14h–22h)', inicio: 14, fim: 22 },
  { codigo: 'noite', rotulo: 'Noite (22h–06h)', inicio: 22, fim: 6 },
];

export function turnoDaHora(h: number): Turno {
  if (h >= 6 && h < 14) return 'manha';
  if (h >= 14 && h < 22) return 'tarde';
  return 'noite';
}

export const TIPOS_OCORRENCIA = [
  { codigo: 'acidente', rotulo: 'Acidente de trânsito', peso: 3, icone: '💥' },
  { codigo: 'congestionamento', rotulo: 'Congestionamento severo', peso: 1, icone: '🚗' },
  { codigo: 'semaforo_apagado', rotulo: 'Semáforo apagado', peso: 2, icone: '⚫' },
  { codigo: 'veiculo_quebrado', rotulo: 'Veículo quebrado na via', peso: 1, icone: '🛠️' },
  { codigo: 'infracao_grave', rotulo: 'Infração grave em flagrante', peso: 2, icone: '⚠️' },
  { codigo: 'vandalismo', rotulo: 'Vandalismo / furto de equipamento', peso: 2, icone: '🔨' },
];
export const OCORRENCIA_POR_CODIGO = Object.fromEntries(TIPOS_OCORRENCIA.map((t) => [t.codigo, t]));

// Divisão territorial de Marília/SP usada como cenário. As coordenadas dos bairros são
// aproximadas e servem para distribuir os equipamentos no mapa.
export const REGIOES = [
  { codigo: 'centro', nome: 'Centro', cor: '#38bdf8' },
  { codigo: 'norte', nome: 'Zona Norte', cor: '#a78bfa' },
  { codigo: 'sul', nome: 'Zona Sul', cor: '#f472b6' },
  { codigo: 'leste', nome: 'Zona Leste', cor: '#34d399' },
  { codigo: 'oeste', nome: 'Zona Oeste', cor: '#fbbf24' },
];
export const REGIAO_POR_CODIGO = Object.fromEntries(REGIOES.map((r) => [r.codigo, r]));

export const BAIRROS = [
  { nome: 'Centro', regiao: 'centro', lat: -22.2160, lng: -49.9470, cep: '17500' },
  { nome: 'Barbosa', regiao: 'centro', lat: -22.2235, lng: -49.9525, cep: '17501' },
  { nome: 'Fragata', regiao: 'centro', lat: -22.2200, lng: -49.9385, cep: '17519' },
  { nome: 'Senador Salgado Filho', regiao: 'centro', lat: -22.2085, lng: -49.9545, cep: '17502' },
  { nome: 'Alto Cafezal', regiao: 'centro', lat: -22.2290, lng: -49.9445, cep: '17504' },
  { nome: 'Jardim Santa Antonieta', regiao: 'norte', lat: -22.1930, lng: -49.9520, cep: '17509' },
  { nome: 'Nova Marília', regiao: 'norte', lat: -22.1880, lng: -49.9400, cep: '17510' },
  { nome: 'Palmital', regiao: 'norte', lat: -22.2010, lng: -49.9330, cep: '17511' },
  { nome: 'Jardim Araxá', regiao: 'norte', lat: -22.1960, lng: -49.9645, cep: '17512' },
  { nome: 'Aeroporto', regiao: 'norte', lat: -22.1965, lng: -49.9275, cep: '17514' },
  { nome: 'Jardim Maria Izabel', regiao: 'sul', lat: -22.2400, lng: -49.9600, cep: '17515' },
  { nome: 'Cascata', regiao: 'sul', lat: -22.2380, lng: -49.9420, cep: '17516' },
  { nome: 'Jardim Morumbi', regiao: 'sul', lat: -22.2470, lng: -49.9510, cep: '17517' },
  { nome: 'Jardim Cavallari', regiao: 'sul', lat: -22.2330, lng: -49.9700, cep: '17518' },
  { nome: 'Parque São Jorge', regiao: 'sul', lat: -22.2520, lng: -49.9380, cep: '17520' },
  { nome: 'Jardim Tangará', regiao: 'leste', lat: -22.2120, lng: -49.9200, cep: '17521' },
  { nome: 'Somenzari', regiao: 'leste', lat: -22.2250, lng: -49.9265, cep: '17522' },
  { nome: 'Jardim Sasazaki', regiao: 'leste', lat: -22.2050, lng: -49.9150, cep: '17523' },
  { nome: 'Parque dos Ipês', regiao: 'leste', lat: -22.2300, lng: -49.9150, cep: '17524' },
  { nome: 'Jardim Califórnia', regiao: 'oeste', lat: -22.2150, lng: -49.9755, cep: '17525' },
  { nome: 'Jardim Alvorada', regiao: 'oeste', lat: -22.2050, lng: -49.9720, cep: '17526' },
  { nome: 'Distrito Industrial', regiao: 'oeste', lat: -22.2000, lng: -49.9900, cep: '17527' },
  { nome: 'Jardim Esplanada', regiao: 'oeste', lat: -22.2250, lng: -49.9800, cep: '17528' },
];

export const LOGRADOUROS = [
  'Av. Sampaio Vidal', 'Av. Rio Branco', 'Rua Nove de Julho', 'Rua São Luiz', 'Av. Santo Antônio',
  'Av. Vicente Ferreira', 'Av. Pedro de Toledo', 'Av. das Esmeraldas', 'Av. República', 'Av. Tiradentes',
  'Av. Brigadeiro Eduardo Gomes', 'Av. Castro Alves', 'Av. João Ramalho', 'Av. Carlos Gomes', 'Rua Paraíba',
  'Av. Nelson Spielmann', 'Av. Sigismundo Nunes de Oliveira', 'Rua Bahia', 'Rua Prudente de Moraes', 'Av. Cascata',
];
export const RODOVIAS = ['Rodovia SP-294', 'Rodovia SP-333'];
