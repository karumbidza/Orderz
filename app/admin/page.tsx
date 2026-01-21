'use client';

import { useState, useEffect } from 'react';

// Types
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
  items: OrderItem[];
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

type Tab = 'orders' | 'inventory';
type OrderStatus = 'PENDING' | 'PROCESSING' | 'DISPATCHED' | 'PARTIAL_DISPATCH' | 'RECEIVED' | 'DECLINED' | 'CANCELLED';
type InventoryCategory = 'all' | 'PPE' | 'Uniforms' | 'Stationery' | 'Consumable';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  DISPATCHED: 'bg-purple-100 text-purple-800',
  PARTIAL_DISPATCH: 'bg-orange-100 text-orange-800',
  RECEIVED: 'bg-green-100 text-green-800',
  DECLINED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const DISPATCH_STATUS_COLORS: Record<string, string> = {
  FULFILLED: 'bg-green-100 text-green-800',
  READY: 'bg-green-50 text-green-700',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  UNAVAILABLE: 'bg-red-100 text-red-800',
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Load data on tab change
  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    } else {
      loadStock();
    }
  }, [activeTab]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  // ─────────────────────────────────────────
  // ORDERS
  // ─────────────────────────────────────────

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders?limit=200');
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
      } else {
        showMessage('Error: ' + data.error);
      }
    } catch (err) {
      showMessage('Failed to load orders');
    }
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: number, newStatus: OrderStatus) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Status updated to ' + newStatus);
        loadOrders();
      } else {
        showMessage('Error: ' + data.error);
      }
    } catch (err) {
      showMessage('Failed to update status');
    }
  };

  // ─────────────────────────────────────────
  // VIEW ORDER MODAL
  // ─────────────────────────────────────────

  const [orderModal, setOrderModal] = useState<{
    open: boolean;
    order: OrderDetail | null;
    loading: boolean;
  }>({ open: false, order: null, loading: false });

  const viewOrder = async (orderId: number) => {
    setOrderModal({ open: true, order: null, loading: true });
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (data.success) {
        setOrderModal({ open: true, order: data.data, loading: false });
      } else {
        showMessage('Error loading order details');
        setOrderModal({ open: false, order: null, loading: false });
      }
    } catch (err) {
      showMessage('Failed to load order');
      setOrderModal({ open: false, order: null, loading: false });
    }
  };

  const printOrder = () => {
    window.print();
  };

  // ─────────────────────────────────────────
  // DISPATCH MODAL
  // ─────────────────────────────────────────

  const [dispatchModal, setDispatchModal] = useState<{
    open: boolean;
    loading: boolean;
    orderId: number | null;
    dispatchInfo: DispatchInfo | null;
    confirming: boolean;
  }>({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false });

  const openDispatchModal = async (orderId: number) => {
    setDispatchModal({ open: true, loading: true, orderId, dispatchInfo: null, confirming: false });
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/dispatch`);
      const data = await res.json();
      if (data.success) {
        setDispatchModal({ 
          open: true, 
          loading: false, 
          orderId, 
          dispatchInfo: data.data, 
          confirming: false 
        });
      } else {
        showMessage('Error: ' + data.error);
        setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false });
      }
    } catch (err) {
      showMessage('Failed to load dispatch info');
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
        showMessage(data.message);
        setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false });
        setOrderModal({ open: false, order: null, loading: false });
        loadOrders();
      } else if (data.require_confirmation) {
        // Show partial dispatch confirmation
        showMessage('Partial dispatch available. Click "Dispatch Available" to proceed.');
        setDispatchModal({ ...dispatchModal, confirming: false });
      } else {
        showMessage('Error: ' + data.error);
        setDispatchModal({ ...dispatchModal, confirming: false });
      }
    } catch (err) {
      showMessage('Failed to dispatch');
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
        showMessage('Order declined');
        setOrderModal({ open: false, order: null, loading: false });
        loadOrders();
      } else {
        showMessage('Error: ' + data.error);
      }
    } catch (err) {
      showMessage('Failed to decline order');
    }
  };

  // ─────────────────────────────────────────
  // INVENTORY
  // ─────────────────────────────────────────

  const loadStock = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stock');
      const data = await res.json();
      if (data.success) {
        setStock(data.data);
      } else {
        showMessage('Error: ' + data.error);
      }
    } catch (err) {
      showMessage('Failed to load stock');
    }
    setLoading(false);
  };

  const addStock = async (itemId: number, quantity: number) => {
    try {
      const res = await fetch('/api/admin/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          warehouse_id: 2,
          quantity,
          reason: 'Manual add via admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message);
        loadStock();
      } else {
        showMessage('Error: ' + data.error);
      }
    } catch (err) {
      showMessage('Failed to add stock');
    }
  };

  const dispatchStock = async (itemId: number, quantity: number) => {
    try {
      const res = await fetch('/api/admin/stock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          warehouse_id: 2,
          quantity,
          reason: 'Manual dispatch via admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message);
        loadStock();
      } else {
        showMessage('Error: ' + data.error);
      }
    } catch (err) {
      showMessage('Failed to dispatch');
    }
  };

  // ─────────────────────────────────────────
  // STOCK ACTION MODAL
  // ─────────────────────────────────────────

  const [stockModal, setStockModal] = useState<{
    open: boolean;
    action: 'add' | 'dispatch';
    item: StockItem | null;
    quantity: string;
  }>({ open: false, action: 'add', item: null, quantity: '' });

  const openStockModal = (item: StockItem, action: 'add' | 'dispatch') => {
    setStockModal({ open: true, action, item, quantity: '' });
  };

  const handleStockAction = () => {
    const qty = parseInt(stockModal.quantity);
    if (!stockModal.item || isNaN(qty) || qty <= 0) {
      showMessage('Enter a valid quantity');
      return;
    }
    if (stockModal.action === 'add') {
      addStock(stockModal.item.item_id, qty);
    } else {
      dispatchStock(stockModal.item.item_id, qty);
    }
    setStockModal({ ...stockModal, open: false });
  };

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Redan Coupon</h1>
            <p className="text-sm text-slate-500">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            {message && (
              <span className="px-3 py-1 bg-slate-900 text-white text-sm rounded-full">
                {message}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'orders'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Orders
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'inventory'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Inventory
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 print:hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : activeTab === 'orders' ? (
          <OrdersTable orders={orders} onStatusChange={updateOrderStatus} onViewOrder={viewOrder} />
        ) : (
          <InventoryTable stock={stock} onAction={openStockModal} />
        )}
      </main>

      {/* Stock Modal */}
      {stockModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4">
              {stockModal.action === 'add' ? 'Add Stock' : 'Dispatch Stock'}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {stockModal.item?.product} ({stockModal.item?.sku})
              <br />
              Current stock: <strong>{stockModal.item?.quantity_on_hand}</strong>
            </p>
            <input
              type="number"
              min="1"
              placeholder="Quantity"
              value={stockModal.quantity}
              onChange={(e) => setStockModal({ ...stockModal, quantity: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setStockModal({ ...stockModal, open: false })}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleStockAction}
                className={`px-4 py-2 text-sm text-white rounded-lg ${
                  stockModal.action === 'add'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {stockModal.action === 'add' ? 'Add Stock' : 'Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order View Modal */}
      {orderModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:bg-white print:static">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-auto shadow-xl print:shadow-none print:max-w-none print:max-h-none print:rounded-none">
            {orderModal.loading ? (
              <div className="p-12 text-center text-slate-500">Loading order details...</div>
            ) : orderModal.order ? (
              <div className="print:p-0">
                {/* Modal Header - hidden on print */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 print:hidden">
                  <h3 className="text-lg font-semibold">Order Details</h3>
                  <div className="flex gap-2">
                    {/* Dispatch/Decline buttons for PENDING or PARTIAL_DISPATCH orders */}
                    {(orderModal.order.status === 'PENDING' || orderModal.order.status === 'PARTIAL_DISPATCH') && (
                      <>
                        <button
                          onClick={() => openDispatchModal(orderModal.order!.id)}
                          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          📦 Dispatch
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Reason for declining this order:');
                            if (reason) handleDecline(reason);
                          }}
                          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          ✕ Decline
                        </button>
                      </>
                    )}
                    <button
                      onClick={printOrder}
                      className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                    >
                      🖨 Print
                    </button>
                    <button
                      onClick={() => setOrderModal({ open: false, order: null, loading: false })}
                      className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* Printable Order Content */}
                <div className="p-6 print:p-8" id="printable-order">
                  {/* Company Header */}
                  <div className="text-center mb-6 print:mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">REDAN COUPON</h1>
                    <p className="text-sm text-slate-500">Order Voucher</p>
                  </div>

                  {/* Order Info Grid */}
                  <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
                    <div>
                      <p className="text-slate-500">Order Number</p>
                      <p className="font-mono font-semibold">{orderModal.order.order_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500">Date</p>
                      <p className="font-semibold">{new Date(orderModal.order.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Site</p>
                      <p className="font-semibold">{orderModal.order.site_name}</p>
                      <p className="text-xs text-slate-400">{orderModal.order.site_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500">City</p>
                      <p className="font-semibold">{orderModal.order.city}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Status</p>
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[orderModal.order.status] || 'bg-slate-100'}`}>
                        {orderModal.order.status}
                      </span>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="w-full text-sm border border-slate-200 mb-6">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 border-b">Item</th>
                        <th className="text-left px-3 py-2 border-b">SKU</th>
                        <th className="text-left px-3 py-2 border-b">Size</th>
                        <th className="text-center px-3 py-2 border-b">Qty</th>
                        <th className="text-right px-3 py-2 border-b">Unit Cost</th>
                        <th className="text-right px-3 py-2 border-b">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderModal.order.items?.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="px-3 py-2">
                            <div className="font-medium">{item.product}</div>
                            {item.employee_name && <div className="text-xs text-slate-400">For: {item.employee_name}</div>}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{item.sku}</td>
                          <td className="px-3 py-2">{item.size || '-'}</td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">${parseFloat(item.unit_cost).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-medium">${parseFloat(item.total_cost).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50">
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-right font-semibold">Total Amount:</td>
                        <td className="px-3 py-3 text-right font-bold text-lg">${parseFloat(orderModal.order.total_amount).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Footer */}
                  <div className="text-center text-xs text-slate-400 pt-4 border-t border-slate-200">
                    <p>Thank you for your order</p>
                    <p>Redan Coupon • Head Office</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-auto shadow-xl">
            {dispatchModal.loading ? (
              <div className="p-12 text-center text-slate-500">Checking stock availability...</div>
            ) : dispatchModal.dispatchInfo ? (
              <>
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold">Dispatch Order</h3>
                  <p className="text-sm text-slate-500">
                    {dispatchModal.dispatchInfo.summary.ready + dispatchModal.dispatchInfo.summary.fulfilled} of {dispatchModal.dispatchInfo.summary.total_items} items ready
                  </p>
                </div>
                
                {/* Summary */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{dispatchModal.dispatchInfo.summary.ready}</div>
                    <div className="text-xs text-slate-500">Ready</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{dispatchModal.dispatchInfo.summary.partial}</div>
                    <div className="text-xs text-slate-500">Partial</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{dispatchModal.dispatchInfo.summary.unavailable}</div>
                    <div className="text-xs text-slate-500">Unavailable</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-400">{dispatchModal.dispatchInfo.summary.fulfilled}</div>
                    <div className="text-xs text-slate-500">Already Sent</div>
                  </div>
                </div>

                {/* Items List */}
                <div className="px-6 py-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Item</th>
                        <th className="text-center py-2">Requested</th>
                        <th className="text-center py-2">In Stock</th>
                        <th className="text-center py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dispatchModal.dispatchInfo.items.map((item: any) => (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-2">
                            <div className="font-medium">{item.item_name}</div>
                            <div className="text-xs text-slate-400">{item.sku}</div>
                          </td>
                          <td className="py-2 text-center">{item.qty_requested - item.qty_dispatched}</td>
                          <td className="py-2 text-center">{item.stock_available}</td>
                          <td className="py-2 text-center">
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${DISPATCH_STATUS_COLORS[item.dispatch_status] || 'bg-slate-100'}`}>
                              {item.dispatch_status === 'FULFILLED' ? '✓ Sent' : 
                               item.dispatch_status === 'READY' ? '✓ Ready' :
                               item.dispatch_status === 'PARTIAL' ? '⚠ Partial' : '✕ No Stock'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    onClick={() => setDispatchModal({ open: false, loading: false, orderId: null, dispatchInfo: null, confirming: false })}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  {!dispatchModal.dispatchInfo.summary.can_dispatch_full && dispatchModal.dispatchInfo.summary.can_dispatch_partial && (
                    <button
                      onClick={() => handleDispatch(true)}
                      disabled={dispatchModal.confirming}
                      className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                    >
                      {dispatchModal.confirming ? 'Processing...' : '⚠ Dispatch Available Only'}
                    </button>
                  )}
                  {dispatchModal.dispatchInfo.summary.can_dispatch_full && (
                    <button
                      onClick={() => handleDispatch(false)}
                      disabled={dispatchModal.confirming}
                      className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {dispatchModal.confirming ? 'Processing...' : '✓ Dispatch All'}
                    </button>
                  )}
                  {!dispatchModal.dispatchInfo.summary.can_dispatch_partial && (
                    <span className="px-4 py-2 text-sm text-red-600">No items available to dispatch</span>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// ORDERS TABLE COMPONENT
// ─────────────────────────────────────────

function OrdersTable({
  orders,
  onStatusChange,
  onViewOrder,
}: {
  orders: Order[];
  onStatusChange: (id: number, status: OrderStatus) => void;
  onViewOrder: (id: number) => void;
}) {
  const statuses: OrderStatus[] = ['PENDING', 'PROCESSING', 'DISPATCHED', 'RECEIVED', 'CANCELLED'];

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Order #</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Site</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">City</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{order.voucher_number}</td>
                <td className="px-4 py-3">{order.site_name}</td>
                <td className="px-4 py-3 text-slate-500">{order.site_city}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  ${parseFloat(order.total_amount).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(order.order_date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onViewOrder(order.id)}
                      className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors"
                    >
                      View
                    </button>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          onStatusChange(order.id, e.target.value as OrderStatus);
                        }
                      }}
                      className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    >
                      <option value="">Status...</option>
                      {statuses
                        .filter((s) => s !== order.status)
                        .map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="text-center py-12 text-slate-500">No orders found</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// INVENTORY TABLE COMPONENT
// ─────────────────────────────────────────

function InventoryTable({
  stock,
  onAction,
}: {
  stock: StockItem[];
  onAction: (item: StockItem, action: 'add' | 'dispatch') => void;
}) {
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('all');
  
  const categories: { key: InventoryCategory; label: string }[] = [
    { key: 'all', label: 'All Items' },
    { key: 'PPE', label: 'PPE' },
    { key: 'Uniforms', label: 'Uniforms' },
    { key: 'Stationery', label: 'Stationery' },
    { key: 'Consumable', label: 'Consumables' },
  ];
  
  const filteredStock = stock.filter((item) => {
    const matchesSearch = 
      item.product.toLowerCase().includes(filter.toLowerCase()) ||
      item.sku.toLowerCase().includes(filter.toLowerCase()) ||
      item.category.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = category === 'all' || item.category === category;
    return matchesSearch && matchesCategory;
  });

  // Get counts per category
  const getCategoryCount = (cat: InventoryCategory) => {
    if (cat === 'all') return stock.length;
    return stock.filter(item => item.category === cat).length;
  };

  return (
    <div>
      {/* Category Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              category === cat.key
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat.label}
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
              category === cat.key ? 'bg-white/20' : 'bg-slate-100'
            }`}>
              {getCategoryCount(cat.key)}
            </span>
          </button>
        ))}
      </div>
      
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by product or SKU..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Stock</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Unit</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Cost</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStock.map((item) => (
                <tr key={item.item_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-3">{item.product}</td>
                  <td className="px-4 py-3 text-slate-500">{item.category}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-medium ${
                        item.quantity_on_hand === 0
                          ? 'text-red-600'
                          : item.quantity_on_hand < 10
                          ? 'text-orange-600'
                          : 'text-slate-900'
                      }`}
                    >
                      {item.quantity_on_hand}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{item.unit}</td>
                  <td className="px-4 py-3 text-right">${parseFloat(item.cost).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onAction(item, 'add')}
                        className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                      >
                        + Add
                      </button>
                      <button
                        onClick={() => onAction(item, 'dispatch')}
                        disabled={item.quantity_on_hand === 0}
                        className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        − Dispatch
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredStock.length === 0 && (
            <div className="text-center py-12 text-slate-500">No items found</div>
          )}
        </div>
      </div>
    </div>
  );
}
