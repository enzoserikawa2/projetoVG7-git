import { describe, expect, it } from 'vitest'
import {
  buildOccurrenceFromCriterion,
  createAppliedChecklist,
  createEmptyInspection,
  createLocation,
  getReviewSummary
} from './inspection'
import { createId, nowIso } from './ids'
import type { ChecklistTemplate, CriticalityLevel } from './types'
import { APP_SCHEMA_VERSION } from './types'

function template(): ChecklistTemplate {
  const timestamp = nowIso()
  return {
    id: createId(),
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    kind: 'checklist-template',
    active: true,
    title: 'Checklist de teste',
    version: 3,
    system: 'HVAC',
    equipmentTypes: ['Chiller'],
    criteria: [
      { id: createId(), text: 'Critério conforme.', guidance: '', order: 1, active: true },
      { id: createId(), text: 'Critério não conforme.', guidance: '', order: 2, active: true },
      { id: createId(), text: 'Critério não aplicável.', guidance: '', order: 3, active: true },
      { id: createId(), text: 'Critério não inspecionado.', guidance: '', order: 4, active: true }
    ]
  }
}

describe('regras da vistoria', () => {
  it('mantém snapshot do checklist e inicia todos os critérios como não inspecionados', () => {
    const source = template()
    const applied = createAppliedChecklist(source)
    source.criteria[0]!.text = 'Texto alterado depois'

    expect(applied.templateVersion).toBe(3)
    expect(applied.responses[0]!.criterionText).toBe('Critério conforme.')
    expect(applied.responses.every((response) => response.status === 'nao_inspecionado')).toBe(true)
  })

  it('conta os quatro estados separadamente e não trata não inspecionado como conforme', () => {
    const inspection = createEmptyInspection()
    inspection.client = 'Cliente Teste'
    inspection.conclusion = 'Conclusão revisada pelo responsável técnico.'
    const location = createLocation('Casa de máquinas')
    const timestamp = nowIso()
    const checklist = createAppliedChecklist(template())
    checklist.responses[0]!.status = 'conforme'
    checklist.responses[1]!.status = 'nao_conforme'
    checklist.responses[2]!.status = 'nao_aplicavel'
    checklist.responses[3]!.status = 'nao_inspecionado'
    location.equipment.push({
      id: createId(),
      schemaVersion: APP_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
      tag: 'CH-01',
      type: 'Chiller',
      manufacturer: '',
      model: '',
      serialNumber: '',
      operatingState: 'nao_informado',
      observations: '',
      limitations: '',
      checklist
    })
    inspection.locations.push(location)

    const summary = getReviewSummary(inspection, 0)
    expect(summary.totalCriteria).toBe(4)
    expect(summary.conforme).toBe(1)
    expect(summary.naoConforme).toBe(1)
    expect(summary.naoAplicavel).toBe(1)
    expect(summary.naoInspecionado).toBe(1)
    expect(summary.warnings.some((warning) => warning.code === 'NOT_INSPECTED')).toBe(true)
  })

  it('separa criticidade sugerida de criticidade confirmada', () => {
    const inspection = createEmptyInspection()
    const level: CriticalityLevel = {
      id: createId(),
      schemaVersion: APP_SCHEMA_VERSION,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      kind: 'criticality',
      active: true,
      title: 'Média',
      description: 'Teste',
      rank: 2
    }
    const occurrence = buildOccurrenceFromCriterion({
      inspection,
      locationId: createId(),
      equipmentId: createId(),
      criterionId: createId(),
      criterionText: 'Equipamento sem sinais visíveis de corrosão.',
      criticality: level
    })

    expect(occurrence.suggestedCriticalityId).toBe(level.id)
    expect(occurrence.confirmedCriticalityId).toBeUndefined()
    expect(occurrence.criticalityConfirmedAt).toBeUndefined()
  })

  it('bloqueia ocorrência não revisada e sinaliza divergência com o checklist', () => {
    const inspection = createEmptyInspection()
    const location = createLocation('Casa de máquinas')
    const timestamp = nowIso()
    const checklist = createAppliedChecklist(template())
    checklist.responses[0]!.status = 'nao_conforme'
    const equipmentId = createId()
    location.equipment.push({
      id: equipmentId,
      schemaVersion: APP_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
      tag: 'CH-01',
      type: 'Chiller',
      manufacturer: '',
      model: '',
      serialNumber: '',
      operatingState: 'nao_informado',
      observations: '',
      limitations: '',
      checklist
    })
    inspection.locations.push(location)
    const occurrence = buildOccurrenceFromCriterion({
      inspection,
      locationId: location.id,
      equipmentId,
      criterionId: checklist.responses[0]!.criterionId,
      criterionText: checklist.responses[0]!.criterionText
    })
    occurrence.title = 'Ocorrência de teste'
    occurrence.finding = 'Condição observada.'
    occurrence.recommendation = 'Avaliar a condição.'
    inspection.occurrences.push(occurrence)

    let summary = getReviewSummary(inspection, 0)
    expect(summary.occurrencesPendingReview).toBe(1)
    expect(summary.warnings.find((warning) => warning.code === 'OCCURRENCE_REVIEW_PENDING')?.blocking).toBe(true)

    occurrence.requiresReview = false
    checklist.responses[0]!.status = 'conforme'
    summary = getReviewSummary(inspection, 0)
    expect(summary.occurrenceStatusMismatches).toBe(1)
    expect(summary.warnings.find((warning) => warning.code === 'OCCURRENCE_STATUS_MISMATCH')?.blocking).toBe(false)
  })
})
