-- 1C hisoboti, 30.09.2026 holatiga
-- Manba: Кредитор_Дебитор_склад_нахт_пулар_отчет_.xlsx
-- Ustunlar: C = Долг (qarz), D = Аванс (avans), E = Изох

insert into ip_suppliers (name, opening_debt, opening_advance, opening_date, currency, note)
values
  ('"Azia Metall Prof" MCHJ Qk', 11612288, 0, '2026-09-30', 'UZS', '№DI-278 (2026-04-18) qarz 11612288 | Bizning qarizimiz bor'),
  ('"Bigmart" Mchj', 0, 20554, '2026-09-30', 'UZS', '№DS-0005250 avans 20554 | Bizning avansimiz bor'),
  ('"Buxoro Gypsum" Mchj', 140434826, 0, '2026-09-30', 'UZS', '№730 (2026-07-01) qarz 54775500; №749 (2026-07-01) qarz 43282000; №809 (2026-08-01) qarz 42377326 | Bizning qarizimiz bor'),
  ('"Durable Metal Pipes" Mchj', 51888483.62, 0, '2026-09-30', 'UZS', '№DP-1472 (2026-08-20) qarz 51888483.62 | Bizning qarizimiz bor'),
  ('"Iso-Mag" Mchj', 4922402.95, 13424744.88, '2026-09-30', 'UZS', '№17-М (2026-04-02) avans 13424735.87; №5-М (2026-01-13) qarz 4922402.95; №9-М (2026-01-30) avans 9.01 | buni aniqlashtiramiz dushanba kuni | Bizning qarizimiz bor | Bizning avansimiz bor'),
  ('"Izo Lyuks " Mchj', 12000000, 0, '2026-09-30', 'UZS', '№203 (2025-09-17) qarz 12000000 | Bizning qarizimiz bor'),
  ('"Mega Group Design" Mchj', 0, 5000000, '2026-09-30', 'UZS', '№98Т (2026-01-14) avans 5000000 | internet xizmati uchun yil oxirida schet faktura olamiz'),
  ('"Pro-Build Trade" Mchj', 0, 145000, '2026-09-30', 'UZS', '№15/4 (2026-04-15) avans 145000 | faktura berish kerak'),
  ('"Teploizolyatsionnaya  Kompaniya" Mchj', 495158655.8, 0, '2026-09-30', 'UZS', '№2026-40/ЕД (2026-01-15) qarz 495158655.8 | Bizning qarizimiz bor'),
  ('"Termotech Xps" Mchj', 3569028.56, 0, '2026-09-30', 'UZS', '№105-АЗМ (2026-03-02) qarz 3569028.56 | Bizning qarizimiz bor'),
  ('Rustamobod Fayz MCHJ', 0, 23320000, '2026-09-30', 'UZS', '№26 (2026-01-05) avans 23320000 | Oy oxirida schet faktura beradi'),
  ('SURKHAN BASALT" MCHJ', 0, 1658880, '2026-09-30', 'UZS', '№104 (2026-08-12) avans 1658880 | Bizning avansimiz bor'),
  ('ООО "TRAST MUAMALAT"', 201474720, 0, '2026-09-30', 'UZS', '№NМ /26-11 (2026-03-25) qarz 201474720 | Bizning qarizimiz bor');

insert into ip_customers (name, tier_id, payment_term_id, manager_id, status,
                          opening_debt, opening_advance, opening_date, note)
