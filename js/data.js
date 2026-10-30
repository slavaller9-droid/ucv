/**
 * BodegaControl - Datos iniciales y persistencia (localStorage)
 * Inventario Central Único y Compartido para Ventas Presenciales y Tienda Online
 * Estados independientes: Pago, Pedido y Entrega.
 * Métodos de Pago configurables (Yape, Plin, Transferencia Bancaria, Efectivo).
 * Verificación administrativa de comprobantes y auditoría.
 */

const SEED_CATEGORIES = [
  { id: 1, name: 'Abarrotes', icon: '🍚' },
  { id: 2, name: 'Bebidas', icon: '🥤' },
  { id: 3, name: 'Lácteos', icon: '🥛' },
  { id: 4, name: 'Dulces', icon: '🍬' },
  { id: 5, name: 'Snacks', icon: '🍪' },
  { id: 6, name: 'Limpieza', icon: '🧼' },
  { id: 7, name: 'Enlatados', icon: '🥫' },
  { id: 8, name: 'Panadería', icon: '🍞' }
];

const SEED_PRODUCTS = [
  { id: 1, sku: 'AB-001', name: 'Arroz Costeño Extra 1 kg', category: 'Abarrotes', price: 4.80, stock: 34, min: 10, emoji: '🍚', image: '', description: 'Arroz grano largo seleccionado de primera calidad.' },
  { id: 2, sku: 'AB-002', name: 'Aceite Primor Premium 1 L', category: 'Abarrotes', price: 9.50, stock: 8, min: 12, emoji: '🧴', image: '', description: 'Aceite vegetal 100% puro con vitamina E.' },
  { id: 3, sku: 'LA-001', name: 'Leche Evaporada Gloria Azul 400g', category: 'Lácteos', price: 4.20, stock: 26, min: 12, emoji: '🥫', image: '', description: 'Leche entera evaporada enriquecida con vitaminas A y D.' },
  { id: 4, sku: 'BE-001', name: 'Café Altomayo Clásico 200g', category: 'Bebidas', price: 11.50, stock: 5, min: 8, emoji: '☕', image: '', description: 'Café gourmet tostado y molido originario de la selva peruana.' },
  { id: 5, sku: 'AB-003', name: 'Huevos frescos de granja (Docena)', category: 'Abarrotes', price: 8.00, stock: 18, min: 6, emoji: '🥚', image: '', description: 'Huevos rosados frescos de granja seleccionados.' },
  { id: 6, sku: 'PA-001', name: 'Pan de molde Bimbo Blanco', category: 'Panadería', price: 6.80, stock: 14, min: 6, emoji: '🍞', image: '', description: 'Pan de molde suave enriquecido con calcio y hierro.' },
  { id: 7, sku: 'BE-002', name: 'Gaseosa Inca Kola 1.5 L', price: 7.50, stock: 22, min: 10, emoji: '🧃', image: '', description: 'Bebida gaseosa sabor único y refrescante.' },
  { id: 8, sku: 'LI-001', name: 'Detergente Ace Floral 1 kg', category: 'Limpieza', price: 9.20, stock: 15, min: 6, emoji: '🧹', image: '', description: 'Detergente en polvo multiacción para ropa blanca y de color.' },
  { id: 9, sku: 'SN-001', name: 'Galletas Casino Menta (Pack 6)', category: 'Snacks', price: 4.00, stock: 3, min: 8, emoji: '🍪', image: '', description: 'Galletas de chocolate rellenas con crema de menta.' },
  { id: 10, sku: 'EN-001', name: 'Atún Primor en Trozos 170g', category: 'Enlatados', price: 6.20, stock: 16, min: 8, emoji: '🐟', image: '', description: 'Trozos de atún claro en aceite vegetal.' },
  { id: 11, sku: 'AB-004', name: 'Fideos Don Vittorio Spaghetti 500g', category: 'Abarrotes', price: 3.50, stock: 40, min: 15, emoji: '🍝', image: '', description: 'Pasta de trigo candeal de cocción perfecta.' },
  { id: 12, sku: 'LI-002', name: 'Jabón Bolívar Antibacterial', category: 'Limpieza', price: 4.50, stock: 19, min: 8, emoji: '🧼', image: '', description: 'Jabón en barra para cuidado de ropa y limpieza profunda.' },
  { id: 13, sku: 'DU-001', name: 'Chocolate Sublime Clásico 30g', category: 'Dulces', price: 2.20, stock: 45, min: 15, emoji: '🍫', image: '', description: 'Chocolate con leche y trozos de maní tostado.' },
  { id: 14, sku: 'BE-003', name: 'Agua San Mateo sin gas 600ml', category: 'Bebidas', price: 2.50, stock: 0, min: 12, emoji: '💧', image: '', description: 'Agua mineral de manantial pura y natural.' }
];

