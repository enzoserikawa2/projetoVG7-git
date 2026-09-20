import { useEffect, useMemo, useState } from 'react'
import { Camera } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PhotoCapture } from '../components/PhotoCapture'
import { PhotoCard } from '../components/PhotoCard'
import { Card, EmptyState, PageTitle, Pill, Skeleton } from '../components/ui'
import { mutateInspection } from '../db/repository'
import { InspectionHeader } from '../features/inspections/InspectionHeader'
import { useInspection, useInspectionPhotos } from '../features/inspections/useInspection'

export function InspectionPhotosPage() {
  const { inspectionId } = useParams()
  const inspection = useInspection(inspectionId)
  const photos = useInspectionPhotos(inspectionId)
  const [locationId, setLocationId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const route = inspectionId ? `/inspection/${inspectionId}/photos` : ''

  useEffect(() => {
    if (!inspection || inspection.lastRoute === route) return
    void mutateInspection(inspection.id, (draft) => {
      draft.lastRoute = route
    })
  }, [inspection, route])

  const selectedLocation = inspection?.locations.find((item) => item.id === locationId)
  const sortedPhotos = useMemo(
    () => photos.slice().sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.order - b.order),
    [photos]
  )

  if (!inspection) return <Skeleton height={480} />

  return (
    <div>
      <InspectionHeader inspection={inspection} />
      <PageTitle
        eyebrow="Galeria da vistoria"
        title="Fotografias e legendas"
        description="As fotografias de ocorrências aparecem aqui junto aos registros gerais da vistoria."
      />

      <Card className="general-photo-card">
        <div className="section-heading">
          <div><h2>Adicionar fotografia geral</h2><p>Use para observações que não constituem uma ocorrência específica.</p></div>
          <Camera size={24} />
        </div>
        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">Local relacionado, se aplicável</span>
            <select
              value={locationId}
              onChange={(event) => {
                setLocationId(event.target.value)
                setEquipmentId('')
              }}
            >
              <option value="">Observação geral da vistoria</option>
              {inspection.locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Equipamento relacionado, se aplicável</span>
            <select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} disabled={!selectedLocation}>
              <option value="">Nenhum equipamento específico</option>
              {selectedLocation?.equipment.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>{equipment.tag}</option>
              ))}
            </select>
          </label>
        </div>
        <PhotoCapture
          inspectionId={inspection.id}
          scope="general"
          locationId={locationId || undefined}
          equipmentId={equipmentId || undefined}
        />
      </Card>

      <div className="section-heading gallery-heading">
        <div><h2>Todas as fotografias</h2><p>Ordem local por ocorrência ou seção geral.</p></div>
        <Pill>{photos.length} foto(s)</Pill>
      </div>

      {sortedPhotos.length === 0 ? (
        <EmptyState title="Nenhuma fotografia" description="Capture uma imagem ou selecione uma existente no dispositivo." />
      ) : (
        <div className="photo-grid">
          {sortedPhotos.map((photo, index) => {
            const occurrence = inspection.occurrences.find((item) => item.id === photo.occurrenceId)
            return (
              <div key={photo.id}>
                <div className="photo-context">
                  {occurrence ? (
                    <Link to={`/inspection/${inspection.id}/occurrence/${occurrence.id}`}>
                      NC-{String(occurrence.internalNumber).padStart(3, '0')} • {occurrence.title}
                    </Link>
                  ) : (
                    <span>Observação geral</span>
                  )}
                </div>
                <PhotoCard
                  photo={photo}
                  canMoveBack={index > 0}
                  canMoveForward={index < sortedPhotos.length - 1}
                />
              </div>
            )
          })}
        </div>
      )}

      <div className="sticky-actions">
        <Link className="button button--primary" to={`/inspection/${inspection.id}/review`}>
          Revisar vistoria
        </Link>
      </div>
    </div>
  )
}
