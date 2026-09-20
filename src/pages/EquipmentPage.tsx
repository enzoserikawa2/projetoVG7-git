import { useEffect } from 'react'
import { ArrowRight, ClipboardCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useSaveState } from '../app/SaveContext'
import { AutosaveInput, AutosaveTextarea } from '../components/AutosaveField'
import { Card, PageTitle, Skeleton } from '../components/ui'
import { mutateInspection } from '../db/repository'
import { EQUIPMENT_STATE } from '../domain/constants'
import { findEquipment, findLocation } from '../domain/inspection'
import type { EquipmentOperatingState } from '../domain/types'
import { InspectionHeader } from '../features/inspections/InspectionHeader'
import { useInspection } from '../features/inspections/useInspection'

type EquipmentTextField = 'tag' | 'type' | 'manufacturer' | 'model' | 'serialNumber' | 'observations' | 'limitations'

export function EquipmentPage() {
  const { inspectionId, locationId, equipmentId } = useParams()
  const inspection = useInspection(inspectionId)
  const { runSave } = useSaveState()
  const route = inspectionId && locationId && equipmentId
    ? `/inspection/${inspectionId}/location/${locationId}/equipment/${equipmentId}`
    : ''

  useEffect(() => {
    if (!inspection || inspection.lastRoute === route) return
    void mutateInspection(inspection.id, (draft) => {
      draft.lastRoute = route
      draft.lastLocationId = locationId
      draft.lastEquipmentId = equipmentId
    })
  }, [equipmentId, inspection, locationId, route])

  if (!inspection || !locationId || !equipmentId) return <Skeleton height={420} />
  const location = findLocation(inspection, locationId)
  const equipment = findEquipment(inspection, locationId, equipmentId)
  if (!location || !equipment) return <PageTitle title="Equipamento não encontrado" />

  const saveText = (field: EquipmentTextField) => async (value: string) => {
    await mutateInspection(inspection.id, (draft) => {
      const target = findEquipment(draft, locationId, equipmentId)
      if (!target) throw new Error('Equipamento não encontrado.')
      target[field] = value
    })
  }

  const saveState = async (state: EquipmentOperatingState) => {
    await runSave(() =>
      mutateInspection(inspection.id, (draft) => {
        const target = findEquipment(draft, locationId, equipmentId)
        if (!target) throw new Error('Equipamento não encontrado.')
        target.operatingState = state
      })
    )
  }

  return (
    <div>
      <InspectionHeader inspection={inspection} />
      <PageTitle
        eyebrow={location.name}
        title={equipment.tag}
        description="Registre apenas os dados disponíveis. Campos não verificados podem permanecer vazios."
      />

      <Card className="form-card">
        <div className="form-grid form-grid--2">
          <AutosaveInput label="Identificação ou tag" required value={equipment.tag} onSave={saveText('tag')} />
          <AutosaveInput label="Tipo" required value={equipment.type} onSave={saveText('type')} />
          <AutosaveInput label="Fabricante" value={equipment.manufacturer} onSave={saveText('manufacturer')} />
          <AutosaveInput label="Modelo" value={equipment.model} onSave={saveText('model')} />
          <AutosaveInput label="Número de série" value={equipment.serialNumber} onSave={saveText('serialNumber')} />
          <label className="field">
            <span className="field__label">Estado durante a inspeção</span>
            <select
              value={equipment.operatingState}
              onChange={(event) => void saveState(event.target.value as EquipmentOperatingState)}
            >
              {Object.entries(EQUIPMENT_STATE).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-section">
          <AutosaveTextarea label="Observações" value={equipment.observations} onSave={saveText('observations')} />
          <AutosaveTextarea
            label="Limitações específicas"
            value={equipment.limitations}
            onSave={saveText('limitations')}
            hint="Ex.: equipamento desligado, acesso interno não autorizado ou painel inacessível."
          />
        </div>
      </Card>

      <div className="sticky-actions">
        <Link className="button button--secondary" to={`/inspection/${inspection.id}/locations`}>
          Voltar aos equipamentos
        </Link>
        <Link
          className="button button--primary"
          to={`/inspection/${inspection.id}/location/${locationId}/equipment/${equipmentId}/checklist`}
        >
          <ClipboardCheck size={19} /> Abrir checklist <ArrowRight size={19} />
        </Link>
      </div>
    </div>
  )
}