const SEED_CONFIG = {
  storeName: 'Bodega Don Pepe',
  subtitle: 'Abarrotes, Bebidas y Limpieza',
  ruc: '10458796321',
  address: 'Av. Las Gardenias 452, Urb. El Bosque - Lima',
  phone: '987654321',
  whatsappPrefix: '51',
  whatsappGreeting: '¡Muchas gracias por su compra en Bodega Don Pepe! Que tenga un excelente día y vuelva pronto.',
  currency: 'S/',
  logoImage: ''
};

// Configuración completa de métodos de pago configurables por el Administrador
const SEED_PAYMENT_METHODS = {
  yape: {
    id: 'yape',
    name: 'Yape',
    icon: '🟣',
    active: true,
    phone: '987 654 321',
    owner: 'José Pepe Morales',
    qrImage: '',
    instructions: 'Escanea el código QR desde tu app Yape o transfiere al número celular indicado.'
  },
  plin: {
    id: 'plin',
    name: 'Plin',
    icon: '🔵',
    active: true,
    phone: '987 654 321',
    owner: 'José Pepe Morales',
    qrImage: '',
    instructions: 'Escanea el código QR desde tu app Plin o transfiere al número celular indicado.'
  },
  transferencia: {
    id: 'transferencia',
    name: 'Transferencia Bancaria',
    icon: '🏦',
    active: true,
    bankName: 'BCP (Banco de Crédito del Perú)',
    owner: 'José Pepe Morales',
    accountNumber: '191-98765432-0-88',
    cci: '002-191-009876543208-88',
    qrImage: '',
    instructions: 'Transfiere a nuestra cuenta o CCI desde tu banca por internet y adjunta la constancia.'
  },
  efectivo: {
    id: 'efectivo',
    name: 'Efectivo',
    icon: '💵',
    active: true,
    instructions: 'Paga en efectivo al momento de recibir tu entrega o al recoger en tienda.'
  }
};

const SEED_USERS = [
  // role: 'admin' | 'cajero' | 'cliente'
  // active: true indicates account can log in

  { id: 1, username: 'donpepe', password: '123', name: 'José "Don Pepe" Morales', role: 'admin', roleLabel: 'Administrador', phone: '987654321', email: 'donpepe@bodegacontrol.pe' },
  { id: 2, username: 'cajero1', password: '123', name: 'Ana Lucía Salas', role: 'cajero', roleLabel: 'Cajero', phone: '988112233', email: 'ana.cajera@bodegacontrol.pe' },
  { id: 3, username: 'cliente', password: '123', name: 'María Flores', role: 'cliente', roleLabel: 'Cliente', phone: '991234567', email: 'maria.flores@gmail.com' }
];

