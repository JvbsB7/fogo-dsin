'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import {
  BAIRROS, CIDADE, FUNCAO_POR_CODIGO, OCORRENCIA_POR_CODIGO, REGIOES, STATUS_AGENTE_POR_CODIGO, STATUS_POR_CODIGO, TIPOS_POR_CODIGO,
} from '@/lib/catalog';
import type { Agente, Equipamento, Ocorrencia, ResumoRegiao } from '@/lib/types';
import type { Camadas, Selecao } from '@/stores/filtros';
import { COR_SITUACAO } from './selos';
import { useApi } from './use-api';

const cacheIcones = new Map<string, L.DivIcon>();
function icone(chave: string, html: string, tamanho: number) {
  let i = cacheIcones.get(chave);
  if (!i) {
    i = L.divIcon({ html, className: '', iconSize: [tamanho, tamanho], iconAnchor: [tamanho / 2, tamanho / 2] });
    cacheIcones.set(chave, i);
  }
  return i;
}

function iconeEquipamento(e: Equipamento, selecionado: boolean) {
  const cor = STATUS_POR_CODIGO[e.status]?.cor ?? '#888';
  const alerta = e.status === 'mau_funcionamento' || e.status === 'furtado';
  const t = selecionado ? 32 : 24;
  return icone(
    `e:${e.tipo}:${e.status}:${selecionado}`,
    `<div class="fogo-marcador ${alerta ? 'fogo-marcador--alerta' : ''} ${selecionado ? 'fogo-marcador--selecionado' : ''}" style="--cor:${cor};width:${t}px;height:${t}px;font-size:${t * 0.5}px">${TIPOS_POR_CODIGO[e.tipo]?.icone ?? '•'}</div>`,
    t,
  );
}

function iconeAgente(a: Agente, selecionado: boolean) {
  const cor = STATUS_AGENTE_POR_CODIGO[a.status]?.cor ?? '#888';
  const t = selecionado ? 30 : 24;
  return icone(
    `a:${a.funcao}:${a.status}:${selecionado}`,
    `<div class="fogo-agente" style="--cor:${cor};width:${t}px;height:${t}px;font-size:${t * 0.5}px">${FUNCAO_POR_CODIGO[a.funcao]?.icone ?? '👤'}</div>`,
    t,
  );
}

function iconeOcorrencia(o: Ocorrencia) {
  return icone(
    `o:${o.tipo}`,
    `<div class="fogo-ocorrencia" style="width:22px;height:22px;font-size:11px">${OCORRENCIA_POR_CODIGO[o.tipo]?.icone ?? '!'}</div>`,
    22,
  );
}

/** Centro e raio aproximados de cada região a partir dos bairros. */
const GEO_REGIOES = REGIOES.map((r) => {
  const bs = BAIRROS.filter((b) => b.regiao === r.codigo);
  const lat = bs.reduce((s, b) => s + b.lat, 0) / bs.length;
  const lng = bs.reduce((s, b) => s + b.lng, 0) / bs.length;
  const raio = Math.max(...bs.map((b) => Math.hypot((b.lat - lat) * 111000, (b.lng - lng) * 103000))) + 700;
  return { ...r, centro: [lat, lng] as [number, number], raio };
});

function Foco({ regiao, aoConcluir }: { regiao: string | null; aoConcluir: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (!regiao) return;
    const g = GEO_REGIOES.find((r) => r.codigo === regiao);
    if (g) map.flyTo(g.centro, 14, { duration: 0.8 });
    aoConcluir();
  }, [regiao, map, aoConcluir]);
  return null;
}

/** Enquadra os bairros escolhidos no filtro (só quando a escolha muda). */
function EnquadrarBairros({ bairros }: { bairros: string[] }) {
  const map = useMap();
  const chave = bairros.join('|');
  useEffect(() => {
    const pontos = BAIRROS.filter((b) => chave.split('|').includes(b.nome)).map((b) => [b.lat, b.lng] as [number, number]);
    if (pontos.length) map.flyToBounds(L.latLngBounds(pontos).pad(0.5), { maxZoom: 15, duration: 0.8 });
  }, [chave, map]);
  return null;
}

interface RespostaCalor {
  dias: number;
  total: number;
  celulas: { sul: number; oeste: number; norte: number; leste: number; n: number; intensidade: number }[];
}

/** Mapa de calor das ocorrências recentes: grade de ~450 m colorida por gravidade acumulada. */
function CamadaCalor() {
  const { dado } = useApi<RespostaCalor>('/api/ocorrencias/calor?dias=30', 5 * 60000);
  if (!dado) return null;
  return dado.celulas
    .filter((c) => c.intensidade >= 0.08)
    .map((c) => {
      const t = c.intensidade;
      const cor = t > 0.66 ? '#ef4444' : t > 0.33 ? '#f97316' : '#eab308';
      return (
        <Rectangle
          key={`${c.sul}:${c.oeste}`}
          bounds={[[c.sul, c.oeste], [c.norte, c.leste]]}
          pathOptions={{ stroke: false, fillColor: cor, fillOpacity: 0.1 + t * 0.4 }}
        >
          <Tooltip sticky>{c.n} ocorrência(s) nos últimos {dado.dias} dias</Tooltip>
        </Rectangle>
      );
    });
}

// Marcadores memorizados: com ~400 pontos no mapa, cada atualização ao vivo redesenha só o
// marcador cujo dado mudou (o objeto só é trocado no store quando chega um evento dele).
type AoSelecionar = (s: Selecao) => void;

