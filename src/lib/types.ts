export type Role = 'owner' | 'manager' | 'accountant'
export type DocStatus = 'draft' | 'posted' | 'cancelled'
export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected'
export type CustomerStatus = 'lead' | 'active' | 'sleeping' | 'lost' | 'blocked'
export type ActivityKind = 'call' | 'meeting' | 'message' | 'note' | 'visit' | 'email'

export interface Profile {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: Role
  is_active: boolean
  salary: number
  bonus_pct: number | null
  hired_at: string | null
  tg_chat_id: number | null
  tg_link_code: string | null
  tg_linked_at: string | null
  avatar_url: string | null
  note: string | null
  role_id: number | null
  birth_date: string | null
  passport: string | null
  pinfl: string | null
  address: string | null
  emergency_name: string | null
  emergency_phone: string | null
  position: string | null
  employment_type: string | null
  probation_until: string | null
  contract_until: string | null
  terminated_at: string | null
  termination_reason: string | null
}

export type SettingType =
  | 'number' | 'percent' | 'money' | 'text' | 'bool' | 'time' | 'select' | 'json'

export interface Setting {
  key: string
  value: unknown
  label: string
  hint: string | null
  grp: string
  value_type: SettingType
  options: string[] | null
  unit: string | null
  sort_order: number
  owner_only: boolean
  updated_at: string
}

export interface Unit { id: number; code: string; name: string; decimals: number; sort_order: number }

export interface Category {
  id: number
  parent_id: number | null
  name: string
  reorder_days: number | null
  overstock_days: number | null
  min_margin_pct: number | null
  sort_order: number
  is_active: boolean
}

export interface Warehouse {
  id: number
  code: string
  name: string
  address: string | null
  is_default: boolean
  kind: 'stock' | 'transit' | 'consignment' | 'office'
  is_active: boolean
  sort_order: number
}

export interface PriceTier {
  id: number
  code: string
  name: string
  default_markup_pct: number | null
  max_discount_pct: number | null
  min_margin_pct: number | null
  is_default: boolean
  is_active: boolean
  sort_order: number
}

export interface PaymentTerm {
  id: number; name: string; days: number
  is_default: boolean; is_active: boolean; sort_order: number
}

export interface CashAccount {
  id: number; name: string; kind: 'cash' | 'bank' | 'card' | 'person'
  currency: string; holder: string | null
  opening_balance: number; opening_date: string | null
  is_active: boolean; sort_order: number
}

export interface PipelineStage {
  id: number; name: string; probability: number
  is_won: boolean; is_lost: boolean; color: string | null
  sort_order: number; is_active: boolean
}

export interface ExpenseCategory {
  id: number; name: string; kind: 'fixed' | 'variable' | 'other'
  is_payroll: boolean; formula: string | null
  default_amount: number; is_active: boolean; sort_order: number
}

export interface Product {
  id: number
  code: string | null
  name: string
  category_id: number | null
  unit_id: number | null
  barcode: string | null
  is_stocked: boolean
  min_margin_pct: number | null
  reorder_days: number | null
  overstock_days: number | null
  min_qty: number | null
  default_supplier_id: number | null
  note: string | null
  is_active: boolean
}

export interface Customer {
  id: number
  name: string
  legal_name: string | null
  inn: string | null
  tier_id: number | null
  payment_term_id: number | null
  manager_id: string | null
  status: CustomerStatus
  phone: string | null
  email: string | null
  address: string | null
  region: string | null
  credit_limit: number | null
  opening_debt: number
  opening_advance: number
  opening_date: string | null
  source: string | null
  first_sale_at: string | null
  last_sale_at: string | null
  note: string | null
  is_active: boolean
}

export interface Supplier {
  id: number
  name: string
  legal_name: string | null
  inn: string | null
  phone: string | null
  email: string | null
  address: string | null
  contact_person: string | null
  payment_term_id: number | null
  currency: string
  opening_debt: number
  opening_advance: number
  opening_date: string | null
  note: string | null
  is_active: boolean
}

