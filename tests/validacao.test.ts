import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizarCep, validarAgente, validarEquipamento } from '@/lib/validacao';

const base = {
  tipo: 'radar_velocidade', numeroSerie: 'rvl-001', marca: 'Perkons', modelo: 'PK-Speed 5', status: 'operacional',
  cep: '17500000', bairro: 'Centro', logradouro: 'Av. Sampaio Vidal', referencia: 'oposto ao nº 181', lat: -22.21, lng: -49.94,
  manutencaoTipo: 'periodica', manutencaoProxima: '2027-01-10', instaladoEm: '2025-05-01',
  atributos: { velocidade_maxima_kmh: '60', faixas_monitoradas: 2, sentido: 'Ambos' },
};

describe('validação de equipamento', () => {
  it('aceita um cadastro completo e normaliza os campos', () => {
    const r = validarEquipamento(base);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.dado.numeroSerie, 'RVL-001');
      assert.equal(r.dado.cep, '17500-000');
      assert.equal(r.dado.orgao, 'SEMOB'); // herdado do tipo
      assert.equal(r.dado.atributos.velocidade_maxima_kmh, 60);
    }
  });

  it('aponta cada campo inválido', () => {
    const r = validarEquipamento({ ...base, tipo: 'nave', cep: '123', bairro: 'Atlântida', lat: 200 });
    assert.equal(r.ok, false);
    if (!r.ok) for (const c of ['tipo', 'cep', 'bairro', 'lat']) assert.ok(r.campos[c], `esperava erro em ${c}`);
  });

  it('valida atributos próprios do tipo', () => {
    const r = validarEquipamento({ ...base, atributos: { velocidade_maxima_kmh: 300, sentido: 'Para cima' } });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.campos['atributos.velocidade_maxima_kmh']);
      assert.ok(r.campos['atributos.sentido']);
    }
  });

  it('exige data da próxima manutenção quando ela é periódica ou agendada', () => {
    const r = validarEquipamento({ ...base, manutencaoProxima: '' });
    assert.equal(r.ok, false);
  });

  it('equipamento ainda não instalado dispensa data de instalação', () => {
    const r = validarEquipamento({ ...base, status: 'nao_instalado', instaladoEm: '', manutencaoTipo: 'nenhuma', manutencaoProxima: '' });
    assert.equal(r.ok, true);
  });
});

describe('validação de agente', () => {
  it('usa as coordenadas do bairro quando não informadas', () => {
    const r = validarAgente({ nome: 'Ana Souza', matricula: 'semob-9', funcao: 'agente_transito', status: 'em_patrulha', turno: 'manha', bairroBase: 'Fragata' });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.dado.matricula, 'SEMOB-9');
      assert.equal(r.dado.orgao, 'SEMOB');
      assert.ok(Number.isFinite(r.dado.lat));
    }
  });

  it('rejeita nome sem sobrenome e turno inválido', () => {
    const r = validarAgente({ nome: 'Ana', matricula: 'X-1', funcao: 'agente_transito', status: 'em_patrulha', turno: 'madrugada', bairroBase: 'Centro' });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.campos.nome);
      assert.ok(r.campos.turno);
    }
  });

  it('normaliza CEP', () => assert.equal(normalizarCep('17.500-000'), '17500-000'));
});
