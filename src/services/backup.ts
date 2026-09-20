import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { z } from 'zod'
import { db } from '../db/database'
import { sanitizeFilePart } from '../domain/ids'
import { APP_SCHEMA_VERSION } from '../domain/types'
import type {
  BackupManifest,
  Inspection,
  InspectionPhoto,
  LibraryItem,
  ProfessionalSettings,
  ReportRun
} from '../domain/types'

type SerializedPhoto = Omit<InspectionPhoto, 'originalBlob' | 'reportBlob' | 'thumbnailBlob'> & {
  blobFiles: {
    original: string
    report: string
    thumbnail: string
  }
}

type SerializedSettings = Omit<ProfessionalSettings, 'logoBlob'> & {
  logoFile?: string
  logoMimeType?: string
}

interface BackupData {
  settings: SerializedSettings[]
  libraryItems: LibraryItem[]
  inspections: Inspection[]
  photos: SerializedPhoto[]
  reportRuns: ReportRun[]
}

const manifestSchema = z.object({
  format: z.literal('VG7_HVAC_BACKUP'),
  formatVersion: z.literal(1),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string().min(1),
  scope: z.enum(['full', 'inspection']),
  inspectionId: z.string().optional(),
  counts: z.object({
    inspections: z.number().int().nonnegative(),
    photos: z.number().int().nonnegative(),
    libraryItems: z.number().int().nonnegative(),
    reportRuns: z.number().int().nonnegative()
  }),
  files: z.array(
    z.object({
      path: z.string().min(1),
      size: z.number().int().nonnegative(),
      sha256: z.string().length(64),
      mimeType: z.string()
    })
  )
})

const entitySchema = z.object({ id: z.string().min(1), schemaVersion: z.number().int().positive() }).passthrough()
const backupDataSchema = z.object({
  settings: z.array(entitySchema),
  libraryItems: z.array(entitySchema),
  inspections: z.array(
    entitySchema.extend({
      locations: z.array(z.object({ id: z.string().min(1), equipment: z.array(z.object({ id: z.string().min(1) }).passthrough()) }).passthrough()),
      occurrences: z.array(z.object({ id: z.string().min(1), locationId: z.string().min(1), photoIds: z.array(z.string()) }).passthrough())
    })
  ),
  photos: z.array(entitySchema.extend({ inspectionId: z.string().min(1), blobFiles: z.object({ original: z.string(), report: z.string(), thumbnail: z.string() }) })),
  reportRuns: z.array(entitySchema)
})

async function sha256(bytes: Uint8Array): Promise<string> {
  const input = new Uint8Array(bytes.byteLength)
  input.set(bytes)
  const digest = await crypto.subtle.digest('SHA-256', input.buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer())
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de backup.'))
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.readAsArrayBuffer(blob)
  })
}

function extensionFor(blob: Blob): string {
  if (blob.type === 'image/jpeg') return 'jpg'
  if (blob.type === 'image/png') return 'png'
  if (blob.type === 'image/webp') return 'webp'
  return 'bin'
}

async function addBlobFile(
  files: Record<string, Uint8Array>,
  manifestFiles: BackupManifest['files'],
  path: string,
  blob: Blob
) {
  const bytes = await blobBytes(blob)
  files[path] = bytes
  manifestFiles.push({ path, size: bytes.byteLength, sha256: await sha256(bytes), mimeType: blob.type })
}

