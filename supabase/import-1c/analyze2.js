const D=require('./parsed2.json')
const N=v=>typeof v==='number'?v:0
const isC=v=>typeof v==='string'&&/^№/.test(v.trim())

function partners(rows,start){
  const out=[]; let cur=null
  for(const r of rows){
    if(r.r<start) continue
    const a=r.cells[0]
    if(typeof a!=='string'||!a.trim()) continue
    if(/^Итого/i.test(a.trim())) continue
    if(isC(a)){
      if(cur) cur.contracts.push({raw:a.trim(),debt:N(r.cells[2]),adv:N(r.cells[3]),note:(r.cells[4]||'').toString().trim()})
      continue
    }
    cur={name:a.trim(),debt:N(r.cells[2]),adv:N(r.cells[3]),note:(r.cells[4]||'').toString().trim(),contracts:[]}
    out.push(cur)
  }
  return out
}

function show(title,list,expDebt,expAdv){
  const sd=list.reduce((a,p)=>a+p.debt,0), sa=list.reduce((a,p)=>a+p.adv,0)
  console.log('\n===== '+title+' =====')
  console.log('Kontragent:', list.length)
  console.log('Qarz  :', sd.toFixed(2), expDebt!=null?('  | modeldagi: '+expDebt+'  '+(Math.abs(sd-expDebt)<1?'MOS':'FARQ '+(sd-expDebt).toFixed(2))):'')
  console.log('Avans :', sa.toFixed(2), expAdv!=null?('  | modeldagi: '+expAdv+'  '+(Math.abs(sa-expAdv)<1?'MOS':'FARQ '+(sa-expAdv).toFixed(2))):'')
  const bad=list.filter(p=>{
    if(!p.contracts.length) return false
    const cd=p.contracts.reduce((a,c)=>a+c.debt,0), ca=p.contracts.reduce((a,c)=>a+c.adv,0)
    return Math.abs(cd-p.debt)>1 || Math.abs(ca-p.adv)>1
  })
  if(bad.length){
    console.log('Shartnomalari mos kelmaganlar:')
    bad.forEach(p=>console.log('   ! '+p.name+'  qarz '+p.debt.toFixed(2)+' vs '+
      p.contracts.reduce((a,c)=>a+c.debt,0).toFixed(2)+'   avans '+p.adv.toFixed(2)+' vs '+
      p.contracts.reduce((a,c)=>a+c.adv,0).toFixed(2)))
  } else console.log('Shartnomalar partner summasiga mos ✓')
  return list
}

const kred=show('KREDITOR (postavshiklar)',partners(D['Кредитор'],8),921060405,43569179)
const deb =show('DEBITOR (mijozlar)',partners(D['Дебитор'],8))

const disc=deb.find(p=>/Discover/i.test(p.name))
const third=deb.filter(p=>p!==disc)
console.log('\n--- Discover ajratilgan holda ---')
console.log('Discover        : qarz '+disc.debt.toFixed(2)+'   avans '+disc.adv.toFixed(2)+
            '   sof '+(disc.adv-disc.debt).toFixed(2)+' (biz qarzdormiz)')
const td=third.reduce((a,p)=>a+p.debt,0), ta=third.reduce((a,p)=>a+p.adv,0)
console.log('Uchinchi tomon  : qarz '+td.toFixed(2)+'  | modelda 135744286  '+(Math.abs(td-135744286)<1?'MOS':'FARQ'))
console.log('Uchinchi tomon  : avans '+ta.toFixed(2)+'  | modelda 177953780  '+(Math.abs(ta-177953780)<1?'MOS':'FARQ'))

const sk=D['Склад'].filter(r=>r.r>=7&&typeof r.cells[0]==='string'&&/^\d+\./.test(r.cells[0].trim()))
const ss=sk.reduce((a,r)=>a+N(r.cells[3]),0)
console.log('\n===== SKLAD =====')
console.log('Pozitsiya:',sk.length,' Summa:',ss.toFixed(2),' | modelda 288482209 ',(Math.abs(ss-288482209)<1?'MOS':'FARQ'))
let cash=0; D['Нахт'].forEach(r=>{cash+=N(r.cells[2])})
console.log('\nNAQD:',cash,' | modelda 19928279 ',(cash===19928279?'MOS':'FARQ'))

require('fs').writeFileSync('clean.json',JSON.stringify({kred,deb,sklad:sk.map(r=>({
  raw:r.cells[0], unit:r.cells[1], qty:N(r.cells[2]), sum:N(r.cells[3])
})),naxt:D['Нахт'].map(r=>({name:(r.cells[1]||'').toString().trim(),amount:N(r.cells[2])})).filter(x=>x.amount)},null,1))