const MarcadorEquipamento = memo(function MarcadorEquipamento({ e, selecionado, aoSelecionar }: { e: Equipamento; selecionado: boolean; aoSelecionar: AoSelecionar }) {
  const eventos = useMemo(() => ({ click: () => aoSelecionar({ tipo: 'equipamento', id: e.id }) }), [aoSelecionar, e.id]);
  return (
    <Marker
      position={[e.lat, e.lng]}
      icon={iconeEquipamento(e, selecionado)}
      zIndexOffset={selecionado ? 1000 : e.status === 'operacional' ? 0 : 400}
      eventHandlers={eventos}
    >
      <Tooltip direction="top" offset={[0, -10]}>
        {TIPOS_POR_CODIGO[e.tipo]?.nome} · {e.numeroSerie}
        <br />
        {STATUS_POR_CODIGO[e.status]?.rotulo} — {e.bairro}
      </Tooltip>
    </Marker>
  );
});

const MarcadorAgente = memo(function MarcadorAgente({ a, selecionado, aoSelecionar }: { a: Agente; selecionado: boolean; aoSelecionar: AoSelecionar }) {
  const eventos = useMemo(() => ({ click: () => aoSelecionar({ tipo: 'agente', id: a.id }) }), [aoSelecionar, a.id]);
  return (
    <Marker position={[a.lat, a.lng]} icon={iconeAgente(a, selecionado)} zIndexOffset={600} eventHandlers={eventos}>
      <Tooltip direction="top" offset={[0, -10]}>
        {a.nome} ({FUNCAO_POR_CODIGO[a.funcao]?.rotulo})
        <br />
        {STATUS_AGENTE_POR_CODIGO[a.status]?.rotulo}
      </Tooltip>
    </Marker>
  );
});

const MarcadorOcorrencia = memo(function MarcadorOcorrencia({ o, aoSelecionar }: { o: Ocorrencia; aoSelecionar: AoSelecionar }) {
  const eventos = useMemo(() => ({ click: () => aoSelecionar({ tipo: 'ocorrencia', id: o.id }) }), [aoSelecionar, o.id]);
  return (
    <Marker position={[o.lat, o.lng]} icon={iconeOcorrencia(o)} zIndexOffset={800} eventHandlers={eventos}>
      <Tooltip direction="top" offset={[0, -10]}>
        {OCORRENCIA_POR_CODIGO[o.tipo]?.rotulo} · gravidade {o.gravidade}/3
        <br />
        {o.bairro}
      </Tooltip>
    </Marker>
  );
});

function CliqueNoMapa({ aoClicar }: { aoClicar?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => aoClicar?.(e.latlng.lat, e.latlng.lng) });
  return null;
}

export interface MapaProps {
  equipamentos: Equipamento[];
  agentes: Agente[];
  ocorrencias: Ocorrencia[];
  regioes: ResumoRegiao[];
  camadas: Camadas;
  selecao: Selecao;
  aoSelecionar: (s: Selecao) => void;
  focoRegiao?: string | null;
  aoFocar?: () => void;
  aoClicarRegiao?: (regiao: string) => void;
  bairros?: string[];
}

export default function Mapa({ equipamentos, agentes, ocorrencias, regioes, camadas, selecao, aoSelecionar, focoRegiao, aoFocar, aoClicarRegiao, bairros = [] }: MapaProps) {
  const situacao = useMemo(() => Object.fromEntries(regioes.map((r) => [r.regiao, r])), [regioes]);
  const limparSelecao = useCallback(() => aoSelecionar(null), [aoSelecionar]);
  return (
    <MapContainer center={CIDADE.centro} zoom={13} minZoom={11} className="size-full" preferCanvas={false} zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="fogo-tiles"
        maxZoom={19}
      />
      <Foco regiao={focoRegiao ?? null} aoConcluir={aoFocar ?? (() => {})} />
      <EnquadrarBairros bairros={bairros} />
      <CliqueNoMapa aoClicar={limparSelecao} />

      {camadas.calor && <CamadaCalor />}

      {camadas.regioes &&
        GEO_REGIOES.map((g) => {
          const r = situacao[g.codigo];
          const cor = r ? COR_SITUACAO[r.situacao] : g.cor;
          return (
            <Circle
              key={g.codigo}
              center={g.centro}
              radius={g.raio}
              pathOptions={{ color: cor, weight: 1.5, fillColor: cor, fillOpacity: 0.07, dashArray: '6 6' }}
              eventHandlers={{ click: () => aoClicarRegiao?.(g.codigo) }}
            >
              <Tooltip sticky>
                <strong>{g.nome}</strong>
                {r && (
                  <>
                    <br />
                    Disponibilidade {r.disponibilidade}% · risco {r.riscoAgora}
                    <br />
                    {r.ocorrenciasAtivas} ocorrência(s) · {r.agentesAtivos} agente(s)
                  </>
                )}
              </Tooltip>
            </Circle>
          );
        })}

      {camadas.equipamentos &&
        equipamentos.map((e) => (
          <MarcadorEquipamento key={`e${e.id}`} e={e} selecionado={selecao?.tipo === 'equipamento' && selecao.id === e.id} aoSelecionar={aoSelecionar} />
        ))}

      {camadas.agentes &&
        agentes.map((a) => (
          <MarcadorAgente key={`a${a.id}`} a={a} selecionado={selecao?.tipo === 'agente' && selecao.id === a.id} aoSelecionar={aoSelecionar} />
        ))}

      {camadas.ocorrencias && ocorrencias.map((o) => <MarcadorOcorrencia key={`o${o.id}`} o={o} aoSelecionar={aoSelecionar} />)}
    </MapContainer>
  );
}