select v.name,
       (select id from ip_price_tiers   where is_default limit 1),
       (select id from ip_payment_terms where is_default limit 1),
       (select id from ip_profiles where role='owner' order by created_at limit 1),
       'active', v.debt, v.adv, '2026-09-30', v.note
  from (values
  ('"Asaka Motors International" Mchj', 0, 336000, 'puli bizada bor'),
  ('"Aysel Inshaat" MCHJ Qk', 0, 17831777.88, 'puli bizada bor'),
  ('"Bino Va Ko`Prik Barpo Etish" Mchj', 0, 3000000, 'puli bizada bor'),
  ('"Bo`Stonliq Temir Beton" Mchj', 0, 16860000, 'faktura berishimiz kk'),
  ('"Discover Invest" Mchj', 396668258.69, 542882433.24, null),
  ('"Eight Doors" Mchj', 2610000, 100000, 'puli bizada bor | qarz'),
  ('"Gok-Yapi Insaat" Mchj', 10000000, 0, 'qarz'),
  ('"Hi Tech Engineering House" Mchj', 0, 137500, 'puli bizada bor'),
  ('"Iso-Mag" Mchj', 0, 13268000, null),
  ('"Kardise" Mchj', 0, 1640442, 'puli bizada bor | puli bizada bor | faktura berishimiz kk'),
  ('"Makon-Kapital-Invest" Mchj', 108269401.13, 4560000, 'puli bizada bor | qarz'),
  ('"Neotemp" Mchj', 673920, 0, null),
  ('"New Times Buildings" Mchj', 0, 4080720, 'puli bizada bor'),
  ('"NIHOL QURILISH" MAS''ULIYATI CHEKLANGAN JAMIYAT', 9810260, 0, 'qarz'),
  ('"Oqoltin Bobur Tomorqa Xizmati Uch" Mchj', 0, 10825800, 'puli bizada bor'),
  ('"Oxus Project Managment" Mchj', 0, 750000, 'faktura berishimiz kk'),
  ('"Qurilish Universal Kompakt Servis" Mchj', 0, 4163520, 'puli bizada bor'),
  ('"Ravshan 001" Mchj', 864000, 11507800.4, 'faktura berishimiz kk'),
  ('"Technogreen" Mchj', 0, 1505980, 'puli bizada bor'),
  ('"TOSHKENT VILOYATI YO`LLARDAN MUNTAZAM FOYDALANISH" DM', 3516705, 0, 'qarz'),
  ('"Zufar Building Group" Mchj', 0, 3965000, 'faktura berishimiz kk'),
  ('MCHJ "SEAFOOD IMPORT TRADE"', 0, 65958000, 'faktura berishimiz kk'),
  ('OOO "URBANIX BUILDER"', 0, 15365160, 'faktura berishimiz kk'),
  ('ООО "ALL TEEM STROY"', 0, 1378080, 'puli bizada bor'),
  ('ООО "EURASIA BOTTLERS"', 0, 720000, 'faktura berishimiz kk')
) as v(name, debt, adv, note);

