import { Check, Sparkles, X } from 'lucide-react'
import { useMemo } from 'react'
import { ToolLink, VendorFlag } from '../components/common'
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui'
import { useDemo, usePermissions } from '../demo-store'
import { confidenceLabel, FIELD_LABEL, isUnclassified, suggestLabels, type Suggestion } from '../lib/suggest'
import { plural } from '../lib/util'
import { useDataState, useStore } from '../store'
import { useUi } from '../ui-store'

function Row({ s, canEdit }: { s: Suggestion; canEdit: boolean }) {
  const updateTool = useStore((st) => st.updateTool)
  const reject = useDemo((d) => d.rejectSuggestion)
  const notify = useUi((u) => u.notify)
  const c = confidenceLabel(s.confidence)
  return (
    <li className="grid grid-cols-[110px_minmax(0,170px)_90px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-[13px]">
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">{FIELD_LABEL[s.field]}</span>
      <span className="truncate font-bold text-ink">{s.value}</span>
      <Badge tone={c.tone} title={`${Math.round(s.confidence * 100)}% by the rules`}>
        {c.label} · {Math.round(s.confidence * 100)}%
      </Badge>
      <span className="truncate text-xs text-slate-600" title={s.reason}>
        {s.reason}
      </span>
      {canEdit ? (
        <span className="flex gap-1">
          <Button
            size="sm"
            variant="danger"
            icon={<X size={12} />}
            onClick={() => {
              reject(s.key)
              notify(`Rejected ${FIELD_LABEL[s.field]} “${s.value}”`)
            }}
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Check size={12} />}
            onClick={() => {
              updateTool(s.toolId, { [s.field]: s.value })
              notify(`Accepted ${FIELD_LABEL[s.field]} “${s.value}”. Recorded in the change history.`)
            }}
          >
            Accept
          </Button>
        </span>
      ) : (
        <span className="text-xs text-slate-400">Needs an editor</span>
      )}
    </li>
  )
}

export function SuggestionsScreen() {
  const state = useDataState()
  const rejected = useDemo((d) => d.rejected)
  const canEdit = usePermissions().can('editTools')
  const suggestions = useMemo(() => suggestLabels(state, new Set(rejected)), [state, rejected])
  const unclassified = state.tools.filter(isUnclassified)
  const byTool = unclassified.map((t) => ({ tool: t, items: suggestions.filter((s) => s.toolId === t.id) }))

  return (
    <>
      <PageHeader
        title="Suggested labels"
        description="Tools with no Tool type or capability, and a suggestion for each gap with the reason behind it. Nothing changes until a person accepts it."
        actions={<Badge tone="accent">Suggestions from written rules</Badge>}
      />
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-[13px] text-accent-800">
        <Sparkles size={16} className="mt-0.5 shrink-0" />
        <p>
          Suggestions come from rules over the map: the LeanIX fact sheet type and business capability, words in the tool name, and the closest named tool. They are a starting point. Each one is accepted or rejected by a person, and an accepted
          label is recorded in the change history like any other edit.
        </p>
      </div>
      {unclassified.length === 0 ? (
        <EmptyState icon={<Check size={26} />} title="Every tool is classified" hint="New tools from imports or desk-built EUCs appear here when they arrive without a Tool type or capability." />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {plural(unclassified.length, 'unclassified tool')} · {plural(suggestions.length, 'open suggestion')}
          </p>
          {byTool.map(({ tool, items }) => (
            <Card
              key={tool.id}
              title={
                <span className="flex items-center gap-2">
                  <ToolLink id={tool.id} /> <VendorFlag v={tool.vendor} />
                </span>
              }
              subtitle={['toolType', 'capL2', 'capL3'].map((f) => `${FIELD_LABEL[f as 'toolType']}: ${tool[f as 'toolType'] || 'blank'}`).join(' · ')}
              bodyClassName="p-0"
            >
              {items.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-500">No rule has a suggestion for the remaining gaps. Set them on the tool’s detail panel.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((s) => (
                    <Row key={s.key} s={s} canEdit={canEdit} />
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
