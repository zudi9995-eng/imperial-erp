const fs = require('fs')
const D = require('./clean.json')
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const nul = (s) => (s == null || s === '' ? 'null' : q(s))

const MAP = [
  [/A-PAY P10/i,              'A-PAY P10 (Android POS terminal)',            'Uskuna va jihoz'],
  [/ISOCOM/i,                 'ISOCOM PPI-JS 50 (Jugut)',                    'Boshqa'],
  [/FASTFIX STANDARD/i,       'PENOPLEX FASTFIX STANDARD, 700 gr',           'Kley va pena'],
  [/вата.*100.*1200х600х50/i, 'Bazalt mineral vata 100 kg/m3, 1200x600x50',  'Mineral vata'],
  [/вата.*100.*1200х600х70/i, 'Bazalt mineral vata 100 kg/m3, 1200x600x70',  'Mineral vata'],
  [/вата.*120.*1200х600х50/i, 'Bazalt mineral vata 120 kg/m3, 1200x600x50',  'Mineral vata'],
  [/мастика/i,                'Bitum mastika universal',                     'Bitum materiallari'],
  [/праймер/i,                'Bitum praymer Marja',                         'Bitum materiallari'],
  [/Гипсокартон 12,5.*белы/i, 'Gipsokarton 12,5 oq',                         'Gipsokarton'],
  [/Гипсокартон 12,5.*зелен/i,'Gipsokarton 12,5 yashil',                     'Gipsokarton'],
  [/ипсокартон 9,5.*белы/i,   'Gipsokarton 9,5 oq',                          'Gipsokarton'],
  [/ипсокартон 9,5.*зелен/i,  'Gipsokarton 9,5 yashil',                      'Gipsokarton'],
  [/Дюбель/i,                 'Dyubel LEWOD PREMIUM 10x260 termobosh bilan', 'Dyubel va mahkamlagich'],
  [/Клей усиленный/i,         'Kley kuchaytirilgan',                         'Kley va pena'],
  [/Клей-пена/i,              'Kley-pena PENOPLEX FASTFIX (aerozol)',        'Kley va pena'],
  [/вода/i,                   'Gazsiz suv',                                  'Boshqa'],
  [/штукатурка/i,             'Plaster shtukaturka',                         'Shtukaturka va qorishma'],
  [/ТЕПЛЕКС.*20х585/i,        'Plita TEPLEKS 20x585x1185 S',                 'Penoplex / Tepleks'],
  [/ТЕПЛЕКС.*30х585/i,        'Plita TEPLEKS 30x585x1185 T-15',              'Penoplex / Tepleks'],
  [/ТЕПЛЕКС.*50х585/i,        'Plita TEPLEKS 50x585x1185 T-15',              'Penoplex / Tepleks'],
  [/ПЕНОПЛЭКС ОСНОВА.*20х585/i,'Plita PENOPLEX OSNOVA 20x585x1185 T-15',     'Penoplex / Tepleks'],
  [/ПЕНОПЛЭКС ОСНОВА.*30х585/i,'Plita PENOPLEX OSNOVA 30x585x1185 T-15',     'Penoplex / Tepleks'],
  [/ПЕНОПЛЭКС ОСНОВА.*50х585/i,'Plita PENOPLEX OSNOVA 50x585x1185 T-15',     'Penoplex / Tepleks'],
  [/пенополистирольные/i,     'Penopolistirol plita PPS 10-R-A',             'Penopolistirol'],
  [/Фиксатор/i,               'Fiksator yulduzcha armatura uchun 40 mm',     'Dyubel va mahkamlagich'],
]
const UNIT = { 'шт': 'sht', 'м': 'm', 'м2': 'm2', 'м3': 'm3', 'кг': 'kg' }

function contract(raw) {
  const m = raw.match(/^(.*?)\s+от\s+(\d{2})\.(\d{2})\.(\d{4})\s*$/)
  if (m) return { no: m[1].trim(), date: m[4] + '-' + m[3] + '-' + m[2] }
  return { no: raw.trim(), date: null }
}
const partnerNote = (p) => {
  const notes = [...new Set(p.contracts.map((c) => c.note).filter(Boolean))]
  return [p.note, ...notes].filter(Boolean).join(' | ') || null
}

const out = {}

/* ---------- 1) POSTAVSHIKLAR ---------- */
out.suppliers =
`insert into ip_suppliers (name, opening_debt, opening_advance, opening_date, currency, note)
values
` + D.kred.map((s) => {
  const detail = s.contracts.map((c) => {
    const k = contract(c.raw)
    return k.no + (k.date ? ' (' + k.date + ')' : '')
      + (c.debt ? ' qarz ' + c.debt : c.adv ? ' avans ' + c.adv : '')
  }).join('; ')
  const note = [detail, partnerNote(s)].filter(Boolean).join(' | ')
  return '  (' + [q(s.name), s.debt, s.adv, "'2026-09-30'", "'UZS'", nul(note)].join(', ') + ')'
}).join(',\n') + ';'

