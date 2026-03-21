'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    PENDING: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
    PROCESSING: { bg: '#dbeafe', color: '#1e40af', label: 'Processing' },
    DISPATCHED: { bg: '#dbeafe', color: '#1e40af', label: 'Dispatched' },
    PARTIAL_DISPATCH: { bg: '#ede9fe', color: '#5b21b6', label: 'Partial' },
    RECEIVED: { bg: '#d1fae5', color: '#065f46', label: 'Received' },
    DECLINED: { bg: '#ffe4e6', color: '#9f1239', label: 'Declined' },
    CANCELLED: { bg: '#fee2e2', color: '#7f1d1d', label: 'Cancelled' },
  };
  const c = cfg[status] || { bg: '#f3f4f6', color: '#6b7280', label: status };
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', display: 'inline-block' }}>
      {c.label}
    </span>
  );
}

function MovementBadge({ type }: { type: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    IN: { bg: '#d1fae5', color: '#065f46' },
    OUT: { bg: '#ffe4e6', color: '#9f1239' },
    DAMAGE: { bg: '#fee2e2', color: '#7f1d1d' },
    ADJUSTMENT: { bg: '#dbeafe', color: '#1e40af' },
  };
  const c = cfg[type] || { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600, display: 'inline-block' }}>
      {type}
    </span>
  );
}

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface Order {
  id: number;
  voucher_number: string;
  site_name: string;
  site_city: string;
  status: string;
  total_amount: string;
  order_date: string;
  category: string;
  item_count: string;
}

interface OrderItem {
  id: number;
  sku: string;
  product: string;
  size: string | null;
  employee_name: string | null;
  quantity: number;
  qty_dispatched: number;
  qty_approved: number | null;
  unit_cost: string;
  total_cost: string;
  stock_available?: number;
  dispatch_status?: 'FULFILLED' | 'READY' | 'PARTIAL' | 'UNAVAILABLE';
}

interface OrderDetail {
  id: number;
  order_number: string;
  site_name: string;
  site_code: string;
  city: string;
  status: string;
  total_amount: string;
  created_at: string;
  dispatched_at?: string;
  dispatched_by?: string;
  received_at?: string;
  received_by?: string;
  category: string;
  requested_by: string;
  notes: string;
  items: OrderItem[];
}

interface DispatchInfo {
  order_id: number;
  items: any[];
  summary: {
    total_items: number;
    fulfilled: number;
    ready: number;
    partial: number;
    unavailable: number;
    can_dispatch_full: boolean;
    can_dispatch_partial: boolean;
  };
}

interface StockItem {
  item_id: number;
  sku: string;
  product: string;
  category: string;
  quantity_on_hand: number;
  unit: string;
  cost: string;
  warehouse_name: string;
  size?: string;
  is_active?: boolean;
}

interface StockMovement {
  id: number;
  item_id: number;
  movement_type: 'IN' | 'OUT' | 'DAMAGE' | 'ADJUSTMENT';
  quantity: number;
  reference_type: string;
  reference_id: string | null;
  reason: string;
  created_at: string;
  created_by: string | null;
  sku: string;
  product: string;
  category: string;
  cost: string;
  site_name: string | null;
  order_number: string | null;
  stock_value: string;
}

interface Site {
  id: number;
  site_code: string;
  name: string;
  city: string;
  address: string;
  contact_name: string;
  phone: string;
  email: string;
  status: string;
  fulfillment_zone: string;
  is_active: boolean;
}

interface SiteTotal {
  site_id: number;
  site_code: string;
  site_name: string;
  city: string;
  total_orders: number;
  total_items_dispatched: number;
  total_value_dispatched: string;
  last_dispatch_date: string | null;
}

type TabValue = 'dashboard' | 'orders' | 'inventory' | 'sites' | 'reports';
type ReportView = 'movements' | 'site-analysis';

interface DashboardData {
  period: { from: string; to: string };
  orders: any;
  inventory: any;
  low_stock: { count: number; items: any[] };
  movements: any;
  top_moving_items: any[];
  sites: any;
  pending_orders: any[];
  order_trend: any[];
  category_orders: any[];
  generated_at: string;
}


// ORDERZ-FILTER — Pagination component
function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }
  const btnS = (active: boolean): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 6,
    border: active ? 'none' : '0.5px solid rgba(0,0,0,0.1)',
    background: active ? '#0a0a0a' : 'transparent',
    color: active ? '#fff' : '#0a0a0a',
    fontSize: 12, cursor: active ? 'default' : 'pointer',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '8px 14px', marginTop: 8 }}>
      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>Page {page} of {totalPages}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button style={btnS(false)} onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}>‹</button>
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>…</span>
            : <button key={p} style={btnS(p === page)} onClick={() => onChange(p as number)}>{p}</button>
        )}
        <button style={btnS(false)} onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>›</button>
      </div>
      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>30 per page</span>
    </div>
  );
}

