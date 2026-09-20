import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, BookOpen, Plus } from 'lucide-react'
import { useSaveState } from '../app/SaveContext'
import { AutosaveInput, AutosaveTextarea } from '../components/AutosaveField'
import { Alert, Button, Card, EmptyState, PageTitle, Pill } from '../components/ui'
import { db } from '../db/database'
import { mutateLibraryItem } from '../db/repository'
import { createId, nowIso } from '../domain/ids'
import { APP_SCHEMA_VERSION } from '../domain/types'
import type {
  ChecklistCriterion,
  ChecklistTemplate,
  CriticalityLevel,
  LibraryItem,
  NormativeReference,
  OccurrenceTemplate,
  RecommendationTemplate
} from '../domain/types'

const tabLabels: Record<LibraryItem['kind'], string> = {
  'checklist-template': 'Checklists',
  'occurrence-template': 'Ocorrências',
  recommendation: 'Recomendações',
  criticality: 'Criticidades',
  'normative-reference': 'Referências'
}

function entityBase() {
  const timestamp = nowIso()
  return {
    id: createId(),
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    active: true
  }
}

function newLibraryItem(kind: LibraryItem['kind']): LibraryItem {
  const base = entityBase()
  switch (kind) {
    case 'checklist-template':
      return { ...base, kind, title: 'Novo checklist', version: 1, system: 'HVAC', equipmentTypes: [], criteria: [] }
    case 'occurrence-template':
      return {
        ...base,
        kind,
        title: 'Novo modelo de ocorrência',
        system: 'HVAC',
        category: '',
        equipmentType: '',
        technicalDescription: '',
        recommendation: '',
        inspectorGuidance: '',
        suggestedReferenceIds: []
      }
    case 'recommendation':
      return { ...base, kind, title: 'Nova recomendação', category: '', text: '' }
    case 'criticality':
      return { ...base, kind, title: 'Novo nível', description: '', rank: 1 }
    case 'normative-reference':
      return {
        ...base,
        kind,
        title: 'Nova referência',
        standardId: '',
        standardTitle: '',
        edition: '',
        clause: '',
        internalNote: '',
        validatedByEngineer: false
      }
  }
}

