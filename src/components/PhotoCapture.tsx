import { useRef, useState } from 'react'
import { Camera, ImagePlus } from 'lucide-react'
import { useSaveState } from '../app/SaveContext'
import { addInspectionPhoto } from '../services/photos'
import type { PhotoScope } from '../domain/types'
import { Button } from './ui'

interface PhotoCaptureProps {
  inspectionId: string
  scope: PhotoScope
  locationId?: string
  equipmentId?: string
  occurrenceId?: string
}

export function PhotoCapture(props: PhotoCaptureProps) {
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const { runSave } = useSaveState()

  const receive = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        await runSave(() => addInspectionPhoto({ ...props, file }))
      }
    } finally {
      setBusy(false)
      if (cameraInput.current) cameraInput.current.value = ''
      if (galleryInput.current) galleryInput.current.value = ''
    }
  }

  return (
    <div className="photo-capture">
      <input
        ref={cameraInput}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => void receive(event.target.files)}
      />
      <input
        ref={galleryInput}
        className="sr-only"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => void receive(event.target.files)}
      />
      <Button
        busy={busy}
        onClick={() => cameraInput.current?.click()}
        icon={<Camera size={19} />}
      >
        Tirar foto
      </Button>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => galleryInput.current?.click()}
        icon={<ImagePlus size={19} />}
      >
        Selecionar imagens
      </Button>
    </div>
  )
}
