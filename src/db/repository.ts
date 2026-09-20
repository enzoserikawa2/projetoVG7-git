import { createEmptyInspection } from '../domain/inspection'
import { createId, nowIso } from '../domain/ids'
import { APP_SCHEMA_VERSION } from '../domain/types'
import type {
  Equipment,
  Inspection,
  InspectionLocation,
  InspectionPhoto,
  LibraryItem,
  ProfessionalSettings
} from '../domain/types'
import { db } from './database'

export async function mutateInspection(
  inspectionId: string,
  mutator: (inspection: Inspection) => void
): Promise<Inspection> {
  return db.transaction('rw', db.inspections, async () => {
    const current = await db.inspections.get(inspectionId)
    if (!current) throw new Error('Vistoria não encontrada.')
    const next = structuredClone(current)
    mutator(next)
    next.updatedAt = nowIso()
    next.revision += 1
    await db.inspections.put(next)
    return next
  })
}

export async function createInspection(): Promise<Inspection> {
  const settings = await db.settings.get('professional')
  const inspection = createEmptyInspection(settings)
  await db.inspections.add(inspection)
  return inspection
}

export function createEquipment(tag: string, type: string): Equipment {
  const timestamp = nowIso()
  return {
    id: createId(),
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    tag,
    type,
    manufacturer: '',
    model: '',
    serialNumber: '',
    operatingState: 'nao_informado',
    observations: '',
    limitations: ''
  }
}

export async function deleteInspection(inspectionId: string): Promise<void> {
  await db.transaction('rw', [db.inspections, db.photos, db.reportRuns], async () => {
    await db.inspections.delete(inspectionId)
    await db.photos.where('inspectionId').equals(inspectionId).delete()
    await db.reportRuns.where('inspectionId').equals(inspectionId).delete()
  })
}

export async function deleteLocationFromInspection(
  inspectionId: string,
  locationId: string
): Promise<void> {
  await db.transaction('rw', [db.inspections, db.photos], async () => {
    const inspection = await db.inspections.get(inspectionId)
    if (!inspection) throw new Error('Vistoria não encontrada.')
    const next = structuredClone(inspection)
    next.locations = next.locations.filter((item) => item.id !== locationId)
    next.occurrences = next.occurrences.filter((item) => item.locationId !== locationId)
    next.updatedAt = nowIso()
    next.revision += 1
    await db.inspections.put(next)
    await db.photos.where('inspectionId').equals(inspectionId).filter((photo) => photo.locationId === locationId).delete()
  })
}

export async function deleteEquipmentFromInspection(
  inspectionId: string,
  locationId: string,
  equipmentId: string
): Promise<void> {
  await db.transaction('rw', [db.inspections, db.photos], async () => {
    const inspection = await db.inspections.get(inspectionId)
    if (!inspection) throw new Error('Vistoria não encontrada.')
    const next = structuredClone(inspection)
    const location = next.locations.find((item) => item.id === locationId)
    if (!location) throw new Error('Local não encontrado.')
    location.equipment = location.equipment.filter((item) => item.id !== equipmentId)
    next.occurrences = next.occurrences.filter((item) => item.equipmentId !== equipmentId)
    next.updatedAt = nowIso()
    next.revision += 1
    await db.inspections.put(next)
    await db.photos
      .where('inspectionId')
      .equals(inspectionId)
      .filter((photo) => photo.equipmentId === equipmentId)
      .delete()
  })
}

export async function duplicateEquipmentInLocation(
  inspectionId: string,
  locationId: string,
  equipmentId: string
): Promise<string> {
  const newId = createId()
  await mutateInspection(inspectionId, (inspection) => {
    const location = inspection.locations.find((item) => item.id === locationId)
    const source = location?.equipment.find((item) => item.id === equipmentId)
    if (!location || !source) throw new Error('Equipamento não encontrado.')
    const timestamp = nowIso()
    const copy = structuredClone(source)
    copy.id = newId
    copy.tag = `${source.tag} — cópia`
    copy.createdAt = timestamp
    copy.updatedAt = timestamp
    if (copy.checklist) {
      copy.checklist.id = createId()
      copy.checklist.createdAt = timestamp
      copy.checklist.updatedAt = timestamp
      copy.checklist.responses = copy.checklist.responses.map((response) => ({
        ...response,
        id: createId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        status: 'nao_inspecionado',
        note: '',
        occurrenceId: undefined
      }))
    }
    location.equipment.push(copy)
    location.updatedAt = timestamp
  })
  return newId
}