export async function createBackup(inspectionId?: string): Promise<{ blob: Blob; fileName: string }> {
  const [allSettings, libraryItems] = await Promise.all([db.settings.toArray(), db.libraryItems.toArray()])
  let scopedInspections: Inspection[]
  if (inspectionId) {
    const inspection = await db.inspections.get(inspectionId)
    if (!inspection) throw new Error('Vistoria não encontrada para exportação.')
    scopedInspections = [inspection]
  } else {
    scopedInspections = await db.inspections.toArray()
  }

  const inspectionIds = new Set(scopedInspections.map((item) => item.id))
  const [photos, reportRuns] = await Promise.all([
    db.photos.filter((item) => inspectionIds.has(item.inspectionId)).toArray(),
    db.reportRuns.filter((item) => inspectionIds.has(item.inspectionId)).toArray()
  ])

  const files: Record<string, Uint8Array> = {}
  const manifestFiles: BackupManifest['files'] = []
  const serializedPhotos: SerializedPhoto[] = []

  for (const photo of photos) {
    const { originalBlob, reportBlob, thumbnailBlob, ...metadata } = photo
    const base = `photos/${photo.id}`
    const original = `${base}/original.${extensionFor(originalBlob)}`
    const report = `${base}/report.${extensionFor(reportBlob)}`
    const thumbnail = `${base}/thumbnail.${extensionFor(thumbnailBlob)}`
    await addBlobFile(files, manifestFiles, original, originalBlob)
    await addBlobFile(files, manifestFiles, report, reportBlob)
    await addBlobFile(files, manifestFiles, thumbnail, thumbnailBlob)
    serializedPhotos.push({ ...metadata, blobFiles: { original, report, thumbnail } })
  }

  const serializedSettings: SerializedSettings[] = []
  for (const settings of allSettings) {
    const { logoBlob, ...metadata } = settings
    if (logoBlob) {
      const logoFile = `settings/logo.${extensionFor(logoBlob)}`
      await addBlobFile(files, manifestFiles, logoFile, logoBlob)
      serializedSettings.push({ ...metadata, logoFile, logoMimeType: logoBlob.type })
    } else {
      serializedSettings.push(metadata)
    }
  }

  const data: BackupData = {
    settings: serializedSettings,
    libraryItems,
    inspections: scopedInspections,
    photos: serializedPhotos,
    reportRuns
  }
  const dataBytes = strToU8(JSON.stringify(data))
  files['data.json'] = dataBytes
  manifestFiles.push({
    path: 'data.json',
    size: dataBytes.byteLength,
    sha256: await sha256(dataBytes),
    mimeType: 'application/json'
  })

  const manifest: BackupManifest = {
    format: 'VG7_HVAC_BACKUP',
    formatVersion: 1,
    schemaVersion: APP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    scope: inspectionId ? 'inspection' : 'full',
    inspectionId,
    counts: {
      inspections: scopedInspections.length,
      photos: photos.length,
      libraryItems: libraryItems.length,
      reportRuns: reportRuns.length
    },
    files: manifestFiles
  }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))

  const zipped = zipSync(files, { level: 6 })
  const target = scopedInspections[0]
  const descriptor = inspectionId && target ? sanitizeFilePart(target.client || target.facility) : 'COMPLETO'
  const date = new Date().toISOString().slice(0, 10)
  return {
    blob: new Blob([Uint8Array.from(zipped).buffer], { type: 'application/vnd.vg7.hvac-backup+zip' }),
    fileName: `BACKUP_VG7_HVAC_${descriptor}_${date}.vg7backup`
  }
}

