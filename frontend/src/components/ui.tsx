'use client';
import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import {
  Bot,
  BrainCircuit,
  Sparkles,
  Cpu,
  Orbit,
  ShieldCheck,
  X,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { Agent, Room } from '@/domain/models';
import { t } from '@/i18n';
const avatarIcons: Record<string, LucideIcon> = {
  violet: BrainCircuit,
  cyan: Sparkles,
  amber: Bot,
  blue: Cpu,
  pink: Orbit,
  green: ShieldCheck,
};
export function Avatar({
  agent,
  size = 'md',
}: {
  agent: Pick<Agent, 'name' | 'color'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const Icon = avatarIcons[agent.color] ?? Bot;
  return (
    <span className={`avatar ${size} tone-${agent.color}`} aria-hidden="true">
      <Icon strokeWidth={1.6} />
    </span>
  );
}
export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={`badge tone-${tone}`}>
      {dot && <span className="status-dot" />}
      {children}
    </span>
  );
}
export function Status({ status }: { status: Room['status'] }) {
  return (
    <Badge tone={status === 'running' ? 'green' : status === 'paused' ? 'amber' : 'neutral'} dot>
      {t.chat.status[status]}
    </Badge>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <span />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}
export function Progress({
  value,
  tone = 'violet',
  label,
}: {
  value: number;
  tone?: string;
  label: string;
}) {
  return (
    <div
      className={`progress tone-${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` } as CSSProperties} />
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Orbit size={38} strokeWidth={1} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label={t.common.close}>
          <X size={20} />
        </button>
      </div>
      {open && children}
    </dialog>
  );
}
export function SectionHeading({
  title,
  icon: Icon,
  href,
  action,
}: {
  title: string;
  icon: LucideIcon;
  href?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>
        <Icon size={18} />
        {title}
      </h2>
      {href ? (
        <Link className="text-link" href={href}>
          {t.common.viewAll}
          <ArrowUpRight size={14} />
        </Link>
      ) : (
        action
      )}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