export async function duplicateLocationInInspection(
  inspectionId: string,
  locationId: string
): Promise<string> {
  const newLocationId = createId()
  await mutateInspection(inspectionId, (inspection) => {
    const source = inspection.locations.find((item) => item.id === locationId)
    if (!source) throw new Error('Local não encontrado.')
    const timestamp = nowIso()
    const copy: InspectionLocation = structuredClone(source)
    copy.id = newLocationId
    copy.name = `${source.name} — cópia`
    copy.createdAt = timestamp
    copy.updatedAt = timestamp
    copy.equipment = copy.equipment.map((equipment) => {
      const next = { ...equipment, id: createId(), createdAt: timestamp, updatedAt: timestamp }
      if (next.checklist) {
        next.checklist = {
          ...next.checklist,
          id: createId(),
          createdAt: timestamp,
          updatedAt: timestamp,
          responses: next.checklist.responses.map((response) => ({
            ...response,
            id: createId(),
            createdAt: timestamp,
            updatedAt: timestamp,
            status: 'nao_inspecionado',
            note: '',
            occurrenceId: undefined
          }))
        }
      }
      return next
    })
    inspection.locations.push(copy)
  })
  return newLocationId
}

export async function duplicateInspection(inspectionId: string): Promise<string> {
  const source = await db.inspections.get(inspectionId)
  if (!source) throw new Error('Vistoria não encontrada.')
  const sourcePhotos = await db.photos.where('inspectionId').equals(inspectionId).toArray()
  const copy = structuredClone(source)
  const timestamp = nowIso()
  const newInspectionId = createId()
  const locationIds = new Map<string, string>()
  const equipmentIds = new Map<string, string>()
  const occurrenceIds = new Map<string, string>()
  const photoIds = new Map<string, string>()

  for (const location of copy.locations) locationIds.set(location.id, createId())
  for (const location of copy.locations) {
    for (const equipment of location.equipment) equipmentIds.set(equipment.id, createId())
  }
  for (const occurrence of copy.occurrences) occurrenceIds.set(occurrence.id, createId())
  for (const photo of sourcePhotos) photoIds.set(photo.id, createId())

  copy.id = newInspectionId
  copy.client = `${copy.client} — cópia`
  copy.status = 'em_andamento'
  copy.isDemo = false
  copy.revision = 1
  copy.createdAt = timestamp
  copy.updatedAt = timestamp
  copy.finalizedAt = undefined
  copy.pendingAcknowledgedAt = undefined
  copy.lastRoute = `/inspection/${newInspectionId}/basics`
  copy.locations = copy.locations.map((location) => ({
    ...location,
    id: locationIds.get(location.id) ?? createId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    equipment: location.equipment.map((equipment) => ({
      ...equipment,
      id: equipmentIds.get(equipment.id) ?? createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      checklist: equipment.checklist
        ? {
            ...equipment.checklist,
            id: createId(),
            createdAt: timestamp,
            updatedAt: timestamp,
            responses: equipment.checklist.responses.map((response) => ({
              ...response,
              id: createId(),
              createdAt: timestamp,
              updatedAt: timestamp,
              occurrenceId: response.occurrenceId
                ? occurrenceIds.get(response.occurrenceId)
                : undefined
            }))
          }
        : undefined
    }))
  }))
  copy.occurrences = copy.occurrences.map((occurrence) => ({
    ...occurrence,
    id: occurrenceIds.get(occurrence.id) ?? createId(),
    locationId: locationIds.get(occurrence.locationId) ?? occurrence.locationId,
    equipmentId: occurrence.equipmentId
      ? (equipmentIds.get(occurrence.equipmentId) ?? occurrence.equipmentId)
      : undefined,
    photoIds: occurrence.photoIds.map((id) => photoIds.get(id) ?? id),
    createdAt: timestamp,
    updatedAt: timestamp
  }))

  const copiedPhotos: InspectionPhoto[] = sourcePhotos.map((photo) => ({
    ...photo,
    id: photoIds.get(photo.id) ?? createId(),
    inspectionId: newInspectionId,
    locationId: photo.locationId ? (locationIds.get(photo.locationId) ?? photo.locationId) : undefined,
    equipmentId: photo.equipmentId
      ? (equipmentIds.get(photo.equipmentId) ?? photo.equipmentId)
      : undefined,
    occurrenceId: photo.occurrenceId
      ? (occurrenceIds.get(photo.occurrenceId) ?? photo.occurrenceId)
      : undefined,
    createdAt: timestamp,
    updatedAt: timestamp
  }))

  await db.transaction('rw', [db.inspections, db.photos], async () => {
    await db.inspections.add(copy)
    await db.photos.bulkAdd(copiedPhotos)
  })
  return newInspectionId
}

export async function saveSettings(
  mutate: (settings: ProfessionalSettings) => void
): Promise<ProfessionalSettings> {
  return db.transaction('rw', db.settings, async () => {
    const settings = await db.settings.get('professional')
    if (!settings) throw new Error('Configurações não encontradas.')
    const next = structuredClone(settings)
    mutate(next)
    next.updatedAt = nowIso()
    await db.settings.put(next)
    return next
  })
}

export async function mutateLibraryItem(
  itemId: string,
  mutator: (item: LibraryItem) => void
): Promise<LibraryItem> {
  return db.transaction('rw', db.libraryItems, async () => {
    const item = await db.libraryItems.get(itemId)
    if (!item) throw new Error('Item da biblioteca não encontrado.')
    const next = structuredClone(item)
    mutator(next)
    next.updatedAt = nowIso()
    await db.libraryItems.put(next)
    return next
  })
}
