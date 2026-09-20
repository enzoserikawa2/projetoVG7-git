import { db } from '../db/database'
import { createId, nowIso } from '../domain/ids'
import { APP_SCHEMA_VERSION } from '../domain/types'
import type { InspectionPhoto, PhotoRotation, PhotoScope } from '../domain/types'
import { createImageCopies } from './image-processing'

interface AddPhotoInput {
  inspectionId: string
  file: File
  scope: PhotoScope
  locationId?: string
  equipmentId?: string
  occurrenceId?: string
}

async function touchInspectionForPhoto(
  photo: Pick<InspectionPhoto, 'inspectionId' | 'occurrenceId'>,
  timestamp: string,
  requireOccurrence = false
): Promise<void> {
  const inspection = await db.inspections.get(photo.inspectionId)
  if (!inspection) throw new Error('Vistoria não encontrada.')
  if (photo.occurrenceId) {
    const occurrence = inspection.occurrences.find((item) => item.id === photo.occurrenceId)
    if (!occurrence && requireOccurrence) throw new Error('Ocorrência não encontrada.')
    if (occurrence) occurrence.requiresReview = true
  }
  inspection.updatedAt = timestamp
  inspection.revision += 1
  await db.inspections.put(inspection)
}

function normalizedRotation(value: number): PhotoRotation {
  return (((value % 360) + 360) % 360) as PhotoRotation
}

export async function addInspectionPhoto(input: AddPhotoInput): Promise<string> {
  const id = createId()
  const timestamp = nowIso()
  const existing = input.occurrenceId
    ? await db.photos.where('[inspectionId+occurrenceId]').equals([input.inspectionId, input.occurrenceId]).toArray()
    : await db.photos.where('inspectionId').equals(input.inspectionId).filter((photo) => photo.scope === input.scope).toArray()

  const photo: InspectionPhoto = {
    id,
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    inspectionId: input.inspectionId,
    scope: input.scope,
    locationId: input.locationId,
    equipmentId: input.equipmentId,
    occurrenceId: input.occurrenceId,
    capturedAt: timestamp,
    order: existing.length + 1,
    caption: '',
    originalFileName: input.file.name || `foto-${id}.jpg`,
    originalMimeType: input.file.type || 'application/octet-stream',
    originalBlob: input.file,
    reportBlob: input.file,
    thumbnailBlob: input.file,
    processingStatus: 'pending',
    rotationDegrees: 0
  }

  await db.transaction('rw', [db.photos, db.inspections], async () => {
    await db.photos.add(photo)
    if (input.occurrenceId) {
      const inspection = await db.inspections.get(input.inspectionId)
      if (!inspection) throw new Error('Vistoria não encontrada.')
      const occurrence = inspection.occurrences.find((item) => item.id === input.occurrenceId)
      if (!occurrence) throw new Error('Ocorrência não encontrada.')
      if (!occurrence.photoIds.includes(id)) occurrence.photoIds.push(id)
      occurrence.requiresReview = true
      inspection.updatedAt = timestamp
      inspection.revision += 1
      await db.inspections.put(inspection)
    } else {
      await touchInspectionForPhoto(photo, timestamp)
    }
  })

  try {
    const copies = await createImageCopies(input.file)
    await db.photos.update(id, {
      ...copies,
      processingStatus: 'ready',
      updatedAt: nowIso()
    })
  } catch {
    await db.photos.update(id, { processingStatus: 'failed', updatedAt: nowIso() })
  }
  return id
}

export async function updatePhotoCaption(photoId: string, caption: string): Promise<void> {
  await db.transaction('rw', [db.photos, db.inspections], async () => {
    const photo = await db.photos.get(photoId)
    if (!photo) throw new Error('Fotografia não encontrada.')
    const timestamp = nowIso()
    await db.photos.update(photoId, { caption, updatedAt: timestamp })
    await touchInspectionForPhoto(photo, timestamp)
  })
}

export async function deleteInspectionPhoto(photoId: string): Promise<void> {
  await db.transaction('rw', [db.photos, db.inspections], async () => {
    const photo = await db.photos.get(photoId)
    if (!photo) return
    await db.photos.delete(photoId)
    if (photo.occurrenceId) {
      const inspection = await db.inspections.get(photo.inspectionId)
      if (!inspection) throw new Error('Vistoria não encontrada.')
      const occurrence = inspection.occurrences.find((item) => item.id === photo.occurrenceId)
      if (occurrence) {
        occurrence.photoIds = occurrence.photoIds.filter((id) => id !== photoId)
        occurrence.requiresReview = true
      }
      inspection.updatedAt = nowIso()
      inspection.revision += 1
      await db.inspections.put(inspection)
    } else {
      await touchInspectionForPhoto(photo, nowIso())
    }
  })
}

export async function movePhoto(photoId: string, direction: -1 | 1): Promise<void> {
  const photo = await db.photos.get(photoId)
  if (!photo) return
  const siblings = photo.occurrenceId
    ? await db.photos.where('[inspectionId+occurrenceId]').equals([photo.inspectionId, photo.occurrenceId]).sortBy('order')
    : await db.photos
        .where('inspectionId')
        .equals(photo.inspectionId)
        .filter((item) => item.scope === photo.scope && !item.occurrenceId)
        .sortBy('order')
  const index = siblings.findIndex((item) => item.id === photoId)
  const target = siblings[index + direction]
  if (!target) return
  await db.transaction('rw', [db.photos, db.inspections], async () => {
    const timestamp = nowIso()
    await db.photos.update(photo.id, { order: target.order, updatedAt: timestamp })
    await db.photos.update(target.id, { order: photo.order, updatedAt: timestamp })
    await touchInspectionForPhoto(photo, timestamp)
  })
}

export async function rotateInspectionPhoto(photoId: string, direction: -1 | 1): Promise<void> {
  const photo = await db.photos.get(photoId)
  if (!photo) throw new Error('Fotografia não encontrada.')
  const rotationDegrees = normalizedRotation((photo.rotationDegrees ?? 0) + direction * 90)
  await db.photos.update(photoId, { processingStatus: 'pending', updatedAt: nowIso() })

  try {
    const copies = await createImageCopies(photo.originalBlob, rotationDegrees)
    await db.transaction('rw', [db.photos, db.inspections], async () => {
      const timestamp = nowIso()
      await db.photos.update(photoId, {
        ...copies,
        rotationDegrees,
        processingStatus: 'ready',
        updatedAt: timestamp
      })
      await touchInspectionForPhoto(photo, timestamp)
    })
  } catch {
    await db.photos.update(photoId, { processingStatus: 'failed', updatedAt: nowIso() })
    throw new Error('Não foi possível corrigir a orientação. A fotografia original foi preservada.')
  }
}
