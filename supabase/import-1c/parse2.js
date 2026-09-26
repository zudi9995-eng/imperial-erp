const fs = require('fs')

function decode(s) {
  return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
          .replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d))
          .replace(/&amp;/g,'&')
}

const ssXml = fs.readFileSync('xl/sharedStrings.xml','utf8')
const shared = []
for (const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  shared.push(decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join('')))
}

const colNum = (ref) => {
  const L = ref.match(/^([A-Z]+)/)[1]
  let n = 0
  for (const ch of L) n = n*26 + (ch.charCodeAt(0)-64)
  return n-1
}

function readSheet(file) {
  const xml = fs.readFileSync(file,'utf8')
  const rows = []
  for (const rm of xml.matchAll(/<row[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = []
    // MUHIM: o'zi yopiladigan katakni alohida ushlaymiz
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1] || ''
      const inner = cm[2]
      const ref = (attrs.match(/\br="([A-Z]+\d+)"/)||[])[1]
      if (!ref) continue
      if (inner === undefined) continue          // bo'sh katak
      const t = (attrs.match(/\bt="([^"]+)"/)||[])[1]
      let v = (inner.match(/<v>([\s\S]*?)<\/v>/)||[])[1]
      if (t === 'inlineStr') {
        v = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>decode(x[1])).join('')
      } else if (t === 's' && v != null) {
        v = shared[+v]
      } else if (v != null) {
        v = decode(v)
        const n = Number(v)
        if (!Number.isNaN(n) && v.trim() !== '') v = n
      }
      if (v != null && v !== '') cells[colNum(ref)] = v
    }
    if (cells.length) rows.push({ r: +rm[1], cells })
  }
  return rows
}

const names = ['Кредитор','Дебитор','Склад','Нахт']
const out = {}
for (let i=1;i<=4;i++) out[names[i-1]] = readSheet(`xl/worksheets/sheet${i}.xml`)
fs.writeFileSync('parsed2.json', JSON.stringify(out,null,1))
console.log('OK — qayta o\'qildi')

// Tekshiruv: D ustunida qanday qiymatlar bor
for (const nm of ['Кредитор','Дебитор']) {
  const ds = new Set()
  out[nm].forEach(r => { if (r.cells[3] != null) ds.add(r.cells[3]) })
  console.log('\n' + nm + ' — D ustuni qiymatlari:')
  console.log('  ', [...ds].join('  |  '))
  const es = out[nm].filter(r => r.cells[4] != null).length
  console.log('   E (izoh) bor qatorlar:', es)
}