insert into ip_contracts (customer_id, number, signed_at, amount, term_days, note)
select cu.id, v.number, v.signed_at::date, v.amount,
       (select days from ip_payment_terms where is_default limit 1), v.note
  from (values
  ('"Asaka Motors International" Mchj', '№10/2025', '2025-11-14', 336000, 'puli bizada bor'),
  ('"Aysel Inshaat" MCHJ Qk', '№12/01', '2026-01-12', 17831777.88, 'puli bizada bor'),
  ('"Bino Va Ko`Prik Barpo Etish" Mchj', '№199', '2026-07-01', 3000000, 'puli bizada bor'),
  ('"Bo`Stonliq Temir Beton" Mchj', '№335', '2026-09-18', 1980000, 'faktura berishimiz kk'),
  ('"Bo`Stonliq Temir Beton" Mchj', '№342', '2026-09-23', 14880000, 'faktura berishimiz kk'),
  ('"Discover Invest" Mchj', '№02', '2026-01-27', 122496, null),
  ('"Discover Invest" Mchj', '№05', '2026-01-28', 17441550, null),
  ('"Discover Invest" Mchj', '№07/01', '2026-01-07', 13391260.69, null),
  ('"Discover Invest" Mchj', '№09', '2026-02-02', 240994, null),
  ('"Discover Invest" Mchj', '№118', '2026-05-08', 25483850, null),
  ('"Discover Invest" Mchj', '№139', '2026-05-25', 213798400.24, null),
  ('"Discover Invest" Mchj', '№14/2025', '2025-12-02', 29047940, null),
  ('"Discover Invest" Mchj', '№141', '2026-05-29', 0, null),
  ('"Discover Invest" Mchj', '№158', '2026-06-09', 28026570, null),
  ('"Discover Invest" Mchj', '№16/01', '2026-01-16', 217119288, null),
  ('"Discover Invest" Mchj', '№165', '2026-06-13', 137780970, null),
  ('"Discover Invest" Mchj', '№203', '2026-07-02', 465, null),
  ('"Discover Invest" Mchj', '№265', '2026-08-07', 4732980, null),
  ('"Discover Invest" Mchj', '№289', '2026-08-25', 29594480, null),
  ('"Discover Invest" Mchj', '№29', '2026-02-20', 15382860, null),
  ('"Discover Invest" Mchj', '№304', '2026-09-03', 6369050, null),
  ('"Discover Invest" Mchj', '№313', '2026-09-07', 300, null),
  ('"Discover Invest" Mchj', '№321', '2026-09-11', 13230000, null),
  ('"Discover Invest" Mchj', '№327', '2026-09-15', 1470000, null),
  ('"Discover Invest" Mchj', '№338', '2026-09-21', 32916575, null),
  ('"Discover Invest" Mchj', '№36', '2026-03-06', 63147590, null),
  ('"Discover Invest" Mchj', '№43', '2026-03-11', 41295120, null),
  ('"Discover Invest" Mchj', '№44', '2026-03-11', 171485, null),
  ('"Discover Invest" Mchj', '№59', '2026-03-30', 13041648, null),
  ('"Discover Invest" Mchj', '№62', '2026-04-01', 35744820, null),
  ('"Eight Doors" Mchj', '№104', '2026-04-30', 100000, 'puli bizada bor'),
  ('"Eight Doors" Mchj', '№112', '2026-05-04', 0, null),
  ('"Eight Doors" Mchj', '№346', '2026-09-24', 2610000, 'qarz'),
  ('"Gok-Yapi Insaat" Mchj', '№333', '2026-09-18', 10000000, 'qarz'),
  ('"Hi Tech Engineering House" Mchj', '№169', '2026-06-15', 137500, 'puli bizada bor'),
  ('"Iso-Mag" Mchj', '№269', '2026-08-11', 13268000, null),
  ('"Kardise" Mchj', '№320', '2026-09-11', 240000, 'puli bizada bor'),
  ('"Kardise" Mchj', '№343', '2026-09-23', 1400000, 'faktura berishimiz kk'),
  ('"Makon-Kapital-Invest" Mchj', '№122', '2026-05-12', 2850000, 'puli bizada bor'),
  ('"Makon-Kapital-Invest" Mchj', '№132', '2026-05-18', 1710000, 'puli bizada bor'),
  ('"Makon-Kapital-Invest" Mchj', '№187', '2026-06-23', 300, null),
  ('"Makon-Kapital-Invest" Mchj', '№275', '2026-08-17', 60277580.33, 'qarz'),
  ('"Makon-Kapital-Invest" Mchj', '№276', '2026-08-17', 27491520.8, 'qarz'),
  ('"Makon-Kapital-Invest" Mchj', '№277', '2026-08-17', 20500000, 'qarz'),
  ('"Neotemp" Mchj', '№33', '2026-03-02', 673920, null),
  ('"New Times Buildings" Mchj', '№217', '2026-07-13', 4080720, 'puli bizada bor'),
  ('"NIHOL QURILISH" MAS''ULIYATI CHEKLANGAN JAMIYAT', '№309', '2026-09-07', 9810260, null),
  ('"Oqoltin Bobur Tomorqa Xizmati Uch" Mchj', '№88', '2026-04-15', 10825800, 'puli bizada bor'),
  ('"Oxus Project Managment" Mchj', '№334', '2026-09-18', 750000, 'faktura berishimiz kk'),
  ('"Qurilish Universal Kompakt Servis" Mchj', '№186', '2026-06-23', 120000, null),
  ('"Qurilish Universal Kompakt Servis" Mchj', '№252', '2026-07-30', 4043520, 'puli bizada bor'),
  ('"Ravshan 001" Mchj', '№128', '2026-05-15', 54000, null),
  ('"Ravshan 001" Mchj', '№193', '2026-06-26', 0, null),
  ('"Ravshan 001" Mchj', '№317', '2026-09-09', 810000, null),
  ('"Ravshan 001" Mchj', '№57', '2026-03-26', 11405800.4, 'faktura berishimiz kk'),
  ('"Ravshan 001" Mchj', '№64', '2026-04-03', 102000, 'faktura berishimiz kk'),
  ('"Technogreen" Mchj', '№315', '2026-09-08', 1505980, 'puli bizada bor'),
  ('"TOSHKENT VILOYATI YO`LLARDAN MUNTAZAM FOYDALANISH" DM', '№В26012175', '2026-08-13', 3516705, 'qarz'),
  ('"Zufar Building Group" Mchj', '№344', '2026-09-23', 3965000, 'faktura berishimiz kk'),
  ('MCHJ "SEAFOOD IMPORT TRADE"', '№348', '2026-09-25', 65958000, 'faktura berishimiz kk'),
  ('OOO "URBANIX BUILDER"', '№345', '2026-09-24', 15365160, 'faktura berishimiz kk'),
  ('ООО "ALL TEEM STROY"', '№297', '2026-08-28', 1378080, 'puli bizada bor'),
  ('ООО "EURASIA BOTTLERS"', '№329', '2026-09-16', 720000, 'faktura berishimiz kk')
) as v(cname, number, signed_at, amount, note)
  join ip_customers cu on cu.name = v.cname;

