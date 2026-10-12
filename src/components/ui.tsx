import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

export function cx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  icon,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:opacity-45 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500'
  const sizes = { sm: 'h-7 px-2.5 text-xs', md: 'h-8 px-3 text-[13px]' }
  const variants: Record<Variant, string> = {
    primary: 'bg-accent-600 text-white hover:bg-accent-700 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
    link: 'text-accent-700 hover:underline px-0 h-auto',
  }
  return (
    <button type="button" className={cx(base, variant !== 'link' && sizes[size], variants[variant], className)} {...rest}>
      {icon}
      {children}
    </button>
  )
}

export function Card({ title, subtitle, actions, children, className, bodyClassName }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cx('rounded-lg border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-[13px] font-bold text-ink">{title}</h2>}
            {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(/(^|\s)p-\d/.test(bodyClassName ?? '') ? '' : 'p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

type Tone = 'neutral' | 'accent' | 'green' | 'amber' | 'red' | 'violet'

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  accent: 'bg-accent-50 text-accent-800 ring-accent-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
}

export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium whitespace-nowrap ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'h-8 rounded-md border border-slate-300 bg-white pr-7 pl-2 text-[13px] text-slate-800 hover:border-slate-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-100 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 hover:border-slate-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-100 focus:outline-none',
        className,
      )}
      {...rest}
    />
  )
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('mb-1 block text-[11px] font-semibold tracking-wide text-slate-500 uppercase', className)}>{children}</span>
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
}

export function Modal({ open, title, onClose, children, footer, width = 'max-w-lg' }: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/30 p-4 pt-[12vh]" onMouseDown={onClose}>
      <div className={cx('animate-fade-up w-full rounded-lg border border-slate-200 bg-white shadow-xl', width)} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="font-display text-[15px] font-bold text-ink">{title}</h3>
          <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4 scroll-thin">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'w-[560px]',
  z = 'z-40',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
  z?: string
}) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className={cx('fixed inset-0', z)}>
      <div className="absolute inset-0 bg-slate-900/15" onMouseDown={onClose} />
      <aside className={cx('animate-slide-in absolute top-0 right-0 flex h-full max-w-[100vw] flex-col border-l border-slate-200 bg-white shadow-2xl', width)}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[17px] font-bold text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
          </div>
          <button className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</div>}
      </aside>
    </div>
  )
}

export function EmptyState({ icon, title, hint, action, className }: { icon?: ReactNode; title: string; hint: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center', className)}>
      {icon && <div className="mb-2 text-slate-400">{icon}</div>}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 max-w-md text-xs text-slate-500">{hint}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx(
        'inline-flex h-7 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors',
        active ? 'border-accent-600 bg-accent-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800',
      )}
    >
      {children}
    </button>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium',
            value === t.id ? 'border-accent-600 text-accent-700' : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cx(
            'rounded px-2.5 font-medium transition-colors',
            size === 'sm' ? 'h-6 text-xs' : 'h-7 text-[13px]',
            value === o.id ? 'bg-accent-600 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="animate-fade-up mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[22px] leading-tight font-bold text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[13px] text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Th({ children, className, right }: { children?: ReactNode; className?: string; right?: boolean }) {
  return <th className={cx('border-b border-slate-300 bg-panel px-3 py-2 text-[11px] font-bold tracking-wide text-slate-600 uppercase', right ? 'text-right' : 'text-left', className)}>{children}</th>
}

export function Td({ children, className, right }: { children?: ReactNode; className?: string; right?: boolean }) {
  return <td className={cx('border-b border-slate-100 px-3 py-1.5 align-middle', right && 'num text-right', className)}>{children}</td>
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500', checked ? 'bg-accent-600' : 'bg-slate-300')}
    >
      <span className={cx('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  )
}
