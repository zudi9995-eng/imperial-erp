# Imperial Partners — Boshqaruv platformasi

Qurilish materiallari B2B distributori uchun ERP: sotuv, ombor (FIFO), mijozlar, CRM,
debitor, moliya, HR, AI tahlil va Telegram bot.

**Asosiy tamoyil:** kodda hech qanday biznes raqami qotirilmagan. Marja chegarasi,
signal kunlari, oklad, bonus foizi, ish vaqti, bildirishnoma vaqtlari, omborlar,
kategoriyalar, narx toifalari — hammasi **Sozlamalar** bo'limidan boshqariladi.
Excel modelidagi raqamlar faqat boshlang'ich qiymat sifatida turibdi.

---

## Ishga tushirish

```bash
npm install
npm run dev
```

`.env` fayli kerak (`.env.example` dan nusxa oling):

```
VITE_SUPABASE_URL=https://lwsdirvewvkworitndrr.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

## Birinchi hisobni ochish

Ilovada ochiq ro'yxatdan o'tish yo'q — bu ataylab. Birinchi hisobni o'zingiz ochasiz:

1. [Supabase Dashboard → Authentication → Users](https://supabase.com/dashboard/project/lwsdirvewvkworitndrr/auth/users)
2. **Add user → Create new user**, emailingiz va parolingizni kiriting,
   **Auto Confirm User** ni yoqing
3. Ilovaga o'sha email/parol bilan kiring
4. Ilova «Birinchi kirish» ekranini ko'rsatadi — ismingizni yozib,
   **Ta'sischi sifatida boshlash** tugmasini bosasiz

Shundan keyin qolgan xodimlarga hisobni siz **Xodimlar** bo'limidan ochasiz.

---

## Texnologiya

| Qatlam | Tanlov |
|---|---|
| Frontend | Vite 7 · React 19 · TypeScript · Tailwind 4 · React Router 7 |
| Baza | Supabase (Postgres 17) — loyiha `davra`, jadval prefiksi `ip_` |
| Xavfsizlik | Row Level Security, har jadval uchun rol bo'yicha siyosat |
| Deploy | Netlify (SPA, `netlify.toml` tayyor) |
| AI | Claude API, Supabase Edge Function ichida (kalit brauzerga chiqmaydi) |

`davra` — ko'p ilovali Supabase loyihasi. Shuning uchun `auth.users` ga trigger
**qo'yilmagan**: boshqa ilovalarda ro'yxatdan o'tgan odamga ERP profili yaratilib
qolmasligi kerak. Profil `ip_bootstrap_owner()` RPC va **Xodimlar** bo'limi orqali
ochiladi.

---

## Rollar

| Rol | Nimani ko'radi |
|---|---|
| **Ta'sischi** (`owner`) | Hammasi: kassa, P&L, tan narx, sozlamalar, tasdiqlash |
| **Menejer** (`manager`) | Faqat o'z mijozlari, o'z sotuvi, ombor miqdori (tan narxsiz), o'z oyligi |
| **Buxgalter** (`accountant`) | Moliya, xaridlar, to'lovlar, hisobotlar — mijoz bazasini o'zgartira olmaydi |

Menejerga tan narx va marja summasi ko'rinmaydi: `ip_stock` va `ip_stock_signals`
view'lari `security_invoker` rejimida, `ip_batches` esa menejerga yopiq. Uning
o'rniga `ip_stock_qty` va `ip_stock_signals_lite` — faqat miqdor va signal.

---

## Baza tuzilishi

57 jadval, 13 view, 26 funksiya, 124 RLS siyosati. Asosiy bloklar:

**Sozlamalar va spravochniklar** — `ip_settings` (54 parametr), `ip_warehouses`,
`ip_categories`, `ip_price_tiers`, `ip_payment_terms`, `ip_cash_accounts`,
`ip_pipeline_stages`, `ip_expense_categories`, `ip_units`, `ip_currencies`,
`ip_exchange_rates`, `ip_loss_reasons`

**Ombor (FIFO)** — `ip_batches` (partiyalar), `ip_stock_moves`, `ip_purchases`,
`ip_transfers`, `ip_inventory_counts`. Tan narx partiya bo'yicha hisoblanadi:
`ip_consume_fifo()` eng eski partiyadan boshlab sarflaydi va har partiya uchun
alohida harakat yozadi.

**Sotuv** — `ip_sales`, `ip_sale_items`, `ip_payments`, `ip_approvals`.
`ip_submit_sale()` sotuvni topshirishda uchta narsani tekshiradi:
1. marja (tovar → kategoriya → toifa → umumiy sozlama tartibida)
2. katta sotuv chegarasi
3. mijoz kredit limiti

Biri oshsa sotuv **tasdiqqa** ketadi va omborga tegmaydi. Ta'sischi tasdiqlagach
`ip_post_sale()` FIFO ni sarflaydi va haqiqiy marjani yozadi.

**CRM** — `ip_customers`, `ip_deals` (bosqich tarixi bilan), `ip_activities`,
`ip_meetings` (Google Calendar uchun `google_event_id`), `ip_tasks`

**HR** — `ip_attendance` (kechikish sozlamadan hisoblanadi), `ip_leaves`,
`ip_payroll`, `ip_kpi_targets`. `ip_calc_payroll()` oklad va bonusni
avtomatik hisoblaydi — bonus bazasi va «faqat undirilgan puldan» sharti sozlamada.

**Moliya** — `ip_periods`, `ip_sales_plans`, `ip_budget_lines`, `ip_expenses`,
`ip_loans`. View'lar: `ip_pnl_monthly`, `ip_cash_balances`, `ip_ar_aging`,
`ip_stock_signals`, `ip_daily_snapshot`, `ip_manager_kpi`

**AI** — `ip_ai_insights`, `ip_ai_briefings`, `ip_ai_chats`, `ip_ai_usage`

### Migratsiyalar

`ip_001` … `ip_021` Supabase'ga qo'llangan (`supabase migration list` bilan
ko'rinadi). Repoda hozircha faqat `001_core.sql` va 1C importi
(`supabase/import-1c/`) bor — qolganini CLI ulangach tortib olish mumkin:

```bash
npx supabase link --project-ref lwsdirvewvkworitndrr
npx supabase db pull
```

---

## Keyingi bosqichlar

- [x] Sotuv: hujjatlar roʻyxati, sotuv kiritish, jonli marja, tasdiqlash oqimi
- [x] Ombor: signallar, qoldiq, partiyalar, harakatlar, ko'chirish
- [x] Debitor: qo'ng'iroq navbati, qarilik tahlili, to'lov taqsimlash, qo'ng'iroq jurnali
- [ ] Mijozlar kartochkasi (aloqa tarixi, sotuv tarixi)
- [ ] Ombor: inventarizatsiya
- [ ] Xaridlar va postavshiklar
- [x] Moliya: pozitsiya, P&L, naqd oqim, reja/byudjet, harajat, qarz, stsenariy
- [ ] HR: hisob ochish, KPI, davomat, oylik
- [ ] CRM: voronka kanbani, uchrashuvlar, Google Calendar
- [ ] AI Edge Function: kunlik brifing, tavsiyalar, savol-javob
- [ ] Telegram bot: bildirishnoma, sotuv kiritish, tasdiqlash
- [x] 1C eksportidan import (13 postavshik, 25 mijoz, 63 shartnoma, 25 tovar)
- [ ] Netlify'ga deploy
