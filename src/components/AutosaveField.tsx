import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useSaveState } from '../app/SaveContext'

interface SharedProps {
  label: string
  hint?: string
  value: string
  onSave: (value: string) => Promise<unknown>
  required?: boolean
}

type AutosaveInputProps = SharedProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>

export function AutosaveInput({ label, hint, value, onSave, required, ...props }: AutosaveInputProps) {
  const [local, setLocal] = useState({ source: value, draft: value })
  const draft = local.source === value ? local.draft : value
  const timer = useRef<number | undefined>(undefined)
  const latestSave = useRef(onSave)
  const { runSave } = useSaveState()

  useEffect(() => {
    latestSave.current = onSave
  }, [onSave])

  const commit = useCallback(
    async (next: string) => {
      window.clearTimeout(timer.current)
      if (next === value) return
      await runSave(() => latestSave.current(next))
    },
    [runSave, value]
  )

  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    setLocal({ source: value, draft: next })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void commit(next), 500)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <label className="field">
      <span className="field__label">
        {label} {required && <span aria-label="obrigatório">*</span>}
      </span>
      <input {...props} required={required} value={draft} onChange={change} onBlur={() => void commit(draft)} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}

type AutosaveTextareaProps = SharedProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'onBlur'>

export function AutosaveTextarea({
  label,
  hint,
  value,
  onSave,
  required,
  ...props
}: AutosaveTextareaProps) {
  const [local, setLocal] = useState({ source: value, draft: value })
  const draft = local.source === value ? local.draft : value
  const timer = useRef<number | undefined>(undefined)
  const latestSave = useRef(onSave)
  const { runSave } = useSaveState()

  useEffect(() => {
    latestSave.current = onSave
  }, [onSave])
  const commit = useCallback(
    async (next: string) => {
      window.clearTimeout(timer.current)
      if (next === value) return
      await runSave(() => latestSave.current(next))
    },
    [runSave, value]
  )

  const change = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value
    setLocal({ source: value, draft: next })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void commit(next), 500)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <label className="field">
      <span className="field__label">
        {label} {required && <span aria-label="obrigatório">*</span>}
      </span>
      <textarea
        {...props}
        required={required}
        value={draft}
        onChange={change}
        onBlur={() => void commit(draft)}
      />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}