// ORDERZ-FILTER — Active filter chips
function ActiveFilters({ chips, onRemove, onClearAll }: { chips: { label: string; key: string }[]; onRemove: (key: string) => void; onClearAll: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
      {chips.map(chip => (
        <span key={chip.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.05)', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 20, padding: '3px 8px 3px 10px', fontSize: 11, color: '#0a0a0a' }}>
          {chip.label}
          <button onClick={() => onRemove(chip.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'rgba(0,0,0,0.4)', lineHeight: 1, fontFamily: 'inherit' }}>×</button>
        </span>
      ))}
      <button onClick={onClearAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#e05a5a', fontFamily: 'inherit', padding: '3px 4px' }}>Clear all</button>
    </div>
  );
}

// ORDERZ-FILTER — Checkbox filter option
function FilterCheck({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer', fontSize: 12, color: 'rgba(0,0,0,0.7)' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: '#0a0a0a', cursor: 'pointer' }} />
      <span style={{ flex: 1 }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', background: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: '1px 6px' }}>{count}</span>}
    </label>
  );
}

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────
export default function AdminPage() {
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress || 'Admin';
  
  const [activeTab, setActiveTab] = useState<TabValue>('dashboard');
  const [reportView, setReportView] = useState<ReportView>('movements');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [stockHistory, setStockHistory] = useState<StockMovement[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteTotals, setSiteTotals] = useState<SiteTotal[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Modals
  const [orderModal, setOrderModal] = useState<{ 
    open: boolean; 
    order: OrderDetail | null; 
    loading: boolean;
    dispatchInfo: DispatchInfo | null;
    customQty: Record<number, number>;
    dispatching: boolean;
    adjusting: boolean;
    adjustments: Record<number, number>; // order_item_id -> qty_approved
    savingAdjustments: boolean;
  }>({
    open: false,
    order: null,
    loading: false,
    dispatchInfo: null,
    customQty: {},
    dispatching: false,
    adjusting: false,
    adjustments: {},
    savingAdjustments: false,
  });
  const [dispatchModal, setDispatchModal] = useState<{
    open: boolean;
    loading: boolean;
    orderId: number | null;
    dispatchInfo: DispatchInfo | null;
    confirming: boolean;
    customQty: Record<number, number>; // order_item_id -> qty_to_dispatch
  }>({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false, customQty: {} });
  const [stockModal, setStockModal] = useState<{
    open: boolean;
    action: 'add' | 'dispatch';
    item: StockItem | null;
    quantity: string;
  }>({ open: false, action: 'add', item: null, quantity: '' });
  const [stockViewModal, setStockViewModal] = useState<{
    open: boolean;
    item: StockItem | null;
    history: StockMovement[];
    loading: boolean;
    action: 'none' | 'add' | 'remove';
    quantity: string;
    reason: string;
    editingCost: boolean;
    newCost: string;
  }>({ open: false, item: null, history: [], loading: false, action: 'none', quantity: '', reason: '', editingCost: false, newCost: '' });
  const [bulkReceiveModal, setBulkReceiveModal] = useState<{
    open: boolean;
    items: { item_id: number; sku: string; product: string; quantity: string }[];
    grnNumber: string;
    submitting: boolean;
  }>({ open: false, items: [], grnNumber: '', submitting: false });
  const [siteModal, setSiteModal] = useState<{
    open: boolean;
    site: Site | null;
    isNew: boolean;
  }>({ open: false, site: null, isNew: false });

  // Add Product Modal
  const [addProductModal, setAddProductModal] = useState<{
    open: boolean;
    mode: 'new' | 'add-size';
    submitting: boolean;
    product: string;
    category: string;
    sku: string;
    role: string;
    size: string;
    unit: string;
    cost: string;
    initialQuantity: string;
  }>({ open: false, mode: 'new', submitting: false, product: '', category: '', sku: '', role: 'All', size: '', unit: 'unit', cost: '0', initialQuantity: '0' });

  // Decline form state
  const [declineInput, setDeclineInput] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);

  // Site Ledger Modal
  const [siteLedgerModal, setSiteLedgerModal] = useState<{
    open: boolean;
    site: SiteTotal | null;
    items: any[];
    loading: boolean;
  }>({ open: false, site: null, items: [], loading: false });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [movementCategories, setMovementCategories] = useState<string[]>([]);
  
  // Date filter for reports (global) - default to current month
  const getDefaultDateFrom = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const getDefaultDateTo = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [dateFrom, setDateFrom] = useState<string>(getDefaultDateFrom);
  const [dateTo, setDateTo] = useState<string>(getDefaultDateTo);

  // ORDERZ-FILTER — Orders filter state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatuses, setOrderStatuses] = useState<string[]>([]);
  const [orderCategories, setOrderCategories] = useState<string[]>([]);
  const [orderSiteSearch, setOrderSiteSearch] = useState('');
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');
  const [orderAmountMin, setOrderAmountMin] = useState('');
  const [orderAmountMax, setOrderAmountMax] = useState('');
  const [orderSort, setOrderSort] = useState('date-desc');
  const [orderPage, setOrderPage] = useState(1);
  const ORDER_PAGE_SIZE = 30;

  // ORDERZ-FILTER — Inventory filter state
  const [invSearch, setInvSearch] = useState('');
  const [invCategories, setInvCategories] = useState<string[]>([]);
  const [invStockFilter, setInvStockFilter] = useState<'all'|'low'|'out'>('all');
  const [invSort, setInvSort] = useState('product-asc');
  const [invPage, setInvPage] = useState(1);
  const INV_PAGE_SIZE = 30;

  // ORDERZ-FILTER — Reports filter state
  const [repSearch, setRepSearch] = useState('');
  const [repTypes, setRepTypes] = useState<string[]>([]);
  const [repCategories, setRepCategories] = useState<string[]>([]);
  const [repSiteSearch, setRepSiteSearch] = useState('');
  const [repDateFrom, setRepDateFrom] = useState('');
  const [repDateTo, setRepDateTo] = useState('');
  const [repSort, setRepSort] = useState('date-desc');
  const [repPage, setRepPage] = useState(1);
  const REP_PAGE_SIZE = 30;

  // ORDERZ-REPORTS — report system
  const [activeReport, setActiveReport] = useState('cost-category');
  const [reportDateFrom, setReportDateFrom] = useState(
    new Date(Date.now() - 90*24*60*60*1000).toISOString().slice(0,10)
  );
  const [reportDateTo, setReportDateTo] = useState(
    new Date().toISOString().slice(0,10)
  );
  const [reportLoading, setReportLoading] = useState(false);
  const [costByCategoryData, setCostByCategoryData] = useState<any[]>([]);
  const [costBySiteData, setCostBySiteData] = useState<{sites: any[]; breakdown: any[]}>({ sites: [], breakdown: [] });
  const [orderFrequencyData, setOrderFrequencyData] = useState<any[]>([]);
  const [financeData, setFinanceData] = useState<any[]>([]);
  const [reorderData, setReorderData] = useState<any[]>([]);
  const [forecastData, setForecastData] = useState<{items: any[]; total_order_value: number}>({ items: [], total_order_value: 0 });
  const [velocityData, setVelocityData] = useState<any[]>([]);
  const [financeSiteFilter, setFinanceSiteFilter] = useState('');
  const [financeCatFilter, setFinanceCatFilter] = useState(''); // ORDERZ-REPORTS
  const [reportCatFilter, setReportCatFilter] = useState(''); // ORDERZ-REPORTS
  const [reportSiteFilter, setReportSiteFilter] = useState(''); // ORDERZ-REPORTS
  const [reportSitesList, setReportSitesList] = useState<string[]>([]); // ORDERZ-REPORTS
  const [reportCategoriesList, setReportCategoriesList] = useState<string[]>([]); // ORDERZ-REPORTS
  const [forecastLookback, setForecastLookback] = useState(90);
  const [forecastDays, setForecastDays] = useState(30);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editReorderLevel, setEditReorderLevel] = useState('0');

  // Load data functions
  const loadDashboard = async () => {
    setDashboardLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      const [dashRes, reorderRes] = await Promise.all([
        fetch(`/api/admin/dashboard?${params.toString()}`),
        fetch('/api/admin/reports/reorder'),
      ]);
      const data = await dashRes.json();
      if (data.success) setDashboardData(data.data);
      else showMessage('Error: ' + data.error, 'error');
      const reorderJson = await reorderRes.json();
      if (reorderJson.success) setReorderData(reorderJson.items || []);
    } catch {
      showMessage('Failed to load dashboard', 'error');
    }
    setDashboardLoading(false);
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders?limit=200');
      const data = await res.json();
      if (data.success) setOrders(data.data);
      else showMessage('Error: ' + data.error, 'error');
    } catch {
      showMessage('Failed to load orders', 'error');
    }
    setLoading(false);
  };

  const loadStock = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stock');
      const data = await res.json();
      if (data.success) setStock(data.data);
      else showMessage('Error: ' + data.error, 'error');
    } catch {
      showMessage('Failed to load stock', 'error');
    }
    setLoading(false);
  };

  const loadStockHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '500');
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      const res = await fetch(`/api/admin/stock/history?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setStockHistory(data.data);
        // Store available categories if returned
        if (data.categories) {
          setMovementCategories(data.categories);
        }
      }
      else showMessage('Error: ' + data.error, 'error');
    } catch {
      showMessage('Failed to load stock history', 'error');
    }
    setLoading(false);
  };

  const loadSites = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sites?limit=200');
      const data = await res.json();
      if (data.success) setSites(data.data);
      else showMessage('Error: ' + data.error, 'error');
    } catch {
      showMessage('Failed to load sites', 'error');
    }
    setLoading(false);
  };

  const loadSiteTotals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      const res = await fetch(`/api/admin/site-totals?${params.toString()}`);
      const data = await res.json();
      if (data.success) setSiteTotals(data.data);
      else showMessage('Error: ' + data.error, 'error');
    } catch {
      showMessage('Failed to load site totals', 'error');
    }
    setLoading(false);
  };

  // Load site ledger (dispatch details for a site)
  const loadSiteLedger = async (site: SiteTotal) => {
    setSiteLedgerModal({ open: true, site, items: [], loading: true });
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      const res = await fetch(`/api/admin/site-ledger/${site.site_id}?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSiteLedgerModal(prev => ({ ...prev, items: data.data.items, loading: false }));
      } else {
        showMessage('Error: ' + data.error, 'error');
        setSiteLedgerModal(prev => ({ ...prev, loading: false }));
      }
    } catch {
      showMessage('Failed to load site ledger', 'error');
      setSiteLedgerModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Download site ledger as CSV
  const downloadSiteLedgerCSV = () => {
    if (!siteLedgerModal.site || siteLedgerModal.items.length === 0) return;
    const headers = ['Voucher', 'Dispatch Date', 'SKU', 'Item', 'Size', 'Qty Requested', 'Qty Dispatched', 'Unit Cost', 'Dispatch Value'];
    const rows = siteLedgerModal.items.map(item => [
      item.voucher_number,
      item.dispatched_at ? new Date(item.dispatched_at).toLocaleDateString() : '',
      item.sku,
      item.item_name,
      item.size || '',
      item.qty_requested,
      item.qty_dispatched,
      item.unit_cost,
      parseFloat(item.dispatch_value).toFixed(2)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-ledger-${siteLedgerModal.site.site_code}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Load data on tab change
  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboard();
    else if (activeTab === 'orders') loadOrders();
    else if (activeTab === 'inventory') loadStock();
    else if (activeTab === 'sites') loadSites();
    else if (activeTab === 'reports') {
      loadStockHistory();
      loadSiteTotals();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ORDERZ-REPORTS
  useEffect(() => {
    if (activeTab === 'reports') {
      loadCurrentReport();
      if (reportSitesList.length === 0) loadReportDropdowns();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, activeTab]);

  const showMessage = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // ─────────────────────────────────────────
  // ORDERS API
  // ─────────────────────────────────────────
  const viewOrder = async (orderId: number) => {
    setOrderModal({ open: true, order: null, loading: true, dispatchInfo: null, customQty: {}, dispatching: false, adjusting: false, adjustments: {}, savingAdjustments: false });
    try {
      // Load order details and dispatch info in parallel
      const [orderRes, dispatchRes] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}`),
        fetch(`/api/admin/orders/${orderId}/dispatch`)
      ]);
      const orderData = await orderRes.json();
      const dispatchData = await dispatchRes.json();
      
      if (orderData.success) {
        // Initialize custom quantities from dispatch info
        const initialQty: Record<number, number> = {};
        if (dispatchData.success) {
          for (const item of dispatchData.data.items) {
            const remaining = item.qty_requested - item.qty_dispatched;
            if (remaining > 0) {
              initialQty[item.id] = Math.min(remaining, item.stock_available);
            }
          }
        }
        setOrderModal({ 
          open: true, 
          order: orderData.data, 
          loading: false,
          dispatchInfo: dispatchData.success ? dispatchData.data : null,
          customQty: initialQty,
          dispatching: false,
          adjusting: false,
          adjustments: {},
          savingAdjustments: false
        });
      } else {
        showMessage('Error loading order details', 'error');
        setOrderModal({ open: false, order: null, loading: false, dispatchInfo: null, customQty: {}, dispatching: false, adjusting: false, adjustments: {}, savingAdjustments: false });
      }
    } catch {
      showMessage('Failed to load order', 'error');
      setOrderModal({ open: false, order: null, loading: false, dispatchInfo: null, customQty: {}, dispatching: false, adjusting: false, adjustments: {}, savingAdjustments: false });
    }
  };

  const openDispatchModal = async (orderId: number) => {
    setDispatchModal({ open: true, loading: true, orderId, dispatchInfo: null, confirming: false, customQty: {} });
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/dispatch`);
      const data = await res.json();
      if (data.success) {
        // Initialize custom quantities with max dispatchable amounts
        const initialQty: Record<number, number> = {};
        for (const item of data.data.items) {
          const remaining = item.qty_requested - item.qty_dispatched;
          if (remaining > 0) {
            // Default to min of remaining needed and stock available
            initialQty[item.id] = Math.min(remaining, item.stock_available);
          }
        }
        setDispatchModal({ open: true, loading: false, orderId, dispatchInfo: data.data, confirming: false, customQty: initialQty });
      } else {
        showMessage('Error: ' + data.error, 'error');
        setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false, customQty: {} });
      }
    } catch {
      showMessage('Failed to load dispatch info', 'error');
      setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false, customQty: {} });
    }
  };

  const handleDispatch = async (forcePartial: boolean = false) => {
    if (!dispatchModal.orderId) return;
    setDispatchModal({ ...dispatchModal, confirming: true });
    
    // Build items array with custom quantities
    const items = Object.entries(dispatchModal.customQty)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({
        order_item_id: parseInt(id),
        qty_to_dispatch: qty
      }));
    
    try {
      const res = await fetch(`/api/admin/orders/${dispatchModal.orderId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_partial: forcePartial, items }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message, 'success');
        setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false, customQty: {} });
        setOrderModal({ open: false, order: null, loading: false, dispatchInfo: null, customQty: {}, dispatching: false, adjusting: false, adjustments: {}, savingAdjustments: false });
        loadOrders();
      } else {
        showMessage('Error: ' + data.error, 'error');
        setDispatchModal({ ...dispatchModal, confirming: false });
      }
    } catch {
      showMessage('Failed to dispatch', 'error');
      setDispatchModal({ ...dispatchModal, confirming: false });
    }
  };

  const handleDecline = async (reason: string) => {
    if (!orderModal.order) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderModal.order.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Order declined', 'success');
        setOrderModal({ open: false, order: null, loading: false, dispatchInfo: null, customQty: {}, dispatching: false, adjusting: false, adjustments: {}, savingAdjustments: false });
        loadOrders();
      } else showMessage('Error: ' + data.error, 'error');
    } catch {
      showMessage('Failed to decline order', 'error');
    }
  };

  const handleOrderModalDispatch = async () => {
    if (!orderModal.order) return;
    setOrderModal({ ...orderModal, dispatching: true });
    
    const items = Object.entries(orderModal.customQty)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({
        order_item_id: parseInt(id),
        qty_to_dispatch: qty
      }));
    
    try {
      const res = await fetch(`/api/admin/orders/${orderModal.order.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_partial: true, items }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message, 'success');
        // ORDERZ-ORDERVIEW — open dispatch note in new tab
        if (orderModal.order) {
          window.open(`/api/admin/orders/${orderModal.order.id}/dispatch-note`, '_blank');
        }
        setOrderModal({ open: false, order: null, loading: false, dispatchInfo: null, customQty: {}, dispatching: false, adjusting: false, adjustments: {}, savingAdjustments: false });
        loadOrders();
      } else {
        showMessage('Error: ' + data.error, 'error');
        setOrderModal({ ...orderModal, dispatching: false });
      }
    } catch {
      showMessage('Failed to dispatch', 'error');
      setOrderModal({ ...orderModal, dispatching: false });
    }
  };

  // ─────────────────────────────────────────
  // ORDER ADJUSTMENT
  // ─────────────────────────────────────────
  const handleSaveAdjustments = async () => {
    if (!orderModal.order) return;
    
    // Build adjustments array - only items that were changed
    const adjustments = Object.entries(orderModal.adjustments)
      .filter(([itemId, qtyApproved]) => {
        const item = orderModal.dispatchInfo?.items.find((i: any) => i.id === parseInt(itemId));
        // Only include if qty_approved is different from qty_requested
        return item && qtyApproved !== item.qty_requested && qtyApproved < item.qty_requested;
      })
      .map(([itemId, qtyApproved]) => ({
        order_item_id: parseInt(itemId),
        qty_approved: qtyApproved,
        reason: 'Adjusted by admin'
      }));

    if (adjustments.length === 0) {
      showMessage('No adjustments to save', 'info');
      setOrderModal({ ...orderModal, adjusting: false });
      return;
    }

    setOrderModal({ ...orderModal, savingAdjustments: true });
    try {
      const res = await fetch(`/api/admin/orders/${orderModal.order.id}/adjust`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustments,
          adjusted_by: 'Admin',
          adjustment_reason: 'Order quantities adjusted before dispatch'
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`Adjusted ${adjustments.length} item(s). New total: $${data.new_total_amount?.toFixed(2) || ''}`, 'success');
        setOrderModal({ ...orderModal, adjusting: false, adjustments: {}, savingAdjustments: false });
        // Reload order to show updated values
        viewOrder(orderModal.order.id);
      } else {
        showMessage('Error: ' + data.error, 'error');
        setOrderModal({ ...orderModal, savingAdjustments: false });
      }
    } catch {
      showMessage('Failed to save adjustments', 'error');
      setOrderModal({ ...orderModal, savingAdjustments: false });
    }
  };

  // ─────────────────────────────────────────
  // INVENTORY API
  // ─────────────────────────────────────────
  const addStock = async (itemId: number, quantity: number) => {
    try {
      const res = await fetch('/api/admin/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, warehouse_id: 2, quantity, reason: 'Manual add via admin' }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message, 'success');
        loadStock();
      } else showMessage('Error: ' + data.error, 'error');
    } catch {
      showMessage('Failed to add stock', 'error');
    }
  };

  const dispatchStock = async (itemId: number, quantity: number) => {
    try {
      const res = await fetch('/api/admin/stock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, warehouse_id: 2, quantity, reason: 'Manual dispatch via admin' }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message, 'success');
        loadStock();
      } else showMessage('Error: ' + data.error, 'error');
    } catch {
      showMessage('Failed to dispatch', 'error');
    }
  };

  const openStockModal = (item: StockItem, action: 'add' | 'dispatch') => {
    setStockModal({ open: true, action, item, quantity: '' });
  };

  const handleStockAction = () => {
    const qty = parseInt(stockModal.quantity);
    if (!stockModal.item || isNaN(qty) || qty <= 0) {
      showMessage('Enter a valid quantity', 'error');
      return;
    }
    if (stockModal.action === 'add') addStock(stockModal.item.item_id, qty);
    else dispatchStock(stockModal.item.item_id, qty);
    setStockModal({ ...stockModal, open: false });
  };

  // Stock View Modal Functions
  const openStockViewModal = async (item: StockItem) => {
    setEditReorderLevel(String((item as any).reorder_level || 0));
    setStockViewModal({ open: true, item, history: [], loading: true, action: 'none', quantity: '', reason: '', editingCost: false, newCost: '' });
    try {
      const res = await fetch(`/api/admin/stock/history?item_id=${item.item_id}&limit=50`);
      const data = await res.json();
      if (data.success) {
        setStockViewModal(prev => ({ ...prev, history: data.data, loading: false }));
      } else {
        showMessage('Error: ' + data.error, 'error');
        setStockViewModal(prev => ({ ...prev, loading: false }));
      }
    } catch {
      showMessage('Failed to load item history', 'error');
      setStockViewModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleStockViewAction = async () => {
    const qty = parseInt(stockViewModal.quantity);
    if (!stockViewModal.item || isNaN(qty) || qty <= 0) {
      showMessage('Enter a valid quantity', 'error');
      return;
    }
    if (stockViewModal.action === 'remove' && !stockViewModal.reason) {
      showMessage('Please select a reason', 'error');
      return;
    }

    try {
      if (stockViewModal.action === 'add') {
        const res = await fetch('/api/admin/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            item_id: stockViewModal.item.item_id, 
            warehouse_id: 2, 
            quantity: qty, 
            reason: stockViewModal.reason || 'Stock addition via admin',
            created_by: userEmail
          }),
        });
        const data = await res.json();
        if (data.success) {
          showMessage('Stock added successfully', 'success');
          loadStock();
          openStockViewModal(stockViewModal.item); // Refresh history
        } else showMessage('Error: ' + data.error, 'error');
      } else if (stockViewModal.action === 'remove') {
        // Use stock-movements API for removals with reason codes
        // Send positive quantity - trigger handles the sign based on movement_type
        const movementType = stockViewModal.reason === 'RETURN_TO_SUPPLIER' ? 'OUT' : 
                             stockViewModal.reason === 'DAMAGED' ? 'DAMAGE' : 'OUT';
        const res = await fetch('/api/admin/stock-movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            item_id: stockViewModal.item.item_id, 
            warehouse_id: 2, 
            quantity: qty,  // Positive - trigger handles the deduction
            movement_type: movementType,
            reason: stockViewModal.reason,
            created_by: userEmail
          }),
        });
        const data = await res.json();
        if (data.success) {
          showMessage('Stock removed successfully', 'success');
          loadStock();
          openStockViewModal(stockViewModal.item); // Refresh history
        } else showMessage('Error: ' + data.error, 'error');
      }
    } catch {
      showMessage('Failed to update stock', 'error');
    }
    setStockViewModal(prev => ({ ...prev, action: 'none', quantity: '', reason: '' }));
  };

  const handleUpdateCost = async () => {
    const newCost = parseFloat(stockViewModal.newCost);
    if (!stockViewModal.item || isNaN(newCost) || newCost < 0) {
      showMessage('Enter a valid cost', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/items/${stockViewModal.item.item_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost: newCost }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Unit cost updated successfully', 'success');
        loadStock();
        // Update local state
        setStockViewModal(prev => ({
          ...prev,
          item: prev.item ? { ...prev.item, cost: String(newCost) } : null,
          editingCost: false,
          newCost: ''
        }));
      } else showMessage('Error: ' + data.error, 'error');
    } catch {
      showMessage('Failed to update cost', 'error');
    }
  };

  const openBulkReceiveModal = () => {
    const items = stock.map((s) => ({ item_id: s.item_id, sku: s.sku, product: s.product, quantity: '' }));
    setBulkReceiveModal({ open: true, items, grnNumber: '', submitting: false });
  };

  const handleBulkReceive = async () => {
    const itemsToReceive = bulkReceiveModal.items
      .filter((i) => i.quantity && parseInt(i.quantity) > 0)
      .map((i) => ({ item_id: i.item_id, quantity: parseInt(i.quantity) }));

    if (itemsToReceive.length === 0) {
      showMessage('Enter at least one quantity', 'error');
      return;
    }

    setBulkReceiveModal({ ...bulkReceiveModal, submitting: true });
    try {
      const res = await fetch('/api/admin/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToReceive, warehouse_id: 2, grn_number: bulkReceiveModal.grnNumber || null }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message, 'success');
        setBulkReceiveModal({ open: false, items: [], grnNumber: '', submitting: false });
        loadStock();
      } else {
        showMessage('Error: ' + data.error, 'error');
        setBulkReceiveModal({ ...bulkReceiveModal, submitting: false });
      }
    } catch {
      showMessage('Failed to bulk receive', 'error');
      setBulkReceiveModal({ ...bulkReceiveModal, submitting: false });
    }
  };

  // ─────────────────────────────────────────
  // ADD PRODUCT
  // ─────────────────────────────────────────
  const handleAddProduct = async () => {
    if (!addProductModal.product || !addProductModal.category) {
      showMessage('Product name and category are required', 'error');
      return;
    }

    setAddProductModal({ ...addProductModal, submitting: true });
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: addProductModal.product,
          category: addProductModal.category,
          sku: addProductModal.sku || undefined,
          role: addProductModal.role || 'All',
          size: addProductModal.size || undefined,
          unit: addProductModal.unit || 'unit',
          cost: parseFloat(addProductModal.cost) || 0,
          initial_quantity: parseInt(addProductModal.initialQuantity) || 0,
          created_by: 'Admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`Product "${data.item.product}" added with SKU: ${data.item.sku}`, 'success');
        setAddProductModal({ open: false, mode: 'new', submitting: false, product: '', category: '', sku: '', role: 'All', size: '', unit: 'unit', cost: '0', initialQuantity: '0' });
        loadStock(); // Refresh inventory
      } else {
        showMessage('Error: ' + data.error, 'error');
        setAddProductModal({ ...addProductModal, submitting: false });
      }
    } catch {
      showMessage('Failed to add product', 'error');
      setAddProductModal({ ...addProductModal, submitting: false });
    }
  };

  // ─────────────────────────────────────────
  // SITES MANAGEMENT
  // ─────────────────────────────────────────
  const openSiteModal = (site: Site | null, isNew: boolean = false) => {
    if (isNew) {
      setSiteModal({
        open: true,
        site: {
          id: 0,
          site_code: '',
          name: '',
          city: '',
          address: '',
          contact_name: '',
          phone: '',
          email: '',
          status: 'ACTIVE',
          fulfillment_zone: 'DISPATCH',
          is_active: true,
        },
        isNew: true,
      });
    } else {
      setSiteModal({ open: true, site, isNew: false });
    }
  };

  const saveSite = async () => {
    if (!siteModal.site) return;
    const site = siteModal.site;
    
    try {
      if (siteModal.isNew) {
        const res = await fetch('/api/sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: site.name,
            city: site.city,
            address: site.address,
            contact_name: site.contact_name,
            email: site.email,
            phone: site.phone,
            fulfillment_zone: site.fulfillment_zone,
            // site_code will be auto-generated from name if not provided
          }),
        });
        const data = await res.json();
        if (data.success) {
          showMessage('Site created successfully', 'success');
          setSiteModal({ open: false, site: null, isNew: false });
          loadSites();
        } else showMessage('Error: ' + data.error, 'error');
      } else {
        const res = await fetch(`/api/sites/${site.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: site.name,
            city: site.city,
            address: site.address,
            contact_name: site.contact_name,
            email: site.email,
            phone: site.phone,
            fulfillment_zone: site.fulfillment_zone,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showMessage('Site updated successfully', 'success');
          setSiteModal({ open: false, site: null, isNew: false });
          loadSites();
        } else showMessage('Error: ' + data.error, 'error');
      }
    } catch {
      showMessage('Failed to save site', 'error');
    }
  };

  // ─────────────────────────────────────────
  // DOWNLOAD REPORTS
  // ─────────────────────────────────────────
  const downloadStockMovementsCSV = () => {
    if (stockHistory.length === 0) {
      showMessage('No stock movements to download', 'info');
      return;
    }
    
    const headers = ['Date', 'Time', 'SKU', 'Product', 'Category', 'Type', 'Quantity', 'Value ($)', 'Destination', 'Order #', 'Reference'];
    const rows = stockHistory.map(m => [
      new Date(m.created_at).toLocaleDateString('en-GB'),
      new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      m.sku,
      m.product,
      m.category || '',
      m.movement_type,
      Math.abs(m.quantity),
      (Math.abs(m.quantity) * parseFloat(m.cost || '0')).toFixed(2),
      m.site_name || '',
      m.order_number || '',
      m.reason || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-movements-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('Stock movements report downloaded', 'success');
  };

  const downloadSiteAnalysisCSV = () => {
    if (siteTotals.length === 0) {
      showMessage('No site data to download', 'info');
      return;
    }
    
    const headers = ['Site Code', 'Site Name', 'City', 'Total Orders', 'Items Dispatched', 'Total Value ($)', 'Last Dispatch'];
    const rows = siteTotals.map(s => [
      s.site_code,
      s.site_name,
      s.city,
      s.total_orders,
      s.total_items_dispatched,
      parseFloat(s.total_value_dispatched || '0').toFixed(2),
      s.last_dispatch_date ? new Date(s.last_dispatch_date).toLocaleDateString('en-GB') : ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('Site analysis report downloaded', 'success');
  };

  // ─────────────────────────────────────────
  // FILTERED + SORTED + PAGINATED DATA
  // ORDERZ-FILTER
  // ─────────────────────────────────────────

  // Orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      result = result.filter(o =>
        (o.voucher_number || '').toLowerCase().includes(q) ||
        (o.site_name || '').toLowerCase().includes(q) ||
        (o.site_city || '').toLowerCase().includes(q)
      );
    }
    if (orderStatuses.length > 0) {
      result = result.filter(o => orderStatuses.includes(o.status));
    }
    if (orderCategories.length > 0) {
      result = result.filter(o => orderCategories.includes(o.category));
    }
    if (orderSiteSearch.trim()) {
      const q = orderSiteSearch.toLowerCase();
      result = result.filter(o => (o.site_name || '').toLowerCase().includes(q));
    }
    if (orderDateFrom) {
      result = result.filter(o => o.order_date >= orderDateFrom);
    }
    if (orderDateTo) {
      result = result.filter(o => o.order_date <= orderDateTo + 'T23:59:59');
    }
    if (orderAmountMin) {
      result = result.filter(o => Number(o.total_amount) >= Number(orderAmountMin));
    }
    if (orderAmountMax) {
      result = result.filter(o => Number(o.total_amount) <= Number(orderAmountMax));
    }
    result.sort((a, b) => {
      switch (orderSort) {
        case 'date-desc': return new Date(b.order_date).getTime() - new Date(a.order_date).getTime();
        case 'date-asc': return new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
        case 'total-desc': return Number(b.total_amount) - Number(a.total_amount);
        case 'total-asc': return Number(a.total_amount) - Number(b.total_amount);
        case 'site-asc': return (a.site_name || '').localeCompare(b.site_name || '');
        case 'items-desc': return Number(b.item_count || 0) - Number(a.item_count || 0);
        default: return 0;
      }
    });
    return result;
  }, [orders, orderSearch, orderStatuses, orderCategories, orderSiteSearch, orderDateFrom, orderDateTo, orderAmountMin, orderAmountMax, orderSort]);

  useEffect(() => { setOrderPage(1); }, [orderSearch, orderStatuses, orderCategories, orderSiteSearch, orderDateFrom, orderDateTo, orderAmountMin, orderAmountMax, orderSort]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDER_PAGE_SIZE));
  const pagedOrders = filteredOrders.slice((orderPage - 1) * ORDER_PAGE_SIZE, orderPage * ORDER_PAGE_SIZE);

  const orderStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return counts;
  }, [orders]);

  const orderCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { if (o.category) counts[o.category] = (counts[o.category] || 0) + 1; });
    return counts;
  }, [orders]);

  // Inventory
  const filteredStock = useMemo(() => {
    let result = [...stock];
    if (invSearch.trim()) {
      const q = invSearch.toLowerCase();
      result = result.filter(s =>
        (s.product || '').toLowerCase().includes(q) ||
        (s.sku || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q)
      );
    }
    if (invCategories.length > 0) {
      result = result.filter(s => invCategories.includes(s.category));
    }
    if (invStockFilter === 'out') {
      result = result.filter(s => s.quantity_on_hand <= 0);
    } else if (invStockFilter === 'low') {
      result = result.filter(s => s.quantity_on_hand > 0 && s.quantity_on_hand <= 5);
    }
    result.sort((a, b) => {
      switch (invSort) {
        case 'product-asc': return (a.product || '').localeCompare(b.product || '');
        case 'stock-desc': return b.quantity_on_hand - a.quantity_on_hand;
        case 'stock-asc': return a.quantity_on_hand - b.quantity_on_hand;
        case 'value-desc': return (b.quantity_on_hand * parseFloat(b.cost)) - (a.quantity_on_hand * parseFloat(a.cost));
        case 'sku-asc': return (a.sku || '').localeCompare(b.sku || '');
        default: return 0;
      }
    });
    return result;
  }, [stock, invSearch, invCategories, invStockFilter, invSort]);

  useEffect(() => { setInvPage(1); }, [invSearch, invCategories, invStockFilter, invSort]);

  const invTotalPages = Math.max(1, Math.ceil(filteredStock.length / INV_PAGE_SIZE));
  const pagedStock = filteredStock.slice((invPage - 1) * INV_PAGE_SIZE, invPage * INV_PAGE_SIZE);

  const invCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    stock.forEach(s => { if (s.category) counts[s.category] = (counts[s.category] || 0) + 1; });
    return counts;
  }, [stock]);

  // Reports
  const filteredHistory = useMemo(() => {
    let result = [...stockHistory];
    if (repSearch.trim()) {
      const q = repSearch.toLowerCase();
      result = result.filter(h =>
        (h.product || '').toLowerCase().includes(q) ||
        (h.sku || '').toLowerCase().includes(q) ||
        (h.site_name || '').toLowerCase().includes(q) ||
        (h.order_number || '').toLowerCase().includes(q)
      );
    }
    if (repTypes.length > 0) {
      result = result.filter(h => repTypes.includes(h.movement_type));
    }
    if (repCategories.length > 0) {
      result = result.filter(h => repCategories.includes(h.category));
    }
    if (repSiteSearch.trim()) {
      const q = repSiteSearch.toLowerCase();
      result = result.filter(h => (h.site_name || '').toLowerCase().includes(q));
    }
    if (repDateFrom) {
      result = result.filter(h => h.created_at >= repDateFrom);
    }
    if (repDateTo) {
      result = result.filter(h => h.created_at <= repDateTo + 'T23:59:59');
    }
    result.sort((a, b) => {
      switch (repSort) {
        case 'date-desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date-asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'qty-desc': return Math.abs(Number(b.quantity)) - Math.abs(Number(a.quantity));
        default: return 0;
      }
    });
    return result;
  }, [stockHistory, repSearch, repTypes, repCategories, repSiteSearch, repDateFrom, repDateTo, repSort]);

  useEffect(() => { setRepPage(1); }, [repSearch, repTypes, repCategories, repSiteSearch, repDateFrom, repDateTo, repSort]);

  const repTotalPages = Math.max(1, Math.ceil(filteredHistory.length / REP_PAGE_SIZE));
  const pagedHistory = filteredHistory.slice((repPage - 1) * REP_PAGE_SIZE, repPage * REP_PAGE_SIZE);

  const repCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    stockHistory.forEach(h => { if (h.category) counts[h.category] = (counts[h.category] || 0) + 1; });
    return counts;
  }, [stockHistory]);

  const filteredSites = sites.filter(site => {
    const matchesSearch = searchQuery === '' ||
      (site.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (site.site_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (site.city || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredTotals = siteTotals.filter(total => {
    const matchesSearch = searchQuery === '' ||
      (total.site_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (total.site_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (total.city || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const uniqueCategories = Array.from(new Set(stock.map(s => s.category)));
  const uniqueOrderCategories = Array.from(new Set(orders.map(o => o.category).filter(Boolean)));
  const uniqueStatuses = Array.from(new Set(orders.map(o => o.status)));
  const uniqueProducts = Array.from(new Set(stock.map(s => s.product))).sort();

  // ORDERZ-FILTER
  const generateSku = (productName: string, sizeName: string): string => {
    if (!sizeName.trim()) return '';
    const existingItems = stock.filter(s => s.product === productName && s.is_active);
    if (existingItems.length === 0) return '';
    const skus = existingItems.map(s => s.sku);
    const sizeCode = sizeName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    // Find longest common prefix across all SKUs
    let prefix = skus[0];
    for (const sku of skus.slice(1)) {
      let i = 0;
      while (i < prefix.length && i < sku.length && prefix[i] === sku[i]) i++;
      prefix = prefix.slice(0, i);
    }
    // Remove trailing dash/underscore/space from prefix
    prefix = prefix.replace(/[-_\s]+$/, '');
    // Safety: if prefix < 3 chars, SKUs are inconsistent — let user type manually
    if (prefix.length < 3) return '';
    return prefix + '-' + sizeCode;
  };

  const handleRefresh = () => {
    if (activeTab === 'dashboard') loadDashboard();
    else if (activeTab === 'orders') loadOrders();
    else if (activeTab === 'inventory') loadStock();
    else if (activeTab === 'sites') loadSites();
    else if (activeTab === 'reports') { loadStockHistory(); loadSiteTotals(); }
  };

  // ORDERZ-REPORTS
  // ORDERZ-REPORTS — fetch sites + categories for report filter dropdowns
  const loadReportDropdowns = async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        fetch('/api/sites?limit=500'),
        fetch('/api/admin/inventory?limit=1000'),
      ]);
      const sData = await sRes.json();
      const cData = await cRes.json();
      if (sData.success) setReportSitesList(sData.data.map((s: any) => s.name as string).sort());
      if (cData.success) {
        const cats = Array.from(new Set(cData.data.map((i: any) => i.category as string))).sort() as string[];
        setReportCategoriesList(cats);
      }
    } catch { /* silent */ }
  };

  const loadCurrentReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({ from: reportDateFrom, to: reportDateTo });

      if (activeReport === 'cost-category') {
        if (reportCatFilter) params.set('category', reportCatFilter); // ORDERZ-REPORTS
        if (reportSiteFilter) params.set('site', reportSiteFilter); // ORDERZ-REPORTS
        const r = await fetch(`/api/admin/reports/cost-by-category?${params}`);
        const d = await r.json();
        if (d.success) setCostByCategoryData(d.data);
      } else if (activeReport === 'cost-site') {
        const r = await fetch(`/api/admin/reports/cost-by-site?${params}`);
        const d = await r.json();
        if (d.success) setCostBySiteData(d);
      } else if (activeReport === 'frequency') {
        const r = await fetch(`/api/admin/reports/order-frequency?${params}`);
        const d = await r.json();
        if (d.success) setOrderFrequencyData(d.data);
      } else if (activeReport === 'finance') {
        const fp = new URLSearchParams({ from: reportDateFrom, to: reportDateTo, ...(financeSiteFilter ? { site: financeSiteFilter } : {}) });
        const r = await fetch(`/api/admin/reports/finance?${fp}`);
        const d = await r.json();
        if (d.success) setFinanceData(d.data);
      } else if (activeReport === 'reorder') {
        const r = await fetch('/api/admin/reports/reorder');
        const d = await r.json();
        if (d.success) setReorderData(d.items);
      } else if (activeReport === 'forecast') {
        const fp = new URLSearchParams({ days: String(forecastLookback), forecast: String(forecastDays) });
        const r = await fetch(`/api/admin/reports/forecast?${fp}`);
        const d = await r.json();
        if (d.success) setForecastData(d);
      } else if (activeReport === 'velocity') {
        const r = await fetch('/api/admin/reports/velocity');
        const d = await r.json();
        if (d.success) setVelocityData(d.items);
      }
    } catch {
      showMessage('Failed to load report', 'error');
    } finally {
      setReportLoading(false);
    }
  };

  // ORDERZ-REPORTS
  const handleSaveReorderLevel = async () => {
    if (!stockViewModal.item) return;
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: stockViewModal.item.item_id, reorder_level: parseInt(editReorderLevel) }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Reorder level saved', 'success');
        loadStock();
      } else {
        showMessage('Error: ' + data.error, 'error');
      }
    } catch {
      showMessage('Failed to save', 'error');
    }
  };

  const handleDeleteItem = async () => {
    if (!stockViewModal.item) return;
    const { sku, product, item_id } = stockViewModal.item;
    if (!window.confirm(`Deactivate "${product}" (${sku})?\n\nThis will hide it from inventory and Excel. Stock history is preserved.`)) return;
    try {
      const res = await fetch(`/api/admin/inventory?item_id=${item_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showMessage(`${sku} deactivated`, 'success');
        setStockViewModal({ open: false, item: null, history: [], loading: false, action: 'none', quantity: '', reason: '', editingCost: false, newCost: '' });
        loadStock();
      } else {
        showMessage('Error: ' + data.error, 'error');
      }
    } catch {
      showMessage('Failed to delete item', 'error');
    }
  };

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
    // ORDERZ-FILTER — shared filter styles
    const filterPanel: React.CSSProperties = {
      width: 240, flexShrink: 0, background: '#fff',
      border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14,
      overflow: 'hidden', alignSelf: 'flex-start',
      position: 'sticky', top: 72,
    };
    const fpSection: React.CSSProperties = { padding: '12px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' };
    const fpLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, display: 'block' };
    const fpInput: React.CSSProperties = { width: '100%', background: 'rgba(0,0,0,0.04)', border: '0.5px solid transparent', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', color: '#0a0a0a', outline: 'none' };
    const sortBar: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '8px 14px', marginBottom: 8 };
    const catColor: Record<string, string> = { Uniforms: '#ede9fe', Consumables: '#fef3c7', PPE: '#d1fae5', Stationery: '#dbeafe', Equipment: '#fee2e2', Safety: '#dcfce7' };
  const thStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.06em', padding: '10px 14px', textAlign: 'left', background: 'rgba(0,0,0,0.02)', borderBottom: '0.5px solid rgba(0,0,0,0.08)' };
  const tdStyle: React.CSSProperties = { fontSize: 13, color: '#0a0a0a', padding: '11px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.05)', verticalAlign: 'middle' };
  const btnPrimary: React.CSSProperties = { background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };
  const btnSecondary: React.CSSProperties = { background: 'transparent', color: '#0a0a0a', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
  const btnDanger: React.CSSProperties = { background: '#ffe4e6', color: '#9f1239', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };
  const inputStyle: React.CSSProperties = { border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const selectStyle: React.CSSProperties = { border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' };

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <style>{`
        .pill-btn { transition: all 0.15s; }
        .pill-btn:hover { opacity: 0.8; }
        .data-row { transition: background 0.08s; }
        .data-row:hover td { background: rgba(0,0,0,0.015) !important; }
        .icon-btn { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:8px; border:none; background:transparent; cursor:pointer; color:rgba(0,0,0,0.45); font-size:17px; transition:background 0.1s; }
        .icon-btn:hover { background: rgba(0,0,0,0.06); }
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 15px; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ── Sticky frosted header ── */}
      <header className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 300, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16 }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: '#0a0a0a', minWidth: 140 }}>Redan Coupon</span>
        <nav style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.04)', borderRadius: 24, padding: 3, gap: 2 }}>
            {(['dashboard', 'orders', 'inventory', 'sites', 'reports'] as TabValue[]).map(tab => (
              <button key={tab} className="pill-btn" onClick={() => { setActiveTab(tab); setSearchQuery(''); setStatusFilter('all'); setCategoryFilter('all'); setTypeFilter('all'); }} style={{ padding: '5px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab ? 500 : 400, fontFamily: 'inherit', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#0a0a0a' : 'rgba(0,0,0,0.5)', boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </nav>
        <div style={{ minWidth: 140, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          <button className="icon-btn" onClick={handleRefresh} title="Refresh">↻</button>
          <UserButton />
        </div>
      </header>

      {/* ── Main content ── */}
      <main style={{ paddingTop: 72, paddingBottom: 48, paddingLeft: 24, paddingRight: 24, maxWidth: 1400, margin: '0 auto' }}>

        {/* ─── DASHBOARD ─── */}
        {activeTab === 'dashboard' && (
          <div>
            {dashboardLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><CircularProgress /></div>
            ) : dashboardData ? (
              <>
                {/* Metric strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14, marginBottom: 24, overflow: 'hidden' }}>
                  {[
                    { label: 'Pending Orders', value: dashboardData.orders.pending_orders, sub: `$${Number(dashboardData.orders.pending_value || 0).toLocaleString()}`, color: '#f59e0b' },
                    { label: 'Dispatched', value: dashboardData.orders.dispatched_orders, sub: null, color: '#3b82f6' },
                    { label: 'Low / Out Stock', value: dashboardData.low_stock.count, sub: null, color: '#f43f5e' },
                    { label: 'Inventory Value', value: `$${Number(dashboardData.inventory.total_stock_value || 0).toLocaleString()}`, sub: `${dashboardData.inventory.total_items} items`, color: '#0a0a0a' },
                  ].map((s, i) => (
                    <div key={i} style={{ padding: '20px 24px', borderRight: i < 3 ? '0.5px solid rgba(0,0,0,0.08)' : 'none' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(0,0,0,0.4)', marginBottom: 8 }}>{s.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      {s.sub && <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginTop: 4 }}>{s.sub}</div>}
                    </div>
                  ))}
                </div>
                {/* Two-column */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                  {/* Pending orders table */}
                  <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Pending Orders</span>
                      <button onClick={() => setActiveTab('orders')} style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>{['Voucher','Site','Category','Items','Date',''].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                      <tbody>
                        {(dashboardData.pending_orders || []).slice(0, 8).map((o: any) => (
                          <tr key={o.id} className="data-row">
                            <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 11, background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '2px 7px' }}>{o.voucher_number || o.order_number}</span></td>
                            <td style={tdStyle}>{o.site_name}</td>
                            <td style={{ ...tdStyle, color: 'rgba(0,0,0,0.5)' }}>{o.category || '—'}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{o.item_count}</td>
                            <td style={{ ...tdStyle, fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>{new Date(o.order_date || o.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}</td>
                            <td style={tdStyle}><button onClick={() => viewOrder(o.id)} style={{ ...btnSecondary, padding: '4px 12px', fontSize: 12 }}>View</button></td>
                          </tr>
                        ))}
                        {(!dashboardData.pending_orders || dashboardData.pending_orders.length === 0) && (
                          <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>No pending orders</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Sidebar cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '16px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Low Stock Alert</div>
                      {dashboardData.low_stock.items.slice(0, 5).map((item: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < Math.min(dashboardData.low_stock.items.length, 5) - 1 ? '0.5px solid rgba(0,0,0,0.05)' : 'none' }}>
                          <span style={{ fontSize: 12 }}>{item.product}{item.size ? ` (${item.size})` : ''}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: item.quantity_on_hand === 0 ? '#9f1239' : '#92400e', background: item.quantity_on_hand === 0 ? '#ffe4e6' : '#fef3c7', borderRadius: 10, padding: '1px 8px' }}>{item.quantity_on_hand}</span>
                        </div>
                      ))}
                      {dashboardData.low_stock.items.length === 0 && <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)' }}>All stocked up!</div>}
                    </div>
                    {/* Reorder Alert card */}
                    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Reorder Alert</div>
                        {reorderData.length > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 600, background: '#fef2f2', color: '#dc2626', borderRadius: 10, padding: '2px 8px' }}>
                            {reorderData.length} item{reorderData.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {reorderData.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)' }}>All items above reorder level</div>
                      ) : (
                        reorderData.slice(0, 5).map((item: any, i: number) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < Math.min(reorderData.length, 5) - 1 ? '0.5px solid rgba(0,0,0,0.05)' : 'none' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product}{item.size ? ` (${item.size})` : ''}</div>
                              <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)' }}>{item.sku}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: Number(item.current_stock) === 0 ? '#9f1239' : '#b45309', background: Number(item.current_stock) === 0 ? '#ffe4e6' : '#fef3c7', borderRadius: 10, padding: '1px 8px' }}>
                                {item.current_stock} / {item.reorder_level}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                      {reorderData.length > 5 && (
                        <button onClick={() => { setActiveTab('reports'); setActiveReport('reorder'); }} style={{ fontSize: 11, color: '#378add', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0 0', fontFamily: 'inherit' }}>
                          +{reorderData.length - 5} more → View all
                        </button>
                      )}
                    </div>
                    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '16px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Active Sites</div>
                      <div style={{ fontSize: 28, fontWeight: 600 }}>{dashboardData.sites.active_sites}</div>
                    </div>
                    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '16px 20px', flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Orders by Category</div>
                      {(dashboardData.category_orders || []).slice(0, 6).map((cat: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                          <span style={{ fontSize: 12 }}>{cat.category}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(0,0,0,0.5)' }}>{cat.order_count || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : <div style={{ textAlign: 'center', padding: 80, color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>No data loaded.</div>}
          </div>
        )}

        {/* ─── ORDERS ─── ORDERZ-FILTER */}
        {activeTab === 'orders' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Orders</h1>
              <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>{filteredOrders.length} of {orders.length}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {/* Filter panel */}
              <div style={filterPanel}>
                <div style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Filters</span>
                  <button onClick={() => { setOrderSearch(''); setOrderStatuses([]); setOrderCategories([]); setOrderSiteSearch(''); setOrderDateFrom(''); setOrderDateTo(''); setOrderAmountMin(''); setOrderAmountMax(''); }} style={{ background: 'none', border: 'none', fontSize: 11, color: '#378add', cursor: 'pointer', fontFamily: 'inherit' }}>Clear all</button>
                </div>
                <div style={fpSection}>
                  <span style={fpLabel}>Search</span>
                  <input style={fpInput} placeholder="Order # or site…" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
                </div>
                <div style={fpSection}>
                  <span style={fpLabel}>Status</span>
                  {['PENDING','DISPATCHED','RECEIVED','PARTIAL_DISPATCH','DECLINED'].map(s => (
                    <FilterCheck key={s} label={s === 'PARTIAL_DISPATCH' ? 'Partial' : s.charAt(0) + s.slice(1).toLowerCase()} count={orderStatusCounts[s] || 0} checked={orderStatuses.includes(s)} onChange={() => setOrderStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                  ))}
                </div>
                <div style={fpSection}>
                  <span style={fpLabel}>Category</span>
                  {Array.from(new Set(orders.map(o => o.category).filter(Boolean))).sort().map(cat => (
                    <FilterCheck key={cat} label={cat} count={orderCategoryCounts[cat] || 0} checked={orderCategories.includes(cat)} onChange={() => setOrderCategories(prev => prev.includes(cat) ? prev.filter(x => x !== cat) : [...prev, cat])} />
                  ))}
                </div>
                <div style={fpSection}>
                  <span style={fpLabel}>Site</span>
                  <input style={fpInput} placeholder="Search site…" value={orderSiteSearch} onChange={e => setOrderSiteSearch(e.target.value)} />
                </div>
                <div style={fpSection}>
                  <span style={fpLabel}>Date range</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {[{label:'Today',days:0},{label:'7d',days:7},{label:'30d',days:30}].map(({label,days}) => (
                      <button key={label} onClick={() => { const to=new Date(),from=new Date(); from.setDate(from.getDate()-days); setOrderDateTo(to.toISOString().slice(0,10)); setOrderDateFrom(from.toISOString().slice(0,10)); }} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.12)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'rgba(0,0,0,0.6)' }}>{label}</button>
                    ))}
                  </div>
                  <input type="date" style={{ ...fpInput, marginBottom: 5 }} value={orderDateFrom} onChange={e => setOrderDateFrom(e.target.value)} />
                  <input type="date" style={fpInput} value={orderDateTo} onChange={e => setOrderDateTo(e.target.value)} />
                </div>
                <div style={{ ...fpSection, borderBottom: 'none' }}>
                  <span style={fpLabel}>Amount ($)</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input style={{ ...fpInput, width: '50%' }} placeholder="Min" type="number" value={orderAmountMin} onChange={e => setOrderAmountMin(e.target.value)} />
                    <input style={{ ...fpInput, width: '50%' }} placeholder="Max" type="number" value={orderAmountMax} onChange={e => setOrderAmountMax(e.target.value)} />
                  </div>
                </div>
              </div>
              {/* Right: sort + table + pagination */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={sortBar}>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>Sort by</span>
                  <select value={orderSort} onChange={e => setOrderSort(e.target.value)} style={{ border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 7, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit', background: 'rgba(0,0,0,0.03)', color: '#0a0a0a', cursor: 'pointer', outline: 'none' }}>
                    <option value="date-desc">Date — newest</option>
                    <option value="date-asc">Date — oldest</option>
                    <option value="total-desc">Total — high to low</option>
                    <option value="total-asc">Total — low to high</option>
                    <option value="site-asc">Site — A to Z</option>
                    <option value="items-desc">Items — most first</option>
                  </select>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}>{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}{filteredOrders.length !== orders.length ? ` (filtered from ${orders.length})` : ''}</span>
                </div>
                <ActiveFilters
                  chips={[
                    ...(orderSearch ? [{ label: `"${orderSearch}"`, key: 'search' }] : []),
                    ...orderStatuses.map(s => ({ label: s === 'PARTIAL_DISPATCH' ? 'Partial' : s.charAt(0) + s.slice(1).toLowerCase(), key: `status-${s}` })),
                    ...orderCategories.map(c => ({ label: c, key: `cat-${c}` })),
                    ...(orderSiteSearch ? [{ label: `Site: ${orderSiteSearch}`, key: 'site' }] : []),
                    ...(orderDateFrom ? [{ label: `From: ${orderDateFrom}`, key: 'from' }] : []),
                    ...(orderDateTo ? [{ label: `To: ${orderDateTo}`, key: 'to' }] : []),
                    ...(orderAmountMin ? [{ label: `Min: $${orderAmountMin}`, key: 'amin' }] : []),
                    ...(orderAmountMax ? [{ label: `Max: $${orderAmountMax}`, key: 'amax' }] : []),
                  ]}
                  onRemove={key => {
                    if (key === 'search') setOrderSearch('');
                    else if (key.startsWith('status-')) setOrderStatuses(p => p.filter(s => `status-${s}` !== key));
                    else if (key.startsWith('cat-')) setOrderCategories(p => p.filter(c => `cat-${c}` !== key));
                    else if (key === 'site') setOrderSiteSearch('');
                    else if (key === 'from') setOrderDateFrom('');
                    else if (key === 'to') setOrderDateTo('');
                    else if (key === 'amin') setOrderAmountMin('');
                    else if (key === 'amax') setOrderAmountMax('');
                  }}
                  onClearAll={() => { setOrderSearch(''); setOrderStatuses([]); setOrderCategories([]); setOrderSiteSearch(''); setOrderDateFrom(''); setOrderDateTo(''); setOrderAmountMin(''); setOrderAmountMax(''); }}
                />
                {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><CircularProgress /></div> : (
                  <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>
                        {['Order #','Site','Category','Status','Total','Date','Items',''].map(h => (
                          <th key={h} style={{ ...thStyle, textAlign: h === 'Total' ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {pagedOrders.map(order => (
                          <tr key={order.id} className="data-row" style={{ cursor: 'pointer' }} onClick={() => viewOrder(order.id)}>
                            <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 11, background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '2px 7px' }}>{order.voucher_number}</span></td>
                            <td style={tdStyle}>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{order.site_name}</div>
                              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', marginTop: 1 }}>{order.site_city}</div>
                            </td>
                            <td style={tdStyle}><span style={{ background: catColor[order.category] || '#f3f4f6', color: '#0a0a0a', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>{order.category || '—'}</span></td>
                            <td style={tdStyle}><StatusBadge status={order.status} /></td>
                            <td style={{ ...tdStyle, fontWeight: 600, textAlign: 'right' }}>${parseFloat(order.total_amount).toFixed(2)}</td>
                            <td style={{ ...tdStyle, fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>{new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{order.item_count}</td>
                            <td style={tdStyle}><button onClick={e => { e.stopPropagation(); viewOrder(order.id); }} style={{ ...btnSecondary, padding: '4px 12px', fontSize: 12 }}>View</button></td>
                          </tr>
                        ))}
                        {pagedOrders.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>No orders match your filters</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination page={orderPage} totalPages={orderTotalPages} onChange={setOrderPage} />
              </div>
            </div>
          </div>
        )}

        {/* ─── INVENTORY ─── ORDERZ-FILTER */}
        {activeTab === 'inventory' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Inventory</h1>
              <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>{filteredStock.length} of {stock.length}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => window.open('/api/admin/inventory/export?format=pdf', '_blank')} style={btnSecondary}>Export PDF</button>
              <button onClick={() => { const a = document.createElement('a'); a.href = '/api/admin/inventory/export?format=csv'; a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`; a.click(); }} style={btnSecondary}>Export CSV</button>
              <button onClick={openBulkReceiveModal} style={btnSecondary}>Bulk Receive</button>
              <button onClick={() => setAddProductModal({ open: true, mode: 'new', submitting: false, product: '', category: '', sku: '', role: 'All', size: '', unit: 'unit', cost: '0', initialQuantity: '0' })} style={btnPrimary}>+ Add Product</button>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {/* Filter panel */}
              <div style={filterPanel}>
                <div style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Filters</span>
                  <button onClick={() => { setInvSearch(''); setInvCategories([]); setInvStockFilter('all'); }} style={{ background: 'none', border: 'none', fontSize: 11, color: '#378add', cursor: 'pointer', fontFamily: 'inherit' }}>Clear all</button>
                </div>
                <div style={fpSection}>
                  <span style={fpLabel}>Search</span>
                  <input style={fpInput} placeholder="Product or SKU…" value={invSearch} onChange={e => setInvSearch(e.target.value)} />
                </div>
                <div style={fpSection}>
                  <span style={fpLabel}>Category</span>
                  {Array.from(new Set(stock.map(s => s.category))).sort().map(cat => (
                    <FilterCheck key={cat} label={cat} count={invCategoryCounts[cat] || 0} checked={invCategories.includes(cat)} onChange={() => setInvCategories(prev => prev.includes(cat) ? prev.filter(x => x !== cat) : [...prev, cat])} />
                  ))}
                </div>
                <div style={{ ...fpSection, borderBottom: 'none' }}>
                  <span style={fpLabel}>Stock level</span>
                  {([['all','All items'],['low','Low (≤ 5)'],['out','Out of stock']] as const).map(([v,l]) => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer', fontSize: 12, color: 'rgba(0,0,0,0.7)' }}>
                      <input type="radio" name="invStock" checked={invStockFilter === v} onChange={() => setInvStockFilter(v)} style={{ accentColor: '#0a0a0a', cursor: 'pointer' }} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              {/* Right: sort + table + pagination */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={sortBar}>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>Sort by</span>
                  <select value={invSort} onChange={e => setInvSort(e.target.value)} style={{ border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 7, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit', background: 'rgba(0,0,0,0.03)', color: '#0a0a0a', cursor: 'pointer', outline: 'none' }}>
                    <option value="product-asc">Product A–Z</option>
                    <option value="stock-desc">Stock — high to low</option>
                    <option value="stock-asc">Stock — low to high</option>
                    <option value="value-desc">Value — high to low</option>
                    <option value="sku-asc">SKU — A to Z</option>
                  </select>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}>{filteredStock.length} item{filteredStock.length !== 1 ? 's' : ''}{filteredStock.length !== stock.length ? ` (filtered from ${stock.length})` : ''}</span>
                </div>
                <ActiveFilters
                  chips={[
                    ...(invSearch ? [{ label: `"${invSearch}"`, key: 'search' }] : []),
                    ...invCategories.map(c => ({ label: c, key: `cat-${c}` })),
                    ...(invStockFilter !== 'all' ? [{ label: invStockFilter === 'low' ? 'Low stock' : 'Out of stock', key: 'stock' }] : []),
                  ]}
                  onRemove={key => {
                    if (key === 'search') setInvSearch('');
                    else if (key.startsWith('cat-')) setInvCategories(p => p.filter(c => `cat-${c}` !== key));
                    else if (key === 'stock') setInvStockFilter('all');
                  }}
                  onClearAll={() => { setInvSearch(''); setInvCategories([]); setInvStockFilter('all'); }}
                />
                {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><CircularProgress /></div> : (
                  <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>
                        {['SKU','Product','Size','Category','Stock','Unit Cost','Value',''].map(h => (
                          <th key={h} style={{ ...thStyle, textAlign: h === 'Stock' || h === 'Unit Cost' || h === 'Value' ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {pagedStock.map(item => {
                          const qty = item.quantity_on_hand;
                          const qtyColor = qty === 0 ? '#9f1239' : qty < 10 ? '#92400e' : '#065f46';
                          const qtyBg = qty === 0 ? '#ffe4e6' : qty < 10 ? '#fef3c7' : 'transparent';
                          const val = qty * parseFloat(item.cost);
                          return (
                            <tr key={item.item_id} className="data-row" style={{ cursor: 'pointer' }} onClick={() => openStockViewModal(item)}>
                              <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 11, background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '2px 7px' }}>{item.sku}</span></td>
                              <td style={{ ...tdStyle, fontWeight: 500 }}>{item.product}</td>
                              <td style={{ ...tdStyle, color: 'rgba(0,0,0,0.4)' }}>{(item as any).size || '—'}</td>
                              <td style={{ ...tdStyle, color: 'rgba(0,0,0,0.5)' }}>{item.category}</td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}><span style={{ fontWeight: 600, color: qtyColor, background: qtyBg, borderRadius: 10, padding: '1px 8px', display: 'inline-block' }}>{qty}</span></td>
                              <td style={{ ...tdStyle, textAlign: 'right', color: 'rgba(0,0,0,0.6)' }}>${parseFloat(item.cost).toFixed(2)}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>${val.toFixed(2)}</td>
                              <td style={tdStyle}><button onClick={e => { e.stopPropagation(); openStockViewModal(item); }} style={{ ...btnSecondary, padding: '4px 12px', fontSize: 12 }}>View</button></td>
                            </tr>
                          );
                        })}
                        {pagedStock.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'rgba(0,0,0,0.3)', fontSize: 13 }}>No items match your filters</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination page={invPage} totalPages={invTotalPages} onChange={setInvPage} />
              </div>
            </div>
          </div>
        )}

        {/* ─── SITES ─── */}
        {activeTab === 'sites' && (
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
              <input type="text" placeholder="Search sites…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} style={{...inputStyle,width:240}} />
              <span style={{fontSize:12,color:'rgba(0,0,0,0.35)'}}>{filteredSites.length} sites</span>
              <div style={{flex:1}} />
              <button onClick={()=>openSiteModal(null,true)} style={btnPrimary}>+ Add Site</button>
            </div>
            {loading ? <div style={{display:'flex',justifyContent:'center',padding:80}}><CircularProgress /></div> : (
              <div style={{background:'#fff',border:'0.5px solid rgba(0,0,0,0.08)',borderRadius:14,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Code','Name','City','Contact','Phone','Status',''].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredSites.map(site=>(
                      <tr key={site.id} className="data-row">
                        <td style={tdStyle}><span style={{fontFamily:'monospace',fontSize:11,background:'rgba(0,0,0,0.04)',borderRadius:6,padding:'2px 7px'}}>{site.site_code}</span></td>
                        <td style={{...tdStyle,fontWeight:500}}>{site.name}</td>
                        <td style={{...tdStyle,color:'rgba(0,0,0,0.5)'}}>{site.city}</td>
                        <td style={{...tdStyle,color:'rgba(0,0,0,0.5)'}}>{site.contact_name||'—'}</td>
                        <td style={{...tdStyle,fontFamily:'monospace',fontSize:12}}>{site.phone||'—'}</td>
                        <td style={tdStyle}><span style={{background:site.status==='ACTIVE'?'#d1fae5':'#f3f4f6',color:site.status==='ACTIVE'?'#065f46':'#6b7280',borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:600}}>{site.status}</span></td>
                        <td style={tdStyle}><button onClick={()=>openSiteModal(site)} style={{...btnSecondary,padding:'4px 12px',fontSize:12}}>Edit</button></td>
                      </tr>
                    ))}
                    {filteredSites.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:48,color:'rgba(0,0,0,0.3)',fontSize:13}}>No sites found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ORDERZ-REPORTS — Reports tab */}
        {activeTab === 'reports' && (
          <div style={{ padding: '0 0 32px' }}>
            {/* Report sub-tabs */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginBottom: 16 }}>
              {[
                { key: 'cost-category', label: 'Cost by Category' },
                { key: 'cost-site', label: 'Cost by Site' },
                { key: 'frequency', label: 'Order Frequency' },
                { key: 'finance', label: 'Finance PDF' },
                { key: 'reorder', label: 'Reorder Alert' },
                { key: 'forecast', label: 'Forecast' },
                { key: 'velocity', label: 'Stock Velocity' },
                { key: 'audit', label: 'Movement Audit' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setActiveReport(key)} style={{ padding: '6px 14px', borderRadius: 20, border: activeReport === key ? 'none' : '0.5px solid rgba(0,0,0,0.12)', background: activeReport === key ? '#0a0a0a' : 'transparent', color: activeReport === key ? '#fff' : 'rgba(0,0,0,0.6)', fontSize: 12, fontWeight: activeReport === key ? 500 : 400, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>{label}</button>
              ))}
            </div>

            {/* Date filter bar — shown for all except audit */}
            {activeReport !== 'audit' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 10, padding: '8px 14px', flexWrap: 'wrap' as const }}>
                <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>Period</span>
                {[{ label: 'This month', days: 30 }, { label: '3 months', days: 90 }, { label: '6 months', days: 180 }, { label: 'This year', days: 365 }].map(({ label, days }) => (
                  <button key={label} onClick={() => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - days); setReportDateFrom(from.toISOString().slice(0,10)); setReportDateTo(to.toISOString().slice(0,10)); }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '0.5px solid rgba(0,0,0,0.12)', background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'rgba(0,0,0,0.6)' }}>{label}</button>
                ))}
                <input type="date" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)} style={fpInput} />
                <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)' }}>to</span>
                <input type="date" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)} style={fpInput} />
                <div style={{ flex: 1 }} />
                <button onClick={loadCurrentReport} style={btnPrimary}>Apply</button>
              </div>
            )}

            {/* Loading spinner */}
            {reportLoading && <div style={{ textAlign: 'center', padding: 40, color: 'rgba(0,0,0,0.4)', fontSize: 13 }}>Loading…</div>}

            {/* ── COST BY CATEGORY ── */}
            {!reportLoading && activeReport === 'cost-category' && (
              <div>
                {/* ORDERZ-REPORTS — category + site filter dropdowns */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' as const }}>
                  <label style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: 500 }}>Category</label>
                  <select value={reportCatFilter} onChange={e => setReportCatFilter(e.target.value)} style={{ ...fpInput, width: 170, cursor: 'pointer' }}>
                    <option value="">All categories</option>
                    {reportCategoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <label style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: 500, marginLeft: 4 }}>Site</label>
                  <select value={reportSiteFilter} onChange={e => setReportSiteFilter(e.target.value)} style={{ ...fpInput, width: 180, cursor: 'pointer' }}>
                    <option value="">All sites</option>
                    {reportSitesList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={loadCurrentReport} style={btnPrimary}>Apply</button>
                  {(reportCatFilter || reportSiteFilter) && (
                    <button onClick={() => { setReportCatFilter(''); setReportSiteFilter(''); }} style={btnSecondary}>Clear</button>
                  )}
                  <div style={{ flex: 1 }} />
                  {costByCategoryData.length > 0 && (
                    <button onClick={() => {
                      // ORDERZ-REPORTS — CSV export: all categories + items
                      const rows: string[] = ['Category,Product,SKU,Unit,Qty Out,Unit Cost,Total Cost'];
                      for (const cat of costByCategoryData) {
                        for (const item of cat.items) {
                          rows.push([cat.category, item.product, item.sku, item.unit, item.total_qty, Number(item.unit_cost).toFixed(2), Number(item.total_cost).toFixed(2)].join(','));
                        }
                        rows.push([cat.category + ' TOTAL', '', '', '', '', '', cat.total_cost.toFixed(2)].join(','));
                        rows.push('');
                      }
                      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
                      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                      a.download = `cost-by-category-${reportDateFrom}-to-${reportDateTo}.csv`; a.click();
                    }} style={btnSecondary}>↓ Download CSV</button>
                  )}
                </div>
                {costByCategoryData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>No data for selected period</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                      {[
                        { label: 'Total Spend', value: '$' + costByCategoryData.reduce((s,c) => s + c.total_cost, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                        { label: 'Categories', value: String(costByCategoryData.length) },
                        { label: 'Top Category', value: costByCategoryData[0]?.category || '—' },
                      ].map(m => (
                        <div key={m.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 20px', minWidth: 140 }}>
                          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{m.label}</div>
                          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                            <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>Category</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>Total Spend</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>Items</th>
                            <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>% of Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const grandTotal = costByCategoryData.reduce((s,c) => s + c.total_cost, 0);
                            return costByCategoryData.map(cat => {
                              const isExpanded = expandedCategories.has(cat.category);
                              return (
                                <>
                                  <tr key={cat.category} onClick={() => setExpandedCategories(prev => { const n = new Set(prev); if (n.has(cat.category)) n.delete(cat.category); else n.add(cat.category); return n; })} style={{ cursor: 'pointer', borderTop: '0.5px solid rgba(0,0,0,0.06)', background: isExpanded ? 'rgba(0,0,0,0.01)' : undefined }}>
                                    <td style={{ padding: '11px 16px', fontWeight: 500 }}><span style={{ marginRight: 8, opacity: 0.4 }}>{isExpanded ? '▾' : '▸'}</span>{cat.category}</td>
                                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600 }}>${cat.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '11px 16px', textAlign: 'right', color: 'rgba(0,0,0,0.5)' }}>{cat.items.length}</td>
                                    <td style={{ padding: '11px 16px', textAlign: 'right', color: 'rgba(0,0,0,0.5)' }}>{grandTotal > 0 ? Math.round(cat.total_cost / grandTotal * 100) : 0}%</td>
                                  </tr>
                                  {isExpanded && cat.items.map((item: any) => (
                                    <tr key={item.sku} style={{ background: 'rgba(0,0,0,0.015)', borderTop: '0.5px solid rgba(0,0,0,0.04)' }}>
                                      <td style={{ padding: '8px 16px 8px 36px', color: 'rgba(0,0,0,0.5)', fontSize: 12 }}>{item.sku}</td>
                                      <td style={{ padding: '8px 16px', fontSize: 12 }}>{item.product}</td>
                                      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12 }}>Qty: {Number(item.total_qty).toLocaleString()}</td>
                                      <td style={{ padding: '8px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500 }}>${Number(item.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                  ))}
                                </>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── COST BY SITE ── */}
            {!reportLoading && activeReport === 'cost-site' && (
              <div>
                {costBySiteData.sites.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>No data for selected period</div>
                ) : (
                  <>
                    {(() => {
                      const top10 = costBySiteData.sites.slice(0, 10);
                      const maxSpend = Math.max(...top10.map((s: any) => Number(s.total_spend)));
                      return (
                        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top 10 Sites by Spend</div>
                          {top10.map((site: any) => (
                            <div key={site.site_name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <div style={{ width: 120, fontSize: 12, color: 'rgba(0,0,0,0.7)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.site_name}</div>
                              <div style={{ flex: 1, background: 'rgba(0,0,0,0.04)', borderRadius: 4, height: 20, position: 'relative' }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${maxSpend > 0 ? Number(site.total_spend) / maxSpend * 100 : 0}%`, background: '#0a0a0a', borderRadius: 4, transition: 'width 0.3s' }} />
                              </div>
                              <div style={{ width: 80, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>${Number(site.total_spend).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                            {['Site', 'City', 'Orders', 'Total Spend', 'Last Order'].map(h => (
                              <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Site' || h === 'City' ? 'left' : 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {costBySiteData.sites.map((site: any) => (
                            <tr key={site.site_name} style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 500 }}>{site.site_name}</td>
                              <td style={{ padding: '10px 16px', color: 'rgba(0,0,0,0.5)' }}>{site.city || '—'}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right' }}>{site.order_count}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>${Number(site.total_spend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', color: 'rgba(0,0,0,0.5)' }}>{site.last_order_date ? new Date(site.last_order_date).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ORDER FREQUENCY ── */}
            {!reportLoading && activeReport === 'frequency' && (
              <div>
                {orderFrequencyData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>No data for selected period</div>
                ) : (
                  (() => {
                    const bySite: Record<string, any[]> = {};
                    for (const row of orderFrequencyData) {
                      if (!bySite[row.site_name]) bySite[row.site_name] = [];
                      bySite[row.site_name].push(row);
                    }
                    const months = Array.from(new Set(orderFrequencyData.map(r => String(r.month)))).sort().reverse().slice(0, 6);
                    return (
                      <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Site</th>
                              {months.map(m => <th key={m} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{new Date(m).toLocaleDateString('en', { month: 'short', year: '2-digit' })}</th>)}
                              <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, fontSize: 11, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(bySite).map(([site, rows]) => {
                              const byMonth: Record<string, number> = {};
                              rows.forEach(r => { byMonth[String(r.month)] = (byMonth[String(r.month)] || 0) + Number(r.order_count); });
                              const total = Object.values(byMonth).reduce((s, n) => s + n, 0);
                              return (
                                <tr key={site} style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{site}</td>
                                  {months.map(m => {
                                    const cnt = byMonth[m] || 0;
                                    const bg = cnt === 0 ? '#fef2f2' : cnt >= 8 ? '#f0fdf4' : cnt >= 3 ? '#fffbeb' : undefined;
                                    return <td key={m} style={{ padding: '10px 16px', textAlign: 'right', background: bg, fontWeight: cnt > 0 ? 500 : 400, color: cnt === 0 ? '#dc2626' : undefined }}>{cnt || '—'}</td>;
                                  })}
                                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{total}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* ── FINANCE PDF ── */}
            {!reportLoading && activeReport === 'finance' && (
              <div>
                {/* ORDERZ-REPORTS — site + category dropdowns */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <label style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: 500 }}>Site</label>
                  <select value={financeSiteFilter} onChange={e => setFinanceSiteFilter(e.target.value)} style={{ ...fpInput, width: 200, cursor: 'pointer' }}>
                    <option value="">All sites</option>
                    {reportSitesList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <label style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: 500, marginLeft: 8 }}>Category</label>
                  <select value={financeCatFilter} onChange={e => setFinanceCatFilter(e.target.value)} style={{ ...fpInput, width: 160, cursor: 'pointer' }}>
                    <option value="">All categories</option>
                    {reportCategoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={loadCurrentReport} style={btnSecondary}>Load</button>
                  {financeData.length > 0 && (
                    <>
                      <button onClick={() => window.print()} style={btnPrimary} className="no-print">Generate PDF</button>
                      <button onClick={() => {
                        // ORDERZ-REPORTS — CSV export grouped by site + category
                        const visibleRows = financeCatFilter ? financeData.filter(r => r.category === financeCatFilter) : financeData;
                        const lines: string[] = ['Site,Category,SKU,Description,Qty,Unit Cost,Total'];
                        const bySite: Record<string, any[]> = {};
                        for (const r of visibleRows) { if (!bySite[r.site_name]) bySite[r.site_name] = []; bySite[r.site_name].push(r); }
                        for (const [site, rows] of Object.entries(bySite)) {
                          const byCat: Record<string, any[]> = {};
                          for (const r of rows) { if (!byCat[r.category]) byCat[r.category] = []; byCat[r.category].push(r); }
                          for (const [cat, items] of Object.entries(byCat)) {
                            for (const item of items) {
                              lines.push([`"${site}"`, `"${cat}"`, item.sku, `"${item.item_name}"`, item.total_qty, Number(item.unit_cost).toFixed(2), Number(item.line_total).toFixed(2)].join(','));
                            }
                            const catTotal = items.reduce((s: number, r: any) => s + Number(r.line_total), 0);
                            lines.push([`"${site}"`, `"${cat} TOTAL"`, '', '', '', '', catTotal.toFixed(2)].join(','));
                          }
                          const siteTotal = rows.reduce((s: number, r: any) => s + Number(r.line_total), 0);
                          lines.push([`"${site} TOTAL"`, '', '', '', '', '', siteTotal.toFixed(2)].join(','));
                          lines.push('');
                        }
                        const grandTotal = visibleRows.reduce((s: number, r: any) => s + Number(r.line_total), 0);
                        lines.push(['GRAND TOTAL', '', '', '', '', '', grandTotal.toFixed(2)].join(','));
                        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                        a.download = `finance-report-${reportDateFrom}-to-${reportDateTo}.csv`; a.click();
                      }} style={btnSecondary} className="no-print">↓ Download CSV</button>
                    </>
                  )}
                </div>
                {financeData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>Select filters and click Load</div>
                ) : (
                  (() => {
                    // ORDERZ-REPORTS — group by site → category
                    const visibleRows = financeCatFilter ? financeData.filter(r => r.category === financeCatFilter) : financeData;
                    const bySite: Record<string, any[]> = {};
                    for (const row of visibleRows) { if (!bySite[row.site_name]) bySite[row.site_name] = []; bySite[row.site_name].push(row); }
                    const grandTotal = visibleRows.reduce((s, r) => s + Number(r.line_total), 0);
                    const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    return (
                      <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 32, fontFamily: 'inherit' }} id="finance-print">
                        {/* Report header */}
                        <div style={{ borderBottom: '2px solid #0a0a0a', paddingBottom: 16, marginBottom: 24 }}>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>REDAN — STOCK ALLOCATION REPORT</div>
                          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', marginTop: 6 }}>
                            Period: {reportDateFrom} to {reportDateTo} &nbsp;|&nbsp; Generated: {new Date().toLocaleDateString()}
                            {financeSiteFilter && <> &nbsp;|&nbsp; Site: <strong>{financeSiteFilter}</strong></>}
                            {financeCatFilter && <> &nbsp;|&nbsp; Category: <strong>{financeCatFilter}</strong></>}
                          </div>
                        </div>

                        {/* Site sections */}
                        {Object.entries(bySite).map(([siteName, siteRows]) => {
                          const byCat: Record<string, any[]> = {};
                          for (const row of siteRows) { if (!byCat[row.category]) byCat[row.category] = []; byCat[row.category].push(row); }
                          const siteTotal = siteRows.reduce((s, r) => s + Number(r.line_total), 0);
                          return (
                            <div key={siteName} style={{ marginBottom: 36, pageBreakInside: 'avoid' as const }}>
                              {/* Site header */}
                              <div style={{ background: '#0a0a0a', color: '#fff', padding: '8px 14px', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.04em' }}>{siteName}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.85 }}>{fmt(siteTotal)}</span>
                              </div>

                              {/* Categories within this site */}
                              {Object.entries(byCat).map(([cat, items]) => {
                                const catTotal = items.reduce((s, r) => s + Number(r.line_total), 0);
                                return (
                                  <div key={cat} style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.5)', marginBottom: 6, paddingLeft: 4 }}>{cat}</div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                      <thead>
                                        <tr style={{ borderBottom: '0.5px solid rgba(0,0,0,0.15)' }}>
                                          {['SKU', 'Description', 'Qty', 'Unit Cost', 'Total'].map(h => (
                                            <th key={h} style={{ padding: '5px 8px', textAlign: ['Qty','Unit Cost','Total'].includes(h) ? 'right' : 'left', fontWeight: 600, fontSize: 10, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' as const }}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {items.map((item: any, i: number) => (
                                          <tr key={i} style={{ borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                                            <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: 11, color: 'rgba(0,0,0,0.6)' }}>{item.sku}</td>
                                            <td style={{ padding: '5px 8px' }}>{item.item_name}</td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right' }}>{Number(item.total_qty).toLocaleString()}</td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right', color: 'rgba(0,0,0,0.6)' }}>{fmt(Number(item.unit_cost))}</td>
                                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 500 }}>{fmt(Number(item.line_total))}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr style={{ borderTop: '1px solid rgba(0,0,0,0.12)', background: 'rgba(0,0,0,0.02)' }}>
                                          <td colSpan={4} style={{ padding: '5px 8px', fontWeight: 600, textAlign: 'right', fontSize: 11, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase' as const }}>{cat} subtotal</td>
                                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(catTotal)}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}

                        {/* Grand total */}
                        <div style={{ borderTop: '2px solid #0a0a0a', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>GRAND TOTAL</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(grandTotal)}</div>
                        </div>
                        <div style={{ marginTop: 40, display: 'flex', gap: 60 }}>
                          <div><div style={{ borderBottom: '1px solid #0a0a0a', width: 200, marginBottom: 4 }} /><div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>Account Code</div></div>
                          <div><div style={{ borderBottom: '1px solid #0a0a0a', width: 200, marginBottom: 4 }} /><div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>Authorised by</div></div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* ── REORDER ALERT ── */}
            {!reportLoading && activeReport === 'reorder' && (
              <div>
                {reorderData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>No items below reorder level</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                      {[
                        { label: 'Items to Reorder', value: String(reorderData.length) },
                        { label: 'Out of Stock', value: String(reorderData.filter(r => Number(r.current_stock) === 0).length) },
                        { label: 'Est. Reorder Cost', value: '$' + reorderData.reduce((s, r) => s + (Math.abs(Number(r.stock_vs_reorder)) * Number(r.cost)), 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) },
                      ].map(m => (
                        <div key={m.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 20px', minWidth: 140 }}>
                          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{m.label}</div>
                          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                            {['SKU', 'Product', 'Category', 'Stock', 'Reorder', 'Deficit', 'Days Left'].map(h => (
                              <th key={h} style={{ padding: '10px 16px', textAlign: h === 'SKU' || h === 'Product' || h === 'Category' ? 'left' : 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reorderData.map((item: any, i: number) => {
                            const isOut = Number(item.current_stock) === 0;
                            return (
                              <tr key={i} style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)', background: isOut ? '#fef2f2' : '#fffbeb' }}>
                                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11 }}>{item.sku}</td>
                                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{item.product}{item.size ? ` (${item.size})` : ''}</td>
                                <td style={{ padding: '10px 16px', color: 'rgba(0,0,0,0.5)' }}>{item.category}</td>
                                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: isOut ? '#dc2626' : '#d97706' }}>{item.current_stock}</td>
                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>{item.reorder_level}</td>
                                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{item.stock_vs_reorder}</td>
                                <td style={{ padding: '10px 16px', textAlign: 'right', color: 'rgba(0,0,0,0.5)' }}>{item.days_until_stockout != null ? `${item.days_until_stockout}d` : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── FORECAST ── */}
            {!reportLoading && activeReport === 'forecast' && (
              <div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>Lookback:</span>
                  {[30, 60, 90].map(d => <button key={d} onClick={() => setForecastLookback(d)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: forecastLookback === d ? 'none' : '0.5px solid rgba(0,0,0,0.12)', background: forecastLookback === d ? '#0a0a0a' : 'transparent', color: forecastLookback === d ? '#fff' : 'rgba(0,0,0,0.6)', cursor: 'pointer', fontFamily: 'inherit' }}>{d}d</button>)}
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', marginLeft: 8 }}>Forecast:</span>
                  {[14, 30, 60].map(d => <button key={d} onClick={() => setForecastDays(d)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: forecastDays === d ? 'none' : '0.5px solid rgba(0,0,0,0.12)', background: forecastDays === d ? '#0a0a0a' : 'transparent', color: forecastDays === d ? '#fff' : 'rgba(0,0,0,0.6)', cursor: 'pointer', fontFamily: 'inherit' }}>{d}d</button>)}
                  <button onClick={loadCurrentReport} style={btnPrimary}>Generate Forecast</button>
                  {forecastData.items.length > 0 && <button onClick={() => window.print()} style={btnSecondary} className="no-print">Supplier Order PDF</button>}
                </div>
                {forecastData.total_order_value > 0 && (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: 'Items to Order', value: String(forecastData.items.length) },
                      { label: 'Total Order Value', value: '$' + forecastData.total_order_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                    ].map(m => (
                      <div key={m.label} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: '12px 20px', minWidth: 140 }}>
                        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{m.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                {forecastData.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>No forecast data — click Generate Forecast</div>
                ) : (
                  <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                          {['SKU', 'Product', 'Category', 'Stock', `${forecastLookback}d Usage`, `${forecastDays}d Forecast`, 'Order Qty', 'Est. Cost'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: ['SKU','Product','Category'].includes(h) ? 'left' : 'right', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {forecastData.items.map((item: any, i: number) => (
                          <tr key={i} style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11 }}>{item.sku}</td>
                            <td style={{ padding: '10px 16px', fontWeight: 500 }}>{item.product}{item.size ? ` (${item.size})` : ''}</td>
                            <td style={{ padding: '10px 16px', color: 'rgba(0,0,0,0.5)' }}>{item.category}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>{item.current_stock}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>{Number(item.usage_in_period).toLocaleString()}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>{Number(item.forecast_demand).toLocaleString()}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{Number(item.suggested_order_qty).toLocaleString()}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>${(Number(item.suggested_order_qty) * Number(item.cost)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── STOCK VELOCITY ── */}
            {!reportLoading && activeReport === 'velocity' && (
              <div>
                {velocityData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>No data available</div>
                ) : (
                  (['FAST', 'NORMAL', 'SLOW', 'IDLE'] as const).map(vel => {
                    const items = velocityData.filter(i => i.velocity === vel);
                    if (items.length === 0) return null;
                    const headerBg = vel === 'FAST' ? '#f0fdf4' : vel === 'SLOW' ? '#fffbeb' : vel === 'IDLE' ? '#fef2f2' : '#fff';
                    const headerColor = vel === 'FAST' ? '#166534' : vel === 'SLOW' ? '#92400e' : vel === 'IDLE' ? '#991b1b' : '#0a0a0a';
                    return (
                      <div key={vel} style={{ marginBottom: 20, background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ background: headerBg, padding: '10px 16px', fontWeight: 700, fontSize: 12, color: headerColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {vel === 'FAST' ? 'Fast Moving (>20 units/month)' : vel === 'NORMAL' ? 'Normal (5–19 units/month)' : vel === 'SLOW' ? 'Slow Moving (<5 units/month)' : 'Idle (0 units last 30 days)'}
                          <span style={{ marginLeft: 8, fontWeight: 400, opacity: 0.7 }}>· {items.length} items</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                              {['SKU', 'Product', 'Category', '30d Qty', '90d Qty', 'Avg/Day', 'Stock'].map(h => (
                                <th key={h} style={{ padding: '8px 16px', textAlign: ['SKU','Product','Category'].includes(h) ? 'left' : 'right', fontWeight: 600, fontSize: 10, letterSpacing: '0.05em', color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item: any, i: number) => (
                              <tr key={i} style={{ borderTop: '0.5px solid rgba(0,0,0,0.05)' }}>
                                <td style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: 11 }}>{item.sku}</td>
                                <td style={{ padding: '8px 16px', fontWeight: 500 }}>{item.product}{item.size ? ` (${item.size})` : ''}</td>
                                <td style={{ padding: '8px 16px', color: 'rgba(0,0,0,0.5)' }}>{item.category}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right' }}>{Number(item.qty_30_days).toLocaleString()}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right' }}>{Number(item.qty_90_days).toLocaleString()}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right' }}>{Number(item.avg_daily_usage).toLocaleString()}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>{Number(item.current_stock).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── MOVEMENT AUDIT ── */}
            {!reportLoading && activeReport === 'audit' && (
              <div style={{ display: 'flex', gap: 20 }}>
                {/* Filter panel */}
                <div style={filterPanel}>
                  <div style={fpSection}>
                    <div style={fpLabel}>Search</div>
                    <input placeholder="Product, SKU…" value={repSearch} onChange={e => { setRepSearch(e.target.value); setRepPage(1); }} style={fpInput} />
                  </div>
                  <div style={fpSection}>
                    <div style={fpLabel}>Type</div>
                    {(['IN','OUT','DAMAGE','ADJUSTMENT'] as const).map(t => (
                      <FilterCheck key={t} label={t} count={stockHistory.filter(h => h.movement_type === t).length} checked={repTypes.includes(t)} onChange={() => { setRepTypes(prev => repTypes.includes(t) ? prev.filter(x => x !== t) : [...prev, t]); setRepPage(1); }} />
                    ))}
                  </div>
                  <div style={fpSection}>
                    <div style={fpLabel}>Date range</div>
                    <input type="date" value={repDateFrom} onChange={e => { setRepDateFrom(e.target.value); setRepPage(1); }} style={fpInput} />
                    <input type="date" value={repDateTo} onChange={e => { setRepDateTo(e.target.value); setRepPage(1); }} style={{ ...fpInput, marginTop: 6 }} />
                  </div>
                </div>
                {/* Table */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>{filteredHistory.length} movements</span>
                  </div>
                  <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                          {['Date', 'Product', 'Type', 'Qty', 'Reference', 'Reason', 'By'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Qty' ? 'right' : 'left', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pagedHistory.length === 0 ? (
                          <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'rgba(0,0,0,0.35)', fontSize: 13 }}>No movements found</td></tr>
                        ) : pagedHistory.map((h: any, i: number) => (
                          <tr key={i} style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                            <td style={{ padding: '9px 16px', color: 'rgba(0,0,0,0.5)', fontSize: 12 }}>{new Date(h.created_at).toLocaleDateString()}</td>
                            <td style={{ padding: '9px 16px', fontWeight: 500 }}>{h.product || h.sku}</td>
                            <td style={{ padding: '9px 16px' }}><MovementBadge type={h.movement_type} /></td>
                            <td style={{ padding: '9px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{h.quantity}</td>
                            <td style={{ padding: '9px 16px', color: 'rgba(0,0,0,0.5)', fontSize: 12 }}>{h.reference_id || '—'}</td>
                            <td style={{ padding: '9px 16px', color: 'rgba(0,0,0,0.5)', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.reason || '—'}</td>
                            <td style={{ padding: '9px 16px', color: 'rgba(0,0,0,0.5)', fontSize: 12 }}>{h.created_by || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={repPage} totalPages={repTotalPages} onChange={setRepPage} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── ORDER SLIDE-IN PANEL ── */}
      {orderModal.open && <div onClick={()=>setOrderModal({open:false,order:null,loading:false,dispatchInfo:null,customQty:{},dispatching:false,adjusting:false,adjustments:{},savingAdjustments:false})} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.2)',zIndex:399,backdropFilter:'blur(2px)'}} />}
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:580,background:'#fff',boxShadow:'-8px 0 40px rgba(0,0,0,0.08)',transform:orderModal.open?'translateX(0)':'translateX(100%)',transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1)',zIndex:400,display:'flex',flexDirection:'column'}}>
        {orderModal.loading ? (
          <div style={{display:'flex',justifyContent:'center',alignItems:'center',flex:1}}><CircularProgress /></div>
        ) : orderModal.order ? (
          <div className="print-area" style={{flex:1,display:'flex',flexDirection:'column',overflowY:'auto'}}>
            {/* Panel header */}
            <div className="no-print" style={{padding:'16px 24px',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,background:'rgba(255,255,255,0.95)',backdropFilter:'blur(8px)',zIndex:10}}>
              <button onClick={()=>setOrderModal({open:false,order:null,loading:false,dispatchInfo:null,customQty:{},dispatching:false,adjusting:false,adjustments:{},savingAdjustments:false})} className="icon-btn" style={{fontSize:18}}>✕</button>
              <div style={{flex:1}}>
                <div style={{fontFamily:'monospace',fontSize:13,fontWeight:600}}>{orderModal.order.order_number}</div>
                <div style={{fontSize:12,color:'rgba(0,0,0,0.4)'}}>{orderModal.order.site_name} · {orderModal.order.city}</div>
              </div>
              <StatusBadge status={orderModal.order.status} />
              <button onClick={()=>window.print()} className="icon-btn" title="Print">⎙</button>
            </div>
            {/* Order meta */}
            <div style={{padding:'14px 24px',borderBottom:'0.5px solid rgba(0,0,0,0.06)'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                {[
                  {label:'Category',value:orderModal.order.category},
                  {label:'Requested by',value:orderModal.order.requested_by||'—'},
                  {label:'Date',value:new Date(orderModal.order.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})},
                  {label:'Total',value:`$${parseFloat(orderModal.order.total_amount).toFixed(2)}`},
                  {label:'Dispatched by',value:orderModal.order.dispatched_by||'—'},
                  {label:'Dispatch date',value:orderModal.order.dispatched_at?new Date(orderModal.order.dispatched_at).toLocaleDateString('en-GB'):'—'},
                ].map((f,i)=>(
                  <div key={i}>
                    <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'rgba(0,0,0,0.35)',marginBottom:3}}>{f.label}</div>
                    <div style={{fontSize:13}}>{f.value}</div>
                  </div>
                ))}
              </div>
              {orderModal.order.notes&&<div style={{marginTop:10,padding:'7px 12px',background:'rgba(0,0,0,0.03)',borderRadius:8,fontSize:12,color:'rgba(0,0,0,0.6)'}}>{orderModal.order.notes}</div>}
            </div>
            {/* Items */}
            <div style={{flex:1,padding:'0 24px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'rgba(0,0,0,0.35)',padding:'14px 0 8px'}}>Items</div>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  {['SKU','Product','Sz','Requested','Dispatched',...(orderModal.dispatchInfo&&['PENDING','PARTIAL_DISPATCH','PROCESSING'].includes(orderModal.order.status)?['Stock','Dispatch Qty']:[])].map(h=>(
                    <th key={h} style={{fontSize:10,fontWeight:600,textTransform:'uppercase',color:'rgba(0,0,0,0.4)',letterSpacing:'0.06em',padding:'7px 8px',textAlign:h==='Requested'||h==='Dispatched'||h==='Stock'||h==='Dispatch Qty'?'center':'left',background:'rgba(0,0,0,0.02)',borderBottom:'0.5px solid rgba(0,0,0,0.08)'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {orderModal.order.items.map(item=>{
                    const dispItem=orderModal.dispatchInfo?.items.find((d:any)=>d.id===item.id);
                    const canDispatch=orderModal.dispatchInfo&&['PENDING','PARTIAL_DISPATCH','PROCESSING'].includes(orderModal.order!.status);
                    return (
                      <tr key={item.id} className="data-row">
                        <td style={{fontSize:10,padding:'8px',borderBottom:'0.5px solid rgba(0,0,0,0.05)',verticalAlign:'middle'}}><span style={{fontFamily:'monospace',background:'rgba(0,0,0,0.04)',borderRadius:4,padding:'1px 5px'}}>{item.sku}</span></td>
                        <td style={{fontSize:12,padding:'8px',borderBottom:'0.5px solid rgba(0,0,0,0.05)',verticalAlign:'middle',fontWeight:500}}>{item.product}{item.employee_name?<span style={{fontSize:11,color:'rgba(0,0,0,0.4)',marginLeft:4}}>({item.employee_name})</span>:null}</td>
                        <td style={{fontSize:12,padding:'8px',borderBottom:'0.5px solid rgba(0,0,0,0.05)',verticalAlign:'middle',textAlign:'center',color:'rgba(0,0,0,0.5)'}}>{item.size||'—'}</td>
                        <td style={{fontSize:13,padding:'8px',borderBottom:'0.5px solid rgba(0,0,0,0.05)',verticalAlign:'middle',textAlign:'center',fontWeight:500}}>
                          {orderModal.adjusting ? (
                            <input type="number" min={1} max={item.quantity} value={orderModal.adjustments[item.id]??item.qty_approved??item.quantity} onChange={e=>setOrderModal(prev=>({...prev,adjustments:{...prev.adjustments,[item.id]:parseInt(e.target.value)||0}}))} style={{width:50,border:'0.5px solid rgba(0,0,0,0.2)',borderRadius:6,padding:'3px 6px',fontSize:12,textAlign:'center',fontFamily:'inherit'}} />
                          ) : (
                            item.qty_approved!=null&&item.qty_approved<item.quantity
                              ?<><span style={{textDecoration:'line-through',color:'rgba(0,0,0,0.3)',marginRight:4}}>{item.quantity}</span><span style={{color:'#92400e',fontWeight:600}}>{item.qty_approved}</span></>
                              :item.quantity
                          )}
                        </td>
                        <td style={{fontSize:13,padding:'8px',borderBottom:'0.5px solid rgba(0,0,0,0.05)',verticalAlign:'middle',textAlign:'center',color:item.qty_dispatched>0?'#065f46':'rgba(0,0,0,0.3)'}}>{item.qty_dispatched}</td>
                        {canDispatch&&<>
                          <td style={{fontSize:12,padding:'8px',borderBottom:'0.5px solid rgba(0,0,0,0.05)',verticalAlign:'middle',textAlign:'center',color:(dispItem?.stock_available||0)===0?'#9f1239':'#065f46',fontWeight:600}}>{dispItem?.stock_available??'—'}</td>
                          <td style={{fontSize:12,padding:'8px',borderBottom:'0.5px solid rgba(0,0,0,0.05)',verticalAlign:'middle',textAlign:'center'}}>
                            {(item.qty_approved??item.quantity)>item.qty_dispatched?(
                              <input type="number" min={0} max={Math.min((item.qty_approved??item.quantity)-item.qty_dispatched,dispItem?.stock_available||0)} value={orderModal.customQty[item.id]??0} onChange={e=>setOrderModal(prev=>({...prev,customQty:{...prev.customQty,[item.id]:parseInt(e.target.value)||0}}))} style={{width:50,border:'0.5px solid rgba(0,0,0,0.2)',borderRadius:6,padding:'3px 6px',fontSize:12,textAlign:'center',fontFamily:'inherit'}} />
                            ):<span style={{color:'#065f46',fontSize:13}}>✓</span>}
                          </td>
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Actions */}
            <div className="no-print" style={{padding:'14px 24px',borderTop:'0.5px solid rgba(0,0,0,0.08)',background:'#fff',display:'flex',gap:8,flexWrap:'wrap'}}>
              {['PENDING','PARTIAL_DISPATCH','PROCESSING'].includes(orderModal.order.status)&&(
                <>
                  {orderModal.adjusting ? (
                    <>
                      <button onClick={handleSaveAdjustments} disabled={orderModal.savingAdjustments} style={btnPrimary}>{orderModal.savingAdjustments?'Saving…':'Save Adjustments'}</button>
                      <button onClick={()=>setOrderModal(prev=>({...prev,adjusting:false,adjustments:{}}))} style={btnSecondary}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleOrderModalDispatch} disabled={orderModal.dispatching} style={btnPrimary}>{orderModal.dispatching?'Dispatching…':'Dispatch'}</button>
                      <button onClick={()=>setOrderModal(prev=>({...prev,adjusting:true}))} style={btnSecondary}>Adjust Qty</button>
                      {showDeclineForm ? (
                        <div style={{display:'flex',gap:8,alignItems:'center',flex:'1 1 100%'}}>
                          <input placeholder="Decline reason…" value={declineInput} onChange={e=>setDeclineInput(e.target.value)} style={{...inputStyle,flex:1}} />
                          <button onClick={()=>{handleDecline(declineInput);setShowDeclineForm(false);setDeclineInput('');}} style={btnDanger}>Confirm Decline</button>
                          <button onClick={()=>setShowDeclineForm(false)} style={btnSecondary}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={()=>setShowDeclineForm(true)} style={btnDanger}>Decline</button>
                      )}
                    </>
                  )}
                </>
              )}
              {/* ORDERZ-ORDERVIEW — View/Print order */}
              <a
                href={`/api/excel/order-view/${orderModal.order?.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 16px',background:'transparent',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:8,fontSize:13,color:'#0a0a0a',textDecoration:'none',cursor:'pointer'}}
              >
                &#8599; View Order
              </a>
              {(orderModal.order?.status === 'DISPATCHED' || orderModal.order?.status === 'PARTIAL_DISPATCH' || orderModal.order?.status === 'RECEIVED') && (
                <a
                  href={`/api/admin/orders/${orderModal.order?.id}/dispatch-note`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 16px',background:'transparent',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:8,fontSize:13,color:'#0a0a0a',textDecoration:'none'}}
                >
                  &#8595; Dispatch Note
                </a>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── STOCK VIEW SLIDE-IN PANEL ── */}
      {stockViewModal.open&&<div onClick={()=>setStockViewModal({open:false,item:null,history:[],loading:false,action:'none',quantity:'',reason:'',editingCost:false,newCost:''})} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.2)',zIndex:399,backdropFilter:'blur(2px)'}} />}
      <div style={{position:'fixed',top:0,right:0,bottom:0,width:480,background:'#fff',boxShadow:'-8px 0 40px rgba(0,0,0,0.08)',transform:stockViewModal.open?'translateX(0)':'translateX(100%)',transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1)',zIndex:400,display:'flex',flexDirection:'column'}}>
        {stockViewModal.item ? (
          <>
            <div style={{padding:'16px 24px',borderBottom:'0.5px solid rgba(0,0,0,0.08)',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,background:'rgba(255,255,255,0.95)',backdropFilter:'blur(8px)',zIndex:10}}>
              <button onClick={()=>setStockViewModal({open:false,item:null,history:[],loading:false,action:'none',quantity:'',reason:'',editingCost:false,newCost:''})} className="icon-btn" style={{fontSize:18}}>✕</button>
              <div style={{flex:1}}>
                <div style={{fontFamily:'monospace',fontSize:13,fontWeight:600}}>{stockViewModal.item.sku}</div>
                <div style={{fontSize:12,color:'rgba(0,0,0,0.4)'}}>{stockViewModal.item.product}{(stockViewModal.item as any).size?` · ${(stockViewModal.item as any).size}`:''}</div>
              </div>
              <button onClick={handleDeleteItem} style={{fontSize:12,color:'#dc2626',background:'#fef2f2',border:'0.5px solid #fecaca',borderRadius:7,padding:'5px 12px',cursor:'pointer',fontFamily:'inherit',fontWeight:500}}>Delete</button>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:22,fontWeight:600,color:stockViewModal.item.quantity_on_hand===0?'#9f1239':stockViewModal.item.quantity_on_hand<10?'#92400e':'#0a0a0a'}}>{stockViewModal.item.quantity_on_hand}</div>
                <div style={{fontSize:11,color:'rgba(0,0,0,0.35)'}}>on hand</div>
              </div>
            </div>
            <div style={{padding:'14px 24px',borderBottom:'0.5px solid rgba(0,0,0,0.06)'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:14}}>
                <div><div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'rgba(0,0,0,0.35)',marginBottom:3}}>Category</div><div style={{fontSize:13}}>{stockViewModal.item.category}</div></div>
                <div><div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'rgba(0,0,0,0.35)',marginBottom:3}}>Unit</div><div style={{fontSize:13}}>{stockViewModal.item.unit}</div></div>
                <div>
                  <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'rgba(0,0,0,0.35)',marginBottom:3}}>Unit Cost</div>
                  {stockViewModal.editingCost?(
                    <div style={{display:'flex',gap:4}}>
                      <input type="number" step="0.01" value={stockViewModal.newCost} onChange={e=>setStockViewModal(prev=>({...prev,newCost:e.target.value}))} style={{width:70,border:'0.5px solid rgba(0,0,0,0.2)',borderRadius:6,padding:'3px 6px',fontSize:12,fontFamily:'inherit'}} />
                      <button onClick={handleUpdateCost} style={{background:'#0a0a0a',color:'#fff',border:'none',borderRadius:6,padding:'3px 8px',fontSize:12,cursor:'pointer'}}>✓</button>
                      <button onClick={()=>setStockViewModal(prev=>({...prev,editingCost:false,newCost:''}))} style={{background:'transparent',border:'0.5px solid rgba(0,0,0,0.15)',borderRadius:6,padding:'3px 6px',fontSize:12,cursor:'pointer'}}>✕</button>
                    </div>
                  ):(
                    <div style={{fontSize:13,cursor:'pointer'}} onClick={()=>setStockViewModal(prev=>({...prev,editingCost:true,newCost:prev.item!.cost}))}>
                      ${parseFloat(stockViewModal.item.cost).toFixed(2)} <span style={{fontSize:11,color:'rgba(0,0,0,0.35)'}}>edit</span>
                    </div>
                  )}
                </div>
              </div>
              {/* ORDERZ-REPORTS — Reorder level */}
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 4 }}>Reorder level</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    value={editReorderLevel}
                    onChange={e => setEditReorderLevel(e.target.value)}
                    style={{ width: 80, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 7, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <button onClick={handleSaveReorderLevel} style={btnSecondary}>Save</button>
                </div>
                <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)', marginTop: 4, marginBottom: 0 }}>Alert when stock falls to or below this level</p>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <select value={stockViewModal.action} onChange={e=>setStockViewModal(prev=>({...prev,action:e.target.value as 'none'|'add'|'remove'}))} style={selectStyle}>
                  <option value="none">Select action…</option>
                  <option value="add">Add stock</option>
                  <option value="remove">Remove stock</option>
                </select>
                {stockViewModal.action!=='none'&&(<>
                  <input type="number" min={1} placeholder="Qty" value={stockViewModal.quantity} onChange={e=>setStockViewModal(prev=>({...prev,quantity:e.target.value}))} style={{...inputStyle,width:72}} />
                  {stockViewModal.action==='remove'&&(
                    <select value={stockViewModal.reason} onChange={e=>setStockViewModal(prev=>({...prev,reason:e.target.value}))} style={selectStyle}>
                      <option value="">Reason…</option>
                      <option value="DAMAGED">Damaged</option>
                      <option value="RETURN_TO_SUPPLIER">Return to supplier</option>
                      <option value="WRITE_OFF">Write off</option>
                      <option value="OTHER">Other</option>
                    </select>
                  )}
                  <button onClick={handleStockViewAction} style={stockViewModal.action==='add'?btnPrimary:btnDanger}>
                    {stockViewModal.action==='add'?'+ Add':'− Remove'}
                  </button>
                </>)}
              </div>
            </div>
            <div style={{flex:1,padding:'0 24px 24px',overflowY:'auto'}}>
              <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'rgba(0,0,0,0.35)',padding:'14px 0 8px'}}>Movement History</div>
              {stockViewModal.loading?<div style={{display:'flex',justifyContent:'center',padding:24}}><CircularProgress size={20} /></div>:(
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>{['Date','Type','Qty','Reference'].map(h=><th key={h} style={{fontSize:10,fontWeight:600,textTransform:'uppercase',color:'rgba(0,0,0,0.4)',letterSpacing:'0.06em',padding:'7px 8px',textAlign:'left',background:'rgba(0,0,0,0.02)',borderBottom:'0.5px solid rgba(0,0,0,0.08)'}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {stockViewModal.history.slice(0,30).map(m=>{
                      const isIn=m.movement_type==='IN'||(m.movement_type==='ADJUSTMENT'&&m.quantity>0);
                      return (
                        <tr key={m.id}>
                          <td style={{fontSize:11,padding:'7px 8px',borderBottom:'0.5px solid rgba(0,0,0,0.04)',verticalAlign:'middle',color:'rgba(0,0,0,0.4)'}}>{new Date(m.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</td>
                          <td style={{fontSize:11,padding:'7px 8px',borderBottom:'0.5px solid rgba(0,0,0,0.04)',verticalAlign:'middle'}}><MovementBadge type={m.movement_type} /></td>
                          <td style={{fontSize:13,padding:'7px 8px',borderBottom:'0.5px solid rgba(0,0,0,0.04)',verticalAlign:'middle',fontWeight:600,color:isIn?'#065f46':'#9f1239'}}>{isIn?'+':'−'}{Math.abs(m.quantity)}</td>
                          <td style={{fontSize:11,padding:'7px 8px',borderBottom:'0.5px solid rgba(0,0,0,0.04)',verticalAlign:'middle',color:'rgba(0,0,0,0.45)',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.order_number||m.reason||'—'}</td>
                        </tr>
                      );
                    })}
                    {stockViewModal.history.length===0&&<tr><td colSpan={4} style={{textAlign:'center',padding:24,color:'rgba(0,0,0,0.3)',fontSize:12}}>No history</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* ── ADD PRODUCT DIALOG ── */}
      <Dialog open={addProductModal.open} onClose={()=>setAddProductModal(prev=>({...prev,open:false}))} maxWidth="sm" fullWidth>
        <DialogTitle style={{fontFamily:'inherit',fontSize:15,fontWeight:600,borderBottom:'0.5px solid rgba(0,0,0,0.08)',paddingBottom:14,display:'flex',alignItems:'center',gap:12}}>
          Add Product
          <div style={{display:'inline-flex',background:'rgba(0,0,0,0.04)',borderRadius:20,padding:3,gap:2}}>
            {(['new','add-size'] as const).map(m=>(
              <button key={m} onClick={()=>setAddProductModal(prev=>({...prev,mode:m,product:'',category:'',sku:'',size:''}))} style={{padding:'4px 12px',borderRadius:16,border:'none',cursor:'pointer',fontSize:12,fontFamily:'inherit',background:addProductModal.mode===m?'#fff':'transparent',color:addProductModal.mode===m?'#0a0a0a':'rgba(0,0,0,0.5)',boxShadow:addProductModal.mode===m?'0 1px 3px rgba(0,0,0,0.08)':'none',fontWeight:addProductModal.mode===m?500:400}}>
                {m==='new'?'New Product':'Add Size to Existing'}
              </button>
            ))}
          </div>
        </DialogTitle>
        <DialogContent style={{paddingTop:20,fontFamily:'inherit'}}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {addProductModal.mode==='new' ? (
              <TextField label="Product Name" size="small" fullWidth value={addProductModal.product} onChange={e=>setAddProductModal(prev=>({...prev,product:e.target.value}))} />
            ) : (
              <>
                <TextField select label="Select Existing Product" size="small" fullWidth value={addProductModal.product} onChange={e=>{const pName=e.target.value;const ex=stock.find(s=>s.product===pName&&s.is_active);setAddProductModal(prev=>({...prev,product:pName,category:ex?.category||prev.category,sku:generateSku(pName,prev.size)}));}} SelectProps={{native:true}}>
                  <option value="">-- Select product --</option>
                  {uniqueProducts.map(p=><option key={p} value={p}>{p}</option>)}
                </TextField>
                {addProductModal.product && (()=>{
                  const existingSizes = stock.filter(s=>s.product===addProductModal.product&&s.is_active&&s.size).map(s=>s.size);
                  const skuInconsistent = addProductModal.size && generateSku(addProductModal.product, addProductModal.size) === '' && stock.filter(s=>s.product===addProductModal.product&&s.is_active).length > 0;
                  return (
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {existingSizes.length > 0 && (
                        <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:4}}>
                          <span style={{fontSize:11,color:'rgba(0,0,0,0.45)',fontWeight:500}}>Existing sizes:</span>
                          {existingSizes.map(sz=>(
                            <span key={sz} style={{fontSize:11,color:'rgba(0,0,0,0.55)',background:'rgba(0,0,0,0.05)',borderRadius:20,padding:'1px 8px'}}>{sz}</span>
                          ))}
                        </div>
                      )}
                      {skuInconsistent && (
                        <div style={{fontSize:11,color:'#92400e',background:'#fef3c7',border:'0.5px solid #fcd34d',borderRadius:8,padding:'6px 10px'}}>
                          SKU prefixes are inconsistent for this product. Please type the SKU manually.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
            {addProductModal.mode==='add-size' ? (
              <TextField label="Category" size="small" fullWidth value={addProductModal.category} disabled />
            ) : (
              <TextField select label="Category" size="small" fullWidth value={addProductModal.category} onChange={e=>setAddProductModal(prev=>({...prev,category:e.target.value}))} SelectProps={{native:true}}>
                <option value="">-- Select category --</option>
                <option value="Uniforms">Uniforms</option>
                <option value="Consumables">Consumables</option>
                <option value="Equipment">Equipment</option>
                <option value="Stationery">Stationery</option>
                <option value="Safety">Safety</option>
                <option value="Other">Other</option>
              </TextField>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <TextField label="Size (optional)" size="small" value={addProductModal.size} onChange={e=>{const sz=e.target.value;setAddProductModal(prev=>({...prev,size:sz,sku:prev.mode==='add-size'&&prev.product?generateSku(prev.product,sz):prev.sku}));}} />
              <TextField label="Role" size="small" value={addProductModal.role} onChange={e=>setAddProductModal(prev=>({...prev,role:e.target.value}))} />
              <TextField label="SKU (auto-generated if blank)" size="small" value={addProductModal.sku} onChange={e=>setAddProductModal(prev=>({...prev,sku:e.target.value}))} />
              <TextField label="Unit" size="small" value={addProductModal.unit} onChange={e=>setAddProductModal(prev=>({...prev,unit:e.target.value}))} />
              <TextField label="Unit Cost ($)" size="small" type="number" value={addProductModal.cost} onChange={e=>setAddProductModal(prev=>({...prev,cost:e.target.value}))} />
              <TextField label="Initial Quantity" size="small" type="number" value={addProductModal.initialQuantity} onChange={e=>setAddProductModal(prev=>({...prev,initialQuantity:e.target.value}))} />
            </div>
          </div>
        </DialogContent>
        <DialogActions style={{padding:'12px 24px',borderTop:'0.5px solid rgba(0,0,0,0.08)'}}>
          <button onClick={()=>setAddProductModal(prev=>({...prev,open:false}))} style={btnSecondary}>Cancel</button>
          <button onClick={handleAddProduct} disabled={addProductModal.submitting} style={btnPrimary}>{addProductModal.submitting?'Adding…':'Add Product'}</button>
        </DialogActions>
      </Dialog>

      {/* ── BULK RECEIVE DIALOG ── */}
      <Dialog open={bulkReceiveModal.open} onClose={()=>setBulkReceiveModal(prev=>({...prev,open:false}))} maxWidth="sm" fullWidth>
        <DialogTitle style={{fontFamily:'inherit',fontSize:15,fontWeight:600}}>Bulk Stock Receive</DialogTitle>
        <DialogContent style={{fontFamily:'inherit'}}>
          <TextField label="GRN Number (optional)" size="small" fullWidth value={bulkReceiveModal.grnNumber} onChange={e=>setBulkReceiveModal(prev=>({...prev,grnNumber:e.target.value}))} style={{marginBottom:14,marginTop:8}} />
          <div style={{maxHeight:400,overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Product</th>
                <th style={{...thStyle,textAlign:'center'}}>Qty</th>
              </tr></thead>
              <tbody>
                {bulkReceiveModal.items.map((item,i)=>(
                  <tr key={item.item_id}>
                    <td style={{...tdStyle,fontSize:11,fontFamily:'monospace'}}>{item.sku}</td>
                    <td style={{...tdStyle,fontSize:12}}>{item.product}</td>
                    <td style={{...tdStyle,textAlign:'center'}}>
                      <input type="number" min={0} value={item.quantity} onChange={e=>{const updated=[...bulkReceiveModal.items];updated[i]={...updated[i],quantity:e.target.value};setBulkReceiveModal(prev=>({...prev,items:updated}));}} style={{width:64,border:'0.5px solid rgba(0,0,0,0.2)',borderRadius:6,padding:'4px 8px',fontSize:13,textAlign:'center',fontFamily:'inherit'}} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
        <DialogActions style={{padding:'12px 24px',borderTop:'0.5px solid rgba(0,0,0,0.08)'}}>
          <button onClick={()=>setBulkReceiveModal(prev=>({...prev,open:false}))} style={btnSecondary}>Cancel</button>
          <button onClick={handleBulkReceive} disabled={bulkReceiveModal.submitting} style={btnPrimary}>{bulkReceiveModal.submitting?'Receiving…':'Receive Stock'}</button>
        </DialogActions>
      </Dialog>

      {/* ── SITE EDIT DIALOG ── */}
      <Dialog open={siteModal.open} onClose={()=>setSiteModal(prev=>({...prev,open:false}))} maxWidth="sm" fullWidth>
        <DialogTitle style={{fontFamily:'inherit',fontSize:15,fontWeight:600}}>{siteModal.isNew?'Add Site':'Edit Site'}</DialogTitle>
        <DialogContent style={{fontFamily:'inherit',paddingTop:16}}>
          {siteModal.site&&(
            <div style={{display:'flex',flexDirection:'column',gap:14,paddingTop:8}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <TextField label="Site Name" size="small" value={siteModal.site.name} onChange={e=>setSiteModal(prev=>({...prev,site:{...prev.site!,name:e.target.value}}))} />
                <TextField label="City" size="small" value={siteModal.site.city} onChange={e=>setSiteModal(prev=>({...prev,site:{...prev.site!,city:e.target.value}}))} />
                <TextField label="Contact Name" size="small" value={siteModal.site.contact_name} onChange={e=>setSiteModal(prev=>({...prev,site:{...prev.site!,contact_name:e.target.value}}))} />
                <TextField label="Phone" size="small" value={siteModal.site.phone} onChange={e=>setSiteModal(prev=>({...prev,site:{...prev.site!,phone:e.target.value}}))} />
                <TextField label="Email" size="small" value={siteModal.site.email} onChange={e=>setSiteModal(prev=>({...prev,site:{...prev.site!,email:e.target.value}}))} />
                <TextField select label="Fulfillment Zone" size="small" value={siteModal.site.fulfillment_zone} onChange={e=>setSiteModal(prev=>({...prev,site:{...prev.site!,fulfillment_zone:e.target.value}}))} SelectProps={{native:true}}>
                  <option value="DISPATCH">Dispatch</option>
                  <option value="COLLECT">Collect</option>
                </TextField>
              </div>
              <TextField label="Address" size="small" fullWidth multiline rows={2} value={siteModal.site.address} onChange={e=>setSiteModal(prev=>({...prev,site:{...prev.site!,address:e.target.value}}))} />
            </div>
          )}
        </DialogContent>
        <DialogActions style={{padding:'12px 24px',borderTop:'0.5px solid rgba(0,0,0,0.08)'}}>
          <button onClick={()=>setSiteModal(prev=>({...prev,open:false}))} style={btnSecondary}>Cancel</button>
          <button onClick={saveSite} style={btnPrimary}>Save</button>
        </DialogActions>
      </Dialog>

      {/* ── SITE LEDGER DIALOG ── */}
      <Dialog open={siteLedgerModal.open} onClose={()=>setSiteLedgerModal(prev=>({...prev,open:false}))} maxWidth="md" fullWidth>
        <DialogTitle style={{fontFamily:'inherit',fontSize:15,fontWeight:600,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          {siteLedgerModal.site?.site_name} — Dispatch Ledger
          <button onClick={downloadSiteLedgerCSV} style={{...btnSecondary,padding:'5px 12px',fontSize:12}}>↓ CSV</button>
        </DialogTitle>
        <DialogContent style={{fontFamily:'inherit'}}>
          {siteLedgerModal.loading?<div style={{display:'flex',justifyContent:'center',padding:40}}><CircularProgress /></div>:(
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Voucher','Dispatch Date','SKU','Item','Size','Qty Req','Qty Disp','Unit Cost','Value'].map(h=><th key={h} style={{...thStyle,textAlign:h==='Qty Req'||h==='Qty Disp'||h==='Unit Cost'||h==='Value'?'right':'left'}}>{h}</th>)}</tr></thead>
              <tbody>
                {siteLedgerModal.items.map((item:any,i:number)=>(
                  <tr key={i} className="data-row">
                    <td style={{...tdStyle,fontSize:11,fontFamily:'monospace'}}>{item.voucher_number}</td>
                    <td style={{...tdStyle,fontSize:12,color:'rgba(0,0,0,0.5)'}}>{item.dispatched_at?new Date(item.dispatched_at).toLocaleDateString('en-GB'):'—'}</td>
                    <td style={{...tdStyle,fontSize:11,fontFamily:'monospace'}}>{item.sku}</td>
                    <td style={{...tdStyle,fontSize:12}}>{item.item_name}</td>
                    <td style={{...tdStyle,fontSize:12,color:'rgba(0,0,0,0.5)'}}>{item.size||'—'}</td>
                    <td style={{...tdStyle,textAlign:'right'}}>{item.qty_requested}</td>
                    <td style={{...tdStyle,textAlign:'right',fontWeight:600}}>{item.qty_dispatched}</td>
                    <td style={{...tdStyle,textAlign:'right'}}>${parseFloat(item.unit_cost).toFixed(2)}</td>
                    <td style={{...tdStyle,textAlign:'right',fontWeight:600}}>${parseFloat(item.dispatch_value).toFixed(2)}</td>
                  </tr>
                ))}
                {siteLedgerModal.items.length===0&&<tr><td colSpan={9} style={{textAlign:'center',padding:32,color:'rgba(0,0,0,0.3)',fontSize:12}}>No dispatch records</td></tr>}
              </tbody>
            </table>
          )}
        </DialogContent>
        <DialogActions style={{padding:'12px 24px',borderTop:'0.5px solid rgba(0,0,0,0.08)'}}>
          <button onClick={()=>setSiteLedgerModal(prev=>({...prev,open:false}))} style={btnSecondary}>Close</button>
        </DialogActions>
      </Dialog>

      {/* ── SNACKBAR ── */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={()=>setSnackbar(prev=>({...prev,open:false}))} anchorOrigin={{vertical:'bottom',horizontal:'center'}}>
        <Alert severity={snackbar.severity} onClose={()=>setSnackbar(prev=>({...prev,open:false}))} style={{fontFamily:'inherit'}}>{snackbar.message}</Alert>
      </Snackbar>
    </div>
  );
}