insert into ip_products (code, name, category_id, unit_id, is_stocked, note)
select v.code, v.name, c.id, u.id, true, v.note
  from (values
  ('NM-001', 'A-PAY P10 (Android POS terminal)', 'Uskuna va jihoz', 'sht', '1C: A-PAY P10 (Android POS TERMINAL P10)'),
  ('NM-002', 'ISOCOM PPI-JS 50 (Jugut)', 'Boshqa', 'm', '1C: ISOCOM ППИ-ЖС 50 (Жугут)'),
  ('NM-004', 'PENOPLEX FASTFIX STANDARD, 700 gr', 'Kley va pena', 'sht', '1C: PENOPLEX FASTFIX STANDARD, 700гр'),
  ('NM-005', 'Bazalt mineral vata 100 kg/m3, 1200x600x50', 'Mineral vata', 'm3', '1C: Базальтовая-минеральная вата, плотность-100кг/м3, 1200х600х50 мм'),
  ('NM-006', 'Bazalt mineral vata 100 kg/m3, 1200x600x70', 'Mineral vata', 'm3', '1C: Базальтовая-минеральная вата, плотность-100кг/м3, 1200х600х70 мм'),
  ('NM-007', 'Bazalt mineral vata 120 kg/m3, 1200x600x50', 'Mineral vata', 'm3', '1C: Базальтовая-минеральная вата, плотность-120кг/м3, 1200х600х50 мм'),
  ('NM-008', 'Bitum mastika universal', 'Bitum materiallari', 'kg', '1C: Битумная мастика Универсальная'),
  ('NM-009', 'Bitum praymer Marja', 'Bitum materiallari', 'kg', '1C: Битумный праймер Marja'),
  ('NM-010', 'Gipsokarton 12,5 oq', 'Gipsokarton', 'm2', '1C: Гипсокартон 12,5 цвет белый'),
  ('NM-011', 'Gipsokarton 12,5 yashil', 'Gipsokarton', 'm2', '1C: Гипсокартон 12,5 цвет зеленый'),
  ('NM-012', 'Gipsokarton 9,5 oq', 'Gipsokarton', 'm2', '1C: гипсокартон 9,5 цвет белый'),
  ('NM-013', 'Gipsokarton 9,5 yashil', 'Gipsokarton', 'm2', '1C: Гипсокартон 9,5 цвет зеленый'),
  ('NM-014', 'Dyubel LEWOD PREMIUM 10x260 termobosh bilan', 'Dyubel va mahkamlagich', 'sht', '1C: Дюбель для теплоизоляции LEWOD PREMIUM 10x260 с металлическим гвоздем с термоголовой'),
  ('NM-016', 'Kley kuchaytirilgan', 'Kley va pena', 'kg', '1C: Клей усиленный'),
  ('NM-017', 'Kley-pena PENOPLEX FASTFIX (aerozol)', 'Kley va pena', 'sht', '1C: Клей-пена в аэрозольной упаковке PENOPLEX FASTFIX'),
  ('NM-018', 'Gazsiz suv', 'Boshqa', 'sht', '1C: негазированная вода'),
  ('NM-019', 'Plaster shtukaturka', 'Shtukaturka va qorishma', 'kg', '1C: Пластер штукатурка'),
  ('NM-020', 'Plita TEPLEKS 20x585x1185 S', 'Penoplex / Tepleks', 'm3', '1C: Плиты "ТЕПЛЕКС" 20х585х1185 С (0,278)'),
  ('NM-021', 'Plita TEPLEKS 30x585x1185 T-15', 'Penoplex / Tepleks', 'm3', '1C: Плиты "ТЕПЛЕКС"30х585х1185 Т-15'),
  ('NM-022', 'Plita TEPLEKS 50x585x1185 T-15', 'Penoplex / Tepleks', 'm3', '1C: Плиты "ТЕПЛЕКС"50х585х1185 Т-15'),
  ('NM-023', 'Plita PENOPLEX OSNOVA 20x585x1185 T-15', 'Penoplex / Tepleks', 'm3', '1C: Плиты «ПЕНОПЛЭКС ОСНОВА» 20х585х1185 Т-15'),
  ('NM-024', 'Plita PENOPLEX OSNOVA 30x585x1185 T-15', 'Penoplex / Tepleks', 'm3', '1C: Плиты «ПЕНОПЛЭКС ОСНОВА» 30х585х1185 Т-15'),
  ('NM-025', 'Plita PENOPLEX OSNOVA 50x585x1185 T-15', 'Penoplex / Tepleks', 'm3', '1C: Плиты «ПЕНОПЛЭКС ОСНОВА» 50х585х1185 Т-15'),
  ('NM-026', 'Penopolistirol plita PPS 10-R-A', 'Penopolistirol', 'm3', '1C: Плиты пенополистирольные ППС 10-Р-А'),
  ('NM-028', 'Fiksator yulduzcha armatura uchun 40 mm', 'Dyubel va mahkamlagich', 'sht', '1C: Фиксатор звездочка для арматуры 40 мм')
) as v(code, name, cat, unit, note)
  left join ip_categories c on c.name = v.cat
  left join ip_units      u on u.code = v.unit;