export interface Sale {
  id: number
  doc_no: string | null
  customer_id: number
  manager_id: string | null
  warehouse_id: number
  contract_id: number | null
  doc_date: string
  payment_term_id: number | null
  term_days: number
  due_date: string | null
  currency: string
  fx_rate: number
  subtotal: number
  discount_total: number
  total: number
  total_base: number
  cogs_base: number
  gross_profit_base: number
  margin_pct: number | null
  paid_base: number
  status: DocStatus
  approval_status: ApprovalStatus
  approval_reason: string | null
  source: string
  note: string | null
  created_at: string
}

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number
  qty: number
  list_price: number
  price: number
  discount_pct: number
  line_total: number
  cogs_base: number
  margin_pct: number | null
  note: string | null
}

export interface ArAging {
  sale_id: number
  doc_no: string | null
  customer_id: number
  customer_name: string
  phone: string | null
  manager_id: string | null
  doc_date: string
  due_date: string | null
  total_base: number
  paid_base: number
  outstanding_base: number
  overdue_days: number
  bucket: string
  priority: number
}

export interface StockSignal {
  product_id: number
  code: string | null
  name: string
  category_name: string | null
  unit_code: string | null
  qty: number
  value_base?: number
  avg_cost_base?: number | null
  daily_consumption: number
  cover_days: number | null
  reorder_days?: number
  overstock_days?: number
  signal: 'TUGAGAN' | 'HARAKATSIZ' | 'BUYURTMA' | 'CHEGIRMA' | 'Normal'
}

export interface DailySnapshot {
  as_of: string
  cash_base: number
  min_safe_cash: number
  overdue_base: number
  call_count: number
  call_amount_base: number
  today_sales_base: number
  month_sales_base: number
  month_plan_base: number
  reorder_count: number
  overstock_count: number
  frozen_stock_base: number
  stock_value_base: number
  pending_approvals: number
  today_meetings: number
}

export interface PnlRow {
  period: string
  revenue: number
  cogs: number
  gross_profit: number
  gross_margin_pct: number | null
  variable_cost: number
  bonus_cost: number
  fixed_cost: number
  ebit: number
  profit_tax: number
  collected: number
  sales_plan: number
  margin_plan: number | null
}

export interface ManagerKpi {
  manager_id: string
  full_name: string
  period_month: string | null
  sale_count: number
  customer_count: number
  revenue_base: number
  gross_profit_base: number
  margin_pct: number | null
  collected_base: number
  collection_pct: number | null
  overdue_base: number
}

export interface Deal {
  id: number
  customer_id: number | null
  title: string
  stage_id: number
  amount: number
  currency: string
  manager_id: string | null
  expected_close: string | null
  probability: number | null
  loss_reason_id: number | null
  won_sale_id: number | null
  closed_at: string | null
  source: string | null
  note: string | null
}

export interface Activity {
  id: number
  kind: ActivityKind
  customer_id: number | null
  deal_id: number | null
  sale_id: number | null
  actor_id: string | null
  subject: string | null
  body: string | null
  outcome: string | null
  happened_at: string
  duration_min: number | null
  next_action_at: string | null
}

export interface Meeting {
  id: number
  title: string
  customer_id: number | null
  deal_id: number | null
  organizer_id: string | null
  starts_at: string
  ends_at: string | null
  location: string | null
  description: string | null
  status: string
  outcome: string | null
  reminder_min: number
  google_event_id: string | null
}

export interface Task {
  id: number
  title: string
  description: string | null
  assignee_id: string | null
  created_by: string | null
  due_at: string | null
  priority: number
  status: string
  customer_id: number | null
  deal_id: number | null
  sale_id: number | null
  product_id: number | null
  source: string
  ai_insight_id: number | null
  completed_at: string | null
}

export interface AiInsight {
  id: number
  kind: string
  severity: 'low' | 'medium' | 'high'
  title: string
  body: string | null
  metric: Record<string, unknown> | null
  entity: string | null
  entity_id: string | null
  suggested_action: string | null
  target_id: string | null
  status: 'open' | 'done' | 'dismissed'
  created_at: string
}

