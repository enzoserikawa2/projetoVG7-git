import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useSaveState } from '../app/SaveContext'
import { Button, Card, EmptyState, PageTitle, Pill } from '../components/ui'
import { db } from '../db/database'
import { createInspection, deleteInspection, duplicateInspection } from '../db/repository'
import { formatDate, formatDateTime } from '../domain/ids'

export function InspectionListPage() {
  const navigate = useNavigate()
  const { runSave } = useSaveState()
  const inspections = useLiveQuery(() => db.inspections.orderBy('updatedAt').reverse().toArray(), [], [])
  const [busyId, setBusyId] = useState<string>()

  const create = async () => {
    const inspection = await runSave(createInspection)
    navigate(`/inspection/${inspection.id}/basics`)
  }

  const duplicate = async (id: string) => {
    setBusyId(id)
    try {
      const nextId = await runSave(() => duplicateInspection(id))
      navigate(`/inspection/${nextId}/basics`)
    } finally {
      setBusyId(undefined)
    }
  }

  const remove = async (id: string, label: string) => {
    const confirmed = window.confirm(
      `Excluir “${label}”? A vistoria, as fotografias e os registros de geração associados serão removidos deste dispositivo.`
    )
    if (!confirmed) return
    setBusyId(id)
    try {
      await runSave(() => deleteInspection(id))
    } finally {
      setBusyId(undefined)
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="Registros locais"
        title="Vistorias salvas"
        description="Os dados abaixo existem somente neste dispositivo, salvo quando exportados manualmente."
        action={<Button onClick={create} icon={<Plus size={19} />}>Nova vistoria</Button>}
      />

      {inspections.length === 0 ? (
        <EmptyState
          title="Nenhuma vistoria salva"
          description="Crie a primeira vistoria para começar o registro em campo."
          action={<Button onClick={create}>Nova vistoria</Button>}
        />
      ) : (
        <div className="inspection-list">
          {inspections.map((inspection) => {
            const equipment = inspection.locations.reduce((total, location) => total + location.equipment.length, 0)
            const label = inspection.facility || inspection.client || 'Vistoria sem título'
            return (
              <Card key={inspection.id} className="inspection-list-card">
                <div className="inspection-list-card__body">
                  <div className="card-title-row">
                    <div>
                      <h2>{label}</h2>
                      <p>{inspection.client || 'Cliente não informado'}</p>
                    </div>
                    {inspection.isDemo ? (
                      <Pill tone="warning">DEMO</Pill>
                    ) : inspection.status === 'finalizada' ? (
                      <Pill tone="success">Finalizada</Pill>
                    ) : (
                      <Pill tone="info">Em andamento</Pill>
                    )}
                  </div>
                  <div className="inspection-meta">
                    <span>Data: {formatDate(inspection.inspectionDate)}</span>
                    <span>{inspection.locations.length} local(is)</span>
                    <span>{equipment} equipamento(s)</span>
                    <span>{inspection.occurrences.length} ocorrência(s)</span>
                  </div>
                  <small>Atualizada em {formatDateTime(inspection.updatedAt)}</small>
                </div>
                <div className="inspection-list-card__actions">
                  <Link className="button button--primary" to={inspection.lastRoute || `/inspection/${inspection.id}/basics`}>
                    {inspection.status === 'finalizada' ? 'Abrir' : 'Continuar'}
                  </Link>
                  <Button
                    variant="secondary"
                    busy={busyId === inspection.id}
                    onClick={() => void duplicate(inspection.id)}
                    icon={<Copy size={18} />}
                  >
                    Duplicar
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busyId === inspection.id}
                    onClick={() => void remove(inspection.id, label)}
                    icon={<Trash2 size={18} />}
                  >
                    Excluir
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