insert into ip_batches (product_id, warehouse_id, qty_in, qty_left, unit_cost_base,
                        received_at, source, note)
select p.id, w.id, v.qty, v.qty, v.cost, '2026-09-30 00:00:00+05', 'opening',
       'Boshlang''ich qoldiq, 1C 30.09.2026'
  from (values
  ('NM-001', 1, 2589285.710000),
  ('NM-002', 10, 5097.857000),
  ('NM-004', 13, 51428.571538),
  ('NM-005', 17.064, 669642.857478),
  ('NM-006', 1.005, 669642.855721),
  ('NM-007', 15.768, 862500.000000),
  ('NM-008', 800, 10714.285713),
  ('NM-009', 288, 12142.857153),
  ('NM-010', 1374, 12053.571434),
  ('NM-011', 153, 15773.809542),
  ('NM-012', 3082, 11309.523809),
  ('NM-013', 1608, 14136.904764),
  ('NM-014', 250, 2142.857160),
  ('NM-016', 600, 30803.571433),
  ('NM-017', 10, 50000.000000),
  ('NM-018', 5, 19642.858000),
  ('NM-019', 1000, 29464.285710),
  ('NM-020', 28.659, 473214.285565),
  ('NM-021', 58.6424, 473214.285739),
  ('NM-022', 62.479, 464129.747755),
  ('NM-023', 13.6639, 589285.714181),
  ('NM-024', 14.6996, 589285.713897),
  ('NM-025', 29.1578, 589285.713943),
  ('NM-026', 41.76, 312500.000000),
  ('NM-028', 15000, 300.304000)
) as v(code, qty, cost)
  join ip_products p on p.code = v.code
  cross join (select id from ip_warehouses where code='MAIN') w;

insert into ip_stock_moves (product_id, warehouse_id, batch_id, direction, qty,
                            unit_cost_base, cost_base, doc_type, moved_at)
select b.product_id, b.warehouse_id, b.id, 1, b.qty_in,
       b.unit_cost_base, b.qty_in * b.unit_cost_base, 'opening', b.received_at
  from ip_batches b where b.source = 'opening';

update ip_cash_accounts set opening_balance=12224800, opening_date='2026-09-30' where name='Kassa (naqd)';
update ip_cash_accounts set opening_balance=5993779, opening_date='2026-09-30' where name='Bank / karta';
update ip_cash_accounts set opening_balance=1709700, opening_date='2026-09-30' where name='Nizomiddinda';