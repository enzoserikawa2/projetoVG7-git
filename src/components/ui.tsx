import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react'
import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  busy?: boolean
  icon?: ReactNode
  full?: boolean
}

export function Button({
  variant = 'primary',
  busy,
  icon,
  full,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button--${variant} ${full ? 'button--full' : ''} ${className}`}
      disabled={disabled || busy}
      {...props}
    >
      {busy ? <LoaderCircle className="spin" size={19} aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  )
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`card ${className}`}>{children}</section>
}

export function PageTitle({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-title__description">{description}</p>}
      </div>
      {action && <div className="page-title__action">{action}</div>}
    </header>
  )
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <Inbox size={32} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function Alert({
  title,
  children,
  tone = 'warning'
}: PropsWithChildren<{ title: string; tone?: 'warning' | 'danger' | 'info' | 'success' }>) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <AlertTriangle size={21} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <div>{children}</div>
      </div>
    </div>
  )
}

export function Pill({
  children,
  tone = 'neutral'
}: PropsWithChildren<{ tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }>) {
  return <span className={`pill pill--${tone}`}>{children}</span>
}

export function Stat({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className={`stat stat--${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export function Skeleton({ height = 92 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} aria-label="Carregando" />
}
