# 1C importi — 30.09.2026 holatiga

Manba: `Кредитор_Дебитор_склад_нахт_пулар_отчет_.xlsx` (1C hisoboti, 4 varaq).

## Fayllar

| Fayl | Nima qiladi |
|---|---|
| `parse2.js`   | xlsx ni XML darajasida o'qiydi → `parsed2.json` |
| `analyze2.js` | raqamlarni tekshiradi, moliyaviy model bilan solishtiradi → `clean.json` |
| `gen2.js`     | `clean.json` dan SQL yasaydi → `import2.sql` |
| `import2.sql` | bazaga qo'llangan SQL (migratsiya `ip_012` … `ip_016`) |
| `clean.json`  | tozalangan ma'lumot — qayta ishlatish uchun |

Qayta ishga tushirish:

```bash
node parse2.js && node analyze2.js && node gen2.js
```

## Ustunlar

1C varaqlarida ustunlar **A / C / D / E**:

- **A** — kontragent nomi yoki shartnoma (`№275 от 17.08.2026`)
- **C** — `Долг` (qarz)
- **D** — `Аванс` (avans)
- **E** — `Изох` (izoh)

> **Diqqat:** B ustuni bo'sh. Agar parser `<c .../>` ko'rinishidagi bo'sh
> kataklarni to'g'ri ajratmasa, keyingi katakning qiymatini oldingisiga
> yozib yuboradi va qarz/avans aralashib ketadi. `parse2.js` buni to'g'ri
> ishlaydi, eski `parse.js` — yo'q.

## Nima import qilindi

| | Soni | Summa |
|---|---|---|
| Postavshik | 13 | qarz 921 060 404.93 · avans 43 569 178.88 |
| Mijoz | 25 | qarz 532 412 544.82 · avans 720 836 213.52 |
| Shartnoma | 63 | 25 qarz + 38 avans |
| Tovar | 25 | ombor 288 482 208.82 |
| Kassa | 2 | 18 218 579 |

Uchinchi tomon (Discoversiz): qarz **135 744 286.13**, avans **177 953 780.28** —
moliyaviy modeldagi raqamlar bilan bir tiyingacha mos.

## Boshlang'ich debitor qanday saqlanadi

Qarz shartnomalari uchun `ip_sales` da **`source = 'opening'`** hujjatlari
yaratilgan (`BOSH-№275` ko'rinishida). Shu tufayli:

- qarilik tahlili va qo'ng'iroq navbati ishlaydi
- to'lovni o'sha hujjatga bog'lab kiritish mumkin
- `ip_pnl_monthly` va `ip_manager_kpi` bu hujjatlarni **hisobga olmaydi**,
  ya'ni o'tgan davr qarzi bu oyning daromadi bo'lib ko'rinmaydi

Mijoz kartochkasidagi `opening_debt` nolga tushirilgan (asl qiymat izohda),
`opening_advance` esa o'z joyida qolgan — avans hali hujjatlashtirilmagan
majburiyat.

## Hal qilinmagan savollar

1. **Discover Invest.** 1C: qarz 396 668 258.69 / avans 542 882 433.24 →
   sof **146 214 174.55** biz qarzdormiz. Moliyaviy modelda **200 000 000**
   deb olingan. Farq **53 785 825.45** — akt sverka kerak.
   Modeldagi qarz yozuvi (`ip_loans`) ikki marta hisoblanmasligi uchun
   faolsizlantirildi.

2. **1C ning o'z ichki farqi.** `Итого` qatori qatorlar yig'indisiga mos emas:
   qarz bo'yicha 619 184 682.78 va 532 412 544.82 (farq 86 772 137.96),
   avans bo'yicha 721 837 438.03 va 720 836 213.52 (farq 1 001 224.51).
   Import **qatorlar yig'indisini** oldi, chunki u har kontragent bo'yicha
   tekshiriladi.

3. **Kardise** — kartochkada avans 1 640 442, shartnomalarda 1 640 000
   (442 so'm farq).

4. **Nizomiddindagi 1 709 700 so'm** import qilinmadi — bu kassa hisobi
   Sozlamalardan o'chirilgan. Shuning uchun kassa 18 218 579, 1C dagi
   19 928 279 emas.

5. **Ombor 0.04 so'm farq** — `unit_cost_base` 4 kasr xonagacha
   yaxlitlangani uchun (288 482 208.78 vs 288 482 208.82).

6. 1C sklad hisoboti sarlavhasida **«на 30 сентября 2029 г.»** deb yozilgan —
   bu 1C dagi xato, ma'lumot 2026 yilniki.
