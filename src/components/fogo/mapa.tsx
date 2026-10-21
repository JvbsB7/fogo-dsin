'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import {
  BAIRROS, CIDADE, FUNCAO_POR_CODIGO, OCORRENCIA_POR_CODIGO, REGIOES, STATUS_AGENTE_POR_CODIGO, STATUS_POR_CODIGO, TIPOS_POR_CODIGO,
} from '@/lib/catalog';
import type { Agente, Equipamento, Ocorrencia, ResumoRegiao } from '@/lib/types';
import type { Camadas, Selecao } from '@/stores/filtros';
import { COR_SITUACAO } from './selos';

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
}

export default function Mapa({ equipamentos, agentes, ocorrencias, regioes, camadas, selecao, aoSelecionar, focoRegiao, aoFocar, aoClicarRegiao }: MapaProps) {
  const situacao = useMemo(() => Object.fromEntries(regioes.map((r) => [r.regiao, r])), [regioes]);
  return (
    <MapContainer center={CIDADE.centro} zoom={13} minZoom={11} className="size-full" preferCanvas={false} zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="fogo-tiles"
        maxZoom={19}
      />
      <Foco regiao={focoRegiao ?? null} aoConcluir={aoFocar ?? (() => {})} />
      <CliqueNoMapa aoClicar={() => aoSelecionar(null)} />

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
        equipamentos.map((e) => {
          const sel = selecao?.tipo === 'equipamento' && selecao.id === e.id;
          return (
            <Marker
              key={`e${e.id}`}
              position={[e.lat, e.lng]}
              icon={iconeEquipamento(e, sel)}
              zIndexOffset={sel ? 1000 : e.status === 'operacional' ? 0 : 400}
              eventHandlers={{ click: () => aoSelecionar({ tipo: 'equipamento', id: e.id }) }}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                {TIPOS_POR_CODIGO[e.tipo]?.nome} · {e.numeroSerie}
                <br />
                {STATUS_POR_CODIGO[e.status]?.rotulo} — {e.bairro}
              </Tooltip>
            </Marker>
          );
        })}

      {camadas.agentes &&
        agentes.map((a) => {
          const sel = selecao?.tipo === 'agente' && selecao.id === a.id;
          return (
            <Marker
              key={`a${a.id}`}
              position={[a.lat, a.lng]}
              icon={iconeAgente(a, sel)}
              zIndexOffset={600}
              eventHandlers={{ click: () => aoSelecionar({ tipo: 'agente', id: a.id }) }}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                {a.nome} ({FUNCAO_POR_CODIGO[a.funcao]?.rotulo})
                <br />
                {STATUS_AGENTE_POR_CODIGO[a.status]?.rotulo}
              </Tooltip>
            </Marker>
          );
        })}

      {camadas.ocorrencias &&
        ocorrencias.map((o) => (
          <Marker
            key={`o${o.id}`}
            position={[o.lat, o.lng]}
            icon={iconeOcorrencia(o)}
            zIndexOffset={800}
            eventHandlers={{ click: () => aoSelecionar({ tipo: 'ocorrencia', id: o.id }) }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              {OCORRENCIA_POR_CODIGO[o.tipo]?.rotulo} · gravidade {o.gravidade}/3
              <br />
              {o.bairro}
            </Tooltip>
          </Marker>
        ))}
    </MapContainer>
  );
}