const SEED_SALES = [
  {
    id: 101,
    code: 'B001-000101',
    channel: 'presencial',
    date: '2026-10-05 09:15',
    customerName: 'María Flores',
    customerPhone: '991234567',
    operatorName: 'Don Pepe (Admin)',
    paymentMethod: 'Yape',
    paymentStatus: 'Confirmado',
    orderStatus: 'Completado',
    deliveryStatus: 'Entregado',
    cashReceived: null,
    change: null,
    subtotal: 23.50,
    total: 23.50,
    items: [
      { id: 1, name: 'Arroz Costeño Extra 1 kg', price: 4.80, quantity: 2, subtotal: 9.60 },
      { id: 2, name: 'Aceite Primor Premium 1 L', price: 9.50, quantity: 1, subtotal: 9.50 },
      { id: 9, name: 'Galletas Casino Menta (Pack 6)', price: 4.00, quantity: 1, subtotal: 4.00 }
    ]
  },
  {
    id: 102,
    code: 'B001-000102',
    channel: 'presencial',
    date: '2026-10-05 11:40',
    customerName: 'Carlos Ruiz',
    customerPhone: '987112233',
    operatorName: 'Ana Lucía (Cajera)',
    paymentMethod: 'Efectivo',
    paymentStatus: 'Confirmado',
    orderStatus: 'Completado',
    deliveryStatus: 'Entregado',
    cashReceived: 50.00,
    change: 21.60,
    subtotal: 28.40,
    total: 28.40,
    items: [
      { id: 3, name: 'Leche Evaporada Gloria Azul 400g', price: 4.20, quantity: 3, subtotal: 12.60 },
      { id: 5, name: 'Huevos frescos de granja (Docena)', price: 8.00, quantity: 1, subtotal: 8.00 },
      { id: 7, name: 'Gaseosa Inca Kola 1.5 L', price: 7.50, quantity: 1, subtotal: 7.50 }
    ]
  },
  {
    id: 103,
    code: 'B001-000103',
    channel: 'online',
    date: '2026-10-05 14:22',
    customerName: 'Lucía Mendoza',
    customerPhone: '955443322',
    operatorName: 'Don Pepe (Admin)',
    paymentMethod: 'Plin',
    paymentStatus: 'Confirmado',
    orderStatus: 'Completado',
    deliveryStatus: 'Entregado',
    cashReceived: null,
    change: null,
    subtotal: 16.90,
    total: 16.90,
    items: [
      { id: 4, name: 'Café Altomayo Clásico 200g', price: 11.50, quantity: 1, subtotal: 11.50 },
      { id: 11, name: 'Fideos Don Vittorio Spaghetti 500g', price: 3.50, quantity: 1, subtotal: 3.50 },
      { id: 13, name: 'Chocolate Sublime Clásico 30g', price: 2.20, quantity: 1, subtotal: 2.20 }
    ]
  }
];

const SEED_MOVEMENTS = [
  { id: 1, type: 'in', subType: 'entrada', product: 'Arroz Costeño Extra 1 kg', qty: 25, date: '2026-10-04 08:30', user: 'Don Pepe (Admin)', note: 'Compra mayorista distribuidor' },
  { id: 2, type: 'in', subType: 'entrada', product: 'Aceite Primor Premium 1 L', qty: 15, date: '2026-10-04 08:35', user: 'Don Pepe (Admin)', note: 'Compra mayorista distribuidor' },
  { id: 3, type: 'out', subType: 'venta_presencial', product: 'Arroz Costeño Extra 1 kg', qty: 2, date: '2026-10-05 09:15', user: 'Don Pepe (Admin)', note: 'Venta presencial Boleta #B001-000101' },
  { id: 4, type: 'out', subType: 'venta_presencial', product: 'Aceite Primor Premium 1 L', qty: 1, date: '2026-10-05 09:15', user: 'Don Pepe (Admin)', note: 'Venta presencial Boleta #B001-000101' },
  { id: 5, type: 'out', subType: 'venta_presencial', product: 'Leche Evaporada Gloria Azul 400g', qty: 3, date: '2026-10-05 11:40', user: 'Ana Lucía (Cajera)', note: 'Venta presencial Boleta #B001-000102' },
  { id: 6, type: 'out', subType: 'venta_online', product: 'Café Altomayo Clásico 200g', qty: 1, date: '2026-10-05 14:22', user: 'Don Pepe (Admin)', note: 'Venta online Boleta #B001-000103' }
];

