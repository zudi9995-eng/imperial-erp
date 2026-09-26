import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Shield, Lock, Trash2, Copy, Users, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { translateDbError } from '../lib/useRefs'
import {
  Badge, Button, Card, CardTitle, Empty, ErrorBox, Field, InfoBox, Input, Loading,
  Modal, Select, Textarea, Toggle,
} from './ui'

interface Role {
  id: number
  code: string
  name: string
  base_role: 'owner' | 'manager' | 'accountant'
  data_scope: 'all' | 'own'
  description: string | null
  is_system: boolean
  is_active: boolean
  sort_order: number
}

interface Permission {
  code: string
  name: string
  grp: string
  description: string | null
  sort_order: number
}

export default function RolesEditor() {
  const { can, refreshProfile } = useAuth()
  const canManage = can('roles.manage')

  const [roles, setRoles] = useState<Role[]>([])
  const [perms, setPerms] = useState<Permission[]>([])
  const [granted, setGranted] = useState<Map<number, Set<string>>>(new Map())
  const [counts, setCounts] = useState<Map<number, number>>(new Map())
  const [activeId, setActiveId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<Role> | null>(null)

  const load = useCallback(async () => {
    const [r, p, rp, pr] = await Promise.all([
      supabase.from('ip_roles').select('*').order('sort_order'),
      supabase.from('ip_permissions').select('*').order('sort_order'),
      supabase.from('ip_role_permissions').select('role_id, permission_code'),
      supabase.from('ip_profiles').select('role_id').eq('is_active', true),
    ])
    if (r.error) setErr(translateDbError(r.error.message))
    const rows = (r.data as Role[]) ?? []
    setRoles(rows)
    setPerms((p.data as Permission[]) ?? [])

    const g = new Map<number, Set<string>>()
    for (const x of (rp.data ?? []) as { role_id: number; permission_code: string }[]) {
      if (!g.has(x.role_id)) g.set(x.role_id, new Set())
      g.get(x.role_id)!.add(x.permission_code)
    }
    setGranted(g)

    const c = new Map<number, number>()
    for (const x of (pr.data ?? []) as { role_id: number | null }[]) {
      if (x.role_id != null) c.set(x.role_id, (c.get(x.role_id) ?? 0) + 1)
    }
    setCounts(c)

    setActiveId((cur) => cur ?? rows.find((x) => !x.is_system)?.id ?? rows[0]?.id ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const active = roles.find((r) => r.id === activeId) ?? null
  const activePerms = activeId != null ? granted.get(activeId) ?? new Set<string>() : new Set<string>()
  const isOwnerRole = active?.code === 'owner'

  const groups = useMemo(() => {
    const m = new Map<string, Permission[]>()
    for (const p of perms) {
      if (!m.has(p.grp)) m.set(p.grp, [])
      m.get(p.grp)!.push(p)
    }
    return [...m.entries()]
  }, [perms])

  async function toggle(code: string, on: boolean) {
    if (!activeId || !canManage || isOwnerRole) return
    setSaving(code); setErr('')

    // Optimistik yangilash
    setGranted((g) => {
      const next = new Map(g)
      const set = new Set(next.get(activeId) ?? [])
      if (on) set.add(code); else set.delete(code)
      next.set(activeId, set)
      return next
    })

    const res = on
      ? await supabase.from('ip_role_permissions')
          .insert({ role_id: activeId, permission_code: code } as never)
      : await supabase.from('ip_role_permissions')
          .delete().eq('role_id', activeId).eq('permission_code', code)

    setSaving(null)
    if (res.error) {
      setErr(translateDbError(res.error.message))
      await load()
      return
    }
    await refreshProfile()
  }

  async function removeRole(r: Role) {
    const used = counts.get(r.id) ?? 0
    if (used > 0) {
      setErr(`Bu rolda ${used} ta xodim bor — avval ularni boshqa rolga o'tkazing`)
      return
    }
    if (!confirm(`"${r.name}" roli o'chirilsinmi?`)) return
    const { error } = await supabase.from('ip_roles').delete().eq('id', r.id)
    if (error) { setErr(translateDbError(error.message)); return }
    setActiveId(null)
    await load()
  }

  if (loading) return <Loading />

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Rollar ro'yxati */}
      <div className="space-y-2">
        <Card pad={false}>
          <div className="p-2">
            {roles.map((r) => {
              const isActive = r.id === activeId
              const n = counts.get(r.id) ?? 0
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveId(r.id)}
                  className="mb-0.5 block w-full rounded-lg px-2.5 py-2 text-left transition-colors"
                  style={{
                    background: isActive ? 'var(--brand-soft)' : 'transparent',
                    color: isActive ? 'var(--brand)' : 'var(--text-2)',
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    {r.is_system && <Lock size={12} className="shrink-0" />}
                    <span className="flex-1 truncate text-[13px] font-medium">{r.name}</span>
                    {n > 0 && <Badge tone="neutral">{n}</Badge>}
                  </div>
                  <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                    {r.data_scope === 'all' ? "Hamma ma'lumot" : "Faqat o'ziniki"}
                    {' · '}{(granted.get(r.id)?.size ?? 0)} ruxsat
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        {canManage && (
          <Button
            full variant="primary"
            onClick={() => setEditing({ base_role: 'manager', data_scope: 'own', is_active: true })}
          >
            <Plus size={14} />Yangi rol
          </Button>
        )}
      </div>

      {/* Ruxsat matritsasi */}
      <div className="space-y-4">
        {err && <ErrorBox>{err}</ErrorBox>}

        {!active ? (
          <Card><Empty title="Rol tanlanmagan" /></Card>
        ) : (
          <>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Shield size={16} style={{ color: 'var(--brand)' }} />
                    <h3 className="text-[15px] font-semibold">{active.name}</h3>
                    {active.is_system && <Badge tone="neutral"><Lock size={10} />tizim roli</Badge>}
                    {!active.is_active && <Badge tone="warn">faol emas</Badge>}
                  </div>
                  {active.description && (
                    <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
                      {active.description}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
                    <Badge tone={active.data_scope === 'all' ? 'info' : 'neutral'}>
                      {active.data_scope === 'all' ? "Hamma mijoz va sotuv" : "Faqat o'z mijozlari"}
                    </Badge>
                    <span><Users size={11} className="mr-0.5 inline" />{counts.get(active.id) ?? 0} xodim</span>
                    <span>{activePerms.size} / {perms.length} ruxsat</span>
                  </div>
                </div>

                {canManage && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => setEditing({
                        base_role: active.base_role, data_scope: active.data_scope,
                        name: `${active.name} (nusxa)`, is_active: true,
                        description: active.description,
                        // nusxa uchun manba rol
                        sort_order: active.sort_order + 1,
                      })}
                      title="Shu rolning nusxasini yaratish"
                    >
                      <Copy size={14} />Nusxa
                    </Button>
                    {!active.is_system && (
                      <>
                        <Button size="sm" onClick={() => setEditing(active)}>Tahrirlash</Button>
                        <Button size="sm" variant="ghost" onClick={() => void removeRole(active)}>
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {isOwnerRole && (
              <InfoBox tone="warn">
                Ta'sischi roli har doim hamma ruxsatga ega va o'zgartirilmaydi — bu
                o'zingizni tizimdan qulflab qo'yishingizning oldini oladi.
              </InfoBox>
            )}

            {!canManage && (
              <InfoBox>Rollarni faqat <b>roles.manage</b> ruxsati bor xodim o'zgartiradi.</InfoBox>
            )}

            {groups.map(([grp, list]) => (
              <Card key={grp} pad={false}>
                <div className="p-4">
                  <CardTitle>{grp}</CardTitle>
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {list.map((p) => {
                      const on = activePerms.has(p.code)
                      return (
                        <div key={p.code} className="flex items-center gap-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] font-medium">{p.name}</div>
                            {p.description && (
                              <div className="mt-0.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
                                {p.description}
                              </div>
                            )}
                            <div className="mt-0.5 font-mono text-[11px]" style={{ color: 'var(--text-3)' }}>
                              {p.code}
                            </div>
                          </div>
                          {isOwnerRole ? (
                            <Badge tone="ok"><Check size={11} />har doim</Badge>
                          ) : (
                            <Toggle
                              checked={on}
                              disabled={!canManage || saving === p.code}
                              onChange={(v) => void toggle(p.code, v)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>

      {editing && (
        <RoleModal
          value={editing}
          sourceRoleId={editing.id ? null : (active?.id ?? null)}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); void load() }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function RoleModal({
  value, sourceRoleId, onClose, onDone,
}: {
  value: Partial<Role>
  /** Yangi rol yaratilayotganda ruxsatlar shu roldan nusxalanadi */
  sourceRoleId: number | null
  onClose: () => void
  onDone: () => void
}) {
  const [d, setD] = useState<Partial<Role>>(value)
  const [copyPerms, setCopyPerms] = useState(!value.id && sourceRoleId != null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function set<K extends keyof Role>(k: K, v: Role[K]) { setD((p) => ({ ...p, [k]: v })) }

  async function save() {
    if (!d.name?.trim()) { setErr('Nomi kiritilmagan'); return }
    setBusy(true); setErr('')

    const code = d.code?.trim()
      || d.name.trim().toLowerCase()
        .replace(/['’`]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || `rol_${Date.now()}`

    const payload = {
      code,
      name: d.name.trim(),
      base_role: d.base_role ?? 'manager',
      data_scope: d.data_scope ?? 'own',
      description: d.description?.trim() || null,
      is_active: d.is_active ?? true,
      sort_order: d.sort_order ?? 100,
    }

    if (d.id) {
      const { error } = await supabase.from('ip_roles').update(payload as never).eq('id', d.id)
      setBusy(false)
      if (error) { setErr(translateDbError(error.message)); return }
      onDone()
      return
    }

    const { data: created, error } = await supabase
      .from('ip_roles').insert(payload as never).select().single()
    if (error) { setBusy(false); setErr(translateDbError(error.message)); return }

    // Manba roldan ruxsatlarni nusxalaymiz
    if (copyPerms && sourceRoleId != null) {
      const { data: src } = await supabase.from('ip_role_permissions')
        .select('permission_code').eq('role_id', sourceRoleId)
      const rows = (src ?? []).map((x: { permission_code: string }) => ({
        role_id: (created as Role).id, permission_code: x.permission_code,
      }))
      if (rows.length) await supabase.from('ip_role_permissions').insert(rows as never)
    }

    setBusy(false)
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={520}
      title={d.id ? 'Rolni tahrirlash' : 'Yangi rol'}
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Rol nomi" required>
          <Input
            value={d.name ?? ''} onChange={(v) => set('name', v)}
            placeholder="Masalan: Sotuv boshlig'i" autoFocus
          />
        </Field>

        <Field
          label="Ma'lumot qamrovi" required
          hint="Mijozlar, sotuv va voronkada nimani ko'radi"
        >
          <Select
            value={d.data_scope ?? 'own'} onChange={(v) => set('data_scope', v as 'all' | 'own')}
            options={[
              { value: 'own', label: "Faqat o'ziga biriktirilgan mijozlar" },
              { value: 'all', label: 'Hamma mijoz va sotuv' },
            ]}
          />
        </Field>

        <Field
          label="Asosiy rol" required
          hint="Tizim ichidagi bazaviy toifa. Odatda 'Sotuv menejeri' qoldiriladi."
        >
          <Select
            value={d.base_role ?? 'manager'}
            onChange={(v) => set('base_role', v as Role['base_role'])}
            options={[
              { value: 'manager', label: 'Sotuv menejeri' },
              { value: 'accountant', label: 'Buxgalter' },
            ]}
          />
        </Field>

        <Field label="Izoh">
          <Textarea
            value={d.description ?? ''} onChange={(v) => set('description', v)}
            rows={2} placeholder="Bu rol nima qila oladi"
          />
        </Field>

        {!d.id && sourceRoleId != null && (
          <Toggle
            checked={copyPerms} onChange={setCopyPerms}
            label="Tanlangan rolning ruxsatlaridan nusxa olish"
          />
        )}
        <Toggle checked={d.is_active ?? true} onChange={(v) => set('is_active', v)} label="Faol" />

        {!d.id && (
          <InfoBox>
            Rol yaratilgandan keyin ruxsatlarni ro'yxatdan bittalab yoqasiz.
          </InfoBox>
        )}
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