/* ---------- 2) MIJOZLAR ---------- */
out.customers =
`insert into ip_customers (name, tier_id, payment_term_id, manager_id, status,
                          opening_debt, opening_advance, opening_date, note)
select v.name,
       (select id from ip_price_tiers   where is_default limit 1),
       (select id from ip_payment_terms where is_default limit 1),
       (select id from ip_profiles where role='owner' order by created_at limit 1),
       'active', v.debt, v.adv, '2026-09-30', v.note
  from (values
` + D.deb.map((c) =>
  '  (' + [q(c.name), c.debt, c.adv, nul(partnerNote(c))].join(', ') + ')'
).join(',\n') + `
) as v(name, debt, adv, note);`

/* ---------- 3) SHARTNOMALAR ---------- */
const crows = []
for (const c of D.deb) {
  for (const ct of c.contracts) {
    const k = contract(ct.raw)
    crows.push('  (' + [
      q(c.name), q(k.no), k.date ? q(k.date) : 'null',
      ct.debt || ct.adv || 0, nul(ct.note || null),
    ].join(', ') + ')')
  }
}
out.contracts =
`insert into ip_contracts (customer_id, number, signed_at, amount, term_days, note)
select cu.id, v.number, v.signed_at::date, v.amount,
       (select days from ip_payment_terms where is_default limit 1), v.note
  from (values
` + crows.join(',\n') + `
) as v(cname, number, signed_at, amount, note)
  join ip_customers cu on cu.name = v.cname;`

/* ---------- 4) NOMENKLATURA ---------- */
const prows = []
for (const it of D.sklad) {
  const m = it.raw.match(/^(\d+)\.\s*([\s\S]+)$/)
  const num = m ? m[1] : '0'
  const ru = (m ? m[2] : it.raw).trim()
  const hit = MAP.find(([re]) => re.test(ru))
  if (!hit) { console.error('MOSLANMADI:', ru); continue }
  prows.push({
    code: 'NM-' + String(num).padStart(3, '0'),
    uz: hit[1], cat: hit[2], unit: UNIT[String(it.unit).trim()],
    qty: it.qty, cost: it.qty > 0 ? it.sum / it.qty : 0, ru,
  })
}

out.products =
`insert into ip_products (code, name, category_id, unit_id, is_stocked, note)
select v.code, v.name, c.id, u.id, true, v.note
  from (values
` + prows.map((p) =>
  '  (' + [q(p.code), q(p.uz), q(p.cat), q(p.unit), q('1C: ' + p.ru)].join(', ') + ')'
).join(',\n') + `
) as v(code, name, cat, unit, note)
  left join ip_categories c on c.name = v.cat
  left join ip_units      u on u.code = v.unit;`

/* ---------- 5) BOSHLANG'ICH PARTIYA + HARAKAT ---------- */
out.batches =
`insert into ip_batches (product_id, warehouse_id, qty_in, qty_left, unit_cost_base,
                        received_at, source, note)
select p.id, w.id, v.qty, v.qty, v.cost, '2026-09-30 00:00:00+05', 'opening',
       'Boshlang''ich qoldiq, 1C 30.09.2026'
  from (values
` + prows.map((p) =>
  '  (' + [q(p.code), p.qty, p.cost.toFixed(6)].join(', ') + ')'
).join(',\n') + `
) as v(code, qty, cost)
  join ip_products p on p.code = v.code
  cross join (select id from ip_warehouses where code='MAIN') w;

insert into ip_stock_moves (product_id, warehouse_id, batch_id, direction, qty,
                            unit_cost_base, cost_base, doc_type, moved_at)
select b.product_id, b.warehouse_id, b.id, 1, b.qty_in,
       b.unit_cost_base, b.qty_in * b.unit_cost_base, 'opening', b.received_at
  from ip_batches b where b.source = 'opening';`

/* ---------- 6) KASSA ---------- */
const CASHMAP = { 'Нахт': 'Kassa (naqd)', 'Карта': 'Bank / karta', 'Низомиддинда пул': 'Nizomiddinda' }
out.cash = D.naxt.map((c) =>
  'update ip_cash_accounts set opening_balance=' + c.amount
  + ", opening_date='2026-09-30' where name=" + q(CASHMAP[c.name] || c.name) + ';'
).join('\n')

const all = [
  '-- 1C hisoboti, 30.09.2026 holatiga',
  '-- Manba: Кредитор_Дебитор_склад_нахт_пулар_отчет_.xlsx',
  '-- Ustunlar: C = Долг (qarz), D = Аванс (avans), E = Изох',
  '', out.suppliers, '', out.customers, '', out.contracts, '',
  out.products, '', out.batches, '', out.cash,
].join('\n')

fs.writeFileSync('import2.sql', all)
for (const [k, v] of Object.entries(out)) fs.writeFileSync('part_' + k + '.sql', v)
console.log('Hajmi:', all.length, 'belgi')
console.log('Postavshik', D.kred.length, '| Mijoz', D.deb.length,
  '| Shartnoma', crows.length, '| Tovar', prows.length)
