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

type TabValue = 'orders' | 'inventory' | 'history';

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [stockHistory, setStockHistory] = useState<StockMovement[]>([]);
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
  }>({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false });
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

  // Load data on tab change
  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
    else if (activeTab === 'inventory') loadStock();
    else if (activeTab === 'history') loadStockHistory();
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
    setDispatchModal({ open: true, loading: true, orderId, dispatchInfo: null, confirming: false });
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/dispatch`);
      const data = await res.json();
      if (data.success) {
        setDispatchModal({ open: true, loading: false, orderId, dispatchInfo: data.data, confirming: false });
      } else {
        showMessage('Error: ' + data.error, 'error');
        setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false });
      }
    } catch {
      showMessage('Failed to load dispatch info', 'error');
      setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false });
    }
  };

  const handleDispatch = async (forcePartial: boolean = false) => {
    if (!dispatchModal.orderId) return;
    setDispatchModal({ ...dispatchModal, confirming: true });
    try {
      const res = await fetch(`/api/admin/orders/${dispatchModal.orderId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_partial: forcePartial }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message, 'success');
        setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false });
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
  // FILTERED DATA
  // ─────────────────────────────────────────
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.voucher_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.site_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.site_city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
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

  const uniqueCategories = Array.from(new Set(stock.map(s => s.category)));
  const uniqueStatuses = Array.from(new Set(orders.map(o => o.status)));

  // ─────────────────────────────────────────
  // DATA GRID COLUMNS
  // ─────────────────────────────────────────
  const ordersColumns: GridColDef[] = [
    { field: 'voucher_number', headerName: 'Order #', width: 130, renderCell: (params) => (
      <Typography variant="body2" fontFamily="monospace" fontWeight={500}>{params.value}</Typography>
    )},
    { field: 'site_name', headerName: 'Site', width: 140, renderCell: (params) => (
      <Typography variant="body2" fontWeight={500}>{params.value}</Typography>
    )},
    { field: 'site_city', headerName: 'City', width: 110, renderCell: (params) => (
      <Typography variant="body2" color="text.secondary">{params.value}</Typography>
    )},
    { field: 'site_address', headerName: 'Address', width: 160, renderCell: (params) => (
      <Tooltip title={params.value || ''} arrow placement="top">
        <Typography variant="body2" color="text.secondary" noWrap sx={{ cursor: 'pointer' }}>
          {params.value || '—'}
        </Typography>
      </Tooltip>
    )},
    { field: 'status', headerName: 'Status', width: 140, renderCell: (params) => (
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

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* App Bar */}
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Redan Coupon
            </Typography>
            <IconButton onClick={() => {
              if (activeTab === 'orders') loadOrders();
              else if (activeTab === 'inventory') loadStock();
              else loadStockHistory();
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
                {activeTab === 'orders' ? 'Orders' : activeTab === 'inventory' ? 'Inventory' : 'Stock History'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {activeTab === 'orders' ? 'Manage incoming orders and dispatches' : 
                 activeTab === 'inventory' ? 'Track stock levels and manage inventory' : 
                 'View stock movement history'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              {activeTab === 'inventory' && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={openBulkReceiveModal}>
                  Bulk Receive
                </Button>
              )}
            </Stack>
          </Box>

          {/* Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Tabs value={activeTab} onChange={(_, v) => { setActiveTab(v); setSearchQuery(''); setStatusFilter('all'); setCategoryFilter('all'); setTypeFilter('all'); }} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab icon={<ReceiptIcon />} iconPosition="start" label="Orders" value="orders" />
              <Tab icon={<InventoryIcon />} iconPosition="start" label="Inventory" value="inventory" />
              <Tab icon={<HistoryIcon />} iconPosition="start" label="Stock History" value="history" />
            </Tabs>
          </Paper>

          {/* Search and Filters */}
          <Paper sx={{ mb: 2, p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                size="small"
                placeholder={activeTab === 'orders' ? 'Search orders...' : activeTab === 'inventory' ? 'Search products...' : 'Search movements...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                }}
                sx={{ minWidth: 300 }}
              />
              <FilterIcon sx={{ color: 'text.secondary' }} />
              {activeTab === 'orders' && (
                <TextField
                  select
                  size="small"
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  SelectProps={{ native: true }}
                  sx={{ minWidth: 150 }}
                >
                  <option value="all">All Statuses</option>
                  {uniqueStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </TextField>
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
              {activeTab === 'history' && (
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
              <Box sx={{ flex: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {activeTab === 'orders' ? `${filteredOrders.length} orders` : 
                 activeTab === 'inventory' ? `${filteredStock.length} items` : 
                 `${filteredHistory.length} movements`}
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
                rows={activeTab === 'orders' ? filteredOrders : activeTab === 'inventory' ? filteredStock.map(s => ({ ...s, id: s.item_id })) : filteredHistory}
                columns={activeTab === 'orders' ? ordersColumns : activeTab === 'inventory' ? inventoryColumns : historyColumns}
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
            <Box sx={{ p: 8, textAlign: 'center' }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>Loading order details...</Typography>
            </Box>
          ) : orderModal.order ? (
            <>
              <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Order {orderModal.order.order_number}</span>
                <IconButton onClick={() => setOrderModal({ open: false, order: null, loading: false })}>
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers>
                {/* Order Info */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, mb: 3 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Site</Typography>
                    <Typography variant="body1" fontWeight={500}>{orderModal.order.site_name}</Typography>
                    <Typography variant="body2" color="text.secondary">{orderModal.order.city}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Date</Typography>
                    <Typography variant="body1">{new Date(orderModal.order.created_at).toLocaleDateString()}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip label={orderModal.order.status} color={STATUS_COLORS[orderModal.order.status] || 'default'} size="small" />
                    </Box>
                  </Box>
                </Box>

                {/* Items Table */}
                <Paper variant="outlined">
                  <Box component="table" sx={{ width: '100%', fontSize: 14 }}>
                    <Box component="thead" sx={{ bgcolor: 'grey.50' }}>
                      <Box component="tr">
                        <Box component="th" sx={{ p: 2, textAlign: 'left' }}>Item</Box>
                        <Box component="th" sx={{ p: 2, textAlign: 'left' }}>SKU</Box>
                        <Box component="th" sx={{ p: 2, textAlign: 'center' }}>Size</Box>
                        <Box component="th" sx={{ p: 2, textAlign: 'center' }}>Qty</Box>
                        <Box component="th" sx={{ p: 2, textAlign: 'right' }}>Unit Cost</Box>
                        <Box component="th" sx={{ p: 2, textAlign: 'right' }}>Total</Box>
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {orderModal.order.items?.map((item, idx) => (
                        <Box component="tr" key={idx} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Box component="td" sx={{ p: 2 }}>
                            <Typography variant="body2" fontWeight={500}>{item.product}</Typography>
                            {item.employee_name && <Typography variant="caption" color="text.secondary">For: {item.employee_name}</Typography>}
                          </Box>
                          <Box component="td" sx={{ p: 2, fontFamily: 'monospace', fontSize: 12 }}>{item.sku}</Box>
                          <Box component="td" sx={{ p: 2, textAlign: 'center' }}>{item.size || '-'}</Box>
                          <Box component="td" sx={{ p: 2, textAlign: 'center' }}>{item.quantity}</Box>
                          <Box component="td" sx={{ p: 2, textAlign: 'right' }}>${parseFloat(item.unit_cost).toFixed(2)}</Box>
                          <Box component="td" sx={{ p: 2, textAlign: 'right', fontWeight: 600 }}>${parseFloat(item.total_cost).toFixed(2)}</Box>
                        </Box>
                      ))}
                    </Box>
                    <Box component="tfoot" sx={{ bgcolor: 'grey.50' }}>
                      <Box component="tr">
                        <Box component="td" colSpan={5} sx={{ p: 2, textAlign: 'right', fontWeight: 600 }}>Total Amount:</Box>
                        <Box component="td" sx={{ p: 2, textAlign: 'right', fontWeight: 700, fontSize: 18 }}>${parseFloat(orderModal.order.total_amount).toFixed(2)}</Box>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </DialogContent>
              <DialogActions sx={{ px: 3, py: 2 }}>
                {(orderModal.order.status === 'PENDING' || orderModal.order.status === 'PARTIAL_DISPATCH') && (
                  <>
                    <Button color="error" onClick={() => {
                      const reason = prompt('Reason for declining this order:');
                      if (reason) handleDecline(reason);
                    }}>
                      Decline
                    </Button>
                    <Button variant="contained" color="success" startIcon={<DispatchIcon />} onClick={() => openDispatchModal(orderModal.order!.id)}>
                      Dispatch
                    </Button>
                  </>
                )}
                <Button startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
              </DialogActions>
            </>
          ) : null}
        </Dialog>

        {/* Dispatch Modal */}
        <Dialog open={dispatchModal.open} onClose={() => setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false })} maxWidth="sm" fullWidth>
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
                        <Box component="th" sx={{ p: 2, textAlign: 'center' }}>Requested</Box>
                        <Box component="th" sx={{ p: 2, textAlign: 'center' }}>In Stock</Box>
                        <Box component="th" sx={{ p: 2, textAlign: 'center' }}>Status</Box>
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {dispatchModal.dispatchInfo.items.map((item: any) => (
                        <Box component="tr" key={item.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Box component="td" sx={{ p: 2 }}>
                            <Typography variant="body2" fontWeight={500}>{item.item_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{item.sku}</Typography>
                          </Box>
                          <Box component="td" sx={{ p: 2, textAlign: 'center' }}>{item.qty_requested - item.qty_dispatched}</Box>
                          <Box component="td" sx={{ p: 2, textAlign: 'center' }}>{item.stock_available}</Box>
                          <Box component="td" sx={{ p: 2, textAlign: 'center' }}>
                            <Chip
                              size="small"
                              label={item.dispatch_status === 'FULFILLED' ? 'Sent' : item.dispatch_status === 'READY' ? 'Ready' : item.dispatch_status === 'PARTIAL' ? 'Partial' : 'No Stock'}
                              color={item.dispatch_status === 'FULFILLED' || item.dispatch_status === 'READY' ? 'success' : item.dispatch_status === 'PARTIAL' ? 'warning' : 'error'}
                            />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Paper>
              </DialogContent>
              <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={() => setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false })}>Cancel</Button>
                {!dispatchModal.dispatchInfo.summary.can_dispatch_full && dispatchModal.dispatchInfo.summary.can_dispatch_partial && (
                  <Button variant="contained" color="warning" onClick={() => handleDispatch(true)} disabled={dispatchModal.confirming}>
                    {dispatchModal.confirming ? 'Processing...' : 'Dispatch Available Only'}
                  </Button>
                )}
                {dispatchModal.dispatchInfo.summary.can_dispatch_full && (
                  <Button variant="contained" color="success" onClick={() => handleDispatch(false)} disabled={dispatchModal.confirming}>
                    {dispatchModal.confirming ? 'Processing...' : 'Dispatch All'}
                  </Button>
                )}
                {!dispatchModal.dispatchInfo.summary.can_dispatch_partial && (
                  <Typography color="error" variant="body2">No items available to dispatch</Typography>
                )}
              </DialogActions>
            </>
          ) : null}
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