export interface Approval {
  id: number
  doc_type: string
  doc_id: number
  reason: string
  detail: Record<string, unknown> | null
  requested_by: string | null
  status: ApprovalStatus
  comment: string | null
  created_at: string
}

export interface Payroll {
  id: number
  profile_id: string
  period_month: string
  salary: number
  bonus_base: number
  bonus_pct: number | null
  bonus_amount: number
  extra_bonus: number
  advance_repaid: number
  deductions: number
  penalties: number
  tax_amount: number
  total_gross: number
  total_net: number
  status: string
  paid_at: string | null
  note: string | null
}

export interface Attendance {
  id: number
  profile_id: string
  work_date: string
  check_in: string | null
  check_out: string | null
  status: string
  late_min: number
  worked_min: number | null
  note: string | null
}

export interface Loan {
  id: number
  name: string
  kind: string
  counterparty: string | null
  principal: number
  balance: number
  monthly_payment: number
  currency: string
  start_date: string | null
  end_date: string | null
  note: string | null
  is_active: boolean
}

export interface ArCustomer {
  customer_id: number
  name: string
  phone: string | null
  manager_id: string | null
  tier_id: number | null
  status: CustomerStatus
  outstanding_base: number
  advance_base: number
  net_base: number
  overdue_base: number
  overdue_days: number
  oldest_due: string | null
  doc_count: number
  overdue_docs: number
  last_contact_at: string | null
  next_action_at: string | null
  priority: number
}

export interface ArBucket {
  bucket: string
  doc_count: number
  customer_count: number
  amount_base: number
  sort_order: number
}

export interface Position {
  cash_base: number
  stock_base: number
  receivable_base: number
  supplier_advance_base: number
  supplier_debt_base: number
  customer_advance_base: number
  loan_base: number
}

export interface CashFlowRow {
  period: string
  inflow_base: number
  outflow_base: number
  inflow_operating: number
  outflow_operating: number
  inflow_financing: number
  outflow_financing: number
  net_flow_base: number
}

export interface PlanVsFact {
  period_month: string
  manager_id: string
  full_name: string
  plan_base: number
  fact_base: number
  gross_profit_base: number
  done_pct: number | null
  margin_pct: number | null
}

export interface BudgetRow {
  period_month: string
  category_id: number
  category_name: string
  kind: 'fixed' | 'variable' | 'other'
  is_payroll: boolean
  formula: string | null
  plan_base: number
  actual_base: number
  diff_base: number
}

export interface Period {
  period_month: string
  sales_plan: number
  margin_plan: number | null
  is_closed: boolean
  note: string | null
}

export interface Expense {
  id: number
  doc_date: string
  expense_category_id: number | null
  cash_account_id: number | null
  supplier_id: number | null
  amount: number
  amount_base: number
  description: string | null
  is_paid: boolean
}

export interface SupplierBalance {
  supplier_id: number
  name: string
  phone: string | null
  contact_person: string | null
  opening_debt: number
  opening_advance: number
  purchased_base: number
  paid_base: number
  debt_base: number
  note: string | null
}

export interface Purchase {
  id: number
  doc_no: string | null
  supplier_id: number | null
  warehouse_id: number
  doc_date: string
  currency: string
  fx_rate: number
  total: number
  total_base: number
  paid_base: number
  status: DocStatus
  note: string | null
  posted_at: string | null
}

export interface PurchaseItem {
  id: number
  purchase_id: number
  product_id: number
  qty: number
  unit_cost: number
  unit_cost_base: number
  line_total_base: number
  note: string | null
}

export interface CustomerStats {
  customer_id: number
  name: string
  manager_id: string | null
  tier_id: number | null
  status: CustomerStatus
  phone: string | null
  credit_limit: number | null
  opening_advance: number
  first_sale_at: string | null
  last_sale_at: string | null
  sale_count: number
  revenue_base: number
  gross_profit_base: number
  margin_pct: number | null
  outstanding_base: number
  net_base: number
  days_since_sale: number | null
  last_contact_at: string | null
  activity_count: number
}