// Pedidos Online con estados independientes y comprobantes
const SEED_ONLINE_ORDERS = [
  {
    id: 1,
    code: 'ORD-00104',
    customerName: 'Rodrigo Benítez',
    customerPhone: '984556677',
    deliveryType: 'delivery',
    deliveryAddress: 'Jr. Los Sauces 230, Dpto 301',
    date: '2026-10-06 18:20',
    paymentMethod: 'Yape',
    // 3 Estados independientes:
    paymentStatus: 'Pendiente de verificación', // 'Pendiente de verificación' | 'En revisión' | 'Confirmado' | 'Rechazado'
    orderStatus: 'Pendiente',                 // 'Pendiente' | 'Aceptado' | 'En preparación' | 'Listo para entregar' | 'Cancelado' | 'Completado'
    deliveryStatus: 'Pendiente',              // 'Pendiente' | 'En camino' | 'Entregado'
    items: [
      { id: 1, name: 'Arroz Costeño Extra 1 kg', price: 4.80, quantity: 2, subtotal: 9.60 },
      { id: 7, name: 'Gaseosa Inca Kola 1.5 L', price: 7.50, quantity: 1, subtotal: 7.50 }
    ],
    subtotal: 17.10,
    total: 17.10,
    voucher: {
      image: '',
      fileName: 'constancia_yape_rodrigo.jpg',
      fileSize: '145 KB',
      uploadedAt: '2026-10-06 18:22'
    },
    verificationHistory: [
      {
        action: 'Creado',
        timestamp: '2026-10-06 18:20',
        adminName: 'Sistema',
        notes: 'Pedido registrado por cliente con comprobante adjunto'
      }
    ]
  },
  {
    id: 2,
    code: 'ORD-00105',
    customerName: 'María Flores',
    customerPhone: '991234567',
    deliveryType: 'recojo',
    deliveryAddress: 'Recojo en bodega (Av. Las Gardenias 452)',
    date: '2026-10-06 19:05',
    paymentMethod: 'Transferencia Bancaria',
    paymentStatus: 'Pendiente de verificación',
    orderStatus: 'Pendiente',
    deliveryStatus: 'Pendiente',
    items: [
      { id: 2, name: 'Aceite Primor Premium 1 L', price: 9.50, quantity: 1, subtotal: 9.50 },
      { id: 3, name: 'Leche Evaporada Gloria Azul 400g', price: 4.20, quantity: 2, subtotal: 8.40 }
    ],
    subtotal: 17.90,
    total: 17.90,
    voucher: null,
    verificationHistory: [
      {
        action: 'Creado',
        timestamp: '2026-10-06 19:05',
        adminName: 'Sistema',
        notes: 'Pedido registrado, comprobante pendiente de envío por WhatsApp'
      }
    ]
  }
];

