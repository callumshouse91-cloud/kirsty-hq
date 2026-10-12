import { Check, GitPullRequestArrow, History, RotateCcw, ShieldCheck, Users, X } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, Chip, cx, EmptyState, Input, PageHeader, Tabs, Td, Th } from '../components/ui'
import { useDemo, usePermissions } from '../demo-store'
import { ALL_PERMS, PERM_LABEL, permissionsFor, ROLES, type Permission } from '../lib/roles'
import { fmtWhen, plural } from '../lib/util'
import { patchParams, useRoute } from '../router'
import { useStore } from '../store'
import type { Approval, ChangeEvent, ChangeKind } from '../types'
import { useUi } from '../ui-store'

const KIND_LABEL: Record<ChangeKind, string> = {
  taxonomy: 'Taxonomy',
  mapping: 'Layer mapping',
  tool: 'Tool',
  usage: 'Desk usage',
  dependency: 'Dependency',
  alias: 'Alias',
  reconcile: 'Reconciliation',
}

const KIND_PERM: Record<ChangeKind, Permission> = {
  taxonomy: 'editTaxonomy',
  mapping: 'editTaxonomy',
  tool: 'editTools',
  usage: 'editTools',
  dependency: 'editTools',
  alias: 'editTools',
  reconcile: 'import',
}

function HistoryTab() {
  const history = useStore((s) => s.history)
  const undo = useStore((s) => s.undoChange)
  const notify = useUi((u) => u.notify)
  const { can } = usePermissions()
  const route = useRoute()
  const kind = route.params.get('kind') as ChangeKind | null
  const kinds = [...new Set(history.map((h) => h.kind))]
  const rows = kind ? history.filter((h) => h.kind === kind) : history

  const status = (h: ChangeEvent) => {
    if (h.undone) return <Badge tone="neutral">Undone by {h.undone.by}</Badge>
    if (h.approvedBy) return <Badge tone="green">Approved by {h.approvedBy}</Badge>
    return null
  }

  if (history.length === 0) {
    return <EmptyState icon={<History size={26} />} title="No changes yet" hint="Edit a taxonomy term, a mapping or a tool and it is recorded here, with who did it and when." />
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip active={!kind} onClick={() => patchParams(route, { kind: null })}>
          All
        </Chip>
        {kinds.map((k) => (
          <Chip key={k} active={kind === k} onClick={() => patchParams(route, { kind: k })}>
            {KIND_LABEL[k]}
          </Chip>
        ))}
        <span className="ml-auto text-xs text-slate-500">{plural(rows.length, 'change')} · newest first</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              <Th className="w-36">When</Th>
              <Th className="w-32">Who</Th>
              <Th>What changed</Th>
              <Th className="w-32">Area</Th>
              <Th right className="w-44">
                {' '}
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id} className={cx(h.undone && 'text-slate-400')}>
                <Td className="num whitespace-nowrap text-slate-600">{fmtWhen(h.at)}</Td>
                <Td className="whitespace-nowrap">{h.actor}</Td>
                <Td>
                  <span className={cx(h.undone && 'line-through')}>{h.summary}</span>
                  <span className="ml-2">{status(h)}</span>
                </Td>
                <Td>
                  <Badge tone={h.kind === 'taxonomy' || h.kind === 'mapping' ? 'accent' : 'neutral'}>{KIND_LABEL[h.kind]}</Badge>
                </Td>
                <Td right>
                  {!h.patch ? (
                    <span className="text-[11px] text-slate-400" title={h.kind === 'reconcile' ? 'Reverse reconciliation decisions on the Issues tab' : 'Came with the demo data; no undo record'}>
                      {h.kind === 'reconcile' ? 'Reverse on Issues' : 'Illustrative history'}
                    </span>
                  ) : h.undone ? null : can(KIND_PERM[h.kind]) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<RotateCcw size={12} />}
                      onClick={() => {
                        const why = undo(h.id)
                        notify(why ?? `Undid: ${h.summary}`)
                      }}
                    >
                      Undo
                    </Button>
                  ) : (
                    <span className="text-[11px] text-slate-400">Your role can’t undo this</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function describe(a: Approval): string {
  const act = a.action
  return act.kind === 'merge' ? `Merge ${act.category} “${act.term}” into “${act.into}”` : `Delete ${act.category} “${act.term}”`
}

function PendingCard({ a }: { a: Approval }) {
  const decide = useStore((s) => s.decideApproval)
  const notify = useUi((u) => u.notify)
  const { can, env } = usePermissions()
  const [note, setNote] = useState('')
  const canApprove = can('approve')
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-ink">{describe(a)}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Requested by {a.requestedBy} · {fmtWhen(a.at)}
          </p>
          <p className="mt-2 text-[13px] text-slate-700">{a.impact}</p>
        </div>
        <Badge tone="amber">Waiting for approval</Badge>
      </div>
      {canApprove ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-amber-200/70 pt-3">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-7 min-w-0 flex-1 text-xs" />
          <Button
            size="sm"
            variant="danger"
            icon={<X size={13} />}
            onClick={() => {
              decide(a.id, false, note.trim() || undefined)
              notify('Rejected. Nothing was changed.')
            }}
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Check size={13} />}
            onClick={() => {
              decide(a.id, true, note.trim() || undefined)
              notify(`Approved and applied: ${describe(a)}`)
            }}
          >
            Approve and apply
          </Button>
        </div>
      ) : (
        <p className="mt-3 border-t border-amber-200/70 pt-3 text-xs text-slate-600">A change lead approves or rejects this. {env === 'prod' ? 'Switch the signed-in role to Change lead to see their view.' : ''}</p>
      )}
    </div>
  )
}

