import { DEFAULT_CONCLUSION } from './constants'
import { createId, dateOnly, nowIso } from './ids'
import type {
  AppliedChecklist,
  ChecklistStatus,
  ChecklistTemplate,
  CriticalityLevel,
  Inspection,
  InspectionLocation,
  Occurrence,
  OccurrenceReference,
  OccurrenceTemplate,
  ProfessionalSettings,
  ReviewSummary,
  ReviewWarning
} from './types'
import { APP_SCHEMA_VERSION } from './types'

export function createEmptyInspection(settings?: ProfessionalSettings): Inspection {
  const timestamp = nowIso()
  const id = createId()
  return {
    id,
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
    status: 'em_andamento',
    isDemo: false,
    client: '',
    facility: '',
    address: '',
    inspectionDate: dateOnly(),
    inspector: settings?.engineerName ?? '',
    technicalLead: settings?.engineerName ?? '',
    contractNumber: '',
    purpose: settings?.defaultPurpose ?? '',
    inspectionType: 'Vistoria visual e documental',
    scope: settings?.defaultScope ?? '',
    methodology: settings?.defaultMethodology ?? '',
    generalNotes: '',
    limitations: settings?.defaultLimitations ?? '',
    conclusion: DEFAULT_CONCLUSION,
    locations: [],
    occurrences: [],
    lastRoute: `/inspection/${id}/basics`
  }
}

export function createLocation(name: string): InspectionLocation {
  const timestamp = nowIso()
  return {
    id: createId(),
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    name,
    description: '',
    observations: '',
    limitations: '',
    equipment: []
  }
}

export function createAppliedChecklist(template: ChecklistTemplate): AppliedChecklist {
  const timestamp = nowIso()
  return {
    id: createId(),
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    templateId: template.id,
    templateVersion: template.version,
    templateTitle: template.title,
    responses: template.criteria
      .filter((criterion) => criterion.active)
      .sort((a, b) => a.order - b.order)
      .map((criterion) => ({
        id: createId(),
        schemaVersion: APP_SCHEMA_VERSION,
        createdAt: timestamp,
        updatedAt: timestamp,
        criterionId: criterion.id,
        criterionText: criterion.text,
        guidance: criterion.guidance,
        order: criterion.order,
        occurrenceTemplateId: criterion.occurrenceTemplateId,
        status: 'nao_inspecionado' as const,
        note: ''
      }))
  }
}

export function buildOccurrenceFromCriterion(args: {
  inspection: Inspection
  locationId: string
  equipmentId: string
  criterionId: string
  criterionText: string
  template?: OccurrenceTemplate
  criticality?: CriticalityLevel
  references?: OccurrenceReference[]
}): Occurrence {
  const timestamp = nowIso()
  const number = Math.max(0, ...args.inspection.occurrences.map((item) => item.internalNumber)) + 1
  return {
    id: createId(),
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    internalNumber: number,
    origin: 'checklist',
    locationId: args.locationId,
    equipmentId: args.equipmentId,
    criterionId: args.criterionId,
    criterionText: args.criterionText,
    sourceTemplateId: args.template?.id,
    title: args.template?.title ?? 'Não conformidade observada',
    finding: '',
    technicalDescription: args.template?.technicalDescription ?? '',
    recommendation: args.template?.recommendation ?? '',
    suggestedCriticalityId: args.criticality?.id,
    suggestedCriticalityLabel: args.criticality?.title,
    references: args.references ?? [],
    inspectorNote: '',
    photoIds: [],
    registeredAt: timestamp,
    requiresReview: true
  }
}

export function createFreeOccurrence(
  inspection: Inspection,
  locationId: string,
  equipmentId?: string
): Occurrence {
  const timestamp = nowIso()
  const number = Math.max(0, ...inspection.occurrences.map((item) => item.internalNumber)) + 1
  return {
    id: createId(),
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    internalNumber: number,
    origin: 'livre',
    locationId,
    equipmentId,
    title: '',
    finding: '',
    technicalDescription: '',
    recommendation: '',
    references: [],
    inspectorNote: '',
    photoIds: [],
    registeredAt: timestamp,
    requiresReview: true
  }
}

