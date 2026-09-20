import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/database'
import type { Inspection, InspectionPhoto } from '../../domain/types'

export function useInspection(inspectionId?: string) {
  return useLiveQuery<Inspection | undefined>(
    () => (inspectionId ? db.inspections.get(inspectionId) : Promise.resolve(undefined)),
    [inspectionId]
  )
}

export function useInspectionPhotos(inspectionId?: string) {
  return useLiveQuery<InspectionPhoto[], InspectionPhoto[]>(
    () =>
      inspectionId
        ? db.photos.where('inspectionId').equals(inspectionId).sortBy('capturedAt')
        : Promise.resolve([]),
    [inspectionId],
    []
  )
}