// Helper de persistencia en localStorage
const Storage = {
  getCategories() {
    const raw = localStorage.getItem('bc_categories_v3');
    if (!raw) {
      localStorage.setItem('bc_categories_v3', JSON.stringify(SEED_CATEGORIES));
      return JSON.parse(JSON.stringify(SEED_CATEGORIES));
    }
    return JSON.parse(raw);
  },

  saveCategories(cats) {
    localStorage.setItem('bc_categories_v3', JSON.stringify(cats));
  },

  getProducts() {
    const raw = localStorage.getItem('bc_products_v3');
    if (!raw) {
      localStorage.setItem('bc_products_v3', JSON.stringify(SEED_PRODUCTS));
      return JSON.parse(JSON.stringify(SEED_PRODUCTS));
    }
    return JSON.parse(raw);
  },

  saveProducts(products) {
    localStorage.setItem('bc_products_v3', JSON.stringify(products));
  },

  getSales() {
    const raw = localStorage.getItem('bc_sales_v3');
    if (!raw) {
      localStorage.setItem('bc_sales_v3', JSON.stringify(SEED_SALES));
      return JSON.parse(JSON.stringify(SEED_SALES));
    }
    return JSON.parse(raw);
  },

  saveSales(sales) {
    localStorage.setItem('bc_sales_v3', JSON.stringify(sales));
  },

  getMovements() {
    const raw = localStorage.getItem('bc_movements_v3');
    if (!raw) {
      localStorage.setItem('bc_movements_v3', JSON.stringify(SEED_MOVEMENTS));
      return JSON.parse(JSON.stringify(SEED_MOVEMENTS));
    }
    return JSON.parse(raw);
  },

  saveMovements(movements) {
    localStorage.setItem('bc_movements_v3', JSON.stringify(movements));
  },

  getUsers() {
    const raw = localStorage.getItem('bc_users_v3');
    if (!raw) {
      localStorage.setItem('bc_users_v3', JSON.stringify(SEED_USERS));
      return JSON.parse(JSON.stringify(SEED_USERS));
    }
    return JSON.parse(raw);
  },

  saveUsers(users) {
    localStorage.setItem('bc_users_v3', JSON.stringify(users));
  },

  getConfig() {
    const raw = localStorage.getItem('bc_config_v3');
    if (!raw) {
      localStorage.setItem('bc_config_v3', JSON.stringify(SEED_CONFIG));
      return JSON.parse(JSON.stringify(SEED_CONFIG));
    }
    return JSON.parse(raw);
  },

  saveConfig(cfg) {
    localStorage.setItem('bc_config_v3', JSON.stringify(cfg));
  },

  getPaymentMethods() {
    const raw = localStorage.getItem('bc_payment_methods_v3');
    if (!raw) {
      localStorage.setItem('bc_payment_methods_v3', JSON.stringify(SEED_PAYMENT_METHODS));
      return JSON.parse(JSON.stringify(SEED_PAYMENT_METHODS));
    }
    return JSON.parse(raw);
  },

  savePaymentMethods(methods) {
    localStorage.setItem('bc_payment_methods_v3', JSON.stringify(methods));
  },

  getOnlineOrders() {
    const raw = localStorage.getItem('bc_online_orders_v3');
    if (!raw) {
      localStorage.setItem('bc_online_orders_v3', JSON.stringify(SEED_ONLINE_ORDERS));
      return JSON.parse(JSON.stringify(SEED_ONLINE_ORDERS));
    }
    const orders = JSON.parse(raw);
    // Migración de compatibilidad para asegurar que todos los pedidos tengan los 3 estados y campos
    let changed = false;
    orders.forEach((o) => {
      if (o.paymentStatus === 'Pendiente' || !o.paymentStatus) {
        o.paymentStatus = 'Pendiente de verificación';
        changed = true;
      }
      if (!o.orderStatus) {
        o.orderStatus = 'Pendiente';
        changed = true;
      }
      if (!o.deliveryStatus) {
        o.deliveryStatus = 'Pendiente';
        changed = true;
      }
      if (!o.deliveryType) {
        o.deliveryType = 'delivery';
        changed = true;
      }
      if (!o.verificationHistory) {
        o.verificationHistory = [];
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem('bc_online_orders_v3', JSON.stringify(orders));
    }
    return orders;
  },

  saveOnlineOrders(orders) {
    localStorage.setItem('bc_online_orders_v3', JSON.stringify(orders));
  },

  getNextSaleCode(sales) {
    const nextNum = sales.length + 101;
    return `B001-${String(nextNum).padStart(6, '0')}`;
  },

  getNextOrderCode(orders) {
    const nextNum = orders.length + 106;
    return `ORD-${String(nextNum).padStart(5, '0')}`;
  }
};

function formatMoney(amount) {
  const num = Number(amount) || 0;
  return `S/ ${num.toFixed(2)}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}
