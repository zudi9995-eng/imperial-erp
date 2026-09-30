import type { SaleBoardRow, SaleItemRow } from '../lib/types'
import { dateShort, money, num } from '../lib/format'

interface Refs {
  units: { id: number; code: string }[]
  warehouses: { id: number; name: string }[]
  /** Hujjatda yetkazib beruvchi sifatida yoziladigan nom */
  company?: string
}

type DocKind = 'waybill' | 'invoice'

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c))

/** Summani so'z bilan — hujjatlarda talab qilinadi */
function amountInWords(n: number): string {
  const ones = ['', 'bir', 'ikki', 'uch', "to'rt", 'besh', 'olti', 'yetti', 'sakkiz', "to'qqiz"]
  const tens = ['', "o'n", 'yigirma', "o'ttiz", 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', "to'qson"]
  const scale = ['', 'ming', 'million', 'milliard']

  const grp = (x: number): string => {
    const out: string[] = []
    const h = Math.floor(x / 100), t = Math.floor((x % 100) / 10), o = x % 10
    if (h) out.push(ones[h], 'yuz')
    if (t) out.push(tens[t])
    if (o) out.push(ones[o])
    return out.filter(Boolean).join(' ')
  }

  let v = Math.floor(Math.abs(n))
  if (v === 0) return 'nol'
  const parts: string[] = []
  let i = 0
  while (v > 0 && i < scale.length) {
    const g = v % 1000
    if (g) parts.unshift((grp(g) + ' ' + scale[i]).trim())
    v = Math.floor(v / 1000)
    i++
  }
  return parts.join(' ')
}

const STYLE = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font: 12px/1.45 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; }
  .doc { page-break-after: always; }
  .doc:last-child { page-break-after: auto; }
  h1 { font-size: 17px; margin: 0 0 2px; letter-spacing: .3px; }
  .sub { color: #666; font-size: 11px; margin-bottom: 14px; }
  .head { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 14px; }
  .box { border: 1px solid #ccc; padding: 8px 10px; border-radius: 4px; flex: 1; }
  .box b { display: block; font-size: 10px; color: #666; text-transform: uppercase;
           letter-spacing: .4px; margin-bottom: 3px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #bbb; padding: 5px 7px; vertical-align: top; }
  th { background: #f2f2f2; font-size: 10.5px; text-transform: uppercase;
       letter-spacing: .3px; font-weight: 600; }
  .r { text-align: right; white-space: nowrap; }
  .c { text-align: center; }
  .mut { color: #777; font-size: 10px; }
  .tot { margin-top: 10px; display: flex; justify-content: flex-end; }
  .tot table { width: auto; min-width: 260px; }
  .tot td { border: none; padding: 3px 0; }
  .tot .v { text-align: right; padding-left: 24px; font-weight: 600; }
  .words { margin-top: 8px; font-size: 11px; }
  .sign { margin-top: 34px; display: flex; gap: 40px; }
  .sign div { flex: 1; }
  .line { border-bottom: 1px solid #333; height: 26px; margin-bottom: 3px; }
  .note { margin-top: 12px; font-size: 11px; color: #555; }
  @media print { .noprint { display: none; } }
  .noprint { margin-bottom: 12px; }
  .offer-head { display: flex; justify-content: space-between; align-items: flex-start;
                gap: 24px; border-bottom: 2px solid #1f4f8f; padding-bottom: 8px; }
  .offer-from { text-align: right; font-size: 11px; line-height: 1.5; }
  .to { margin-top: 12px; font-size: 12px; }
  .lead { margin: 8px 0 4px; font-size: 12px; }
  .terms { margin-top: 14px; font-size: 11.5px; }
  .terms ul { margin: 4px 0 0; padding-left: 18px; }
  .terms li { margin-bottom: 2px; }
  .btn { font: inherit; padding: 7px 14px; border: 1px solid #1f4f8f; background: #1f4f8f;
         color: #fff; border-radius: 5px; cursor: pointer; }
`

/** Bitta hujjatning tanasi — bir nechtasi bitta sahifaga yig'ilishi mumkin */
function buildDocBody(
  s: SaleBoardRow, items: SaleItemRow[], refs: Refs, kind: DocKind,
): string {
  const unit = (uid: number | null | undefined) =>
    refs.units.find((u) => u.id === uid)?.code ?? ''
  const wh = refs.warehouses.find((w) => w.id === s.warehouse_id)?.name ?? ''
  const title = kind === 'waybill' ? 'YUK XATI' : 'HISOB-FAKTURA'
  const total = Number(s.net_base)

  const rows = items.map((i, n) => `
    <tr>
      <td class="c">${n + 1}</td>
      <td>${esc(i.product?.name ?? '')}${i.product?.code ? `<br><span class="mut">${esc(i.product.code)}</span>` : ''}</td>
      <td class="c">${esc(unit(i.product?.unit_id))}</td>
      <td class="r">${num(kind === 'waybill' ? Number(i.qty_shipped) || Number(i.qty) : Number(i.qty), 2)}</td>
      <td class="r">${money(i.price, false)}</td>
      <td class="r">${money(i.line_total, false)}</td>
    </tr>`).join('')

  return `
  <div class="doc">
    <h1>${title} № ${esc(s.doc_no ?? s.id)}</h1>
    <div class="sub">Sana: ${dateShort(s.doc_date)}${s.due_date ? ` · To'lov muddati: ${dateShort(s.due_date)}` : ''}</div>

    <div class="head">
      <div class="box">
        <b>Yetkazib beruvchi</b>
        ${esc(refs.company ?? 'Kompaniya')}<br>
        Ombor: ${esc(wh)}
        ${s.manager_name ? `<br>Menejer: ${esc(s.manager_name)}` : ''}
      </div>
      <div class="box">
        <b>Xaridor</b>
        ${esc(s.customer_name)}
        ${s.phone ? `<br>Tel: ${esc(s.phone)}` : ''}
        ${s.delivery_address ? `<br>Manzil: ${esc(s.delivery_address)}` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:32px">№</th>
          <th>Nomenklatura</th>
          <th style="width:52px">Birlik</th>
          <th style="width:80px" class="r">Miqdor</th>
          <th style="width:100px" class="r">Narx</th>
          <th style="width:115px" class="r">Summa</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="tot"><table>
      ${Number(s.returned_base) > 0 ? `
      <tr><td>Sotuv summasi</td><td class="v">${money(s.total_base, false)}</td></tr>
      <tr><td>Qaytarilgan</td><td class="v">−${money(s.returned_base, false)}</td></tr>` : ''}
      <tr><td><b>Jami</b></td><td class="v">${money(total)}</td></tr>
      ${Number(s.paid_base) > 0 ? `
      <tr><td>To'langan</td><td class="v">${money(s.paid_base, false)}</td></tr>
      <tr><td><b>Qarz</b></td><td class="v">${money(s.due_base, false)}</td></tr>` : ''}
    </table></div>

    <div class="words">Summa so'z bilan: <b>${amountInWords(total)} so'm</b></div>

    ${kind === 'waybill' && (s.delivery_driver || s.delivery_vehicle) ? `
    <div class="note">
      ${s.delivery_driver ? `Haydovchi: ${esc(s.delivery_driver)}` : ''}
      ${s.delivery_vehicle ? ` · Mashina: ${esc(s.delivery_vehicle)}` : ''}
    </div>` : ''}

    <div class="sign">
      <div><div class="line"></div>Topshirdi (F.I.Sh., imzo)</div>
      <div><div class="line"></div>Qabul qildi (F.I.Sh., imzo)</div>
    </div>

    <div class="note">
      Bu hujjat Sales Growth boshqaruv platformasidan chiqarildi.
      Rasmiy schyot-faktura buxgalteriya orqali rasmiylashtiriladi.
    </div>
  </div>`
}

function openPrintWindow(title: string, body: string, pdfHint = false) {
  const BTN = pdfHint ? 'PDF sifatida saqlash' : 'Chop etish'
  const HINT = pdfHint
    ? '<span style="margin-left:10px;color:#666;font-size:12px">'
      + "Ochilgan oynada printer o'rniga <b>Save as PDF</b> (PDF sifatida saqlash) ni tanlang"
      + '</span>'
    : ''
  const html = `<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${STYLE}</style></head>
<body>
  <div class="noprint">
    <button class="btn" onclick="window.print()">${BTN}</button>
    ${HINT}
  </div>
  ${body}
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300))</script>
</body></html>`

  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) {
    alert("Chop etish oynasi ochilmadi — brauzer qalqib chiquvchi oynalarni bloklagan bo'lishi mumkin.")
    return
  }
  w.document.write(html)
  w.document.close()
}

/**
 * Tijorat taklifi — mijozga yuboriladigan hujjat.
 * Chop etish oynasida "PDF sifatida saqlash" tanlanadi.
 */
export function printOffer(
  o: {
    doc_no: string | null
    doc_date: string
    valid_days: number
    customer_name: string
    phone: string | null
    manager_name: string | null
    manager_phone: string | null
    company: string
    note: string | null
    delivery_note: string | null
  },
  items: {
    name: string
    code: string | null
    unit_id: number | null
    qty: number
    price: number
    line_total: number
    vat_amount: number
  }[],
  refs: Refs,
) {
  const unit = (uid: number | null | undefined) =>
    refs.units.find((u) => u.id === uid)?.code ?? ''
  const total = items.reduce((a, i) => a + Number(i.line_total), 0)
  const vat = items.reduce((a, i) => a + Number(i.vat_amount), 0)
  const exVat = total - vat

  const until = (() => {
    const d = new Date(o.doc_date)
    d.setDate(d.getDate() + (o.valid_days || 0))
    return d
  })()

  const rows = items.map((i, n) => `
    <tr>
      <td class="c">${n + 1}</td>
      <td>${esc(i.name)}${i.code ? `<br><span class="mut">${esc(i.code)}</span>` : ''}</td>
      <td class="c">${esc(unit(i.unit_id))}</td>
      <td class="r">${num(i.qty, 2)}</td>
      <td class="r">${money(i.price, false)}</td>
      <td class="r">${money(i.line_total, false)}</td>
    </tr>`).join('')

  const body = `
  <div class="doc">
    <div class="offer-head">
      <div>
        <h1>TIJORAT TAKLIFI</h1>
        <div class="sub">
          ${o.doc_no ? `№ ${esc(o.doc_no)} · ` : ''}${dateShort(o.doc_date)}
          ${o.valid_days > 0
            ? ` · Taklif <b>${dateShort(until)}</b> gacha kuchda`
            : ''}
        </div>
      </div>
      <div class="offer-from">
        <b>${esc(o.company)}</b>
        ${o.manager_name ? `<br>${esc(o.manager_name)}` : ''}
        ${o.manager_phone ? `<br>${esc(o.manager_phone)}` : ''}
      </div>
    </div>

    <div class="to">
      <b>Kimga:</b> ${esc(o.customer_name)}${o.phone ? ` · ${esc(o.phone)}` : ''}
    </div>

    <p class="lead">
      Hurmatli hamkor! Quyidagi shartlar bilan tovar taklif qilamiz.
    </p>

    <table>
      <thead>
        <tr>
          <th style="width:32px">№</th>
          <th>Nomenklatura</th>
          <th style="width:52px">Birlik</th>
          <th style="width:80px" class="r">Miqdor</th>
          <th style="width:110px" class="r">Narx</th>
          <th style="width:125px" class="r">Summa</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="tot"><table>
      ${vat > 0 ? `
      <tr><td>QQS siz</td><td class="v">${money(exVat, false)}</td></tr>
      <tr><td>QQS</td><td class="v">${money(vat, false)}</td></tr>` : ''}
      <tr><td><b>Jami</b></td><td class="v">${money(total)}</td></tr>
    </table></div>

    <div class="words">Summa so'z bilan: <b>${amountInWords(total)} so'm</b></div>

    <div class="terms">
      <b>Shartlar</b>
      <ul>
        ${o.valid_days > 0
          ? `<li>Narxlar ${dateShort(until)} gacha kuchda.</li>`
          : '<li>Narxlar kelishuvga ko\'ra.</li>'}
        ${vat > 0 ? '<li>Narxlar QQS bilan ko\'rsatilgan.</li>' : ''}
        ${o.delivery_note ? `<li>${esc(o.delivery_note)}</li>` : ''}
        <li>Tovar omborda bor bo'lganda yetkazib beriladi.</li>
      </ul>
      ${o.note ? `<div class="note">${esc(o.note)}</div>` : ''}
    </div>

    <div class="sign">
      <div><div class="line"></div>${esc(o.manager_name ?? 'Menejer')} (imzo)</div>
      <div><div class="line"></div>Xaridor (F.I.Sh., imzo)</div>
    </div>
  </div>`

  openPrintWindow(`Tijorat taklifi ${o.doc_no ?? ''}`.trim(), body, true)
}

/** Xaridor buyurtmasi — 1C dagi «Печать» ga mos */
export function printOrderDoc(
  o: {
    id: number
    doc_no: string | null
    doc_date: string
    valid_until: string | null
    customer_name: string
    manager_name: string | null
    warehouse_name: string | null
    contract_no: string | null
    note: string | null
  },
  items: {
    name: string
    code: string | null
    unit_id: number | null
    qty: number
    price: number
    line_total: number
  }[],
  refs: Refs,
) {
  const unit = (uid: number | null | undefined) =>
    refs.units.find((u) => u.id === uid)?.code ?? ''
  const total = items.reduce((a, i) => a + Number(i.line_total), 0)

  const rows = items.map((i, n) => `
    <tr>
      <td class="c">${n + 1}</td>
      <td>${esc(i.name)}${i.code ? `<br><span class="mut">${esc(i.code)}</span>` : ''}</td>
      <td class="c">${esc(unit(i.unit_id))}</td>
      <td class="r">${num(i.qty, 2)}</td>
      <td class="r">${money(i.price, false)}</td>
      <td class="r">${money(i.line_total, false)}</td>
    </tr>`).join('')

  const body = `
  <div class="doc">
    <h1>XARIDOR BUYURTMASI № ${esc(o.doc_no ?? o.id)}</h1>
    <div class="sub">Sana: ${dateShort(o.doc_date)}${
      o.valid_until ? ` · Amal qilish muddati: ${dateShort(o.valid_until)}` : ''}</div>

    <div class="head">
      <div class="box">
        <b>Yetkazib beruvchi</b>
        ${esc(refs.company ?? 'Kompaniya')}
        ${o.warehouse_name ? `<br>Ombor: ${esc(o.warehouse_name)}` : ''}
        ${o.manager_name ? `<br>Menejer: ${esc(o.manager_name)}` : ''}
      </div>
      <div class="box">
        <b>Xaridor</b>
        ${esc(o.customer_name)}
        <br>Shartnoma: ${esc(o.contract_no ?? 'Asosiy shartnoma')}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:32px">№</th>
          <th>Nomenklatura</th>
          <th style="width:52px">Birlik</th>
          <th style="width:80px" class="r">Miqdor</th>
          <th style="width:100px" class="r">Narx</th>
          <th style="width:115px" class="r">Summa</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="tot"><table>
      <tr><td><b>Jami</b></td><td class="v">${money(total)}</td></tr>
    </table></div>

    <div class="words">Summa so'z bilan: <b>${amountInWords(total)} so'm</b></div>
    ${o.note ? `<div class="note">Izoh: ${esc(o.note)}</div>` : ''}

    <div class="sign">
      <div><div class="line"></div>Menejer (F.I.Sh., imzo)</div>
      <div><div class="line"></div>Xaridor (F.I.Sh., imzo)</div>
    </div>

    <div class="note">
      Bu buyurtma — kelishuv hujjati. Tovar yuk xati bilan topshiriladi.
    </div>
  </div>`

  openPrintWindow(`Buyurtma ${o.doc_no ?? o.id}`, body)
}

/** Bitta sotuvdan hujjat */
export function printSaleDoc(
  s: SaleBoardRow, items: SaleItemRow[], refs: Refs, kind: DocKind,
) {
  const title = `${kind === 'waybill' ? 'Yuk xati' : 'Hisob-faktura'} ${s.doc_no ?? s.id}`
  openPrintWindow(title, buildDocBody(s, items, refs, kind))
}

/** Bir nechta hujjat — har biri alohida sahifada */
export function printManySaleDocs(
  docs: { sale: SaleBoardRow; items: SaleItemRow[] }[],
  refs: Refs,
  kind: DocKind,
) {
  if (docs.length === 0) return
  const body = docs.map((d) => buildDocBody(d.sale, d.items, refs, kind)).join('')
  const title = `${kind === 'waybill' ? 'Yuk xatlari' : 'Hisob-fakturalar'} (${docs.length})`
  openPrintWindow(title, body)
}