export interface Contract {
  id: number
  customer_id: number
  number: string
  signed_at: string | null
  term_days: number | null
  amount: number | null
  kind: string
  note: string | null
  is_active: boolean
}

export interface CashCategory {
  id: number
  name: string
  direction: 1 | -1
  flow_kind: 'operating' | 'investing' | 'financing'
  code: string | null
  is_system: boolean
  is_active: boolean
  sort_order: number
}

export interface CashLedgerRow {
  source: 'payment' | 'expense' | 'loan' | 'op'
  source_id: number
  op_date: string
  direction: 1 | -1
  category_name: string
  flow_kind: string
  cash_account_id: number
  to_account_id: number | null
  amount_base: number
  counterparty: string | null
  doc_no: string | null
  description: string | null
  created_at: string
}

export interface CashBalance {
  cash_account_id: number
  name: string
  kind: string
  currency: string
  balance_base: number
  opening_base: number
}

export interface FxCurrent {
  currency: string
  currency_name: string
  symbol: string | null
  rate: number
  rate_date: string
  source: string
  days_old: number
  last_sync_at: string | null
}

export interface TopProduct {
  product_id: number
  code: string | null
  name: string
  category_name: string | null
  unit_code: string | null
  qty_sold: number
  revenue_base: number
  gross_profit_base: number
  margin_pct: number | null
  customer_count: number
  sale_count: number
  last_sold_at: string | null
  stock_qty: number
}

export interface TopCustomer {
  customer_id: number
  name: string
  manager_id: string | null
  tier_id: number | null
  phone: string | null
  sale_count: number
  revenue_base: number
  gross_profit_base: number
  margin_pct: number | null
  collection_pct: number | null
  last_sale_at: string | null
  days_since_sale: number | null
  avg_check_base: number
}

export interface CrossSellRow {
  customer_id: number
  customer_name: string
  manager_id: string | null
  product_id: number
  product_name: string
  product_code: string | null
  category_name: string | null
  other_buyers: number
  stock_qty: number
  margin_pct: number | null
}

export interface CashByCategory {
  period: string
  direction: 1 | -1
  category_name: string
  flow_kind: string
  op_count: number
  amount_base: number
}

export type EmpEventType =
  | 'hire' | 'rehire' | 'terminate' | 'position' | 'salary' | 'role' | 'note'

export interface EmploymentEvent {
  id: number
  profile_id: string
  event_type: EmpEventType
  effective_date: string
  order_no: string | null
  order_date: string | null
  position: string | null
  employment_type: string | null
  probation_until: string | null
  contract_until: string | null
  salary_from: number | null
  salary_to: number | null
  bonus_pct_from: number | null
  bonus_pct_to: number | null
  role_id_from: number | null
  role_id_to: number | null
  reason: string | null
  note: string | null
  is_applied: boolean
  created_at: string
}

export interface StaffAdvance {
  id: number
  profile_id: string
  issue_date: string
  amount: number
  repay_monthly: number
  reason: string | null
  status: 'open' | 'closed'
  repaid: number
  balance: number
}

export interface StaffAdjustment {
  id: number
  profile_id: string
  period_month: string
  kind: 'penalty' | 'bonus'
  amount: number
  reason: string
  created_at: string
}

export interface HandoverItem {
  id: number
  profile_id: string
  item_type: string
  entity_id: string | null
  description: string
  amount_base: number | null
  to_profile_id: string | null
  is_done: boolean
  note: string | null
}

export interface HrReminder {
  profile_id: string
  full_name: string
  kind: 'birthday' | 'anniversary' | 'probation' | 'contract'
  label: string
  event_date: string
  days_left: number
}

export interface FinalSettlement {
  worked_days: number
  work_days: number
  salary_full: number
  salary_part: number
  leave_quota: number
  leave_used: number
  leave_days_left: number
  leave_comp: number
  bonus: number
  extra_bonus: number
  penalty: number
  advance_due: number
  total: number
}
