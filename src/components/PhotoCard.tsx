import { useEffect, useMemo } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import { useSaveState } from '../app/SaveContext'
import type { InspectionPhoto } from '../domain/types'
import {
  deleteInspectionPhoto,
  movePhoto,
  rotateInspectionPhoto,
  updatePhotoCaption
} from '../services/photos'
import { AutosaveInput } from './AutosaveField'
import { Button, Pill } from './ui'

export function PhotoCard({
  photo,
  canMoveBack = true,
  canMoveForward = true
}: {
  photo: InspectionPhoto
  canMoveBack?: boolean
  canMoveForward?: boolean
}) {
  const { runSave } = useSaveState()
  const url = useMemo(() => URL.createObjectURL(photo.thumbnailBlob), [photo.thumbnailBlob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  const remove = async () => {
    if (!window.confirm('Excluir esta fotografia do dispositivo e da ocorrência associada?')) return
    await runSave(() => deleteInspectionPhoto(photo.id))
  }

  return (
    <article className="photo-card">
      <div className="photo-card__image-wrap">
        {url && <img src={url} alt={photo.caption || 'Fotografia da vistoria'} />}
        <Pill tone={photo.processingStatus === 'ready' ? 'success' : photo.processingStatus === 'failed' ? 'danger' : 'warning'}>
          {photo.processingStatus === 'ready' ? 'Otimizada' : photo.processingStatus === 'failed' ? 'Original preservado' : 'Processando'}
        </Pill>
      </div>
      <AutosaveInput
        label="Legenda"
        placeholder="Descreva o que a fotografia evidencia"
        value={photo.caption}
        onSave={(caption) => updatePhotoCaption(photo.id, caption)}
      />
      <div className="photo-card__actions">
        <button
          className="icon-button"
          disabled={!canMoveBack}
          onClick={() => void runSave(() => movePhoto(photo.id, -1))}
          aria-label="Mover fotografia para trás"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          className="icon-button"
          disabled={!canMoveForward}
          onClick={() => void runSave(() => movePhoto(photo.id, 1))}
          aria-label="Mover fotografia para frente"
        >
          <ArrowRight size={18} />
        </button>
        <button
          className="icon-button"
          disabled={photo.processingStatus === 'pending'}
          onClick={() => void runSave(() => rotateInspectionPhoto(photo.id, -1))}
          aria-label="Girar fotografia 90 graus para a esquerda"
        >
          <RotateCcw size={18} />
        </button>
        <button
          className="icon-button"
          disabled={photo.processingStatus === 'pending'}
          onClick={() => void runSave(() => rotateInspectionPhoto(photo.id, 1))}
          aria-label="Girar fotografia 90 graus para a direita"
        >
          <RotateCw size={18} />
        </button>
        <Button variant="ghost" onClick={() => void remove()} icon={<Trash2 size={18} />}>
          Excluir
        </Button>
      </div>
    </article>
  )
}
