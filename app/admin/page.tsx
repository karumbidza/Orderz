'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  Tooltip,
  AppBar,
  Toolbar,
  Container,
  Stack,
  Card,
  CardContent,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
} from '@mui/x-data-grid';
import {
  LocalShipping as DispatchIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  History as HistoryIcon,
  ArrowDownward as InIcon,
  ArrowUpward as OutIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Store as SiteIcon,
  Assessment as TotalsIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  Analytics as ReportsIcon,
} from '@mui/icons-material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// ─────────────────────────────────────────
// THEME
// ─────────────────────────────────────────
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

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
}

interface StockMovement {
  id: number;
  item_id: number;
  movement_type: 'IN' | 'OUT';
  quantity: number;
  reference_type: string;
  reference_id: string | null;
  reason: string;
  created_at: string;
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

type TabValue = 'orders' | 'inventory' | 'sites' | 'reports';
type ReportView = 'movements' | 'site-analysis';

const STATUS_COLORS: Record<string, 'warning' | 'info' | 'secondary' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  DISPATCHED: 'secondary',
  PARTIAL_DISPATCH: 'warning',
  RECEIVED: 'success',
  DECLINED: 'error',
  CANCELLED: 'error',
};

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabValue>('orders');
  const [reportView, setReportView] = useState<ReportView>('movements');
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
  const [orderModal, setOrderModal] = useState<{ open: boolean; order: OrderDetail | null; loading: boolean }>({
    open: false,
    order: null,
    loading: false,
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

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Load data functions
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
      const res = await fetch('/api/admin/stock/history?limit=100&days=30');
      const data = await res.json();
      if (data.success) setStockHistory(data.data);
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
      const res = await fetch('/api/admin/site-totals');
      const data = await res.json();
      if (data.success) setSiteTotals(data.data);
      else showMessage('Error: ' + data.error, 'error');
    } catch {
      showMessage('Failed to load site totals', 'error');
    }
    setLoading(false);
  };

  // Load data on tab change
  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
    else if (activeTab === 'inventory') loadStock();
    else if (activeTab === 'sites') loadSites();
    else if (activeTab === 'reports') {
      loadStockHistory();
      loadSiteTotals();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const showMessage = (message: string, severity: 'success' | 'error' | 'info' = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // ─────────────────────────────────────────
  // ORDERS API
  // ─────────────────────────────────────────
  const viewOrder = async (orderId: number) => {
    setOrderModal({ open: true, order: null, loading: true });
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (data.success) setOrderModal({ open: true, order: data.data, loading: false });
      else {
        showMessage('Error loading order details', 'error');
        setOrderModal({ open: false, order: null, loading: false });
      }
    } catch {
      showMessage('Failed to load order', 'error');
      setOrderModal({ open: false, order: null, loading: false });
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
        setOrderModal({ open: false, order: null, loading: false });
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
        setOrderModal({ open: false, order: null, loading: false });
        loadOrders();
      } else showMessage('Error: ' + data.error, 'error');
    } catch {
      showMessage('Failed to decline order', 'error');
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
  // FILTERED DATA
  // ─────────────────────────────────────────
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.voucher_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.site_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.site_city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || order.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const filteredStock = stock.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredHistory = stockHistory.filter(movement => {
    const matchesSearch = searchQuery === '' ||
      movement.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (movement.site_name && movement.site_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || movement.movement_type === typeFilter;
    return matchesSearch && matchesType;
  });

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

  // ─────────────────────────────────────────
  // DATA GRID COLUMNS
  // ─────────────────────────────────────────
  const ordersColumns: GridColDef[] = [
    { field: 'voucher_number', headerName: 'Order #', width: 130, renderCell: (params) => (
      <Typography variant="body2" fontFamily="monospace" fontWeight={500}>{params.value}</Typography>
    )},
    { field: 'category', headerName: 'Category', width: 100, renderCell: (params) => (
      <Chip label={params.value || 'N/A'} size="small" variant="outlined" sx={{ fontSize: 11 }} />
    )},
    { field: 'site_name', headerName: 'Site', width: 140, renderCell: (params) => (
      <Typography variant="body2" fontWeight={500}>{params.value}</Typography>
    )},
    { field: 'site_city', headerName: 'City', width: 100, renderCell: (params) => (
      <Typography variant="body2" color="text.secondary">{params.value}</Typography>
    )},
    { field: 'site_address', headerName: 'Address', width: 140, renderCell: (params) => (
      <Tooltip title={params.value || ''} arrow placement="top">
        <Typography variant="body2" color="text.secondary" noWrap sx={{ cursor: 'pointer' }}>
          {params.value || '—'}
        </Typography>
      </Tooltip>
    )},
    { field: 'status', headerName: 'Status', width: 130, renderCell: (params) => (
      <Chip label={params.value} color={STATUS_COLORS[params.value] || 'default'} size="small" />
    )},
    { field: 'total_amount', headerName: 'Total', width: 110, align: 'right', headerAlign: 'right', renderCell: (params) => (
      <Typography variant="body2" fontWeight={600}>${parseFloat(params.value).toFixed(2)}</Typography>
    )},
    { field: 'order_date', headerName: 'Date', width: 110, renderCell: (params) => {
      const date = new Date(params.value);
      return <Typography variant="body2">{date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>;
    }},
    { field: 'item_count', headerName: 'Items', width: 80, align: 'center', headerAlign: 'center' },
    { field: 'actions', headerName: '', width: 100, sortable: false, align: 'center', headerAlign: 'center', renderCell: (params) => (
      <Button size="small" variant="outlined" onClick={() => viewOrder(params.row.id)}>
        View
      </Button>
    )},
  ];

  const inventoryColumns: GridColDef[] = [
    { field: 'sku', headerName: 'SKU', width: 120, renderCell: (params) => (
      <Typography variant="body2" fontFamily="monospace" sx={{ bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 1 }}>{params.value}</Typography>
    )},
    { field: 'product', headerName: 'Product', flex: 1, minWidth: 180, renderCell: (params) => (
      <Typography variant="body2" fontWeight={500}>{params.value}</Typography>
    )},
    { field: 'size', headerName: 'Size', width: 80, align: 'center', headerAlign: 'center', renderCell: (params) => (
      params.value ? <Typography variant="body2">{params.value}</Typography> : <Typography variant="caption" color="text.secondary">—</Typography>
    )},
    { field: 'unit', headerName: 'Unit', width: 80, align: 'center', headerAlign: 'center', renderCell: (params) => (
      <Typography variant="body2" color="text.secondary">{params.value}</Typography>
    )},
    { field: 'category', headerName: 'Category', width: 130, renderCell: (params) => (
      <Chip label={params.value} size="small" variant="outlined" />
    )},
    { field: 'quantity_on_hand', headerName: 'Stock', width: 100, align: 'right', headerAlign: 'right', renderCell: (params) => (
      <Typography variant="body2" fontWeight={600} color={params.value === 0 ? 'error.main' : params.value < 10 ? 'warning.main' : 'text.primary'}>
        {params.value}
      </Typography>
    )},
    { field: 'cost', headerName: 'Unit Cost', width: 110, align: 'right', headerAlign: 'right', renderCell: (params) => (
      <Typography variant="body2">${parseFloat(params.value).toFixed(2)}</Typography>
    )},
    { field: 'value', headerName: 'Value', width: 120, align: 'right', headerAlign: 'right', valueGetter: (value, row) => row.quantity_on_hand * parseFloat(row.cost), renderCell: (params) => (
      <Typography variant="body2" fontWeight={600}>${params.value.toFixed(2)}</Typography>
    )},
    { field: 'actions', headerName: 'Actions', width: 140, sortable: false, renderCell: (params) => (
      <Stack direction="row" spacing={1}>
        <Tooltip title="Add Stock">
          <IconButton size="small" color="success" onClick={() => openStockModal(params.row, 'add')}>
            <AddIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Dispatch Stock">
          <IconButton size="small" color="warning" onClick={() => openStockModal(params.row, 'dispatch')} disabled={params.row.quantity_on_hand === 0}>
            <RemoveIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    )},
  ];

  const historyColumns: GridColDef[] = [
    { field: 'created_at', headerName: 'Date/Time', width: 150, renderCell: (params) => {
      const date = new Date(params.value);
      return (
        <Box>
          <Typography variant="body2">{date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>
          <Typography variant="caption" color="text.secondary">{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Typography>
        </Box>
      );
    }},
    { field: 'sku', headerName: 'SKU', width: 140, renderCell: (params) => (
      <Typography variant="body2" fontFamily="monospace" sx={{ bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 1 }}>{params.value}</Typography>
    )},
    { field: 'product', headerName: 'Product', flex: 1, minWidth: 160, renderCell: (params) => (
      <Typography variant="body2" fontWeight={500}>{params.value}</Typography>
    )},
    { field: 'movement_type', headerName: 'Type', width: 100, renderCell: (params) => (
      <Chip
        icon={params.value === 'IN' ? <InIcon /> : <OutIcon />}
        label={params.value}
        color={params.value === 'IN' ? 'success' : 'warning'}
        size="small"
      />
    )},
    { field: 'quantity', headerName: 'Qty', width: 90, align: 'right', headerAlign: 'right', renderCell: (params) => (
      <Typography variant="body2" fontWeight={600} color={params.row.movement_type === 'IN' ? 'success.main' : 'warning.main'}>
        {params.row.movement_type === 'IN' ? '+' : '−'}{Math.abs(params.value)}
      </Typography>
    )},
    { field: 'site_name', headerName: 'Destination', width: 160, renderCell: (params) => params.value ? (
      <Box>
        <Typography variant="body2" fontWeight={500}>{params.value}</Typography>
        {params.row.order_number && <Typography variant="caption" color="text.secondary">Order #{params.row.order_number}</Typography>}
      </Box>
    ) : <Typography variant="caption" color="text.secondary">—</Typography>},
    { field: 'stock_value', headerName: 'Value', width: 110, align: 'right', headerAlign: 'right', renderCell: (params) => {
      const value = params.value ? parseFloat(params.value) : Math.abs(params.row.quantity) * parseFloat(params.row.cost || 0);
      return <Typography variant="body2" fontWeight={500} color={params.row.movement_type === 'IN' ? 'success.main' : 'warning.main'}>${value.toFixed(2)}</Typography>;
    }},
    { field: 'reason', headerName: 'Reference', flex: 1, minWidth: 150, renderCell: (params) => (
      <Tooltip title={params.value}>
        <Typography variant="body2" color="text.secondary" noWrap>{params.value}</Typography>
      </Tooltip>
    )},
  ];

  const sitesColumns: GridColDef[] = [
    { field: 'site_code', headerName: 'Code', width: 140, renderCell: (params) => (
      <Typography variant="body2" fontFamily="monospace" sx={{ bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 1 }}>{params.value}</Typography>
    )},
    { field: 'name', headerName: 'Site Name', flex: 1, minWidth: 180, renderCell: (params) => (
      <Typography variant="body2" fontWeight={500}>{params.value}</Typography>
    )},
    { field: 'city', headerName: 'City', width: 120, renderCell: (params) => (
      <Typography variant="body2">{params.value}</Typography>
    )},
    { field: 'address', headerName: 'Address', width: 200, renderCell: (params) => (
      <Tooltip title={params.value || ''} arrow>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ cursor: 'pointer' }}>{params.value || '—'}</Typography>
      </Tooltip>
    )},
    { field: 'contact_name', headerName: 'Contact', width: 150, renderCell: (params) => (
      <Typography variant="body2">{params.value || '—'}</Typography>
    )},
    { field: 'phone', headerName: 'Phone', width: 120, renderCell: (params) => (
      <Typography variant="body2" fontFamily="monospace">{params.value || '—'}</Typography>
    )},
    { field: 'email', headerName: 'Email', width: 180, renderCell: (params) => (
      <Typography variant="body2" color="text.secondary" noWrap>{params.value || '—'}</Typography>
    )},
    { field: 'status', headerName: 'Status', width: 100, renderCell: (params) => (
      <Chip label={params.value} color={params.value === 'ACTIVE' ? 'success' : 'default'} size="small" />
    )},
    { field: 'actions', headerName: 'Actions', width: 100, sortable: false, renderCell: (params) => (
      <IconButton size="small" color="primary" onClick={() => openSiteModal(params.row)}>
        <EditIcon />
      </IconButton>
    )},
  ];

  const totalsColumns: GridColDef[] = [
    { field: 'site_code', headerName: 'Code', width: 140, renderCell: (params) => (
      <Typography variant="body2" fontFamily="monospace" sx={{ bgcolor: 'grey.100', px: 1, py: 0.5, borderRadius: 1 }}>{params.value}</Typography>
    )},
    { field: 'site_name', headerName: 'Site Name', flex: 1, minWidth: 180, renderCell: (params) => (
      <Typography variant="body2" fontWeight={500}>{params.value}</Typography>
    )},
    { field: 'city', headerName: 'City', width: 120, renderCell: (params) => (
      <Typography variant="body2">{params.value}</Typography>
    )},
    { field: 'total_orders', headerName: 'Orders', width: 100, align: 'center', headerAlign: 'center', renderCell: (params) => (
      <Typography variant="body2" fontWeight={600}>{params.value}</Typography>
    )},
    { field: 'total_items_dispatched', headerName: 'Items Dispatched', width: 140, align: 'right', headerAlign: 'right', renderCell: (params) => (
      <Typography variant="body2" fontWeight={600}>{params.value}</Typography>
    )},
    { field: 'total_value_dispatched', headerName: 'Total Value', width: 150, align: 'right', headerAlign: 'right', renderCell: (params) => (
      <Typography variant="body2" fontWeight={600} color="primary.main">
        ${parseFloat(params.value || 0).toFixed(2)}
      </Typography>
    )},
    { field: 'last_dispatch_date', headerName: 'Last Dispatch', width: 130, renderCell: (params) => {
      if (!params.value) return <Typography variant="caption" color="text.secondary">—</Typography>;
      const date = new Date(params.value);
      return <Typography variant="body2">{date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>;
    }},
  ];

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 15px;
            background: white !important;
            font-size: 12px;
          }
          .print-content table {
            width: 100% !important;
            border-collapse: collapse;
            page-break-inside: auto;
          }
          .print-content tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          .print-content th, .print-content td {
            padding: 6px 8px !important;
          }
          .no-print {
            display: none !important;
          }
          .MuiDialog-root, .MuiModal-root {
            position: static !important;
          }
          .MuiBackdrop-root {
            display: none !important;
          }
          .MuiDialog-container {
            height: auto !important;
          }
          .MuiPaper-root {
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            margin: 10mm;
            size: A4 portrait;
          }
        }
      `}</style>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }} className="no-print">
        {/* App Bar */}
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Redan Coupon
            </Typography>
            <IconButton onClick={() => {
              if (activeTab === 'orders') loadOrders();
              else if (activeTab === 'inventory') loadStock();
              else if (activeTab === 'sites') loadSites();
              else if (activeTab === 'reports') {
                loadStockHistory();
                loadSiteTotals();
              }
            }}>
              <RefreshIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: 3 }}>
          {/* Page Header */}
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4">
                {activeTab === 'orders' ? 'Orders' : 
                 activeTab === 'inventory' ? 'Inventory' : 
                 activeTab === 'sites' ? 'Sites' : 'Reports'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {activeTab === 'orders' ? 'Manage incoming orders and dispatches' : 
                 activeTab === 'inventory' ? 'Track stock levels and manage inventory' : 
                 activeTab === 'sites' ? 'Manage site information' : 
                 reportView === 'movements' ? 'Stock movement history and tracking' : 'Site dispatch totals and analysis'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              {activeTab === 'inventory' && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={openBulkReceiveModal}>
                  Bulk Receive
                </Button>
              )}
              {activeTab === 'sites' && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openSiteModal(null, true)}>
                  Add Site
                </Button>
              )}
            </Stack>
          </Box>

          {/* Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Tabs value={activeTab} onChange={(_, v) => { setActiveTab(v); setSearchQuery(''); setStatusFilter('all'); setCategoryFilter('all'); setTypeFilter('all'); }} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab icon={<ReceiptIcon />} iconPosition="start" label="Orders" value="orders" />
              <Tab icon={<InventoryIcon />} iconPosition="start" label="Inventory" value="inventory" />
              <Tab icon={<SiteIcon />} iconPosition="start" label="Sites" value="sites" />
              <Tab icon={<ReportsIcon />} iconPosition="start" label="Reports" value="reports" />
            </Tabs>
          </Paper>

          {/* Search and Filters */}
          <Paper sx={{ mb: 2, p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                size="small"
                placeholder={
                  activeTab === 'orders' ? 'Search orders...' : 
                  activeTab === 'inventory' ? 'Search products...' : 
                  activeTab === 'sites' ? 'Search sites...' : 'Search reports...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                }}
                sx={{ minWidth: 300 }}
              />
              <FilterIcon sx={{ color: 'text.secondary' }} />
              {activeTab === 'orders' && (
                <>
                  <TextField
                    select
                    size="small"
                    label="Status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    SelectProps={{ native: true }}
                    sx={{ minWidth: 140 }}
                  >
                    <option value="all">All Statuses</option>
                    {uniqueStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    SelectProps={{ native: true }}
                    sx={{ minWidth: 130 }}
                  >
                    <option value="all">All Categories</option>
                    {uniqueOrderCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </TextField>
                </>
              )}
              {activeTab === 'inventory' && (
                <TextField
                  select
                  size="small"
                  label="Category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  SelectProps={{ native: true }}
                  sx={{ minWidth: 150 }}
                >
                  <option value="all">All Categories</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </TextField>
              )}
              {activeTab === 'reports' && (
                <>
                  <TextField
                    select
                    size="small"
                    label="Report"
                    value={reportView}
                    onChange={(e) => setReportView(e.target.value as ReportView)}
                    SelectProps={{ native: true }}
                    sx={{ minWidth: 160 }}
                  >
                    <option value="movements">Stock Movements</option>
                    <option value="site-analysis">Site Analysis</option>
                  </TextField>
                  {reportView === 'movements' && (
                    <TextField
                      select
                      size="small"
                      label="Type"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      SelectProps={{ native: true }}
                      sx={{ minWidth: 120 }}
                    >
                      <option value="all">All</option>
                      <option value="IN">Stock In</option>
                      <option value="OUT">Stock Out</option>
                    </TextField>
                  )}
                  <Button 
                    variant="outlined" 
                    startIcon={<DownloadIcon />} 
                    onClick={reportView === 'movements' ? downloadStockMovementsCSV : downloadSiteAnalysisCSV}
                  >
                    Download CSV
                  </Button>
                </>
              )}
              <Box sx={{ flex: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {activeTab === 'orders' ? `${filteredOrders.length} orders` : 
                 activeTab === 'inventory' ? `${filteredStock.length} items` : 
                 activeTab === 'sites' ? `${filteredSites.length} sites` :
                 reportView === 'movements' ? `${filteredHistory.length} movements` :
                 `${filteredTotals.length} sites`}
              </Typography>
            </Stack>
          </Paper>

          {/* Data Grid */}
          <Paper sx={{ height: 600 }}>
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : (
              <DataGrid
                rows={
                  activeTab === 'orders' ? filteredOrders : 
                  activeTab === 'inventory' ? filteredStock.map(s => ({ ...s, id: s.item_id })) : 
                  activeTab === 'sites' ? filteredSites :
                  reportView === 'movements' ? filteredHistory :
                  filteredTotals.map(t => ({ ...t, id: t.site_id }))
                }
                columns={
                  activeTab === 'orders' ? ordersColumns : 
                  activeTab === 'inventory' ? inventoryColumns : 
                  activeTab === 'sites' ? sitesColumns :
                  reportView === 'movements' ? historyColumns : totalsColumns
                }
                pageSizeOptions={[10, 25, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                disableRowSelectionOnClick
                rowHeight={60}
                sx={{
                  border: 'none',
                  '& .MuiDataGrid-cell': { 
                    py: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiDataGrid-columnHeaders': { 
                    bgcolor: 'grey.50',
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                  },
                  '& .MuiDataGrid-row': {
                    '&:hover': { bgcolor: 'action.hover' },
                  },
                  '& .MuiDataGrid-columnHeaderTitle': {
                    fontWeight: 600,
                  },
                }}
              />
            )}
          </Paper>
        </Container>

        {/* Stock Modal */}
        <Dialog open={stockModal.open} onClose={() => setStockModal({ ...stockModal, open: false })} maxWidth="xs" fullWidth>
          <DialogTitle>{stockModal.action === 'add' ? 'Add Stock' : 'Dispatch Stock'}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {stockModal.item?.product} ({stockModal.item?.sku})
              <br />
              Current stock: <strong>{stockModal.item?.quantity_on_hand}</strong>
            </Typography>
            <TextField
              autoFocus
              fullWidth
              type="number"
              label="Quantity"
              value={stockModal.quantity}
              onChange={(e) => setStockModal({ ...stockModal, quantity: e.target.value })}
              inputProps={{ min: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStockModal({ ...stockModal, open: false })}>Cancel</Button>
            <Button variant="contained" color={stockModal.action === 'add' ? 'success' : 'warning'} onClick={handleStockAction}>
              {stockModal.action === 'add' ? 'Add Stock' : 'Dispatch'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Bulk Receive Modal */}
        <Dialog open={bulkReceiveModal.open} onClose={() => setBulkReceiveModal({ open: false, items: [], grnNumber: '', submitting: false })} maxWidth="md" fullWidth>
          <DialogTitle>Bulk Receive Stock</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="GRN / Invoice Number"
              placeholder="e.g. GRN-2026-001"
              value={bulkReceiveModal.grnNumber}
              onChange={(e) => setBulkReceiveModal({ ...bulkReceiveModal, grnNumber: e.target.value })}
              sx={{ mb: 3, mt: 1 }}
            />
            <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Box component="table" sx={{ width: '100%', fontSize: 14 }}>
                <Box component="thead" sx={{ bgcolor: 'grey.100', position: 'sticky', top: 0 }}>
                  <Box component="tr">
                    <Box component="th" sx={{ p: 2, textAlign: 'left' }}>SKU</Box>
                    <Box component="th" sx={{ p: 2, textAlign: 'left' }}>Product</Box>
                    <Box component="th" sx={{ p: 2, textAlign: 'right', width: 120 }}>Qty</Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {bulkReceiveModal.items.map((item, idx) => (
                    <Box component="tr" key={item.item_id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Box component="td" sx={{ p: 2, fontFamily: 'monospace', fontSize: 12 }}>{item.sku}</Box>
                      <Box component="td" sx={{ p: 2 }}>{item.product}</Box>
                      <Box component="td" sx={{ p: 1 }}>
                        <TextField
                          size="small"
                          type="number"
                          placeholder="0"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...bulkReceiveModal.items];
                            newItems[idx].quantity = e.target.value;
                            setBulkReceiveModal({ ...bulkReceiveModal, items: newItems });
                          }}
                          inputProps={{ min: 0, style: { textAlign: 'right' } }}
                          sx={{ width: 100 }}
                        />
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Paper>
          </DialogContent>
          <DialogActions>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1, pl: 2 }}>
              {bulkReceiveModal.items.filter((i) => i.quantity && parseInt(i.quantity) > 0).length} items to receive
            </Typography>
            <Button onClick={() => setBulkReceiveModal({ open: false, items: [], grnNumber: '', submitting: false })}>Cancel</Button>
            <Button variant="contained" onClick={handleBulkReceive} disabled={bulkReceiveModal.submitting}>
              {bulkReceiveModal.submitting ? 'Processing...' : 'Receive Stock'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Order View Modal */}
        <Dialog open={orderModal.open} onClose={() => setOrderModal({ open: false, order: null, loading: false })} maxWidth="md" fullWidth>
          {orderModal.loading ? (
            <Box sx={{ p: 8, textAlign: 'center' }} className="no-print">
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>Loading order details...</Typography>
            </Box>
          ) : orderModal.order ? (
            <>
              <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
                <span>Order {orderModal.order.order_number}</span>
                <IconButton onClick={() => setOrderModal({ open: false, order: null, loading: false })}>
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers className="print-content">
                {/* Print Header - only visible when printing */}
                <Box className="print-only" sx={{ 
                  display: 'none', 
                  textAlign: 'center', 
                  mb: 3, 
                  pb: 2, 
                  borderBottom: '3px solid #006633',
                  '@media print': { display: 'block' }
                }}>
                  <Typography variant="h4" sx={{ color: '#006633', fontWeight: 700 }}>REDAN COUPON</Typography>
                  <Typography variant="h6">Request Voucher - {orderModal.order.order_number}</Typography>
                </Box>
                
                {/* Order Info */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Site</Typography>
                    <Typography variant="body1" fontWeight={500}>{orderModal.order.site_name}</Typography>
                    <Typography variant="body2" color="text.secondary">{orderModal.order.city}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Order Date</Typography>
                    <Typography variant="body1">{new Date(orderModal.order.created_at).toLocaleDateString()}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip label={orderModal.order.status} color={STATUS_COLORS[orderModal.order.status] || 'default'} size="small" />
                    </Box>
                  </Box>
                  {orderModal.order.dispatched_at && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Dispatched</Typography>
                      <Typography variant="body1">{new Date(orderModal.order.dispatched_at).toLocaleDateString()}</Typography>
                    </Box>
                  )}
                </Box>

                {/* Dispatch Status Banner */}
                {orderModal.order.status === 'DISPATCHED' && (
                  <Box sx={{ mb: 2, p: 1.5, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
                    <Typography variant="body2" color="success.dark" sx={{ fontWeight: 600 }}>
                      ✓ Fully Dispatched {orderModal.order.dispatched_at && `on ${new Date(orderModal.order.dispatched_at).toLocaleDateString()}`}
                    </Typography>
                  </Box>
                )}
                {orderModal.order.status === 'PARTIAL_DISPATCH' && (
                  <Box sx={{ mb: 2, p: 1.5, bgcolor: 'warning.50', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                    <Typography variant="body2" color="warning.dark" sx={{ fontWeight: 600 }}>
                      ⚠ Partially Dispatched - Some items pending. Dispatch remaining when stock is available.
                    </Typography>
                  </Box>
                )}

                {/* Items Table */}
                <Paper variant="outlined">
                  <Box component="table" sx={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <Box component="thead" sx={{ bgcolor: 'grey.100' }}>
                      <Box component="tr">
                        <Box component="th" sx={{ p: 1.5, textAlign: 'left', borderBottom: '2px solid #006633' }}>Item</Box>
                        <Box component="th" sx={{ p: 1.5, textAlign: 'left', borderBottom: '2px solid #006633' }}>SKU</Box>
                        <Box component="th" sx={{ p: 1.5, textAlign: 'center', borderBottom: '2px solid #006633', width: 60 }}>Qty</Box>
                        <Box component="th" sx={{ p: 1.5, textAlign: 'center', borderBottom: '2px solid #006633', width: 70 }}>Sent</Box>
                        <Box component="th" sx={{ p: 1.5, textAlign: 'center', borderBottom: '2px solid #006633', width: 70 }}>Pending</Box>
                        <Box component="th" sx={{ p: 1.5, textAlign: 'right', borderBottom: '2px solid #006633', width: 80 }}>Unit $</Box>
                        <Box component="th" sx={{ p: 1.5, textAlign: 'right', borderBottom: '2px solid #006633', width: 80 }}>Total $</Box>
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {orderModal.order.items?.map((item, idx) => {
                        const dispatched = item.qty_dispatched || 0;
                        const remaining = item.quantity - dispatched;
                        return (
                          <Box component="tr" key={idx} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: remaining > 0 ? 'warning.50' : 'transparent' }}>
                            <Box component="td" sx={{ p: 1.5 }}>
                              <Typography variant="body2" fontWeight={500} sx={{ fontSize: 13 }}>{item.product}</Typography>
                              {item.employee_name && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>For: {item.employee_name}</Typography>}
                            </Box>
                            <Box component="td" sx={{ p: 1.5, fontFamily: 'monospace', fontSize: 11 }}>{item.sku}</Box>
                            <Box component="td" sx={{ p: 1.5, textAlign: 'center', fontWeight: 500 }}>{item.quantity}</Box>
                            <Box component="td" sx={{ p: 1.5, textAlign: 'center' }}>
                              {dispatched > 0 ? (
                                <Typography variant="body2" sx={{ fontWeight: 600, color: dispatched >= item.quantity ? 'success.main' : 'primary.main', fontSize: 13 }}>
                                  {dispatched >= item.quantity ? `✓${dispatched}` : dispatched}
                                </Typography>
                              ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>0</Typography>
                              )}
                            </Box>
                            <Box component="td" sx={{ p: 1.5, textAlign: 'center' }}>
                              {remaining > 0 ? (
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.dark', fontSize: 13 }}>{remaining}</Typography>
                              ) : (
                                <Typography variant="body2" color="success.main" sx={{ fontSize: 13 }}>✓</Typography>
                              )}
                            </Box>
                            <Box component="td" sx={{ p: 1.5, textAlign: 'right', fontSize: 13 }}>${parseFloat(item.unit_cost).toFixed(2)}</Box>
                            <Box component="td" sx={{ p: 1.5, textAlign: 'right', fontWeight: 600, fontSize: 13 }}>${parseFloat(item.total_cost).toFixed(2)}</Box>
                          </Box>
                        );
                      })}
                    </Box>
                    <Box component="tfoot" sx={{ bgcolor: 'grey.100' }}>
                      <Box component="tr">
                        <Box component="td" colSpan={6} sx={{ p: 1.5, textAlign: 'right', fontWeight: 600, borderTop: '2px solid #006633' }}>Total Amount:</Box>
                        <Box component="td" sx={{ p: 1.5, textAlign: 'right', fontWeight: 700, fontSize: 16, borderTop: '2px solid #006633' }}>${parseFloat(orderModal.order.total_amount).toFixed(2)}</Box>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </DialogContent>
              <DialogActions sx={{ px: 3, py: 2 }} className="no-print">
                {orderModal.order.status === 'PENDING' && (
                  <Button color="error" onClick={() => {
                    const reason = prompt('Reason for declining this order:');
                    if (reason) handleDecline(reason);
                  }}>
                    Decline
                  </Button>
                )}
                {orderModal.order.status === 'PENDING' && (
                  <Button variant="contained" color="success" startIcon={<DispatchIcon />} onClick={() => openDispatchModal(orderModal.order!.id)}>
                    Dispatch
                  </Button>
                )}
                {orderModal.order.status === 'PARTIAL_DISPATCH' && (
                  <Button variant="contained" color="warning" startIcon={<DispatchIcon />} onClick={() => openDispatchModal(orderModal.order!.id)}>
                    Dispatch Remaining
                  </Button>
                )}
                {orderModal.order.status === 'DISPATCHED' && (
                  <Chip label="Fully Dispatched" color="success" size="small" sx={{ mr: 1 }} />
                )}
                <Button startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
              </DialogActions>
            </>
          ) : null}
        </Dialog>

        {/* Dispatch Modal */}
        <Dialog open={dispatchModal.open} onClose={() => setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false, customQty: {} })} maxWidth="md" fullWidth>
          {dispatchModal.loading ? (
            <Box sx={{ p: 8, textAlign: 'center' }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>Checking stock availability...</Typography>
            </Box>
          ) : dispatchModal.dispatchInfo ? (
            <>
              <DialogTitle>Dispatch Order</DialogTitle>
              <DialogContent dividers>
                {/* Summary Cards */}
                <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                  <Card sx={{ flex: 1, textAlign: 'center', bgcolor: 'success.50' }}>
                    <CardContent>
                      <Typography variant="h4" color="success.main">{dispatchModal.dispatchInfo.summary.ready}</Typography>
                      <Typography variant="caption">Ready</Typography>
                    </CardContent>
                  </Card>
                  <Card sx={{ flex: 1, textAlign: 'center', bgcolor: 'warning.50' }}>
                    <CardContent>
                      <Typography variant="h4" color="warning.main">{dispatchModal.dispatchInfo.summary.partial}</Typography>
                      <Typography variant="caption">Partial</Typography>
                    </CardContent>
                  </Card>
                  <Card sx={{ flex: 1, textAlign: 'center', bgcolor: 'error.50' }}>
                    <CardContent>
                      <Typography variant="h4" color="error.main">{dispatchModal.dispatchInfo.summary.unavailable}</Typography>
                      <Typography variant="caption">Unavailable</Typography>
                    </CardContent>
                  </Card>
                  <Card sx={{ flex: 1, textAlign: 'center', bgcolor: 'grey.100' }}>
                    <CardContent>
                      <Typography variant="h4" color="text.secondary">{dispatchModal.dispatchInfo.summary.fulfilled}</Typography>
                      <Typography variant="caption">Already Sent</Typography>
                    </CardContent>
                  </Card>
                </Stack>

                {/* Items List */}
                <Paper variant="outlined">
                  <Box component="table" sx={{ width: '100%', fontSize: 14 }}>
                    <Box component="thead" sx={{ bgcolor: 'grey.50' }}>
                      <Box component="tr">
                        <Box component="th" sx={{ p: 2, textAlign: 'left' }}>Item</Box>
                        <Box component="th" sx={{ p: 2, textAlign: 'center' }}>Need</Box>
                        <Box component="th" sx={{ p: 2, textAlign: 'center' }}>Stock</Box>
                        <Box component="th" sx={{ p: 2, textAlign: 'center', width: 100 }}>Dispatch</Box>
                        <Box component="th" sx={{ p: 2, textAlign: 'center' }}>Status</Box>
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {dispatchModal.dispatchInfo.items.map((item: any) => {
                        const remaining = item.qty_requested - item.qty_dispatched;
                        const maxDispatch = Math.min(remaining, item.stock_available);
                        const currentQty = dispatchModal.customQty[item.id] ?? 0;
                        
                        return (
                          <Box component="tr" key={item.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Box component="td" sx={{ p: 2 }}>
                              <Typography variant="body2" fontWeight={500}>{item.item_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{item.sku}</Typography>
                              {item.size && <Typography variant="caption" color="text.secondary"> (Size: {item.size})</Typography>}
                            </Box>
                            <Box component="td" sx={{ p: 2, textAlign: 'center' }}>
                              <Typography variant="body2">{remaining}</Typography>
                            </Box>
                            <Box component="td" sx={{ p: 2, textAlign: 'center' }}>
                              <Typography 
                                variant="body2" 
                                color={item.stock_available >= remaining ? 'success.main' : item.stock_available > 0 ? 'warning.main' : 'error.main'}
                                fontWeight={500}
                              >
                                {item.stock_available}
                              </Typography>
                            </Box>
                            <Box component="td" sx={{ p: 2, textAlign: 'center' }}>
                              {item.dispatch_status === 'FULFILLED' ? (
                                <Typography variant="body2" color="text.secondary">✓ Sent</Typography>
                              ) : item.stock_available > 0 ? (
                                <TextField
                                  type="number"
                                  size="small"
                                  value={currentQty}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(maxDispatch, parseInt(e.target.value) || 0));
                                    setDispatchModal({
                                      ...dispatchModal,
                                      customQty: { ...dispatchModal.customQty, [item.id]: val }
                                    });
                                  }}
                                  inputProps={{ min: 0, max: maxDispatch, style: { textAlign: 'center', width: 50 } }}
                                  sx={{ width: 80 }}
                                />
                              ) : (
                                <Typography variant="body2" color="error.main">No stock</Typography>
                              )}
                            </Box>
                            <Box component="td" sx={{ p: 2, textAlign: 'center' }}>
                              <Chip
                                size="small"
                                label={
                                  item.dispatch_status === 'FULFILLED' ? 'Sent' : 
                                  currentQty >= remaining ? 'Full' : 
                                  currentQty > 0 ? 'Partial' : 
                                  item.stock_available > 0 ? 'Skip' : 'No Stock'
                                }
                                color={
                                  item.dispatch_status === 'FULFILLED' ? 'default' :
                                  currentQty >= remaining ? 'success' : 
                                  currentQty > 0 ? 'warning' : 
                                  'error'
                                }
                              />
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Paper>
                
                {/* Dispatch Summary */}
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>Will dispatch:</strong> {Object.values(dispatchModal.customQty).reduce((sum, qty) => sum + qty, 0)} items 
                    from {Object.values(dispatchModal.customQty).filter(qty => qty > 0).length} line(s)
                  </Typography>
                </Box>
              </DialogContent>
              <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={() => setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false, customQty: {} })}>Cancel</Button>
                {Object.values(dispatchModal.customQty).some(qty => qty > 0) ? (
                  <Button 
                    variant="contained" 
                    color="success" 
                    onClick={() => handleDispatch(true)} 
                    disabled={dispatchModal.confirming}
                    startIcon={dispatchModal.confirming ? <CircularProgress size={16} /> : null}
                  >
                    {dispatchModal.confirming ? 'Processing...' : `Dispatch ${Object.values(dispatchModal.customQty).reduce((sum, qty) => sum + qty, 0)} Items`}
                  </Button>
                ) : (
                  <Typography color="text.secondary" variant="body2">Adjust quantities to dispatch</Typography>
                )}
              </DialogActions>
            </>
          ) : null}
        </Dialog>

        {/* Site Edit Modal */}
        <Dialog open={siteModal.open} onClose={() => setSiteModal({ open: false, site: null, isNew: false })} maxWidth="sm" fullWidth>
          <DialogTitle>{siteModal.isNew ? 'Add New Site' : 'Edit Site'}</DialogTitle>
          <DialogContent>
            {siteModal.site && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                {/* Site Code - shown only when editing, auto-generated for new sites */}
                {!siteModal.isNew && (
                  <TextField
                    fullWidth
                    label="Site Code"
                    value={siteModal.site.site_code}
                    disabled
                    helperText="Auto-generated from site name"
                  />
                )}
                <TextField
                  fullWidth
                  label="Site Name"
                  value={siteModal.site.name}
                  onChange={(e) => setSiteModal({ ...siteModal, site: { ...siteModal.site!, name: e.target.value } })}
                  placeholder="e.g. Harare Main Branch"
                  required
                  helperText={siteModal.isNew ? "Site code will be auto-generated from name" : ""}
                />
                <TextField
                  fullWidth
                  label="City"
                  value={siteModal.site.city}
                  onChange={(e) => setSiteModal({ ...siteModal, site: { ...siteModal.site!, city: e.target.value } })}
                  placeholder="e.g. Harare"
                />
                <TextField
                  fullWidth
                  label="Address"
                  value={siteModal.site.address}
                  onChange={(e) => setSiteModal({ ...siteModal, site: { ...siteModal.site!, address: e.target.value } })}
                  placeholder="Full street address"
                  multiline
                  rows={2}
                />
                <Stack direction="row" spacing={2}>
                  <TextField
                    fullWidth
                    label="Contact Name"
                    value={siteModal.site.contact_name}
                    onChange={(e) => setSiteModal({ ...siteModal, site: { ...siteModal.site!, contact_name: e.target.value } })}
                    placeholder="Contact person"
                  />
                  <TextField
                    fullWidth
                    label="Phone"
                    value={siteModal.site.phone}
                    onChange={(e) => setSiteModal({ ...siteModal, site: { ...siteModal.site!, phone: e.target.value } })}
                    placeholder="Phone number"
                  />
                </Stack>
                <TextField
                  fullWidth
                  label="Email"
                  value={siteModal.site.email}
                  onChange={(e) => setSiteModal({ ...siteModal, site: { ...siteModal.site!, email: e.target.value } })}
                  placeholder="email@example.com"
                  type="email"
                />
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSiteModal({ open: false, site: null, isNew: false })}>Cancel</Button>
            <Button variant="contained" onClick={saveSite}>
              {siteModal.isNew ? 'Create Site' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
// Build Mon Jan 26 08:47:06 CAT 2026
