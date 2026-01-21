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
  category: string;
  role: string;
  size: string;
  unit: string;
  quantity: number;
  unit_cost: string;
  total_cost: string;
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
type OrderStatus = 'PENDING' | 'PROCESSING' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  DISPATCHED: 'bg-purple-100 text-purple-800',
  RECEIVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
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
                            <div className="text-xs text-slate-400">{item.category} • {item.role}</div>
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
  
  const filteredStock = stock.filter(
    (item) =>
      item.product.toLowerCase().includes(filter.toLowerCase()) ||
      item.sku.toLowerCase().includes(filter.toLowerCase()) ||
      item.category.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by product, SKU, or category..."
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
