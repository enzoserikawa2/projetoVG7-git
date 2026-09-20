// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
import { createEmptyInspection } from '../domain/inspection'
import { createId, nowIso } from '../domain/ids'
import { APP_SCHEMA_VERSION } from '../domain/types'
import type { InspectionPhoto, ProfessionalSettings } from '../domain/types'
import { createBackup, inspectBackup, restoreBackup } from './backup'

const settings: ProfessionalSettings = {
  id: 'professional',
  schemaVersion: APP_SCHEMA_VERSION,
  createdAt: nowIso(),
  updatedAt: nowIso(),
  engineerName: 'Engenheiro Teste',
  crea: 'CREA-TESTE',
  companyName: 'VG7 Engenharia',
  contact: '',
  email: '',
  reportHeader: 'Cabeçalho',
  reportFooter: 'Rodapé',
  defaultPurpose: '',
  defaultScope: '',
  defaultMethodology: '',
  defaultLimitations: ''
}

beforeEach(async () => {
  await db.open()
  await db.transaction(
    'rw',
    [db.appMeta, db.settings, db.libraryItems, db.inspections, db.photos, db.reportRuns],
    async () => {
      await Promise.all([
        db.appMeta.clear(),
        db.settings.clear(),
        db.libraryItems.clear(),
        db.inspections.clear(),
        db.photos.clear(),
        db.reportRuns.clear()
      ])
    }
  )
})

afterAll(async () => {
  db.close()
})

describe('backup local', () => {
  it('exporta, valida e restaura dados e blobs', async () => {
    const inspection = createEmptyInspection(settings)
    inspection.client = 'Cliente Teste'
    const blob = new Blob(['imagem de teste'], { type: 'image/jpeg' })
    const photo: InspectionPhoto = {
      id: createId(),
      schemaVersion: APP_SCHEMA_VERSION,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      inspectionId: inspection.id,
      scope: 'general',
      capturedAt: nowIso(),
      order: 1,
      caption: 'Foto de teste',
      originalFileName: 'teste.jpg',
      originalMimeType: 'image/jpeg',
      originalBlob: blob,
      reportBlob: blob,
      thumbnailBlob: blob,
      processingStatus: 'ready',
      rotationDegrees: 0
    }
    await db.settings.put(settings)
    await db.inspections.put(inspection)
    await db.photos.put(photo)

    const backup = await createBackup()
    const file = new File([backup.blob], backup.fileName)
    const inspected = await inspectBackup(file)

    expect(inspected.manifest.counts.inspections).toBe(1)
    expect(inspected.manifest.counts.photos).toBe(1)

    await db.inspections.clear()
    await db.photos.clear()
    await restoreBackup(file)

    expect(await db.inspections.count()).toBe(1)
    const restoredPhoto = await db.photos.get(photo.id)
    expect(restoredPhoto?.caption).toBe('Foto de teste')
    expect(restoredPhoto?.originalBlob.size).toBe(blob.size)
  })
})
