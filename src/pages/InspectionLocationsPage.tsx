import { useEffect, useState } from 'react'
import { Copy, MapPin, Plus, Trash2, Wrench } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSaveState } from '../app/SaveContext'
import { AutosaveInput, AutosaveTextarea } from '../components/AutosaveField'
import { Button, Card, EmptyState, PageTitle, Pill, Skeleton } from '../components/ui'
import {
  createEquipment,
  deleteEquipmentFromInspection,
  deleteLocationFromInspection,
  duplicateEquipmentInLocation,
  duplicateLocationInInspection,
  mutateInspection
} from '../db/repository'
import { createLocation } from '../domain/inspection'
import { InspectionHeader } from '../features/inspections/InspectionHeader'
import { useInspection } from '../features/inspections/useInspection'

export function InspectionLocationsPage() {
  const { inspectionId } = useParams()
  const inspection = useInspection(inspectionId)
  const navigate = useNavigate()
  const { runSave } = useSaveState()
  const [newLocationName, setNewLocationName] = useState('')
  const [equipmentFormLocation, setEquipmentFormLocation] = useState<string>()
  const [equipmentTag, setEquipmentTag] = useState('')
  const [equipmentType, setEquipmentType] = useState('')
  const route = inspectionId ? `/inspection/${inspectionId}/locations` : ''

  useEffect(() => {
    if (!inspection || inspection.lastRoute === route) return
    void mutateInspection(inspection.id, (draft) => {
      draft.lastRoute = route
    })
  }, [inspection, route])

  if (!inspectionId || inspection === undefined) return <Skeleton height={420} />

  const addLocation = async () => {
    const name = newLocationName.trim()
    if (!name) return
    await runSave(() =>
      mutateInspection(inspection.id, (draft) => {
        draft.locations.push(createLocation(name))
      })
    )
    setNewLocationName('')
  }

  const addEquipment = async (locationId: string) => {
    const tag = equipmentTag.trim()
    const type = equipmentType.trim()
    if (!tag || !type) return
    const equipment = createEquipment(tag, type)
    await runSave(() =>
      mutateInspection(inspection.id, (draft) => {
        const location = draft.locations.find((item) => item.id === locationId)
        if (!location) throw new Error('Local não encontrado.')
        location.equipment.push(equipment)
        draft.lastLocationId = locationId
        draft.lastEquipmentId = equipment.id
      })
    )
    setEquipmentTag('')
    setEquipmentType('')
    setEquipmentFormLocation(undefined)
    navigate(`/inspection/${inspection.id}/location/${locationId}/equipment/${equipment.id}`)
  }

  const saveLocationField =
    (locationId: string, field: 'name' | 'description' | 'observations' | 'limitations') =>
    async (value: string) => {
      await mutateInspection(inspection.id, (draft) => {
        const location = draft.locations.find((item) => item.id === locationId)
        if (!location) throw new Error('Local não encontrado.')
        location[field] = value
      })
    }

  const removeLocation = async (locationId: string, name: string) => {
    const location = inspection.locations.find((item) => item.id === locationId)
    const occurrenceCount = inspection.occurrences.filter((item) => item.locationId === locationId).length
    if (
      !window.confirm(
        `Excluir “${name}”, ${location?.equipment.length ?? 0} equipamento(s) e ${occurrenceCount} ocorrência(s) associados?`
      )
    ) return
    await runSave(() => deleteLocationFromInspection(inspection.id, locationId))
  }

  const removeEquipment = async (locationId: string, equipmentId: string, tag: string) => {
    const occurrenceCount = inspection.occurrences.filter((item) => item.equipmentId === equipmentId).length
    if (!window.confirm(`Excluir “${tag}” e ${occurrenceCount} ocorrência(s) associados?`)) return
    await runSave(() => deleteEquipmentFromInspection(inspection.id, locationId, equipmentId))
  }

  return (
    <div>
      <InspectionHeader inspection={inspection} />
      <PageTitle
        eyebrow="Etapa 2"
        title="Locais e equipamentos"
        description="Organize a vistoria conforme o percurso em campo. Locais ou equipamentos semelhantes podem ser duplicados."
      />

      <Card className="inline-create-card">
        <div className="action-icon"><MapPin size={24} /></div>
        <label className="field inline-create-card__field">
          <span className="field__label">Nome do novo local</span>
          <input
            value={newLocationName}
            onChange={(event) => setNewLocationName(event.target.value)}
            placeholder="Ex.: Casa de máquinas"
            onKeyDown={(event) => {
              if (event.key === 'Enter') void addLocation()
            }}
          />
        </label>
        <Button onClick={() => void addLocation()} disabled={!newLocationName.trim()} icon={<Plus size={19} />}>
          Adicionar local
        </Button>
      </Card>

      {inspection.locations.length === 0 ? (
        <EmptyState
          title="Nenhum local registrado"
          description="Adicione o primeiro ambiente ou área da vistoria."
        />
      ) : (
        <div className="location-list">
          {inspection.locations.map((location, locationIndex) => (
            <Card key={location.id} className="location-card">
              <div className="location-card__header">
                <div className="location-card__number">{locationIndex + 1}</div>
                <div>
                  <h2>{location.name}</h2>
                  <p>{location.equipment.length} equipamento(s)</p>
                </div>
                <div className="location-card__menu">
                  <Button
                    variant="ghost"
                    onClick={() => void runSave(() => duplicateLocationInInspection(inspection.id, location.id))}
                    icon={<Copy size={17} />}
                  >
                    Duplicar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void removeLocation(location.id, location.name)}
                    icon={<Trash2 size={17} />}
                  >
                    Excluir
                  </Button>
                </div>
              </div>

              <details className="detail-panel">
                <summary>Editar informações e limitações do local</summary>
                <div className="form-grid form-grid--2 detail-panel__body">
                  <AutosaveInput
                    label="Nome do local"
                    value={location.name}
                    onSave={saveLocationField(location.id, 'name')}
                  />
                  <AutosaveInput
                    label="Descrição"
                    value={location.description}
                    onSave={saveLocationField(location.id, 'description')}
                  />
                  <AutosaveTextarea
                    label="Observações"
                    value={location.observations}
                    onSave={saveLocationField(location.id, 'observations')}
                  />
                  <AutosaveTextarea
                    label="Limitações específicas"
                    value={location.limitations}
                    onSave={saveLocationField(location.id, 'limitations')}
                  />
                </div>
              </details>

              <div className="equipment-list">
                {location.equipment.map((equipment) => (
                  <div className="equipment-row" key={equipment.id}>
                    <div className="equipment-row__icon"><Wrench size={19} /></div>
                    <div className="equipment-row__body">
                      <strong>{equipment.tag}</strong>
                      <span>{equipment.type}</span>
                    </div>
                    <Pill tone={equipment.checklist ? 'success' : 'neutral'}>
                      {equipment.checklist ? 'Checklist aberto' : 'Sem checklist'}
                    </Pill>
                    <div className="equipment-row__actions">
                      <Link
                        className="button button--secondary"
                        to={`/inspection/${inspection.id}/location/${location.id}/equipment/${equipment.id}`}
                      >
                        Abrir
                      </Link>
                      <button
                        className="icon-button"
                        aria-label={`Duplicar ${equipment.tag}`}
                        onClick={() =>
                          void runSave(() =>
                            duplicateEquipmentInLocation(inspection.id, location.id, equipment.id)
                          )
                        }
                      >
                        <Copy size={18} />
                      </button>
                      <button
                        className="icon-button icon-button--danger"
                        aria-label={`Excluir ${equipment.tag}`}
                        onClick={() => void removeEquipment(location.id, equipment.id, equipment.tag)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {equipmentFormLocation === location.id ? (
                <div className="equipment-create-form">
                  <label className="field">
                    <span className="field__label">Identificação ou tag *</span>
                    <input value={equipmentTag} onChange={(event) => setEquipmentTag(event.target.value)} placeholder="Ex.: Chiller 01" />
                  </label>
                  <label className="field">
                    <span className="field__label">Tipo *</span>
                    <input value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)} placeholder="Ex.: Chiller" />
                  </label>
                  <div className="button-row">
                    <Button
                      onClick={() => void addEquipment(location.id)}
                      disabled={!equipmentTag.trim() || !equipmentType.trim()}
                    >
                      Criar e abrir
                    </Button>
                    <Button variant="ghost" onClick={() => setEquipmentFormLocation(undefined)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setEquipmentFormLocation(location.id)}
                  icon={<Plus size={18} />}
                >
                  Adicionar equipamento
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {inspection.locations.length > 0 && (
        <div className="sticky-actions">
          <Link className="button button--secondary" to={`/inspection/${inspection.id}/review`}>
            Ir para revisão
          </Link>
        </div>
      )}
    </div>
  )
}
