export const APP_SCHEMA_VERSION = 2

export type ISODateTime = string
export type UUID = string

export interface EntityBase {
  id: UUID
  createdAt: ISODateTime
  updatedAt: ISODateTime
  schemaVersion: number
}

export type ChecklistStatus =
  | 'conforme'
  | 'nao_conforme'
  | 'nao_aplicavel'
  | 'nao_inspecionado'

export type EquipmentOperatingState =
  | 'operando'
  | 'desligado'
  | 'inacessivel'
  | 'nao_informado'

export type InspectionStatus = 'em_andamento' | 'finalizada'

export interface ProfessionalSettings extends EntityBase {
  id: 'professional'
  engineerName: string
  crea: string
  companyName: string
  contact: string
  email: string
  reportHeader: string
  reportFooter: string
  defaultPurpose: string
  defaultScope: string
  defaultMethodology: string
  defaultLimitations: string
  logoBlob?: Blob
  logoFileName?: string
}

export interface ChecklistCriterion {
  id: UUID
  text: string
  guidance: string
  order: number
  occurrenceTemplateId?: UUID
  active: boolean
}

export interface LibraryItemBase extends EntityBase {
  kind:
    | 'checklist-template'
    | 'occurrence-template'
    | 'recommendation'
    | 'criticality'
    | 'normative-reference'
  active: boolean
  title: string
}

export interface ChecklistTemplate extends LibraryItemBase {
  kind: 'checklist-template'
  version: number
  system: string
  equipmentTypes: string[]
  criteria: ChecklistCriterion[]
}

export interface OccurrenceTemplate extends LibraryItemBase {
  kind: 'occurrence-template'
  system: string
  category: string
  equipmentType: string
  technicalDescription: string
  recommendation: string
  suggestedCriticalityId?: UUID
  inspectorGuidance: string
  suggestedReferenceIds: UUID[]
}

export interface RecommendationTemplate extends LibraryItemBase {
  kind: 'recommendation'
  category: string
  text: string
}

export interface CriticalityLevel extends LibraryItemBase {
  kind: 'criticality'
  description: string
  rank: number
}

export interface NormativeReference extends LibraryItemBase {
  kind: 'normative-reference'
  standardId: string
  standardTitle: string
  edition: string
  clause: string
  internalNote: string
  validatedByEngineer: boolean
}

export type LibraryItem =
  | ChecklistTemplate
  | OccurrenceTemplate
  | RecommendationTemplate
  | CriticalityLevel
  | NormativeReference

export interface ChecklistResponse extends EntityBase {
  criterionId: UUID
  criterionText: string
  guidance: string
  order: number
  occurrenceTemplateId?: UUID
  status: ChecklistStatus
  note: string
  occurrenceId?: UUID
}

export interface AppliedChecklist extends EntityBase {
  templateId: UUID
  templateVersion: number
  templateTitle: string
  responses: ChecklistResponse[]
}

export interface Equipment extends EntityBase {
  tag: string
  type: string
  manufacturer: string
  model: string
  serialNumber: string
  operatingState: EquipmentOperatingState
  observations: string
  limitations: string
  checklist?: AppliedChecklist
}

export interface InspectionLocation extends EntityBase {
  name: string
  description: string
  observations: string
  limitations: string
  equipment: Equipment[]
}

export interface OccurrenceReference {
  id: UUID
  sourceReferenceId?: UUID
  standardId: string
  standardTitle: string
  edition: string
  clause: string
  applicabilityConfirmed: boolean
  confirmedAt?: ISODateTime
}

export type OccurrenceOrigin = 'checklist' | 'livre'

export interface Occurrence extends EntityBase {
  internalNumber: number
  origin: OccurrenceOrigin
  locationId: UUID
  equipmentId?: UUID
  criterionId?: UUID
  criterionText?: string
  sourceTemplateId?: UUID
  title: string
  finding: string
  technicalDescription: string
  recommendation: string
  suggestedCriticalityId?: UUID
  suggestedCriticalityLabel?: string
  confirmedCriticalityId?: UUID
  confirmedCriticalityLabel?: string
  criticalityConfirmedAt?: ISODateTime
  references: OccurrenceReference[]
  inspectorNote: string
  photoIds: UUID[]
  registeredAt: ISODateTime
  requiresReview: boolean
}

export interface Inspection extends EntityBase {
  revision: number
  status: InspectionStatus
  isDemo: boolean
  client: string
  facility: string
  address: string
  inspectionDate: string
  inspector: string
  technicalLead: string
  contractNumber: string
  purpose: string
  inspectionType: string
  scope: string
  methodology: string
  generalNotes: string
  limitations: string
  conclusion: string
  locations: InspectionLocation[]
  occurrences: Occurrence[]
  lastRoute: string
  lastLocationId?: UUID
  lastEquipmentId?: UUID
  finalizedAt?: ISODateTime
  pendingAcknowledgedAt?: ISODateTime
}

export type PhotoScope = 'occurrence' | 'general'
export type PhotoProcessingStatus = 'pending' | 'ready' | 'failed'
export type PhotoRotation = 0 | 90 | 180 | 270

export interface InspectionPhoto extends EntityBase {
  inspectionId: UUID
  scope: PhotoScope
  locationId?: UUID
  equipmentId?: UUID
  occurrenceId?: UUID
  capturedAt: ISODateTime
  order: number
  caption: string
  originalFileName: string
  originalMimeType: string
  originalBlob: Blob
  reportBlob: Blob
  thumbnailBlob: Blob
  processingStatus: PhotoProcessingStatus
  rotationDegrees?: PhotoRotation
}

export interface ReportRun extends EntityBase {
  inspectionId: UUID
  inspectionRevision: number
  reportVersion: number
  fileName: string
  generatedAt: ISODateTime
  sha256: string
  acknowledgedWarnings: string[]
}

export interface AppMeta extends EntityBase {
  key: string
  value: string | number | boolean
}

export interface ReviewSummary {
  locations: number
  equipment: number
  totalCriteria: number
  conforme: number
  naoConforme: number
  naoAplicavel: number
  naoInspecionado: number
  occurrences: number
  photos: number
  occurrencesWithoutPhoto: number
  unconfirmedCriticalities: number
  unconfirmedReferences: number
  incompleteOccurrences: number
  occurrencesPendingReview: number
  occurrenceStatusMismatches: number
  limitations: string[]
  warnings: ReviewWarning[]
}

export interface ReviewWarning {
  code: string
  label: string
  detail: string
  blocking: boolean
}

export interface BackupManifest {
  format: 'VG7_HVAC_BACKUP'
  formatVersion: 1
  schemaVersion: number
  exportedAt: ISODateTime
  scope: 'full' | 'inspection'
  inspectionId?: UUID
  counts: {
    inspections: number
    photos: number
    libraryItems: number
    reportRuns: number
  }
  files: Array<{
    path: string
    size: number
    sha256: string
    mimeType: string
  }>
}