function ApprovalsTab() {
  const approvals = useStore((s) => s.approvals)
  const env = useDemo((s) => s.env)
  const pending = approvals.filter((a) => a.status === 'Pending')
  const decided = approvals.filter((a) => a.status !== 'Pending')
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3">
        {pending.length === 0 ? (
          <EmptyState icon={<GitPullRequestArrow size={26} />} title="Nothing waiting" hint="When someone without approval rights merges or deletes a taxonomy term, the request appears here before anything changes." />
        ) : (
          pending.map((a) => <PendingCard key={a.id} a={a} />)
        )}
        {decided.length > 0 && (
          <Card title="Decided" bodyClassName="p-0">
            <ul className="divide-y divide-slate-100">
              {decided.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink">{describe(a)}</p>
                    <p className="text-xs text-slate-500">
                      {a.requestedBy} asked {fmtWhen(a.at)} · {a.decidedBy} decided {a.decidedAt ? fmtWhen(a.decidedAt) : ''}
                      {a.note && <> · “{a.note}”</>}
                    </p>
                  </div>
                  <Badge tone={a.status === 'Approved' ? 'green' : 'red'}>{a.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <Card title="How approvals work">
        <ul className="space-y-2 text-[13px] text-slate-700">
          <li>Renames and new terms apply straight away and are recorded in the history.</li>
          <li>Merges and deletes re-point tools and usage rows, so they wait for a change lead.</li>
          <li>The request shows the impact at the time it was made.</li>
          <li>{env === 'sandbox' ? 'In the sandbox you hold every role, so your own merges apply at once. Requests from others still queue here.' : 'Change leads’ own merges apply at once and are recorded as approved by them.'}</li>
        </ul>
      </Card>
    </div>
  )
}

function RolesTab() {
  const phase = useDemo((s) => s.phase)
  return (
    <Card title="Who can do what" subtitle="Simulated roles. In production these come from Entra ID groups." bodyClassName="p-0">
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            <Th>Role</Th>
            {ALL_PERMS.map((p) => (
              <Th key={p} className="text-center">
                {PERM_LABEL[p]}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROLES.map((r) => {
            const perms = permissionsFor(phase, 'prod', r.id)
            return (
              <tr key={r.id}>
                <Td>
                  <div className="font-bold text-ink">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.summary}</div>
                </Td>
                {ALL_PERMS.map((p) => (
                  <Td key={p} className="text-center">
                    {perms.has(p) ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Check size={15} />
                        {p === 'attest' && r.desk && <span className="text-[11px] text-slate-500">{r.desk} only</span>}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </Td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

export function ChangesScreen() {
  const route = useRoute()
  const pending = useStore((s) => s.approvals.filter((a) => a.status === 'Pending').length)
  const tab = (['approvals', 'roles'] as const).find((t) => t === route.params.get('tab')) ?? 'history'
  return (
    <>
      <PageHeader title="Changes & approvals" description="Who changed which term, mapping or tool, and when. Undo a change, approve a merge, see who can edit what." />
      <div className="mb-4">
        <Tabs
          tabs={[
            { id: 'history', label: (<><History size={14} /> History</>) },
            {
              id: 'approvals',
              label: (
                <>
                  <ShieldCheck size={14} /> Approvals {pending > 0 && <span className="num rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{pending}</span>}
                </>
              ),
            },
            { id: 'roles', label: (<><Users size={14} /> Roles</>) },
          ]}
          value={tab}
          onChange={(t) => patchParams(route, { tab: t === 'history' ? null : t, kind: null })}
        />
      </div>
      {tab === 'history' && <HistoryTab />}
      {tab === 'approvals' && <ApprovalsTab />}
      {tab === 'roles' && <RolesTab />}
    </>
  )
}
