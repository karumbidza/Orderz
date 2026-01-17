export default function RootPage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Orderz API</h1>
      <p>Inventory & Ordering System Backend</p>
      <h2>API Endpoints</h2>
      <ul>
        <li><code>GET /api/health</code> - Health check</li>
        <li><code>GET /api/items</code> - List items</li>
        <li><code>GET /api/sites</code> - List sites</li>
        <li><code>GET /api/warehouses</code> - List warehouses</li>
        <li><code>GET /api/stock</code> - Stock levels</li>
        <li><code>GET /api/orders</code> - List orders</li>
        <li><code>POST /api/orders</code> - Create order</li>
        <li><code>GET /api/excel/stock</code> - Excel-optimized stock export</li>
        <li><code>GET /api/excel/items</code> - Excel-optimized items export</li>
      </ul>
    </div>
  );
}
