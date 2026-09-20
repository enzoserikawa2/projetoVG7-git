import Dexie, { type EntityTable } from 'dexie'
import type {
  AppMeta,
  Inspection,
  InspectionPhoto,
  LibraryItem,
  ProfessionalSettings,
  ReportRun
} from '../domain/types'
import { APP_SCHEMA_VERSION } from '../domain/types'

const storesV1 = {
  appMeta: '&id, key, updatedAt',
  settings: '&id, updatedAt',
  libraryItems: '&id, kind, active, title, updatedAt, [kind+active]',
  inspections: '&id, status, inspectionDate, updatedAt, client, facility, isDemo',
  photos:
    '&id, inspectionId, occurrenceId, locationId, equipmentId, capturedAt, order, [inspectionId+occurrenceId]',
  reportRuns: '&id, inspectionId, reportVersion, generatedAt, [inspectionId+reportVersion]'
}

const stores = {
  ...storesV1,
  libraryItems: '&id, kind, title, updatedAt'
}

export class VG7Database extends Dexie {
  appMeta!: EntityTable<AppMeta, 'id'>
  settings!: EntityTable<ProfessionalSettings, 'id'>
  libraryItems!: EntityTable<LibraryItem, 'id'>
  inspections!: EntityTable<Inspection, 'id'>
  photos!: EntityTable<InspectionPhoto, 'id'>
  reportRuns!: EntityTable<ReportRun, 'id'>

  constructor() {
    super('vg7-hvac-local')

    this.version(1).stores(storesV1)
    this.version(2)
      .stores(stores)
      .upgrade(async (transaction) => {
        for (const tableName of Object.keys(stores)) {
          await transaction
            .table(tableName)
            .toCollection()
            .modify((entity: { schemaVersion?: number; rotationDegrees?: number }) => {
              entity.schemaVersion = APP_SCHEMA_VERSION
              if (tableName === 'photos' && entity.rotationDegrees === undefined) {
                entity.rotationDegrees = 0
              }
            })
        }
      })
  }
}

export const db = new VG7Database()