export function LibraryPage() {
  const [activeTab, setActiveTab] = useState<LibraryItem['kind']>('checklist-template')
  const { runSave } = useSaveState()
  const items = useLiveQuery<LibraryItem[], LibraryItem[]>(
    () => db.libraryItems.orderBy('updatedAt').reverse().toArray(),
    [],
    []
  )
  const visible = items.filter((item) => item.kind === activeTab)
  const criticalities = items.filter((item): item is CriticalityLevel => item.kind === 'criticality')
  const references = items.filter((item): item is NormativeReference => item.kind === 'normative-reference')
  const occurrenceTemplates = items.filter(
    (item): item is OccurrenceTemplate => item.kind === 'occurrence-template'
  )

  const addItem = async () => {
    await runSave(() => db.libraryItems.add(newLibraryItem(activeTab)))
  }

  const toggleActive = async (item: LibraryItem) => {
    await runSave(() => mutateLibraryItem(item.id, (draft) => { draft.active = !draft.active }))
  }

  return (
    <div>
      <PageTitle
        eyebrow="Conteúdo local"
        title="Biblioteca técnica"
        description="Modelos aceleram o registro, mas sugestões de criticidade e referências sempre dependem de confirmação do engenheiro."
        action={<Button onClick={() => void addItem()} icon={<Plus size={18} />}>Novo item</Button>}
      />

      <Alert title="Biblioteca não é validação automática" tone="warning">
        Não armazene textos integrais de normas. Cadastre somente referências conferidas e conteúdo que possa ser usado legitimamente.
      </Alert>

      <div className="library-tabs" role="tablist" aria-label="Categorias da biblioteca">
        {(Object.keys(tabLabels) as LibraryItem['kind'][]).map((kind) => (
          <button
            key={kind}
            role="tab"
            aria-selected={activeTab === kind}
            className={activeTab === kind ? 'active' : ''}
            onClick={() => setActiveTab(kind)}
          >
            {tabLabels[kind]}
            <span>{items.filter((item) => item.kind === kind).length}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={`Nenhum item em ${tabLabels[activeTab]}`}
          description="Crie um item local para começar."
          action={<Button onClick={() => void addItem()}>Criar item</Button>}
        />
      ) : (
        <div className="library-list">
          {visible.map((item) => (
            <Card key={item.id} className="library-card">
              <details>
                <summary>
                  <div className="library-card__icon"><BookOpen size={20} /></div>
                  <div><strong>{item.title}</strong><span>{tabLabels[item.kind]}</span></div>
                  <Pill tone={item.active ? 'success' : 'neutral'}>{item.active ? 'Ativo' : 'Inativo'}</Pill>
                </summary>
                <div className="library-card__body">
                  <div className="library-active-toggle">
                    <label>
                      <input type="checkbox" checked={item.active} onChange={() => void toggleActive(item)} />
                      Disponível para novas vistorias
                    </label>
                  </div>
                  {item.kind === 'checklist-template' && (
                    <ChecklistEditor item={item} occurrenceTemplates={occurrenceTemplates} runSave={runSave} />
                  )}
                  {item.kind === 'occurrence-template' && (
                    <OccurrenceTemplateEditor item={item} criticalities={criticalities} references={references} runSave={runSave} />
                  )}
                  {item.kind === 'recommendation' && <RecommendationEditor item={item} />}
                  {item.kind === 'criticality' && <CriticalityEditor item={item} />}
                  {item.kind === 'normative-reference' && <ReferenceEditor item={item} runSave={runSave} />}
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

type RunSave = <T>(operation: () => Promise<T>) => Promise<T>

function ChecklistEditor({
  item,
  occurrenceTemplates,
  runSave
}: {
  item: ChecklistTemplate
  occurrenceTemplates: OccurrenceTemplate[]
  runSave: RunSave
}) {
  const saveString = (field: 'title' | 'system') => async (value: string) => {
    await mutateLibraryItem(item.id, (draft) => {
      if (draft.kind !== 'checklist-template') return
      draft[field] = value
      draft.version += 1
    })
  }
  const saveEquipmentTypes = async (value: string) => {
    await mutateLibraryItem(item.id, (draft) => {
      if (draft.kind !== 'checklist-template') return
      draft.equipmentTypes = value.split(',').map((entry) => entry.trim()).filter(Boolean)
      draft.version += 1
    })
  }
  const addCriterion = async () => {
    await runSave(() =>
      mutateLibraryItem(item.id, (draft) => {
        if (draft.kind !== 'checklist-template') return
        const criterion: ChecklistCriterion = {
          id: createId(),
          text: 'Novo critério positivo e verificável.',
          guidance: '',
          order: draft.criteria.length + 1,
          active: true
        }
        draft.criteria.push(criterion)
        draft.version += 1
      })
    )
  }
  const updateCriterion = async (
    criterionId: string,
    mutate: (criterion: ChecklistCriterion) => void
  ) => {
    await mutateLibraryItem(item.id, (draft) => {
      if (draft.kind !== 'checklist-template') return
      const criterion = draft.criteria.find((entry) => entry.id === criterionId)
      if (!criterion) throw new Error('Critério não encontrado.')
      mutate(criterion)
      draft.version += 1
    })
  }
  const moveCriterion = async (criterionId: string, direction: -1 | 1) => {
    await runSave(() =>
      mutateLibraryItem(item.id, (draft) => {
        if (draft.kind !== 'checklist-template') return
        const ordered = draft.criteria.slice().sort((a, b) => a.order - b.order)
        const index = ordered.findIndex((entry) => entry.id === criterionId)
        const target = ordered[index + direction]
        const current = ordered[index]
        if (!target || !current) return
        const order = current.order
        current.order = target.order
        target.order = order
        draft.version += 1
      })
    )
  }

  return (
    <div className="library-editor">
      <div className="form-grid form-grid--2">
        <AutosaveInput label="Nome do modelo" value={item.title} onSave={saveString('title')} />
        <AutosaveInput label="Sistema" value={item.system} onSave={saveString('system')} />
        <AutosaveInput
          label="Tipos de equipamento"
          hint="Separe por vírgulas."
          value={item.equipmentTypes.join(', ')}
          onSave={saveEquipmentTypes}
        />
        <div className="library-version"><span>Versão local</span><strong>{item.version}</strong></div>
      </div>
      <div className="section-heading"><h3>Critérios</h3><Button variant="secondary" onClick={() => void addCriterion()} icon={<Plus size={17} />}>Adicionar</Button></div>
      <div className="criteria-editor-list">
        {item.criteria.slice().sort((a, b) => a.order - b.order).map((criterion, index) => (
          <div className="criterion-editor" key={criterion.id}>
            <div className="criterion-editor__order">{index + 1}</div>
            <div className="criterion-editor__fields">
              <AutosaveInput
                label="Critério positivo e verificável"
                value={criterion.text}
                onSave={(value) => updateCriterion(criterion.id, (draft) => { draft.text = value })}
              />
              <AutosaveInput
                label="Orientação ao inspetor"
                value={criterion.guidance}
                onSave={(value) => updateCriterion(criterion.id, (draft) => { draft.guidance = value })}
              />
              <label className="field">
                <span className="field__label">Modelo para não conformidade</span>
                <select
                  value={criterion.occurrenceTemplateId ?? ''}
                  onChange={(event) => void runSave(() => updateCriterion(criterion.id, (draft) => {
                    draft.occurrenceTemplateId = event.target.value || undefined
                  }))}
                >
                  <option value="">Nenhum</option>
                  {occurrenceTemplates.filter((entry) => entry.active).map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.title}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="criterion-editor__actions">
              <button className="icon-button" disabled={index === 0} onClick={() => void moveCriterion(criterion.id, -1)} aria-label="Mover critério para cima"><ArrowUp size={17} /></button>
              <button className="icon-button" disabled={index === item.criteria.length - 1} onClick={() => void moveCriterion(criterion.id, 1)} aria-label="Mover critério para baixo"><ArrowDown size={17} /></button>
              <label className="compact-check"><input type="checkbox" checked={criterion.active} onChange={(event) => void runSave(() => updateCriterion(criterion.id, (draft) => { draft.active = event.target.checked }))} /> Ativo</label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OccurrenceTemplateEditor({
  item,
  criticalities,
  references,
  runSave
}: {
  item: OccurrenceTemplate
  criticalities: CriticalityLevel[]
  references: NormativeReference[]
  runSave: RunSave
}) {
  const saveString =
    (field: 'title' | 'system' | 'category' | 'equipmentType' | 'technicalDescription' | 'recommendation' | 'inspectorGuidance') =>
    async (value: string) => {
      await mutateLibraryItem(item.id, (draft) => {
        if (draft.kind === 'occurrence-template') draft[field] = value
      })
    }
  const toggleReference = async (referenceId: string, checked: boolean) => {
    await runSave(() =>
      mutateLibraryItem(item.id, (draft) => {
        if (draft.kind !== 'occurrence-template') return
        draft.suggestedReferenceIds = checked
          ? Array.from(new Set([...draft.suggestedReferenceIds, referenceId]))
          : draft.suggestedReferenceIds.filter((id) => id !== referenceId)
      })
    )
  }

  return (
    <div className="library-editor">
      <div className="form-grid form-grid--2">
        <AutosaveInput label="Título resumido" value={item.title} onSave={saveString('title')} />
        <AutosaveInput label="Sistema" value={item.system} onSave={saveString('system')} />
        <AutosaveInput label="Categoria" value={item.category} onSave={saveString('category')} />
        <AutosaveInput label="Tipo de equipamento" value={item.equipmentType} onSave={saveString('equipmentType')} />
      </div>
      <AutosaveTextarea label="Descrição técnica padrão" value={item.technicalDescription} onSave={saveString('technicalDescription')} />
      <AutosaveTextarea label="Recomendação padrão" value={item.recommendation} onSave={saveString('recommendation')} />
      <AutosaveTextarea label="Orientações ao inspetor" value={item.inspectorGuidance} onSave={saveString('inspectorGuidance')} />
      <label className="field">
        <span className="field__label">Criticidade sugerida</span>
        <select
          value={item.suggestedCriticalityId ?? ''}
          onChange={(event) => void runSave(() => mutateLibraryItem(item.id, (draft) => {
            if (draft.kind === 'occurrence-template') draft.suggestedCriticalityId = event.target.value || undefined
          }))}
        >
          <option value="">Sem sugestão</option>
          {criticalities.filter((entry) => entry.active).sort((a, b) => a.rank - b.rank).map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.title}</option>
          ))}
        </select>
      </label>
      <fieldset className="reference-suggestions">
        <legend>Referências sugeridas</legend>
        {references.map((reference) => (
          <label key={reference.id}>
            <input
              type="checkbox"
              checked={item.suggestedReferenceIds.includes(reference.id)}
              onChange={(event) => void toggleReference(reference.id, event.target.checked)}
            />
            <span>{reference.standardId || 'Referência a validar'} — {reference.standardTitle || reference.title}</span>
            <Pill tone={reference.validatedByEngineer ? 'success' : 'warning'}>{reference.validatedByEngineer ? 'Validada' : 'Pendente'}</Pill>
          </label>
        ))}
      </fieldset>
    </div>
  )
}

function RecommendationEditor({ item }: { item: RecommendationTemplate }) {
  const saveString = (field: 'title' | 'category' | 'text') => async (value: string) => {
    await mutateLibraryItem(item.id, (draft) => {
      if (draft.kind === 'recommendation') draft[field] = value
    })
  }
  return (
    <div className="library-editor">
      <div className="form-grid form-grid--2">
        <AutosaveInput label="Título" value={item.title} onSave={saveString('title')} />
        <AutosaveInput label="Categoria" value={item.category} onSave={saveString('category')} />
      </div>
      <AutosaveTextarea label="Texto da recomendação" value={item.text} onSave={saveString('text')} />
    </div>
  )
}

function CriticalityEditor({ item }: { item: CriticalityLevel }) {
  return (
    <div className="library-editor">
      <div className="form-grid form-grid--2">
        <AutosaveInput label="Nome" value={item.title} onSave={(value) => mutateLibraryItem(item.id, (draft) => { if (draft.kind === 'criticality') draft.title = value })} />
        <AutosaveInput label="Ordem" type="number" min="1" value={String(item.rank)} onSave={(value) => mutateLibraryItem(item.id, (draft) => { if (draft.kind === 'criticality') draft.rank = Math.max(1, Number(value) || 1) })} />
      </div>
      <AutosaveTextarea label="Descrição interna" value={item.description} onSave={(value) => mutateLibraryItem(item.id, (draft) => { if (draft.kind === 'criticality') draft.description = value })} />
    </div>
  )
}

function ReferenceEditor({ item, runSave }: { item: NormativeReference; runSave: RunSave }) {
  const saveString =
    (field: 'title' | 'standardId' | 'standardTitle' | 'edition' | 'clause' | 'internalNote') =>
    async (value: string) => {
      await mutateLibraryItem(item.id, (draft) => {
        if (draft.kind !== 'normative-reference') return
        draft[field] = value
        if (field === 'standardId' || field === 'standardTitle') draft.validatedByEngineer = false
      })
    }
  const validate = async (checked: boolean) => {
    if (checked && (!item.standardId.trim() || !item.standardTitle.trim())) {
      window.alert('Preencha a identificação e o título da norma antes de validar.')
      return
    }
    await runSave(() => mutateLibraryItem(item.id, (draft) => {
      if (draft.kind === 'normative-reference') draft.validatedByEngineer = checked
    }))
  }
  return (
    <div className="library-editor">
      <div className="form-grid form-grid--2">
        <AutosaveInput label="Nome interno" value={item.title} onSave={saveString('title')} />
        <AutosaveInput label="Identificação da norma" value={item.standardId} onSave={saveString('standardId')} placeholder="Ex.: identificação conferida" />
        <AutosaveInput label="Título" value={item.standardTitle} onSave={saveString('standardTitle')} />
        <AutosaveInput label="Ano ou edição" value={item.edition} onSave={saveString('edition')} />
        <AutosaveInput label="Item ou subitem" value={item.clause} onSave={saveString('clause')} />
      </div>
      <AutosaveTextarea label="Observação interna" value={item.internalNote} onSave={saveString('internalNote')} />
      <label className="reference-validation">
        <input type="checkbox" checked={item.validatedByEngineer} onChange={(event) => void validate(event.target.checked)} />
        <span><strong>Referência conferida pelo engenheiro</strong><small>A aplicabilidade ainda deverá ser confirmada em cada ocorrência.</small></span>
      </label>
    </div>
  )
}
