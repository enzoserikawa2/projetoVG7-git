import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertCircle, ArrowRight, Check, ClipboardList, Plus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSaveState } from '../app/SaveContext'
import { AutosaveInput } from '../components/AutosaveField'
import { Alert, Button, Card, PageTitle, Pill, Skeleton } from '../components/ui'
import { db } from '../db/database'
import { mutateInspection } from '../db/repository'
import { CHECKLIST_STATUS } from '../domain/constants'
import { createId, nowIso } from '../domain/ids'
import {
  buildOccurrenceFromCriterion,
  createAppliedChecklist,
  createFreeOccurrence,
  findEquipment,
  findLocation
} from '../domain/inspection'
import type {
  ChecklistStatus,
  ChecklistTemplate,
  CriticalityLevel,
  LibraryItem,
  NormativeReference,
  OccurrenceReference,
  OccurrenceTemplate
} from '../domain/types'
import { InspectionHeader } from '../features/inspections/InspectionHeader'
import { useInspection } from '../features/inspections/useInspection'

export function ChecklistPage() {
  const { inspectionId, locationId, equipmentId } = useParams()
  const inspection = useInspection(inspectionId)
  const library = useLiveQuery<LibraryItem[], LibraryItem[]>(
    () => db.libraryItems.filter((item) => item.active).toArray(),
    [],
    []
  )
  const { runSave } = useSaveState()
  const navigate = useNavigate()
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const route = inspectionId && locationId && equipmentId
    ? `/inspection/${inspectionId}/location/${locationId}/equipment/${equipmentId}/checklist`
    : ''

  const templates = useMemo(
    () => library.filter((item): item is ChecklistTemplate => item.kind === 'checklist-template'),
    [library]
  )

  const effectiveTemplateId = selectedTemplateId || templates[0]?.id || ''

  useEffect(() => {
    if (!inspection || inspection.lastRoute === route) return
    void mutateInspection(inspection.id, (draft) => {
      draft.lastRoute = route
      draft.lastLocationId = locationId
      draft.lastEquipmentId = equipmentId
    })
  }, [equipmentId, inspection, locationId, route])

  if (!inspection || !locationId || !equipmentId) return <Skeleton height={520} />
  const location = findLocation(inspection, locationId)
  const equipment = findEquipment(inspection, locationId, equipmentId)
  if (!location || !equipment) return <PageTitle title="Equipamento não encontrado" />

  const applyTemplate = async () => {
    const template = templates.find((item) => item.id === effectiveTemplateId)
    if (!template) return
    if (equipment.checklist && !window.confirm('Substituir o checklist atual? Respostas e vínculos existentes serão preservados apenas nas ocorrências já registradas.')) return
    await runSave(() =>
      mutateInspection(inspection.id, (draft) => {
        const target = findEquipment(draft, locationId, equipmentId)
        if (!target) throw new Error('Equipamento não encontrado.')
        target.checklist = createAppliedChecklist(template)
      })
    )
  }

  const setStatus = async (responseId: string, status: ChecklistStatus) => {
    const currentResponse = equipment.checklist?.responses.find((item) => item.id === responseId)
    if (!currentResponse) return
    let occurrenceId = currentResponse.occurrenceId

    const template = currentResponse.occurrenceTemplateId
      ? (library.find(
          (item) => item.id === currentResponse.occurrenceTemplateId && item.kind === 'occurrence-template'
        ) as OccurrenceTemplate | undefined)
      : undefined
    const criticality = template?.suggestedCriticalityId
      ? (library.find(
          (item) => item.id === template.suggestedCriticalityId && item.kind === 'criticality'
        ) as CriticalityLevel | undefined)
      : undefined
    const references: OccurrenceReference[] = (template?.suggestedReferenceIds ?? [])
      .map((referenceId) =>
        library.find(
          (item) => item.id === referenceId && item.kind === 'normative-reference'
        ) as NormativeReference | undefined
      )
      .filter((item): item is NormativeReference => Boolean(item))
      .map((item) => ({
        id: createId(),
        sourceReferenceId: item.id,
        standardId: item.standardId,
        standardTitle: item.standardTitle || item.title,
        edition: item.edition,
        clause: item.clause,
        applicabilityConfirmed: false
      }))

    const nextInspection = await runSave(() =>
      mutateInspection(inspection.id, (draft) => {
        const target = findEquipment(draft, locationId, equipmentId)
        const response = target?.checklist?.responses.find((item) => item.id === responseId)
        if (!target || !response) throw new Error('Critério não encontrado.')
        response.status = status
        response.updatedAt = nowIso()

        if (status === 'nao_conforme') {
          if (!response.occurrenceId) {
            const occurrence = buildOccurrenceFromCriterion({
              inspection: draft,
              locationId,
              equipmentId,
              criterionId: response.criterionId,
              criterionText: response.criterionText,
              template,
              criticality,
              references
            })
            draft.occurrences.push(occurrence)
            response.occurrenceId = occurrence.id
            occurrenceId = occurrence.id
          } else {
            occurrenceId = response.occurrenceId
            const occurrence = draft.occurrences.find((item) => item.id === response.occurrenceId)
            if (occurrence) occurrence.requiresReview = true
          }
        } else if (response.occurrenceId) {
          const occurrence = draft.occurrences.find((item) => item.id === response.occurrenceId)
          if (occurrence) occurrence.requiresReview = true
        }
      })
    )

    if (status === 'nao_conforme') {
      const refreshedResponse = findEquipment(nextInspection, locationId, equipmentId)?.checklist?.responses.find(
        (item) => item.id === responseId
      )
      occurrenceId = occurrenceId ?? refreshedResponse?.occurrenceId
      if (occurrenceId) navigate(`/inspection/${inspection.id}/occurrence/${occurrenceId}`)
    }
  }

  const saveNote = (responseId: string) => async (note: string) => {
    await mutateInspection(inspection.id, (draft) => {
      const response = findEquipment(draft, locationId, equipmentId)?.checklist?.responses.find(
        (item) => item.id === responseId
      )
      if (!response) throw new Error('Critério não encontrado.')
      response.note = note
      response.updatedAt = nowIso()
    })
  }

  const addFreeOccurrence = async () => {
    const occurrence = createFreeOccurrence(inspection, locationId, equipmentId)
    await runSave(() =>
      mutateInspection(inspection.id, (draft) => {
        draft.occurrences.push(occurrence)
      })
    )
    navigate(`/inspection/${inspection.id}/occurrence/${occurrence.id}`)
  }

  const getNextRoute = () => {
    const equipmentOrder = inspection.locations.flatMap((item) =>
      item.equipment.map((entry) => ({ locationId: item.id, equipmentId: entry.id }))
    )
    const currentIndex = equipmentOrder.findIndex((item) => item.equipmentId === equipmentId)
    const next = equipmentOrder[currentIndex + 1]
    return next
      ? `/inspection/${inspection.id}/location/${next.locationId}/equipment/${next.equipmentId}/checklist`
      : `/inspection/${inspection.id}/review`
  }

  const counts = equipment.checklist?.responses.reduce<Record<ChecklistStatus, number>>(
    (result, response) => {
      result[response.status] += 1
      return result
    },
    { conforme: 0, nao_conforme: 0, nao_aplicavel: 0, nao_inspecionado: 0 }
  )

  return (
    <div>
      <InspectionHeader inspection={inspection} />
      <PageTitle
        eyebrow={`${location.name} • ${equipment.type}`}
        title={`Checklist — ${equipment.tag}`}
        description="Critérios positivos, quatro estados explícitos e criação automática de ocorrência para cada não conformidade."
      />

      {!equipment.checklist ? (
        <Card className="checklist-picker">
          <div className="action-icon"><ClipboardList size={25} /></div>
          <div>
            <h2>Selecionar modelo de checklist</h2>
            <p>O conteúdo será copiado para esta vistoria. Alterações futuras na biblioteca não mudarão este registro.</p>
          </div>
          <label className="field">
            <span className="field__label">Modelo</span>
            <select value={effectiveTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.title}</option>
              ))}
            </select>
          </label>
          <Button onClick={() => void applyTemplate()} disabled={!effectiveTemplateId}>Aplicar checklist</Button>
        </Card>
      ) : (
        <>
          <div className="checklist-summary">
            {(Object.keys(CHECKLIST_STATUS) as ChecklistStatus[]).map((status) => (
              <div key={status} className={`checklist-summary__item checklist-summary__item--${status}`}>
                <strong>{counts?.[status] ?? 0}</strong>
                <span>{CHECKLIST_STATUS[status].label}</span>
              </div>
            ))}
          </div>

          <div className="criterion-list">
            {equipment.checklist.responses
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((response, index) => (
                <Card key={response.id} className={`criterion-card criterion-card--${response.status}`}>
                  <div className="criterion-card__heading">
                    <span className="criterion-number">{index + 1}</span>
                    <div>
                      <h2>{response.criterionText}</h2>
                      {response.guidance && <p>{response.guidance}</p>}
                    </div>
                    <Pill
                      tone={
                        response.status === 'conforme'
                          ? 'success'
                          : response.status === 'nao_conforme'
                            ? 'danger'
                            : response.status === 'nao_aplicavel'
                              ? 'info'
                              : 'warning'
                      }
                    >
                      {CHECKLIST_STATUS[response.status].label}
                    </Pill>
                  </div>
                  <div className="status-selector" aria-label={`Status: ${response.criterionText}`}>
                    {(Object.keys(CHECKLIST_STATUS) as ChecklistStatus[]).map((status) => (
                      <button
                        key={status}
                        className={`${response.status === status ? 'active' : ''} status-${status}`}
                        onClick={() => void setStatus(response.id, status)}
                        aria-pressed={response.status === status}
                      >
                        {response.status === status && <Check size={16} />}
                        {CHECKLIST_STATUS[status].label}
                      </button>
                    ))}
                  </div>
                  <AutosaveInput
                    label="Observação do critério"
                    placeholder="Opcional"
                    value={response.note}
                    onSave={saveNote(response.id)}
                  />
                  {response.occurrenceId && (
                    <Link
                      className="criterion-occurrence-link"
                      to={`/inspection/${inspection.id}/occurrence/${response.occurrenceId}`}
                    >
                      <AlertCircle size={17} /> Abrir ocorrência vinculada
                    </Link>
                  )}
                </Card>
              ))}
          </div>

          <Alert title="O checklist não produz conclusão automática" tone="info">
            Os estados apoiam o registro. Conformidade global, segurança e aplicabilidade normativa permanecem sob avaliação do engenheiro.
          </Alert>
        </>
      )}

      <div className="sticky-actions sticky-actions--split">
        <Button variant="secondary" onClick={() => void addFreeOccurrence()} icon={<Plus size={18} />}>
          Ocorrência livre
        </Button>
        <Link className="button button--primary" to={getNextRoute()}>
          Próximo equipamento <ArrowRight size={19} />
        </Link>
      </div>
    </div>
  )
}