export function downloadBackup(backup: { blob: Blob; fileName: string }) {
  const url = URL.createObjectURL(backup.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = backup.fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function assertInspectionIntegrity(inspections: Inspection[], photos: SerializedPhoto[]) {
  const photoIds = new Set(photos.map((photo) => photo.id))
  for (const inspection of inspections) {
    const locations = new Map(inspection.locations.map((location) => [location.id, location]))
    const occurrences = new Set(inspection.occurrences.map((occurrence) => occurrence.id))
    for (const occurrence of inspection.occurrences) {
      const location = locations.get(occurrence.locationId)
      if (!location) throw new Error(`Backup inconsistente: local ausente na ocorrência ${occurrence.id}.`)
      if (occurrence.equipmentId && !location.equipment.some((item) => item.id === occurrence.equipmentId)) {
        throw new Error(`Backup inconsistente: equipamento ausente na ocorrência ${occurrence.id}.`)
      }
      for (const photoId of occurrence.photoIds) {
        if (!photoIds.has(photoId)) throw new Error(`Backup inconsistente: fotografia ${photoId} ausente.`)
      }
    }
    for (const location of inspection.locations) {
      for (const equipment of location.equipment) {
        for (const response of equipment.checklist?.responses ?? []) {
          if (response.occurrenceId && !occurrences.has(response.occurrenceId)) {
            throw new Error(`Backup inconsistente: vínculo de checklist ${response.id} inválido.`)
          }
        }
      }
    }
  }
}

export async function inspectBackup(file: File): Promise<{
  manifest: BackupManifest
  data: BackupData
  files: Record<string, Uint8Array>
}> {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(await blobBytes(file))
  } catch {
    throw new Error('O arquivo não é um backup VG7 válido ou está corrompido.')
  }
  const manifestBytes = files['manifest.json']
  const dataBytes = files['data.json']
  if (!manifestBytes || !dataBytes) throw new Error('Backup incompleto: manifesto ou dados ausentes.')

  const manifest = manifestSchema.parse(JSON.parse(strFromU8(manifestBytes))) as BackupManifest
  if (manifest.schemaVersion > APP_SCHEMA_VERSION) {
    throw new Error('Este backup foi criado por uma versão mais recente do aplicativo.')
  }

  for (const entry of manifest.files) {
    const bytes = files[entry.path]
    if (!bytes || bytes.byteLength !== entry.size || (await sha256(bytes)) !== entry.sha256) {
      throw new Error(`Falha de integridade no arquivo ${entry.path}.`)
    }
  }

  const parsed = backupDataSchema.parse(JSON.parse(strFromU8(dataBytes)))
  const data = parsed as unknown as BackupData
  if (
    data.inspections.length !== manifest.counts.inspections ||
    data.photos.length !== manifest.counts.photos ||
    data.libraryItems.length !== manifest.counts.libraryItems ||
    data.reportRuns.length !== manifest.counts.reportRuns
  ) {
    throw new Error('As contagens do backup não correspondem ao manifesto.')
  }
  assertInspectionIntegrity(data.inspections, data.photos)
  return { manifest, data, files }
}

export async function restoreBackup(file: File): Promise<BackupManifest['counts']> {
  const { manifest, data, files } = await inspectBackup(file)

  const settings: ProfessionalSettings[] = data.settings.map((item) => {
    const { logoFile, logoMimeType, ...metadata } = item
    const logoBytes = logoFile ? files[logoFile] : undefined
    return {
      ...metadata,
      logoBlob: logoBytes
        ? new Blob([Uint8Array.from(logoBytes).buffer], { type: logoMimeType || 'application/octet-stream' })
        : undefined
    }
  })
  const photos: InspectionPhoto[] = data.photos.map((item) => {
    const { blobFiles, ...metadata } = item
    const original = files[blobFiles.original]
    const report = files[blobFiles.report]
    const thumbnail = files[blobFiles.thumbnail]
    if (!original || !report || !thumbnail) throw new Error(`Fotografia ${item.id} incompleta no backup.`)
    return {
      ...metadata,
      originalBlob: new Blob([Uint8Array.from(original).buffer], { type: item.originalMimeType }),
      reportBlob: new Blob([Uint8Array.from(report).buffer], {
        type: manifest.files.find((entry) => entry.path === blobFiles.report)?.mimeType
      }),
      thumbnailBlob: new Blob([Uint8Array.from(thumbnail).buffer], {
        type: manifest.files.find((entry) => entry.path === blobFiles.thumbnail)?.mimeType
      })
    }
  })

  await db.transaction(
    'rw',
    [db.settings, db.libraryItems, db.inspections, db.photos, db.reportRuns],
    async () => {
      if (settings.length) await db.settings.bulkPut(settings)
      if (data.libraryItems.length) await db.libraryItems.bulkPut(data.libraryItems)
      if (data.inspections.length) await db.inspections.bulkPut(data.inspections)
      if (photos.length) await db.photos.bulkPut(photos)
      if (data.reportRuns.length) await db.reportRuns.bulkPut(data.reportRuns)
    }
  )

  return manifest.counts
}
