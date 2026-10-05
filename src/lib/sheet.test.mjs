// Excel/CSV o'qish mantig'i sinovi:  npm test

const { toNumber, toDate, parseCsv, guessMapping, findHeaderRow, normalizeRows, pickSheet } =
  await import('./sheet.ts')

let fail = 0
const eq = (got, want, what) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { fail++; console.log('XATO', what, '->', JSON.stringify(got), 'kutilgan', JSON.stringify(want)) }
}

// --- raqamlar
eq(toNumber('1 234 567,89'), 1234567.89, 'bo\'sh joy + vergul')
eq(toNumber('1,234,567.89'), 1234567.89, 'minglik vergul')
eq(toNumber('48159500'), 48159500, 'oddiy')
eq(toNumber('48 159 500,00'), 48159500, 'nol kasr')
eq(toNumber('(500)'), -500, 'qavs = manfiy')
eq(toNumber('-1.234,50'), -1234.5, 'yevropa')
eq(toNumber('12.000'), 12000, 'nuqta minglik')
eq(toNumber('12.50'), 12.5, 'nuqta kasr')
eq(toNumber(''), null, 'bo\'sh')
eq(toNumber('—'), null, 'tire')

// --- sanalar
eq(toDate('02.10.2026'), '2026-10-02', 'nuqtali')
eq(toDate('2/10/2026'), '2026-10-02', 'slash')
eq(toDate('2026-10-02'), '2026-10-02', 'iso')
eq(toDate('02.10.26'), '2026-10-02', 'ikki xonali yil')
eq(toDate('46297'), '2026-10-02', 'excel seriya')
eq(toDate('salom'), null, 'matn')

// --- CSV
eq(parseCsv('a;b;c\n1;2;3'), [['a','b','c'],['1','2','3']], 'nuqta-vergul')
eq(parseCsv('a,b\n"Ivanov, A.",5'), [['a','b'],['Ivanov, A.','5']], 'qo\'shtirnoq ichida vergul')
eq(parseCsv('a,b\n"u ""qavs"" u",5'), [['a','b'],['u "qavs" u','5']], 'ikkilangan qo\'shtirnoq')
eq(parseCsv('a;b\r\n1;2\r\n'), [['a','b'],['1','2']], 'CRLF va oxirgi bo\'sh qator')

// --- ustunlarni tanish (haqiqiy bank sarlavhasi)
const F = [
  { key:'date',  label:'Sana',       aliases:['дата','date','дата операции'] },
  { key:'doc',   label:'Hujjat №',   aliases:['номер','№ док','документ','doc'] },
  { key:'name',  label:'Kontragent', aliases:['контрагент','наименование','плательщик'] },
  { key:'inn',   label:'STIR',       aliases:['инн','stir'] },
  { key:'debit', label:'Debet',      aliases:['дебет','расход'] },
  { key:'credit',label:'Kredit',     aliases:['кредит','приход'] },
  { key:'purp',  label:'Maqsad',     aliases:['назначение','назначение платежа'] },
]
const rows = [
  ['АО «Банк»','','','','','',''],
  ['Выписка за период 01.10.2026 - 02.10.2026','','','','','',''],
  ['Дата','№ док','Контрагент','ИНН','Дебет','Кредит','Назначение платежа'],
  ['02.10.2026','142','Bahor Qurilish','302145879','','48 159 500','Oplata po dogovoru'],
]
const h = findHeaderRow(rows, F)
eq(h, 2, 'sarlavha qatori')
eq(guessMapping(rows[h], F), {date:0,doc:1,name:2,inn:3,debit:4,credit:5,purp:6}, 'ustunlar')

// --- bazaga yuborishdan oldin tozalash
eq(normalizeRows([{price:'38 500,00', min_qty:'', d:'02.10.2026'}], {numeric:['price','min_qty'], date:['d']}),
   [{price:'38500', min_qty:'', d:'2026-10-02'}], 'normalizeRows')
eq(normalizeRows([{price:'yomon'}], {numeric:['price']}), [{price:''}], "o'qib bo'lmagan raqam bo'sh qoladi")

// --- kutubxona ikki xil ko'rinishda qaytaradi
eq(pickSheet([['a','b'],['1','2']]), [['a','b'],['1','2']], 'oddiy qatorlar')
eq(pickSheet([{sheet:'Лист_1', data:[['a'],['1']]}]), [['a'],['1']], "varaqlar royxati")
eq(pickSheet([{sheet:'bosh', data:[['x']]}, {sheet:'asosiy', data:[['a'],['1'],['2']]}]),
   [['a'],['1'],['2']], 'eng kop qatorli varaq')
eq(pickSheet([]), null, 'bosh fayl')

console.log(fail === 0 ? 'HAMMASI O\'TDI' : fail + ' ta xato')
