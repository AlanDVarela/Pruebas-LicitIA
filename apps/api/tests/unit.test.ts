import { describe, expect, it } from 'vitest';
import { evaluar } from '../src/rules/evaluador';
import { numeroLetra } from '../src/lib/letras';
import { canonical } from '../src/lib/hash';
import { WorkflowService } from '../src/services/WorkflowService';

const completo = {
  generales: { objeto: 'Equipo de cómputo para oficinas', areaRequirente: 'TI', justificacion: 'Renovación de equipo' },
  partidas: [{ descripcion: 'Laptop', cantidad: 10, unidad: 'pieza', montoMaximo: 250000 }],
  requisitos: [{ categoria: 'TECNICO' as const, descripcion: '16 GB de RAM', obligatorio: true, criterioEvaluacion: 'Ficha técnica' }],
  fechas: { publicacion: '2026-11-01', aclaraciones: '2026-11-05', apertura: '2026-11-10', fallo: '2026-11-15' },
};

describe('motor de reglas', () => {
  it('no alerta con datos completos', () => expect(evaluar(completo)).toEqual([]));
  it('detecta datos vacíos', () => expect(evaluar({}).map((a) => a.reglaId)).toEqual(expect.arrayContaining(['REQ-001', 'REQ-002'])));
  it('requisito obligatorio sin criterio', () => {
    const d = { ...completo, requisitos: [{ ...completo.requisitos[0]!, criterioEvaluacion: '' }] };
    expect(evaluar(d).map((a) => a.reglaId)).toContain('REQ-003');
  });
  it('fechas fuera de orden', () => {
    const d = { ...completo, fechas: { ...completo.fechas, fallo: '2026-11-02' } };
    expect(evaluar(d).map((a) => a.reglaId)).toContain('REQ-005');
  });
  it('marca sin equivalente es advertencia; con equivalente no', () => {
    const base = completo.requisitos[0]!;
    const mal = evaluar({ ...completo, requisitos: [{ ...base, descripcion: 'Laptop marca Acme' }] });
    expect(mal.find((a) => a.reglaId === 'REQ-006')?.severidad).toBe('ADVERTENCIA');
    const bien = evaluar({ ...completo, requisitos: [{ ...base, descripcion: 'Laptop marca Acme o equivalente' }] });
    expect(bien.find((a) => a.reglaId === 'REQ-006')).toBeUndefined();
  });
});

describe('numeroLetra', () => {
  it.each([[0, 'cero'], [1, 'uno'], [15, 'quince'], [21, 'veintiuno'], [31, 'treinta y uno'], [100, 'cien'], [101, 'ciento uno'], [1000, 'mil'], [21000, 'veintiún mil'], [1_000_000, 'un millón'], [2_500_000, 'dos millones quinientos mil']])(
    '%i → %s', (n, esperado) => expect(numeroLetra(n)).toBe(esperado));
});

describe('bitácora: hash canónico', () => {
  it('no depende del orden de las llaves', () => expect(canonical({ b: 1, a: { d: 2, c: 3 } })).toBe(canonical({ a: { c: 3, d: 2 }, b: 1 })));
});

describe('workflow', () => {
  it('solo el jurídico aprueba en revisión jurídica', () => {
    expect(() => WorkflowService.resolver('EN_REVISION_JURIDICA', 'APROBAR_JURIDICA', 'TECNICO')).toThrow();
    expect(WorkflowService.resolver('EN_REVISION_JURIDICA', 'APROBAR_JURIDICA', 'JURIDICO').hacia).toBe('PENDIENTE_AUTORIZACION');
  });
  it('rechazar exige comentario', () => {
    expect(() => WorkflowService.resolver('EN_REVISION_TECNICA', 'RECHAZAR', 'TECNICO')).toThrow();
    expect(WorkflowService.resolver('EN_REVISION_TECNICA', 'RECHAZAR', 'TECNICO', 'Faltan datos').hacia).toBe('BORRADOR');
  });
  it('no se puede autorizar un borrador', () => expect(() => WorkflowService.resolver('BORRADOR', 'AUTORIZAR', 'AUTORIDAD')).toThrow());
});