export function getReviewSummary(inspection: Inspection, photoCount: number): ReviewSummary {
  const statuses: Record<ChecklistStatus, number> = {
    conforme: 0,
    nao_conforme: 0,
    nao_aplicavel: 0,
    nao_inspecionado: 0
  }
  let equipment = 0
  let totalCriteria = 0
  const limitations: string[] = []

  if (inspection.limitations.trim()) limitations.push(`Geral: ${inspection.limitations.trim()}`)

  for (const location of inspection.locations) {
    if (location.limitations.trim()) limitations.push(`${location.name}: ${location.limitations.trim()}`)
    equipment += location.equipment.length
    for (const item of location.equipment) {
      if (item.limitations.trim()) limitations.push(`${location.name} / ${item.tag}: ${item.limitations.trim()}`)
      for (const response of item.checklist?.responses ?? []) {
        totalCriteria += 1
        statuses[response.status] += 1
      }
    }
  }

  const occurrencesWithoutPhoto = inspection.occurrences.filter((item) => item.photoIds.length === 0).length
  const unconfirmedCriticalities = inspection.occurrences.filter(
    (item) => !item.confirmedCriticalityId
  ).length
  const unconfirmedReferences = inspection.occurrences.reduce(
    (total, item) => total + item.references.filter((reference) => !reference.applicabilityConfirmed).length,
    0
  )
  const incompleteOccurrences = inspection.occurrences.filter(
    (item) => !item.title.trim() || !item.finding.trim() || !item.recommendation.trim()
  ).length
  const occurrencesPendingReview = inspection.occurrences.filter((item) => item.requiresReview).length
  const occurrenceStatusMismatches = inspection.occurrences.filter((occurrence) => {
    if (occurrence.origin !== 'checklist' || !occurrence.criterionId || !occurrence.equipmentId) return false
    const response = findEquipment(
      inspection,
      occurrence.locationId,
      occurrence.equipmentId
    )?.checklist?.responses.find((item) => item.criterionId === occurrence.criterionId)
    return !response || response.status !== 'nao_conforme'
  }).length

  const warnings: ReviewWarning[] = []
  if (statuses.nao_inspecionado > 0) {
    warnings.push({
      code: 'NOT_INSPECTED',
      label: `${statuses.nao_inspecionado} item(ns) não inspecionado(s)`,
      detail: 'Esses itens não serão tratados como conformes.',
      blocking: false
    })
  }
  if (occurrencesWithoutPhoto > 0) {
    warnings.push({
      code: 'OCCURRENCE_WITHOUT_PHOTO',
      label: `${occurrencesWithoutPhoto} ocorrência(s) sem fotografia`,
      detail: 'Confirme se o registro textual é suficiente ou inclua uma fotografia.',
      blocking: false
    })
  }
  if (unconfirmedCriticalities > 0) {
    warnings.push({
      code: 'UNCONFIRMED_CRITICALITY',
      label: `${unconfirmedCriticalities} criticidade(s) não confirmada(s)`,
      detail: 'A sugestão da biblioteca não equivale à avaliação do engenheiro.',
      blocking: false
    })
  }
  if (unconfirmedReferences > 0) {
    warnings.push({
      code: 'UNCONFIRMED_REFERENCE',
      label: `${unconfirmedReferences} referência(s) ainda não confirmada(s)`,
      detail: 'Referências pendentes não serão apresentadas como aplicáveis no relatório.',
      blocking: false
    })
  }
  if (incompleteOccurrences > 0) {
    warnings.push({
      code: 'INCOMPLETE_OCCURRENCE',
      label: `${incompleteOccurrences} ocorrência(s) incompleta(s)`,
      detail: 'Título, constatação e recomendação devem ser revisados.',
      blocking: true
    })
  }
  if (occurrencesPendingReview > 0) {
    warnings.push({
      code: 'OCCURRENCE_REVIEW_PENDING',
      label: `${occurrencesPendingReview} ocorrência(s) com revisão pendente`,
      detail: 'Abra cada ficha e conclua a revisão técnica antes de emitir o relatório.',
      blocking: true
    })
  }
  if (occurrenceStatusMismatches > 0) {
    warnings.push({
      code: 'OCCURRENCE_STATUS_MISMATCH',
      label: `${occurrenceStatusMismatches} ocorrência(s) vinculada(s) a critério que não está “Não conforme”`,
      detail: 'Revise o vínculo e confirme conscientemente se a ocorrência deve permanecer no relatório.',
      blocking: false
    })
  }
  if (!inspection.conclusion.trim()) {
    warnings.push({
      code: 'MISSING_CONCLUSION',
      label: 'Conclusão não preenchida',
      detail: 'A conclusão deve ser redigida pelo responsável técnico.',
      blocking: true
    })
  }

  return {
    locations: inspection.locations.length,
    equipment,
    totalCriteria,
    conforme: statuses.conforme,
    naoConforme: statuses.nao_conforme,
    naoAplicavel: statuses.nao_aplicavel,
    naoInspecionado: statuses.nao_inspecionado,
    occurrences: inspection.occurrences.length,
    photos: photoCount,
    occurrencesWithoutPhoto,
    unconfirmedCriticalities,
    unconfirmedReferences,
    incompleteOccurrences,
    occurrencesPendingReview,
    occurrenceStatusMismatches,
    limitations,
    warnings
  }
}

export function findLocation(inspection: Inspection, locationId?: string) {
  return inspection.locations.find((item) => item.id === locationId)
}

export function findEquipment(inspection: Inspection, locationId?: string, equipmentId?: string) {
  return findLocation(inspection, locationId)?.equipment.find((item) => item.id === equipmentId)
}

export function statusProgress(inspection: Inspection): number {
  const responses = inspection.locations.flatMap((location) =>
    location.equipment.flatMap((equipment) => equipment.checklist?.responses ?? [])
  )
  if (responses.length === 0) return 0
  const inspected = responses.filter((response) => response.status !== 'nao_inspecionado').length
  return Math.round((inspected / responses.length) * 100)
}
