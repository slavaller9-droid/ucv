/**
 * BodegaControl - Aplicación Principal
 * Maneja Inventario Central Único, Dos Interfaces Separadas (Panel Personal y Tienda Online),
 * Roles (Administrador, Cajero, Cliente), Registro de Clientes, Creación de Cajeros,
 * Categorías Dinámicas, Subida de Imágenes Reales (Logo, QR Yape, QR Plin, Productos),
 * Ciclo de Pedidos Online con "✅ PAGO CONFIRMADO", Descuento Automático de Stock
 * y Apertura Automática de WhatsApp con el Comprobante Preparado.
 */

// ==================== ESTADO GLOBAL ====================
let products = [];
let categories = [];
let sales = [];
let movements = [];
let storeConfig = {};
let users = [];
let onlineOrders = [];
let paymentMethods = [];

// Carritos y seguimiento
let posCart = [];
let onlineCart = [];
let onlineSelectedPaymentMethod = 'Yape';
let activeTrackingOrderId = null;
let activeRejectOrderId = null;
let activeVoucherFile = null;
let activeReuploadVoucher = null;
let currentDeliveryMethod = 'delivery'; // 'delivery' | 'recojo'
let tempMethodQrImages = { yape: '', plin: '', transferencia: '' };

// ==================== USUARIO Y SESIÓN ====================
let currentUser = null;
let currentRole = 'admin';

// ==================== BODEGA ACTIVA ====================
let activeStoreId = null;
let activeStoreRole = null;

function getStoreCollection(collectionName) {
  if (!activeStoreId) {
    throw new Error('No hay una bodega seleccionada.');
  }

  return db.collection('bodegas')
    .doc(activeStoreId)
    .collection(collectionName);
}

// ==================== CARGAR DATOS DE UNA BODEGA ====================
async function loadStoreData(bodegaId) {
  const collections = {
    products: 'productos',
    categories: 'categorias',
    sales: 'ventas',
    movements: 'movimientos',
    onlineOrders: 'pedidos'
  };

  const loadedData = {};

  for (const [key, collectionName] of Object.entries(collections)) {
    const snapshot = await db
      .collection('bodegas')
      .doc(bodegaId)
      .collection(collectionName)
      .get();

    loadedData[key] = snapshot.docs
      .filter(doc => !doc.data().marcador)
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  }

  products = loadedData.products;
  categories = loadedData.categories;
  sales = loadedData.sales;
  movements = loadedData.movements;
  onlineOrders = loadedData.onlineOrders;

  activeStoreId = bodegaId;

  console.log('Datos de bodega cargados:', bodegaId);
}

// ==================== VARIABLES DE MÓDULOS ====================
let selectedPosPaymentMethod = 'Efectivo';
let currentBoleta = null;
let editingProductId = null;
let editingCategoryId = null;

// Archivos de imagen en memoria
let tempUploadedProductImage = '';

// Filtros
let currentPosCategory = 'Todos';
let currentInvCategory = 'Todos';
let currentClientCategory = 'Todos';
let movementFilter = 'all';

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
  initDateDisplay();
  initAuth();
  initNavigation();
  initModals();
  initCategoriesModule();
  initInventoryModule();
  initPosModule();
  initClientStoreModule();
  initOnlineOrdersModule();
  initPaymentVerificationModule();
  initPaymentMethodsModule();
  initReportsModule();
  initUsersModule();
  initConfigModule();
  applyStoreBranding();
  renderAllViews();
});

// Elemento auxiliar
const $ = (id) => document.getElementById(id);

function initDateDisplay() {
  const now = new Date();
  const str = now.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  const el = $('currentDate');
  if (el) el.textContent = str.charAt(0).toUpperCase() + str.slice(1);
}


// ==================== AUTENTICACIÓN CON GOOGLE ====================

function initAuth() {
  const googleBtn = $('googleLoginBtn');
  const loginMsg = $('loginMsg');
  const authLoading = $('authLoading');
  const accountSetup = $('accountSetup');

  
  // Crear una bodega y registrar a su propietario
  const createStoreBtn = $('createStoreBtn');
  const createStoreForm = $('createStoreForm');
  const saveStoreBtn = $('saveStoreBtn');
  const storeName = $('storeName');
  const storeAddress = $('storeAddress');
  const storeMsg = $('storeMsg');

  if (createStoreBtn && createStoreForm) {
    createStoreBtn.addEventListener('click', () => {
      createStoreForm.classList.toggle('hidden');
    });
  }

  if (saveStoreBtn) {
    saveStoreBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      const nombre = storeName.value.trim();
      const direccion = storeAddress.value.trim();

      if (!user) {
        storeMsg.textContent = 'Inicia sesión primero.';
        return;
      }

      if (!nombre) {
        storeMsg.textContent = 'Escribe el nombre de tu bodega.';
        storeName.focus();
        return;
      }

      try {
        saveStoreBtn.disabled = true;
        storeMsg.textContent = 'Registrando tu bodega...';

        // Crear identificador único
        const bodegaRef = db.collection('bodegas').doc();

        // Identificador único de la membresía
        const membresiaRef = db.collection('membresias')
          .doc(`${bodegaRef.id}_${user.uid}`);

        // Guardar ambos documentos en una sola operación
        const batch = db.batch();

        batch.set(bodegaRef, {
          nombre: nombre,
          direccion: direccion,
          propietarioUid: user.uid,
          fechaCreacion:
            firebase.firestore.FieldValue.serverTimestamp(),
          estado: 'activa'
        });

        batch.set(membresiaRef, {
          usuarioUid: user.uid,
          bodegaId: bodegaRef.id,
          rol: 'admin',
          estado: 'activo',
          fechaCreacion:
            firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        storeMsg.textContent =
          '¡Tu bodega fue creada correctamente! Ya eres su administrador.';

        saveStoreBtn.textContent = 'Bodega creada';
        showToast('¡Bodega registrada correctamente!');

      } catch (error) {
        console.error('Error al crear bodega:', error);

        storeMsg.textContent =
          'No se pudo crear la bodega: ' + error.message;

        saveStoreBtn.disabled = false;
      }
    });
  }

  if (!window.auth || !window.db) {
    if (loginMsg) {
      loginMsg.textContent = 'No se pudo conectar con Firebase.';
    }
    return;
  }

  // Iniciar sesión con Google
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      try {
        googleBtn.disabled = true;
        if (loginMsg) loginMsg.textContent = '';
        if (authLoading) authLoading.classList.remove('hidden');

        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);

      } catch (error) {
        console.error('Error al iniciar sesión:', error);

       if (loginMsg) {
  loginMsg.textContent =
    'Error: ' + (error.code || error.message);
}

        if (authLoading) authLoading.classList.add('hidden');
        googleBtn.disabled = false;
      }
    });
  }

  // Comprobar si existe una sesión de Google
  auth.onAuthStateChanged(async (user) => {
    if (authLoading) authLoading.classList.add('hidden');

    if (!user) {
      currentUser = null;

      $('app')?.classList.add('hidden');
      $('clientStoreApp')?.classList.add('hidden');
      $('loginPage')?.classList.remove('hidden');

      if (accountSetup) accountSetup.classList.add('hidden');
      if (googleBtn) googleBtn.disabled = false;

      return;
    }

    try {
      // Guardar o actualizar el perfil del usuario
      await db.collection('usuarios').doc(user.uid).set({
        uid: user.uid,
        nombre: user.displayName || '',
        correo: user.email || '',
        foto: user.photoURL || '',
        fechaActualizacion:
          firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      currentUser = {
        uid: user.uid,
        name: user.displayName || 'Usuario',
        email: user.email || '',
        photo: user.photoURL || ''
      };

      
// Buscar las bodegas a las que pertenece el usuario
const membresiasSnapshot = await db.collection('membresias')
  .where('usuarioUid', '==', user.uid)
  .where('estado', '==', 'activo')
  .get();

const misBodegas = [];

for (const membresiaDoc of membresiasSnapshot.docs) {
  const membresia = membresiaDoc.data();

  const bodegaDoc = await db.collection('bodegas')
    .doc(membresia.bodegaId)
    .get();

  if (bodegaDoc.exists) {
    misBodegas.push({
      id: bodegaDoc.id,
      ...bodegaDoc.data(),
      rol: membresia.rol
    });
  }
}


const myStoresList = $('myStoresList');

if (myStoresList) {
  myStoresList.innerHTML = '';

  if (misBodegas.length === 0) {
    myStoresList.textContent = 'Todavía no tienes bodegas registradas.';
  } else {
    misBodegas.forEach((bodega) => {
      const card = document.createElement('div');

      card.style.cssText = `
        padding:22px;
        margin:16px 0;
        border:1px solid #e2e8f0;
        border-radius:16px;
        background:#ffffff;
        box-shadow:0 3px 10px rgba(0,0,0,0.05);
      `;

      const nombre = document.createElement('h3');
      nombre.textContent = '🏪 ' + bodega.nombre;
      nombre.style.cssText = 'font-size:22px;margin:0 0 12px;';

      const direccion = document.createElement('p');
      direccion.textContent = '📍 ' + (bodega.direccion || 'Sin dirección');
      direccion.style.cssText = 'font-size:16px;color:#475569;';

      const rol = document.createElement('p');
      rol.textContent = '👤 ' +
        (bodega.rol === 'admin' ? 'Administradora' : 'Cajera');
      rol.style.cssText = 'font-size:16px;color:#475569;';

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = 'PROBAR CONEXIÓN';
      boton.style.cssText = `
        width:100%;
        padding:15px;
        margin-top:12px;
        border:0;
        border-radius:10px;
        background:#f9a8d4;
        color:#831843;
        font-size:15px;
        font-weight:bold;
        cursor:pointer;
      `;

      boton.addEventListener('click', async () => {
        boton.disabled = true;
        boton.textContent = 'CARGANDO...';

        try {
          await loadStoreData(bodega.id);
          activeStoreRole = bodega.rol;

          console.log('Conexión con la bodega correcta');
          console.log('Productos:', products.length);
          console.log('Categorías:', categories.length);
          console.log('Ventas:', sales.length);
          console.log('Movimientos:', movements.length);
          console.log('Pedidos:', onlineOrders.length);

          boton.textContent = 'CONEXIÓN CORRECTA ✓';
          boton.style.background = '#bbf7d0';
          boton.style.color = '#166534';

        } catch (error) {
          console.error('Error al cargar la bodega:', error);
          boton.disabled = false;
          boton.textContent = 'REINTENTAR CONEXIÓN';
          alert('No se pudieron cargar los datos. Revisa la consola.');
        }
      });

      card.append(nombre, direccion, rol, boton);
      myStoresList.appendChild(card);
    });
  }
}


$('app')?.classList.add('hidden');
$('clientStoreApp')?.classList.add('hidden');
$('loginPage')?.classList.remove('hidden');

if (accountSetup) accountSetup.classList.remove('hidden');
if (googleBtn) googleBtn.classList.add('hidden');

if (createStoreBtn) {
  createStoreBtn.textContent = misBodegas.length > 0
    ? '🏪 Crear otra bodega'
    : '🏪 Crear mi bodega';
}
  
     } catch (error) {
  console.error('Error al iniciar sesión o cargar bodegas:', error);

  if (loginMsg) {
    loginMsg.textContent =
      'Tu sesión inició, pero ocurrió un error al cargar tus datos: ' +
      (error.message || error);
  }
}
  });
}

// Cerrar sesión de Firebase
window.logoutUser = async function () {
  try {
    await auth.signOut();
    showToast('Sesión cerrada.');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
};

window.logoutClient = function () {
  window.logoutUser();
};


window.openStorefrontView = function () {
  // Permite a admin/cajero abrir y explorar la tienda online de clientes
  $('app')?.classList.add('hidden');
  $('clientStoreApp')?.classList.remove('hidden');
  renderClientProducts();
  renderClientCartUI();
  showToast('Vista de Tienda Online abierta. Haz clic en "Cerrar sesión" para regresar.');
};

// ==================== NAVEGACIÓN DEL PANEL DE PERSONAL ====================
function initNavigation() {
  const navButtons = document.querySelectorAll('#nav button');
  const menuToggle = $('menuToggle');
  const sidebar = $('sidebar');

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

function switchView(viewName) {
  const views = document.querySelectorAll('#app .view');
  views.forEach((v) => v.classList.remove('active'));

  const targetView = $(`view-${viewName}`);
  if (targetView) targetView.classList.add('active');

  const navButtons = document.querySelectorAll('#nav button');
  navButtons.forEach((b) => b.classList.toggle('active', b.dataset.view === viewName));

  const sidebar = $('sidebar');
  if (sidebar) sidebar.classList.remove('open');

  const titles = {
    inicio: ['Inicio / Dashboard', 'Resumen general del inventario central y ventas de la bodega.'],
    inventario: ['Inventario Central Compartido', 'Gestiona productos y stock sincronizado para ventas presenciales y online.'],
    ventas: ['Ventas Presenciales (POS)', 'Registro de compras en mostrador con descuento automático de stock.'],
    pedidos: ['🛍️ Pedidos de la Tienda Online', 'Control de los 3 estados independientes: Estado de Pago, Pedido y Entrega.'],
    'verificacion-pagos': ['🔍 Verificación de Pagos', 'Revisa transferencias y comprobantes enviados por los clientes. Solo el administrador puede aprobar o rechazar un pago.'],
    'metodos-pago': ['💳 Configuración de Métodos de Pago', 'Activa o desactiva métodos, actualiza cuentas bancarias, números de celular y códigos QR.'],
    categorias: ['📁 Gestión de Categorías', 'Organiza los productos de tu bodega. No se pueden eliminar categorías con productos.'],
    pagos: ['Gestión de Pagos y Códigos QR', 'Verifica transferencias pendientes y gestiona los QR de Yape y Plin.'],
    boletas: ['Historial de Boletas Emitidas', 'Consulta, imprime, descarga o envía boletas directamente por WhatsApp.'],
    movimientos: ['Historial de Movimientos de Inventario', 'Auditoría cronológica de entradas, ventas presenciales y ventas online.'],
    reportes: ['Reportes y Métricas Comerciales', 'Ventas del día, desglose presencial vs online y métodos de pago.'],
    usuarios: ['Gestión de Usuarios', 'Administración de cuentas de administradores, cajeros y clientes.'],
    configuracion: ['Configuración del Sistema', 'Personaliza el logo, códigos QR de cobro y datos de WhatsApp de tu bodega.']
  };

  if (titles[viewName]) {
    if ($('pageTitle')) $('pageTitle').textContent = titles[viewName][0];
    if ($('pageSubtitle')) $('pageSubtitle').textContent = titles[viewName][1];
  }

  // Refrescar contenido específico según la vista
  if (viewName === 'inicio') updateDashboardStats();
  if (viewName === 'inventario') renderInventoryTable();
  if (viewName === 'ventas') renderPosProducts();
  if (viewName === 'pedidos') renderOnlineOrdersTable();
  if (viewName === 'verificacion-pagos') renderPaymentVerificationTable();
  if (viewName === 'metodos-pago') renderPaymentMethodsSettings();
  if (viewName === 'categorias') renderCategoriesTable();
  if (viewName === 'pagos') { renderPendingPaymentsTable(); renderPaymentQRs(); }
  if (viewName === 'boletas') renderBoletasTable();
  if (viewName === 'movimientos') renderMovementsList();
  if (viewName === 'reportes') renderReportsData();
  if (viewName === 'usuarios') renderUsersTable();
  if (viewName === 'configuracion') renderConfigFields();
}

window.navigateToView = function (v) {
  switchView(v);
};

// ==================== PERSONALIZACIÓN Y BRANDING ====================
function applyStoreBranding() {
  const name = storeConfig.storeName || 'BodegaControl';
  const sub = storeConfig.subtitle || 'Abarrotes y Bebidas';

  if ($('sideStoreName')) $('sideStoreName').textContent = name;
  if ($('clientStoreBrandName')) $('clientStoreBrandName').textContent = name;
  if ($('clientStoreBrandSub')) $('clientStoreBrandSub').textContent = `${sub} · Pedidos con Boleta a WhatsApp`;

  // Logo de la bodega
  if (storeConfig.logoImage) {
    if ($('sideLogoBadge')) $('sideLogoBadge').innerHTML = `<img src="${storeConfig.logoImage}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" alt="Logo" />`;
    if ($('clientLogoBadge')) $('clientLogoBadge').innerHTML = `<img src="${storeConfig.logoImage}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" alt="Logo" />`;
    if ($('cfgLogoImg')) {
      $('cfgLogoImg').src = storeConfig.logoImage;
      $('cfgLogoImg').classList.remove('hidden');
      $('cfgLogoPlaceholder')?.classList.add('hidden');
    }
  }

  // QR Yape Preview
  if (storeConfig.yapeQrImage) {
    if ($('cfgYapeImg')) {
      $('cfgYapeImg').src = storeConfig.yapeQrImage;
      $('cfgYapeImg').classList.remove('hidden');
      $('cfgYapePlaceholder')?.classList.add('hidden');
    }
  }

  // QR Plin Preview
  if (storeConfig.plinQrImage) {
    if ($('cfgPlinImg')) {
      $('cfgPlinImg').src = storeConfig.plinQrImage;
      $('cfgPlinImg').classList.remove('hidden');
      $('cfgPlinPlaceholder')?.classList.add('hidden');
    }
  }

  renderPaymentQRs();
}

window.handleLogoUpload = function (input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      storeConfig.logoImage = e.target.result;
      Storage.saveConfig(storeConfig);
      applyStoreBranding();
      showToast('Logo de la bodega actualizado con éxito.');
    };
    reader.readAsDataURL(input.files[0]);
  }
};

window.handleYapeQrUpload = function (input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      storeConfig.yapeQrImage = e.target.result;
      Storage.saveConfig(storeConfig);
      applyStoreBranding();
      showToast('Imagen de QR Yape subida y guardada.');
    };
    reader.readAsDataURL(input.files[0]);
  }
};

window.handlePlinQrUpload = function (input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      storeConfig.plinQrImage = e.target.result;
      Storage.saveConfig(storeConfig);
      applyStoreBranding();
      showToast('Imagen de QR Plin subida y guardada.');
    };
    reader.readAsDataURL(input.files[0]);
  }
};

window.handleProductImageUpload = function (input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      tempUploadedProductImage = e.target.result;
      const previewImg = $('productImgPreview');
      const placeholder = $('productImgPlaceholder');
      if (previewImg) {
        previewImg.src = tempUploadedProductImage;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
    };
    reader.readAsDataURL(input.files[0]);
  }
};


// ==================== MÓDULO DE CATEGORÍAS ====================
function initCategoriesModule() {
  const catForm = $('categoryForm');

  if (catForm) {
    catForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = $('catName').value.trim();
      const icon = $('catIcon').value.trim() || '📦';

      if (!activeStoreId || activeStoreRole !== 'admin') {
        alert('Necesitas ser administrador de una bodega activa.');
        return;
      }

      if (!name) return;

      if (editingCategoryId) {
        alert('La edición de categorías estará disponible en una siguiente etapa.');
        return;
      }

      if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        alert('Ya existe una categoría con ese nombre.');
        return;
      }

      const newCategory = {
        id: Date.now(),
        name,
        icon
      };

      try {
        await getStoreCollection('categorias')
          .doc(String(newCategory.id))
          .set(newCategory);

        categories.push(newCategory);

        showToast(`Categoría "${name}" guardada en Firebase.`);

        closeAllModals();
        editingCategoryId = null;

        populateCategoryPillsAndSelects();
        renderCategoriesTable();
        renderInventoryTable();

        console.log('Categoría guardada correctamente:', newCategory);

      } catch (error) {
        console.error('Error al guardar categoría:', error);
        alert('No se pudo guardar la categoría: ' + error.message);
      }
    });
  }

  populateCategoryPillsAndSelects();
}

function populateCategoryPillsAndSelects() {
  const pCatSelect = $('pCategory');
  if (pCatSelect) {
    pCatSelect.innerHTML = categories
      .map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`)
      .join('');
  }

  const invCatFilter = $('inventoryCatFilter');
  if (invCatFilter) {
    invCatFilter.innerHTML =
      '<option value="Todos">Todas las categorías</option>' +
      categories.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join('');
  }

  const invPills = $('invCategoryPills');
  if (invPills) {
    invPills.innerHTML =
      `<button class="pos-cat-pill ${currentInvCategory === 'Todos' ? 'active' : ''}" onclick="setInventoryCategory('Todos')">Todos</button>` +
      categories.map(c => `<button class="pos-cat-pill ${currentInvCategory === c.name ? 'active' : ''}" onclick="setInventoryCategory('${c.name}')">${c.icon} ${c.name}</button>`).join('');
  }

  const posPills = $('posCategoryPills');
  if (posPills) {
    posPills.innerHTML =
      `<button class="pos-cat-pill ${currentPosCategory === 'Todos' ? 'active' : ''}" onclick="setPosCategory('Todos')">Todos</button>` +
      categories.map(c => `<button class="pos-cat-pill ${currentPosCategory === c.name ? 'active' : ''}" onclick="setPosCategory('${c.name}')">${c.icon} ${c.name}</button>`).join('');
  }

  const clientPills = $('clientCategoryPills');
  if (clientPills) {
    clientPills.innerHTML =
      `<button class="pos-cat-pill ${currentClientCategory === 'Todos' ? 'active' : ''}" onclick="setClientCategory('Todos')">Todos</button>` +
      categories.map(c => `<button class="pos-cat-pill ${currentClientCategory === c.name ? 'active' : ''}" onclick="setClientCategory('${c.name}')">${c.icon} ${c.name}</button>`).join('');
  }
}

function renderCategoriesTable() {
  const tbody = $('categoriesTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!categories.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">No hay categorías registradas.</td></tr>';
    return;
  }

  categories.forEach(cat => {
    const prodCount = products.filter(p => p.category === cat.name).length;

    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td style="font-size:22px;">${cat.icon}</td>
        <td><strong>${cat.name}</strong></td>
        <td><span class="badge b-purple">${prodCount} producto(s)</span></td>
        <td><span class="badge">Edición próximamente</span></td>
      </tr>
    `);
  });
}

window.openCategoryModal = function () {
  editingCategoryId = null;
  $('modalCatTitle').textContent = 'Nueva Categoría';
  $('categoryForm')?.reset();
  $('modalCategory')?.classList.remove('hidden');
};

window.editCategory = function () {
  alert('La edición de categorías estará disponible en una siguiente etapa.');
};

window.deleteCategory = function () {
  alert('La eliminación de categorías estará disponible en una siguiente etapa.');
};

// ==================== INVENTARIO CENTRAL COMPARTIDO ====================
function initInventoryModule() {
  const pForm = $('productForm');
  if (pForm) {
    pForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveProduct();
    });
  }

  const sEntryForm = $('stockEntryForm');
  if (sEntryForm) {
    sEntryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveStockEntry();
    });
  }
}

function renderInventoryTable() {
  const tbody = $('inventoryTableBody');
  if (!tbody) return;

  const query = ($('inventorySearch')?.value || '').toLowerCase().trim();

  const filtered = products.filter((p) => {
    const matchesSearch = (p.name + ' ' + (p.sku || '') + ' ' + p.category).toLowerCase().includes(query);
    const matchesCat = currentInvCategory === 'Todos' || p.category === currentInvCategory;
    return matchesSearch && matchesCat;
  });

  tbody.innerHTML = '';

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:36px;color:var(--muted)">No se encontraron productos en el inventario.</td></tr>';
    return;
  }

  filtered.forEach((p) => {
    const status = getProductStatus(p);
    const isCajero = currentRole === 'cajero';

    const imgDisplay = p.image
      ? `<img src="${p.image}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;" alt="${p.name}" />`
      : `<span style="font-size:24px;">${p.emoji}</span>`;

    tbody.insertAdjacentHTML(
      'beforeend',
      `<tr>
        <td>${imgDisplay}</td>
        <td><code>${p.sku || 'S/N'}</code></td>
        <td>
          <strong>${p.name}</strong>
          ${p.description ? `<div style="font-size:11.5px;color:var(--muted);">${p.description}</div>` : ''}
        </td>
        <td><span class="badge b-purple">${p.category}</span></td>
        <td><strong>${formatMoney(p.price)}</strong></td>
        <td><strong style="font-size:14px;">${p.stock}</strong> un.</td>
        <td style="color:var(--muted);">${p.min} un.</td>
        <td><span class="badge ${status.badge}">${status.text}</span></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="openProductModal(${p.id})">✏️ Editar</button>
            ${
              isCajero
                ? ''
                : `<button class="btn btn-outline btn-sm" onclick="deleteProduct(${p.id})" style="color:var(--danger);border-color:var(--danger-soft);">🗑️</button>`
            }
          </div>
        </td>
      </tr>`
    );
  });
}

function getProductStatus(p) {
  if (p.stock <= 0) return { text: 'Agotado', badge: 'b-out' };
  if (p.stock <= p.min) return { text: 'Stock bajo', badge: 'b-low' };
  return { text: 'Disponible', badge: 'b-ok' };
}

window.filterInventoryByCategory = function (cat) {
  currentInvCategory = cat;
  populateCategoryPillsAndSelects();
  renderInventoryTable();
};

window.setInventoryCategory = function (cat) {
  currentInvCategory = cat;
  if ($('inventoryCatFilter')) $('inventoryCatFilter').value = cat;
  populateCategoryPillsAndSelects();
  renderInventoryTable();
};

window.openProductModal = function (productId = null) {
  editingProductId = productId;
  tempUploadedProductImage = '';

  const modal = $('modalProduct');
  const title = $('modalProductTitle');
  const form = $('productForm');
  const previewImg = $('productImgPreview');
  const placeholder = $('productImgPlaceholder');

  form?.reset();
  if (previewImg) previewImg.classList.add('hidden');
  if (placeholder) placeholder.classList.remove('hidden');

  populateCategoryPillsAndSelects();

  if (productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;

    if (title) title.textContent = 'Editar Producto';
    $('pName').value = p.name;
    $('pSku').value = p.sku || '';
    $('pCategory').value = p.category;
    $('pEmoji').value = p.emoji;
    $('pPrice').value = p.price;
    $('pStock').value = p.stock;
    $('pMin').value = p.min;
    $('pDesc').value = p.description || '';

    if (p.image) {
      tempUploadedProductImage = p.image;
      if (previewImg) {
        previewImg.src = p.image;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
    }

    // Si es cajero, deshabilitar precio y stock
    if (currentRole === 'cajero') {
      $('pPrice').disabled = true;
      $('pStock').disabled = true;
    } else {
      $('pPrice').disabled = false;
      $('pStock').disabled = false;
    }
  } else {
    if (title) title.textContent = 'Nuevo Producto';
    $('pPrice').disabled = false;
    $('pStock').disabled = false;
  }

  modal?.classList.remove('hidden');
};

async function saveProduct() {
  const name = $('pName').value.trim();
  const sku = $('pSku').value.trim() || `PR-${Math.floor(100 + Math.random() * 900)}`;
  const category = $('pCategory').value;
  const emoji = $('pEmoji').value;
  const price = parseFloat($('pPrice').value) || 0;
  const stock = parseInt($('pStock').value) || 0;
  const min = parseInt($('pMin').value) || 5;
  const desc = $('pDesc').value.trim();

  if (!activeStoreId || activeStoreRole !== 'admin') {
    alert('No tienes permisos de administrador en una bodega activa.');
    return;
  }

  if (editingProductId) {
    alert('La edición de productos se habilitará en la siguiente etapa.');
    return;
  }

  if (!name || price < 0 || stock < 0) {
    alert('Ingresa valores válidos para el producto.');
    return;
  }

  try {
    const newProd = {
      id: Date.now(),
      sku,
      name,
      category,
      price,
      stock,
      min,
      emoji,
      image: tempUploadedProductImage || '',
      description: desc
    };

    const productRef = getStoreCollection('productos')
      .doc(String(newProd.id));

    await productRef.set(newProd);

    products.push(newProd);

    showToast(`Producto "${name}" guardado en Firebase.`);

    closeAllModals();
    editingProductId = null;
    tempUploadedProductImage = '';
    renderAllViews();

    console.log('Producto guardado correctamente:', newProd);

  } catch (error) {
    console.error('Error al guardar producto en Firebase:', error);
    alert('No se pudo guardar el producto: ' + error.message);
  }
}

window.deleteProduct = function () {
  alert('La eliminación de productos estará disponible cuando terminemos la migración a Firebase.');
};

window.openStockEntryModal = function () {
  const select = $('stockEntryProduct');
  if (select) {
    select.innerHTML = products
      .map((p) => `<option value="${p.id}">${p.emoji} ${p.name} (Stock actual: ${p.stock})</option>`)
      .join('');
  }
  $('stockEntryForm')?.reset();
  $('modalStockEntry')?.classList.remove('hidden');
};


async function saveStockEntry() {
  const prodId = parseInt($('stockEntryProduct').value);
  const qty = parseInt($('stockEntryQty').value) || 0;
  const note = $('stockEntryNote').value.trim() || 'Entrada directa a bodega';

  if (!activeStoreId || !['admin', 'cajero'].includes(activeStoreRole)) {
    alert('No tienes permisos para registrar entradas en esta bodega.');
    return;
  }

  if (!Number.isInteger(prodId) || qty <= 0) {
    alert('Ingresa una cantidad válida.');
    return;
  }

  const prod = products.find(p => Number(p.id) === prodId);

  if (!prod) {
    alert('No se encontró el producto seleccionado.');
    return;
  }

  const newStock = Number(prod.stock || 0) + qty;

  const movement = {
    id: Date.now(),
    type: 'in',
    subType: 'entrada',
    product: prod.name,
    qty,
    date: nowFormatted(),
    user: currentUser ? currentUser.name : 'Usuario',
    note
  };

  try {
    const batch = db.batch();

    const productRef = getStoreCollection('productos')
      .doc(String(prod.id));

    const movementRef = getStoreCollection('movimientos')
      .doc(String(movement.id));

    batch.update(productRef, {
      stock: newStock
    });

    batch.set(movementRef, movement);

    await batch.commit();

    prod.stock = newStock;
    movements.push(movement);

    closeAllModals();
    renderAllViews();

    showToast(`Se agregaron +${qty} unidades a "${prod.name}".`);

    console.log('Entrada guardada en Firebase:', movement);

  } catch (error) {
    console.error('Error al registrar entrada:', error);
    alert('No se pudo registrar la entrada: ' + error.message);
  }
}

// ==================== VENTAS PRESENCIALES (POS) ====================
function initPosModule() {
  $('posSearch')?.addEventListener('input', renderPosProducts);
}

function renderPosProducts() {
  const grid = $('posGrid');
  if (!grid) return;

  const query = ($('posSearch')?.value || '').toLowerCase().trim();

  const filtered = products.filter((p) => {
    const matchesSearch = (p.name + ' ' + (p.sku || '') + ' ' + p.category).toLowerCase().includes(query);
    const matchesCat = currentPosCategory === 'Todos' || p.category === currentPosCategory;
    return matchesSearch && matchesCat;
  });

  grid.innerHTML = '';

  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--muted)">No hay productos que coincidan con la búsqueda.</div>';
    return;
  }

  filtered.forEach((p) => {
    const isSoldOut = p.stock === 0;
    const isLow = p.stock > 0 && p.stock <= p.min;

    const imgDisplay = p.image
      ? `<img src="${p.image}" class="pos-card-img" alt="${p.name}" />`
      : `<div class="pos-card-icon">${p.emoji}</div>`;

    const card = document.createElement('div');
    card.className = `pos-card ${isSoldOut ? 'sold-out' : ''}`;
    card.onclick = () => {
      if (!isSoldOut) addProductToPosCart(p.id);
    };

    card.innerHTML = `
      <span class="pos-stock-badge ${isSoldOut ? 'b-out' : isLow ? 'b-low' : 'b-ok'}">
        ${isSoldOut ? 'Agotado' : `${p.stock} un.`}
      </span>
      ${imgDisplay}
      <h4>${p.name}</h4>
      <div class="pos-card-price">${formatMoney(p.price)}</div>
    `;

    grid.appendChild(card);
  });
}

window.setPosCategory = function (cat) {
  currentPosCategory = cat;
  populateCategoryPillsAndSelects();
  renderPosProducts();
};

function addProductToPosCart(productId) {
  const p = products.find((x) => x.id === productId);
  if (!p || p.stock <= 0) {
    showToast(`"${p?.name}" está agotado.`);
    return;
  }

  const existing = posCart.find((i) => i.id === productId);
  if (existing) {
    if (existing.quantity >= p.stock) {
      showToast(`No puedes agregar más: solo quedan ${p.stock} unidades disponibles.`);
      return;
    }
    existing.quantity++;
    existing.subtotal = existing.quantity * existing.price;
  } else {
    posCart.push({
      id: p.id,
      name: p.name,
      price: p.price,
      emoji: p.emoji,
      image: p.image || '',
      quantity: 1,
      subtotal: p.price
    });
  }

  renderPosCart();
}

function renderPosCart() {
  const container = $('cartItems');
  const countBadge = $('cartCount');
  const subtotalEl = $('cartSubtotal');
  const totalEl = $('cartTotal');
  const btnAmount = $('btnProceedPaymentAmount');

  const totalUnits = posCart.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = posCart.reduce((sum, i) => sum + i.subtotal, 0);

  if (countBadge) countBadge.textContent = `${totalUnits} un.`;
  if (subtotalEl) subtotalEl.textContent = formatMoney(totalAmount);
  if (totalEl) totalEl.textContent = formatMoney(totalAmount);
  if (btnAmount) btnAmount.textContent = formatMoney(totalAmount);

  if (!container) return;
  container.innerHTML = '';

  if (!posCart.length) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);font-size:13px;">El carrito está vacío. Haz clic en los productos para agregarlos.</div>';
    return;
  }

  posCart.forEach((item) => {
    container.insertAdjacentHTML(
      'beforeend',
      `<div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price">${formatMoney(item.price)} c/u</div>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updatePosCartQty(${item.id}, -1)">−</button>
          <span class="qty-val">${item.quantity}</span>
          <button class="qty-btn" onclick="updatePosCartQty(${item.id}, 1)">＋</button>
        </div>
        <div class="cart-item-subtotal">${formatMoney(item.subtotal)}</div>
        <button class="cart-item-del" onclick="removePosCartItem(${item.id})" title="Quitar">×</button>
      </div>`
    );
  });
}

window.updatePosCartQty = function (productId, delta) {
  const itemIndex = posCart.findIndex((i) => i.id === productId);
  if (itemIndex === -1) return;

  const item = posCart[itemIndex];
  const p = products.find((x) => x.id === productId);
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    posCart.splice(itemIndex, 1);
  } else {
    if (p && newQty > p.stock) {
      showToast(`Stock máximo disponible alcanzado (${p.stock} un.).`);
      return;
    }
    item.quantity = newQty;
    item.subtotal = item.quantity * item.price;
  }

  renderPosCart();
};

window.removePosCartItem = function (productId) {
  posCart = posCart.filter((i) => i.id !== productId);
  renderPosCart();
};

window.clearPosCart = function () {
  if (posCart.length && confirm('¿Deseas vaciar el carrito presencial?')) {
    posCart = [];
    renderPosCart();
  }
};

window.openPosPaymentModal = function () {
  if (!posCart.length) {
    showToast('El carrito está vacío. Agrega productos para cobrar.');
    return;
  }

  const totalAmount = posCart.reduce((sum, i) => sum + i.subtotal, 0);
  if ($('payModalTotal')) $('payModalTotal').textContent = formatMoney(totalAmount);

  if ($('cashReceived')) $('cashReceived').value = totalAmount.toFixed(2);

  setPosPaymentMethod('Efectivo');
  calculateCashChange();
  $('modalPayment')?.classList.remove('hidden');
};

window.setPosPaymentMethod = function (method) {
  selectedPosPaymentMethod = method;
  document.querySelectorAll('.pay-tab:not(.online-pay-tab)').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.method === method);
  });

  $('payPanelCash')?.classList.toggle('hidden', method !== 'Efectivo');
  $('payPanelYape')?.classList.toggle('hidden', method !== 'Yape');
  $('payPanelPlin')?.classList.toggle('hidden', method !== 'Plin');

  renderPaymentQRs();
};

window.setQuickCash = function (amount) {
  const totalAmount = posCart.reduce((acc, i) => acc + i.subtotal, 0);
  const input = $('cashReceived');
  if (!input) return;

  if (amount === 'exact') {
    input.value = totalAmount.toFixed(2);
  } else {
    input.value = Number(amount).toFixed(2);
  }
  calculateCashChange();
};

window.calculateCashChange = function () {
  const totalAmount = posCart.reduce((acc, i) => acc + i.subtotal, 0);
  const cashInput = $('cashReceived');
  const changeEl = $('changeAmount');
  const confirmBtn = $('btnConfirmSale');

  const received = parseFloat(cashInput?.value) || 0;
  const change = received - totalAmount;

  if (changeEl) {
    if (change < 0) {
      changeEl.textContent = 'Monto insuficiente';
      changeEl.style.color = 'var(--danger)';
      if (confirmBtn && selectedPosPaymentMethod === 'Efectivo') confirmBtn.disabled = true;
    } else {
      changeEl.textContent = formatMoney(change);
      changeEl.style.color = 'var(--success)';
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }
};

window.confirmPosSale = function () {
  if (!posCart.length) return;

  const totalAmount = posCart.reduce((acc, i) => acc + i.subtotal, 0);
  const custName = $('customerName')?.value.trim() || 'Cliente mostrador';
  const custPhone = $('customerPhone')?.value.trim() || '';

  let cashReceived = null;
  let change = null;

  if (selectedPosPaymentMethod === 'Efectivo') {
    cashReceived = parseFloat($('cashReceived')?.value) || totalAmount;
    if (cashReceived < totalAmount) {
      alert('El monto en efectivo ingresado no cubre el total de la compra.');
      return;
    }
    change = cashReceived - totalAmount;
  }

  closeAllModals();

  executeSaleTransaction({
    channel: 'presencial',
    customerName: custName,
    customerPhone: custPhone,
    paymentMethod: selectedPosPaymentMethod,
    cashReceived,
    change,
    items: [...posCart],
    subtotal: totalAmount,
    total: totalAmount
  });

  posCart = [];
  if ($('customerName')) $('customerName').value = '';
  if ($('customerPhone')) $('customerPhone').value = '';
  renderPosCart();
};

// ==================== TIENDA ONLINE STANDALONE (CLIENTE) ====================
function initClientStoreModule() {
  $('clientSearchInput')?.addEventListener('input', renderClientProducts);
}

function renderClientProducts() {
  const grid = $('clientProductGrid');
  if (!grid) return;

  const query = ($('clientSearchInput')?.value || '').toLowerCase().trim();

  const filtered = products.filter((p) => {
    const matchesSearch = (p.name + ' ' + (p.sku || '') + ' ' + p.category + ' ' + (p.description || '')).toLowerCase().includes(query);
    const matchesCat = currentClientCategory === 'Todos' || p.category === currentClientCategory;
    return matchesSearch && matchesCat;
  });

  grid.innerHTML = '';

  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--muted)">No encontramos productos que coincidan con tu búsqueda en la tienda.</div>';
    return;
  }

  filtered.forEach((p) => {
    const isSoldOut = p.stock === 0;
    const isLow = p.stock > 0 && p.stock <= p.min;
    const status = getProductStatus(p);

    const imgDisplay = p.image
      ? `<img src="${p.image}" class="online-card-img" alt="${p.name}" />`
      : `<div class="online-card-icon">${p.emoji}</div>`;

    const card = document.createElement('div');
    card.className = `online-card ${isSoldOut ? 'sold-out' : ''}`;

    card.innerHTML = `
      <div class="online-card-top">
        <span class="badge ${status.badge}">${isSoldOut ? 'AGOTADO' : isLow ? `¡Últimas ${p.stock} un.!` : `${p.stock} disponibles`}</span>
        <span style="font-size:11.5px;color:var(--muted);">${p.category}</span>
      </div>
      ${imgDisplay}
      <h4>${p.name}</h4>
      <p class="online-card-desc">${p.description || 'Disponible para pedido inmediato en la bodega.'}</p>
      <div class="online-card-bottom">
        <div class="online-card-price">${formatMoney(p.price)}</div>
        ${
          isSoldOut
            ? `<button class="btn btn-outline btn-sm" disabled style="opacity:0.5;cursor:not-allowed;">AGOTADO</button>`
            : `<button class="btn-add-online" onclick="addClientProductToCart(${p.id})">＋ Agregar</button>`
        }
      </div>
    `;

    grid.appendChild(card);
  });
}

window.setClientCategory = function (cat) {
  currentClientCategory = cat;
  populateCategoryPillsAndSelects();
  renderClientProducts();
};

window.addClientProductToCart = function (productId) {
  const p = products.find((x) => x.id === productId);
  if (!p || p.stock <= 0) {
    showToast(`Lo sentimos, "${p?.name || 'Producto'}" está AGOTADO.`);
    return;
  }

  const existing = onlineCart.find((i) => i.id === productId);
  if (existing) {
    if (existing.quantity >= p.stock) {
      showToast(`No puedes agregar más: solo quedan ${p.stock} unidades disponibles.`);
      return;
    }
    existing.quantity++;
    existing.subtotal = existing.quantity * existing.price;
  } else {
    onlineCart.push({
      id: p.id,
      name: p.name,
      price: p.price,
      emoji: p.emoji,
      image: p.image || '',
      quantity: 1,
      subtotal: p.price
    });
  }

  renderClientCartUI();
  showToast(`"${p.name}" agregado al carrito.`);
};

function renderClientCartUI() {
  const totalUnits = onlineCart.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = onlineCart.reduce((sum, i) => sum + i.subtotal, 0);

  const badge = $('clientCartBadge');
  const navTotal = $('clientCartNavTotal');

  if (badge) badge.textContent = totalUnits;
  if (navTotal) navTotal.textContent = formatMoney(totalAmount);
}

window.openOnlineCartModal = function () {
  if (!onlineCart.length) {
    showToast('Tu carrito está vacío. Agrega productos de la tienda online.');
    return;
  }

  renderOnlineCartModalItems();

  // Autocompletar datos del cliente si hay sesión
  if (currentUser) {
    if ($('onlineCustName') && !$('onlineCustName').value) $('onlineCustName').value = currentUser.name || '';
    if ($('onlineCustPhone') && !$('onlineCustPhone').value) $('onlineCustPhone').value = currentUser.phone || '';
  }

  // Inicializar método de entrega por defecto en domicilio
  selectDeliveryMethod(currentDeliveryMethod || 'delivery');

  // Renderizar métodos de pago activos y configurados
  renderOnlineActivePaymentMethods();

  // Si no hay comprobante activo seleccionado, resetear vista previa
  if (!activeVoucherFile) {
    clearSelectedVoucher();
  }

  $('modalOnlineCart')?.classList.remove('hidden');
};

function renderOnlineCartModalItems() {
  const container = $('onlineCartItems');
  const totalEl = $('onlineCartTotalAmount');
  if (!container) return;

  const totalAmount = onlineCart.reduce((sum, i) => sum + i.subtotal, 0);
  if (totalEl) totalEl.textContent = formatMoney(totalAmount);

  container.innerHTML = '';

  if (!onlineCart.length) {
    container.innerHTML = '<div style="text-align:center;padding:25px;color:var(--muted);">El carrito online está vacío.</div>';
    return;
  }

  onlineCart.forEach((item) => {
    container.insertAdjacentHTML(
      'beforeend',
      `<div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price">${formatMoney(item.price)} c/u</div>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateOnlineCartQty(${item.id}, -1)">−</button>
          <span class="qty-val">${item.quantity}</span>
          <button class="qty-btn" onclick="updateOnlineCartQty(${item.id}, 1)">＋</button>
        </div>
        <div class="cart-item-subtotal">${formatMoney(item.subtotal)}</div>
        <button class="cart-item-del" onclick="removeOnlineCartItem(${item.id})" title="Quitar">×</button>
      </div>`
    );
  });
}

window.updateOnlineCartQty = function (productId, delta) {
  const itemIndex = onlineCart.findIndex((i) => i.id === productId);
  if (itemIndex === -1) return;

  const item = onlineCart[itemIndex];
  const p = products.find((x) => x.id === productId);
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    onlineCart.splice(itemIndex, 1);
  } else {
    if (p && newQty > p.stock) {
      showToast(`Stock máximo alcanzado (${p.stock} un.).`);
      return;
    }
    item.quantity = newQty;
    item.subtotal = item.quantity * item.price;
  }

  renderClientCartUI();
  renderOnlineCartModalItems();
  const totalAmount = onlineCart.reduce((sum, i) => sum + i.subtotal, 0);
  renderOnlinePaymentDetails(totalAmount);
};

window.removeOnlineCartItem = function (productId) {
  onlineCart = onlineCart.filter((i) => i.id !== productId);
  renderClientCartUI();
  renderOnlineCartModalItems();
  const totalAmount = onlineCart.reduce((sum, i) => sum + i.subtotal, 0);
  renderOnlinePaymentDetails(totalAmount);
};

window.selectDeliveryMethod = function (type) {
  currentDeliveryMethod = type;
  const isDelivery = type === 'delivery';

  $('optDeliveryDomicilio')?.classList.toggle('active', isDelivery);
  $('optDeliveryRecojo')?.classList.toggle('active', !isDelivery);

  $('deliveryAddressGroup')?.classList.toggle('hidden', !isDelivery);
  $('pickupStoreInfoGroup')?.classList.toggle('hidden', isDelivery);

  if ($('checkoutPickupAddressText')) {
    $('checkoutPickupAddressText').textContent = storeConfig.address || 'Av. Las Gardenias 452, Urb. El Bosque - Lima';
  }
};

function renderOnlineActivePaymentMethods() {
  const container = $('onlineActivePaymentTabs');
  if (!container) return;

  paymentMethods = Storage.getPaymentMethods();
  const activeList = Object.values(paymentMethods).filter((m) => m.active);

  container.innerHTML = '';

  if (!activeList.length) {
    container.innerHTML = '<div style="color:var(--danger);font-size:12.5px;padding:8px;">No hay métodos de pago activos. Por favor contacta al administrador.</div>';
    if ($('onlinePaymentDetailsBox')) $('onlinePaymentDetailsBox').innerHTML = '';
    return;
  }

  const currentActive = activeList.find((m) => m.name.toLowerCase() === (onlineSelectedPaymentMethod || '').toLowerCase());
  if (!currentActive) {
    onlineSelectedPaymentMethod = activeList[0].name;
  }

  activeList.forEach((method) => {
    const isSelected = method.name.toLowerCase() === onlineSelectedPaymentMethod.toLowerCase();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `online-pay-tab ${isSelected ? 'active' : ''}`;
    btn.dataset.method = method.name;
    btn.innerHTML = `<span>${method.icon || '💳'}</span> <span>${method.name}</span>`;
    btn.onclick = () => {
      selectOnlinePaymentMethod(method.name);
    };
    container.appendChild(btn);
  });

  const totalAmount = onlineCart.reduce((sum, i) => sum + i.subtotal, 0);
  renderOnlinePaymentDetails(totalAmount);
}

window.selectOnlinePaymentMethod = function (methodName) {
  onlineSelectedPaymentMethod = methodName;
  document.querySelectorAll('#onlineActivePaymentTabs .online-pay-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.method.toLowerCase() === methodName.toLowerCase());
  });
  const totalAmount = onlineCart.reduce((sum, i) => sum + i.subtotal, 0);
  renderOnlinePaymentDetails(totalAmount);
};

function renderOnlinePaymentDetails(total) {
  const box = $('onlinePaymentDetailsBox');
  if (!box) return;

  paymentMethods = Storage.getPaymentMethods();
  const activeList = Object.values(paymentMethods).filter((m) => m.active);
  const method = activeList.find((m) => m.name.toLowerCase() === (onlineSelectedPaymentMethod || '').toLowerCase());

  if (!method) {
    box.innerHTML = '';
    return;
  }

  const formattedTotal = formatMoney(total);

  if (method.id === 'yape') {
    const qrContent = method.qrImage
      ? `<img src="${method.qrImage}" alt="QR Yape" style="width:100%;height:100%;object-fit:contain;border-radius:10px;" />`
      : generateQRCodeSvg('#731e84', 'YAPE', method.phone || '987 654 321');

    box.innerHTML = `
      <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:14px;padding:16px;">
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
          <div style="width:130px;height:130px;background:#ffffff;border-radius:12px;padding:6px;box-shadow:0 2px 8px rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${qrContent}
          </div>
          <div style="flex:1;min-width:200px;font-size:13px;line-height:1.6;">
            <div style="font-size:15px;font-weight:800;color:#6b21a8;margin-bottom:4px;">🟣 Pago por Yape</div>
            <div><b>Titular de la cuenta:</b> ${method.owner || storeConfig.yapeOwner || 'José Pepe Morales'}</div>
            <div><b>Número de celular asociado:</b> <span style="font-size:14px;font-weight:800;color:#6b21a8;letter-spacing:0.5px;">${method.phone || storeConfig.yapeNumber || '987 654 321'}</span></div>
            <div style="margin-top:6px;background:#ffffff;border:1px solid #d8b4fe;border-radius:8px;padding:6px 10px;display:inline-block;">
              <b>Monto exacto que debe pagar:</b> <strong style="color:var(--primary);font-size:16px;">${formattedTotal}</strong>
            </div>
            <p style="margin-top:8px;color:#7e22ce;font-size:12px;">${method.instructions || 'Escanea el código QR desde tu app Yape o transfiere al número celular indicado y adjunta la captura abajo.'}</p>
          </div>
        </div>
      </div>
    `;
  } else if (method.id === 'plin') {
    const qrContent = method.qrImage
      ? `<img src="${method.qrImage}" alt="QR Plin" style="width:100%;height:100%;object-fit:contain;border-radius:10px;" />`
      : generateQRCodeSvg('#00bed7', 'PLIN', method.phone || '987 654 321');

    box.innerHTML = `
      <div style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:14px;padding:16px;">
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
          <div style="width:130px;height:130px;background:#ffffff;border-radius:12px;padding:6px;box-shadow:0 2px 8px rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${qrContent}
          </div>
          <div style="flex:1;min-width:200px;font-size:13px;line-height:1.6;">
            <div style="font-size:15px;font-weight:800;color:#0e7490;margin-bottom:4px;">🔵 Pago por Plin</div>
            <div><b>Titular de la cuenta:</b> ${method.owner || storeConfig.plinOwner || 'José Pepe Morales'}</div>
            <div><b>Número de celular asociado:</b> <span style="font-size:14px;font-weight:800;color:#0e7490;letter-spacing:0.5px;">${method.phone || storeConfig.plinNumber || '987 654 321'}</span></div>
            <div style="margin-top:6px;background:#ffffff;border:1px solid #67e8f9;border-radius:8px;padding:6px 10px;display:inline-block;">
              <b>Monto exacto que debe pagar:</b> <strong style="color:var(--primary);font-size:16px;">${formattedTotal}</strong>
            </div>
            <p style="margin-top:8px;color:#0e7490;font-size:12px;">${method.instructions || 'Escanea el código QR desde tu app Plin o transfiere al número indicado y adjunta la captura abajo.'}</p>
          </div>
        </div>
      </div>
    `;
  } else if (method.id === 'transferencia') {
    const qrHtml = method.qrImage
      ? `<div style="width:120px;height:120px;background:#ffffff;border-radius:10px;padding:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.05);"><img src="${method.qrImage}" alt="QR Banco" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" /></div>`
      : '';

    box.innerHTML = `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:16px;">
        <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
          ${qrHtml}
          <div style="flex:1;min-width:220px;font-size:13px;line-height:1.6;">
            <div style="font-size:15px;font-weight:800;color:#166534;margin-bottom:4px;">🏦 Transferencia Bancaria</div>
            <div><b>Nombre del banco:</b> <span style="font-weight:700;">${method.bankName || 'BCP (Banco de Crédito del Perú)'}</span></div>
            <div><b>Titular de la cuenta:</b> ${method.owner || 'José Pepe Morales'}</div>
            <div><b>Número de cuenta:</b> <span style="font-family:monospace;font-size:13.5px;font-weight:800;background:#ffffff;padding:2px 6px;border-radius:4px;border:1px solid #bbf7d0;">${method.accountNumber || '191-98765432-0-88'}</span></div>
            <div><b>Código de cuenta interbancario (CCI):</b> <span style="font-family:monospace;font-size:13px;font-weight:700;background:#ffffff;padding:2px 6px;border-radius:4px;border:1px solid #bbf7d0;">${method.cci || '002-191-009876543208-88'}</span></div>
            <div style="margin-top:6px;background:#ffffff;border:1px solid #86efac;border-radius:8px;padding:6px 10px;display:inline-block;">
              <b>Monto exacto que debe pagar:</b> <strong style="color:var(--primary);font-size:16px;">${formattedTotal}</strong>
            </div>
            <p style="margin-top:8px;color:#15803d;font-size:12px;">${method.instructions || 'Transfiere desde tu banca por internet y adjunta la captura o constancia digital.'}</p>
          </div>
        </div>
      </div>
    `;
  } else if (method.id === 'efectivo') {
    box.innerHTML = `
      <div style="background:#fefce8;border:1px solid #fef08a;border-radius:14px;padding:16px;">
        <div style="display:flex;gap:14px;align-items:center;">
          <span style="font-size:36px;">💵</span>
          <div style="flex:1;font-size:13px;line-height:1.5;">
            <div style="font-size:15px;font-weight:800;color:#854d0e;margin-bottom:2px;">💵 Pago en Efectivo</div>
            <div style="margin-bottom:4px;"><b>Monto total a pagar:</b> <strong style="color:var(--primary);font-size:16px;">${formattedTotal}</strong></div>
            <p style="color:#713f12;font-size:12.5px;">${method.instructions || 'Pagas en efectivo al momento de recibir tu entrega a domicilio o directamente en nuestro mostrador.'}</p>
            <div style="font-size:11.5px;color:#a16207;margin-top:4px;">* Ten listo el monto exacto o indica con cuánto pagarás para que el repartidor lleve tu vuelto.</div>
          </div>
        </div>
      </div>
    `;
  }
}

window.handleClientVoucherSelect = function (input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    alert('Formato no válido. Solo se admiten imágenes JPG, JPEG, PNG o WEBP.');
    input.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('La imagen seleccionada supera el límite máximo de 5 MB. Por favor sube una captura más ligera.');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    activeVoucherFile = {
      image: dataUrl,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      uploadedAt: nowFormatted()
    };

    if ($('voucherSelectedImg')) $('voucherSelectedImg').src = dataUrl;
    if ($('voucherSelectedName')) $('voucherSelectedName').textContent = file.name;
    if ($('voucherSelectedSize')) $('voucherSelectedSize').textContent = formatFileSize(file.size);

    $('voucherSelectedPreview')?.classList.remove('hidden');
    $('voucherDropzoneContent')?.classList.add('hidden');
    showToast('Comprobante adjuntado correctamente.');
  };
  reader.readAsDataURL(file);
};

window.clearSelectedVoucher = function () {
  activeVoucherFile = null;
  const input = $('clientVoucherFile');
  if (input) input.value = '';
  $('voucherSelectedPreview')?.classList.add('hidden');
  $('voucherDropzoneContent')?.classList.remove('hidden');
};


window.processOnlineCheckout = async function () {
  if (!onlineCart.length) {
    alert('Tu carrito está vacío.');
    return;
  }

  if (!activeStoreId) {
    alert('No hay una bodega seleccionada para registrar el pedido.');
    return;
  }

  const name = $('onlineCustName')?.value.trim();
  const phone = $('onlineCustPhone')?.value.trim();
  const address = $('onlineCustAddress')?.value.trim() || '';

  if (!name) {
    alert('Por favor ingresa tu nombre completo.');
    $('onlineCustName')?.focus();
    return;
  }

  if (!phone || phone.replace(/\D/g, '').length < 8) {
    alert('Por favor ingresa un número de WhatsApp válido.');
    $('onlineCustPhone')?.focus();
    return;
  }

  if (currentDeliveryMethod === 'delivery' && !address) {
    alert('Por favor ingresa tu dirección exacta de entrega.');
    $('onlineCustAddress')?.focus();
    return;
  }

  for (const item of onlineCart) {
    const prod = products.find(p => String(p.id) === String(item.id));

    if (!prod || Number(prod.stock) < Number(item.quantity)) {
      alert(`Stock insuficiente para "${item.name}".`);
      renderAllViews();
      return;
    }
  }

  const totalAmount = onlineCart.reduce((sum, item) => sum + item.subtotal, 0);
  const orderCode = Storage.getNextOrderCode(onlineOrders);
  const orderDate = nowFormatted();

  const fullAddress = currentDeliveryMethod === 'delivery'
    ? address
    : `Recojo en bodega (${storeConfig.address || 'Dirección de la bodega'})`;

  const newOrder = {
    id: Date.now(),
    code: orderCode,
    customerName: name,
    customerPhone: phone,
    deliveryType: currentDeliveryMethod,
    deliveryAddress: fullAddress,
    date: orderDate,
    paymentMethod: onlineSelectedPaymentMethod,
    paymentStatus: 'Pendiente de verificación',
    orderStatus: 'Pendiente',
    deliveryStatus: 'Pendiente',
    items: [...onlineCart],
    subtotal: totalAmount,
    total: totalAmount,
    voucher: activeVoucherFile ? { ...activeVoucherFile } : null,
    verificationHistory: [
      {
        action: 'Creado',
        timestamp: orderDate,
        adminName: `Cliente (${name})`,
        notes: activeVoucherFile
          ? 'Pedido registrado con comprobante adjuntado'
          : 'Pedido registrado, comprobante por adjuntar o enviar por WhatsApp'
      }
    ]
  };

  try {
    await getStoreCollection('pedidos')
      .doc(String(newOrder.id))
      .set(newOrder);

    onlineOrders.push(newOrder);
    onlineCart = [];
    activeVoucherFile = null;

    const voucherInput = $('clientVoucherFile');
    if (voucherInput) voucherInput.value = '';

    $('voucherSelectedPreview')?.classList.add('hidden');
    $('voucherDropzoneContent')?.classList.remove('hidden');

    closeAllModals();
    renderClientCartUI();
    renderOnlineOrdersTable();
    renderPaymentVerificationTable();
    updateDashboardStats();

    openClientOrderTracking(newOrder.id);
    showToast(`¡Pedido ${orderCode} registrado en Firebase! Pendiente de verificación.`);

    console.log('Pedido guardado en Firebase:', newOrder);

  } catch (error) {
    console.error('Error al guardar pedido:', error);
    alert('No se pudo registrar el pedido: ' + error.message);
  }
};


// ==================== SEGUIMIENTO DEL PEDIDO DEL CLIENTE ====================
window.openClientOrderTracking = function (orderId) {
  const order = onlineOrders.find((o) => o.id === orderId);
  if (!order) return;

  activeTrackingOrderId = order.id;

  if ($('trackOrderCode')) $('trackOrderCode').textContent = order.code;
  if ($('trackOrderDate')) $('trackOrderDate').textContent = `${formatDateTime(order.date)} • ${order.deliveryType === 'delivery' ? '🛵 Domicilio' : '🏪 Recojo en tienda'}`;
  if ($('trackOrderTotal')) $('trackOrderTotal').textContent = formatMoney(order.total);

  // 1. Estado del Pago Badge
  const payBadgeContainer = $('trackPaymentStatusBadge');
  if (payBadgeContainer) {
    let payClass = 'b-pay-pendiente';
    if (order.paymentStatus === 'En revisión') payClass = 'b-pay-revision';
    if (order.paymentStatus === 'Confirmado') payClass = 'b-pay-confirmado';
    if (order.paymentStatus === 'Rechazado') payClass = 'b-pay-rechazado';
    payBadgeContainer.innerHTML = `<span class="badge ${payClass}">${order.paymentStatus}</span>`;
  }

  // 2. Estado del Pedido Badge
  const ordBadgeContainer = $('trackOrderStatusBadge');
  if (ordBadgeContainer) {
    let ordClass = 'b-ord-pendiente';
    if (order.orderStatus === 'Aceptado') ordClass = 'b-ord-aceptado';
    if (order.orderStatus === 'En preparación') ordClass = 'b-ord-preparacion';
    if (order.orderStatus === 'Listo para entregar') ordClass = 'b-ord-listo';
    if (order.orderStatus === 'Completado') ordClass = 'b-ord-completado';
    if (order.orderStatus === 'Cancelado') ordClass = 'b-ord-cancelado';
    ordBadgeContainer.innerHTML = `<span class="badge ${ordClass}">${order.orderStatus}</span>`;
  }

  // 3. Estado de Entrega Badge
  const delBadgeContainer = $('trackDeliveryStatusBadge');
  if (delBadgeContainer) {
    let delClass = 'b-del-pendiente';
    if (order.deliveryStatus === 'En camino') delClass = 'b-del-camino';
    if (order.deliveryStatus === 'Entregado') delClass = 'b-del-entregado';
    delBadgeContainer.innerHTML = `<span class="badge ${delClass}">${order.deliveryStatus}</span>`;
  }

  // Alerta de Rechazo si aplica
  const rejectionBox = $('trackRejectionBox');
  if (rejectionBox) {
    if (order.paymentStatus === 'Rechazado') {
      rejectionBox.classList.remove('hidden');
      if ($('trackRejectionReasonText')) {
        $('trackRejectionReasonText').textContent = order.rejectionReason || 'El comprobante presentado no pudo ser validado con la cuenta bancaria.';
      }
    } else {
      rejectionBox.classList.add('hidden');
    }
  }

  // Mensaje explicativo del estado
  const infoMsg = $('trackPaymentInfoMsg');
  if (infoMsg) {
    if (order.paymentStatus === 'Confirmado') {
      infoMsg.innerHTML = `
        <div style="color:#166534;font-weight:700;">✅ ¡Tu pago ha sido verificado y confirmado!</div>
        <div style="color:#15803d;margin-top:4px;">Tu compra ha sido procesada, el inventario ha sido reservado y tu pedido se encuentra en proceso.</div>
      `;
      infoMsg.style.background = '#f0fdf4';
      infoMsg.style.borderColor = '#bbf7d0';
    } else if (order.paymentStatus === 'Rechazado') {
      infoMsg.innerHTML = `
        <div style="color:#991b1b;font-weight:700;">❌ Pago no aprobado por el administrador</div>
        <div style="color:#b91c1c;margin-top:4px;">Por favor lee el motivo indicado arriba y adjunta un comprobante corregido para que el administrador reevalúe tu pago.</div>
      `;
      infoMsg.style.background = '#fef2f2';
      infoMsg.style.borderColor = '#fecaca';
    } else if (order.paymentStatus === 'En revisión') {
      infoMsg.innerHTML = `
        <div style="color:#9a3412;font-weight:700;">⏳ Nuevo comprobante en revisión</div>
        <div style="color:#c2410c;margin-top:4px;">El administrador está verificando tu nuevo comprobante. Se confirmará apenas se valide en cuenta.</div>
      `;
      infoMsg.style.background = '#fff7ed';
      infoMsg.style.borderColor = '#ffedd5';
    } else {
      infoMsg.innerHTML = `
        <div style="color:#1e40af;font-weight:700;">ℹ️ Pendiente de verificación</div>
        <div style="color:#1d4ed8;margin-top:4px;">El administrador verificará el abono de <b>${formatMoney(order.total)}</b> en su cuenta bancaria. Recuerda adjuntar tu captura o enviarla por WhatsApp.</div>
      `;
      infoMsg.style.background = '#eff6ff';
      infoMsg.style.borderColor = '#bfdbfe';
    }
  }

  // Visualización de comprobante
  const voucherArea = $('trackVoucherDisplayArea');
  if (voucherArea) {
    if (order.voucher && order.voucher.image) {
      voucherArea.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;background:#ffffff;border:1px solid var(--line);border-radius:12px;padding:10px 14px;">
          <div class="voucher-thumb-wrap" onclick="openVoucherModal(${order.id})" title="Ver comprobante en pantalla completa">
            <img class="voucher-thumb-img" src="${order.voucher.image}" alt="Voucher" />
          </div>
          <div style="flex:1;min-width:0;">
            <strong style="font-size:13px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${order.voucher.fileName || 'comprobante.jpg'}</strong>
            <small style="color:var(--muted);font-size:11.5px;">${order.voucher.fileSize || ''} • Subido: ${order.voucher.uploadedAt || order.date}</small>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="openVoucherModal(${order.id})">🔍 Ver Completo</button>
        </div>
      `;
    } else {
      voucherArea.innerHTML = `
        <div style="padding:14px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;text-align:center;color:var(--muted);font-size:12.5px;">
          📷 Aún no has adjuntado una captura de pago para este pedido.
        </div>
      `;
    }
  }

  // Permitir subir / reemplazar comprobante si no está confirmado
  const replaceArea = $('trackReplaceVoucherArea');
  if (replaceArea) {
    const canUpload = order.paymentStatus !== 'Confirmado';
    replaceArea.classList.toggle('hidden', !canUpload);
    const reInput = $('reuploadVoucherInput');
    if (reInput) reInput.value = '';
    $('reuploadPreviewArea')?.classList.add('hidden');
    activeReuploadVoucher = null;
  }

  $('modalClientOrderTracking')?.classList.remove('hidden');
};

window.handleReuploadVoucherChange = function (input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    alert('Formato no válido. Solo se admiten imágenes JPG, JPEG, PNG o WEBP.');
    input.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('La imagen seleccionada supera el límite máximo de 5 MB.');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    activeReuploadVoucher = {
      image: dataUrl,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
      uploadedAt: nowFormatted()
    };

    if ($('reuploadPreviewImg')) $('reuploadPreviewImg').src = dataUrl;
    if ($('reuploadFileName')) $('reuploadFileName').textContent = file.name;
    $('reuploadPreviewArea')?.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
};

window.submitReuploadedVoucher = function () {
  if (!activeReuploadVoucher || !activeTrackingOrderId) {
    alert('Por favor selecciona una imagen de comprobante.');
    return;
  }

  const order = onlineOrders.find((o) => o.id === activeTrackingOrderId);
  if (!order) return;

  order.voucher = { ...activeReuploadVoucher };
  order.paymentStatus = 'En revisión'; // Cambia estado a "En revisión"

  if (!order.verificationHistory) order.verificationHistory = [];
  order.verificationHistory.push({
    action: 'Comprobante Reemplazado',
    timestamp: nowFormatted(),
    adminName: `Cliente (${order.customerName})`,
    notes: 'Nuevo comprobante subido por el cliente. Estado pasó a En revisión.'
  });

  Storage.saveOnlineOrders(onlineOrders);
  showToast('¡Comprobante enviado! El administrador reevaluará tu pago a la brevedad.');

  openClientOrderTracking(order.id);
  renderPaymentVerificationTable();
  renderOnlineOrdersTable();
  updateDashboardStats();
};

window.openWhatsAppForCurrentTrackingOrder = function () {
  if (!activeTrackingOrderId) return;
  const order = onlineOrders.find((o) => o.id === activeTrackingOrderId);
  if (!order) return;

  const storePhone = (storeConfig.phone || '987654321').replace(/\D/g, '');
  const prefix = storeConfig.whatsappPrefix || '51';
  const targetPhone = storePhone.length === 9 ? prefix + storePhone : storePhone;

  let msg = `*Hola Bodega ${storeConfig.storeName || 'BodegaControl'}!* 👋\n`;
  msg += `He registrado el pedido *#${order.code}* desde su tienda online.\n`;
  msg += `----------------------------------------\n`;
  msg += `*Cliente:* ${order.customerName}\n`;
  msg += `*Total a Pagar:* ${formatMoney(order.total)}\n`;
  msg += `*Método de Pago:* ${order.paymentMethod}\n`;
  msg += `*Tipo de Entrega:* ${order.deliveryType === 'delivery' ? 'Envío a Domicilio' : 'Recojo en Local'}\n`;
  if (order.deliveryType === 'delivery') msg += `*Dirección:* ${order.deliveryAddress}\n`;
  msg += `----------------------------------------\n`;
  msg += `Adjunto mi comprobante para la verificación de mi pago. ¡Muchas gracias!`;

  const url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
};

window.openClientOrdersModal = function () {
  const tbody = $('clientOrdersListTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const clientOrders = onlineOrders.slice().reverse();

  if (!clientOrders.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--muted)">No has realizado pedidos aún.</td></tr>';
  } else {
    clientOrders.forEach((o) => {
      let payClass = 'b-pay-pendiente';
      if (o.paymentStatus === 'En revisión') payClass = 'b-pay-revision';
      if (o.paymentStatus === 'Confirmado') payClass = 'b-pay-confirmado';
      if (o.paymentStatus === 'Rechazado') payClass = 'b-pay-rechazado';

      let ordClass = 'b-ord-pendiente';
      if (o.orderStatus === 'Aceptado') ordClass = 'b-ord-aceptado';
      if (o.orderStatus === 'En preparación') ordClass = 'b-ord-preparacion';
      if (o.orderStatus === 'Listo para entregar') ordClass = 'b-ord-listo';
      if (o.orderStatus === 'Completado') ordClass = 'b-ord-completado';
      if (o.orderStatus === 'Cancelado') ordClass = 'b-ord-cancelado';

      tbody.insertAdjacentHTML(
        'beforeend',
        `<tr>
          <td><strong>${o.code}</strong></td>
          <td>${formatDateTime(o.date)}</td>
          <td><strong>${formatMoney(o.total)}</strong></td>
          <td>${o.paymentMethod}</td>
          <td><span class="badge ${payClass}">${o.paymentStatus}</span></td>
          <td><span class="badge ${ordClass}">${o.orderStatus}</span></td>
          <td>${o.deliveryType === 'delivery' ? '🛵 Domicilio' : '🏪 Recojo'}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="closeAllModals(); openClientOrderTracking(${o.id});">
              🔍 Seguimiento
            </button>
          </td>
        </tr>`
      );
    });
  }

  $('modalClientOrdersList')?.classList.remove('hidden');
};

// ==================== 5. MÓDULO VERIFICACIÓN DE PAGOS (ADMINISTRADOR) ====================
function initPaymentVerificationModule() {
  $('verifSearch')?.addEventListener('input', renderPaymentVerificationTable);
  $('verifStatusFilter')?.addEventListener('change', renderPaymentVerificationTable);
  $('verifMethodFilter')?.addEventListener('change', renderPaymentVerificationTable);
}

function renderPaymentVerificationTable() {
  const tbody = $('paymentVerificationTableBody');
  if (!tbody) return;

  const query = ($('verifSearch')?.value || '').toLowerCase().trim();
  const statusFilter = $('verifStatusFilter')?.value || 'todos';
  const methodFilter = $('verifMethodFilter')?.value || 'todos';

  const filtered = onlineOrders.filter((o) => {
    const matchesSearch = (o.code + ' ' + o.customerName + ' ' + (o.customerPhone || '')).toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'todos' || o.paymentStatus === statusFilter;
    const matchesMethod = methodFilter === 'todos' || o.paymentMethod.toLowerCase() === methodFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesMethod;
  });

  tbody.innerHTML = '';

  const pendingCount = onlineOrders.filter((o) => o.paymentStatus === 'Pendiente de verificación' || o.paymentStatus === 'En revisión').length;
  const navBadge = $('navVerifBadge');
  if (navBadge) {
    navBadge.textContent = pendingCount;
    navBadge.classList.toggle('hidden', pendingCount === 0);
  }

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:36px;color:var(--muted)">No se encontraron pedidos en verificación de pagos.</td></tr>';
    return;
  }

  filtered.slice().reverse().forEach((o) => {
    const cleanPhone = o.customerPhone ? o.customerPhone.replace(/\D/g, '') : '';
    const phoneLink = cleanPhone ? `<a href="https://wa.me/51${cleanPhone}" target="_blank" style="color:var(--success);font-weight:700;">📲 ${o.customerPhone}</a>` : '—';
    const itemsSummary = o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');

    // Voucher thumbnail
    let voucherHtml = '<span class="voucher-thumb-empty" title="Sin captura adjuntada">Sin voucher</span>';
    if (o.voucher && o.voucher.image) {
      voucherHtml = `
        <div class="voucher-thumb-wrap" onclick="openVoucherModal(${o.id})" title="Clic para ampliar comprobante">
          <img class="voucher-thumb-img" src="${o.voucher.image}" alt="Voucher" />
        </div>
      `;
    }

    // Badge de estado de pago
    let payClass = 'b-pay-pendiente';
    if (o.paymentStatus === 'En revisión') payClass = 'b-pay-revision';
    if (o.paymentStatus === 'Confirmado') payClass = 'b-pay-confirmado';
    if (o.paymentStatus === 'Rechazado') payClass = 'b-pay-rechazado';

    let extraStatusInfo = '';
    if (o.paymentStatus === 'Confirmado' && o.verifiedBy) {
      extraStatusInfo = `<div style="font-size:10.5px;color:var(--muted);margin-top:3px;">Por: ${o.verifiedBy} (${formatDateTime(o.verifiedAt)})</div>`;
    } else if (o.paymentStatus === 'Rechazado' && o.rejectionReason) {
      extraStatusInfo = `<div style="font-size:10.5px;color:var(--danger);margin-top:3px;max-width:160px;">Motivo: ${o.rejectionReason}</div>`;
    }

    // Acciones del Administrador
    let actionsHtml = '';
    if (o.paymentStatus !== 'Confirmado') {
      actionsHtml = `
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-success btn-sm" onclick="adminApprovePayment(${o.id})" style="font-weight:800;" title="Aprobar pago, descontar stock de inventario y generar boleta">
            ✅ Aprobar
          </button>
          <button class="btn btn-outline btn-sm" onclick="openRejectPaymentModal(${o.id})" style="color:var(--danger);border-color:#fecaca;" title="Rechazar pago e indicar motivo">
            ❌ Rechazar
          </button>
          ${o.voucher && o.voucher.image ? `<button class="btn btn-outline btn-sm" onclick="openVoucherModal(${o.id})" title="Ver comprobante">👁️</button>` : ''}
        </div>
      `;
    } else {
      actionsHtml = `
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span class="badge b-pay-confirmado" style="font-size:11px;">Aprobado ✓</span>
          <button class="btn btn-outline btn-sm" onclick="resendOrderWhatsApp(${o.id})" style="color:var(--success);border-color:#bbf7d0;">
            📲 WhatsApp
          </button>
          ${o.voucher && o.voucher.image ? `<button class="btn btn-outline btn-sm" onclick="openVoucherModal(${o.id})" title="Ver comprobante">👁️</button>` : ''}
        </div>
      `;
    }

    tbody.insertAdjacentHTML(
      'beforeend',
      `<tr>
        <td><strong>${o.code}</strong></td>
        <td>${formatDateTime(o.date)}</td>
        <td><strong>${o.customerName}</strong></td>
        <td>${phoneLink}</td>
        <td style="max-width:180px;font-size:12px;" title="${itemsSummary}">${itemsSummary}</td>
        <td><strong>${formatMoney(o.total)}</strong></td>
        <td><span class="badge b-purple">${o.paymentMethod}</span></td>
        <td>${voucherHtml}</td>
        <td>
          <span class="badge ${payClass}">${o.paymentStatus}</span>
          ${extraStatusInfo}
        </td>
        <td>${actionsHtml}</td>
      </tr>`
    );
  });
}

window.openVoucherModal = function (orderId) {
  const order = onlineOrders.find((o) => o.id === orderId);
  if (!order) return;

  const modal = $('modalViewVoucher');
  if (!modal) return;

  const imgEl = $('viewerFullImage');
  if (imgEl) {
    if (order.voucher && order.voucher.image) {
      imgEl.src = order.voucher.image;
      imgEl.classList.remove('hidden');
    } else {
      imgEl.src = '';
      imgEl.classList.add('hidden');
    }
  }

  if ($('viewerOrderCode')) $('viewerOrderCode').textContent = order.code;
  if ($('viewerCustomerName')) $('viewerCustomerName').textContent = order.customerName;
  if ($('viewerAmount')) $('viewerAmount').textContent = formatMoney(order.total);
  if ($('viewerUploadTime')) $('viewerUploadTime').textContent = order.voucher ? (order.voucher.uploadedAt || order.date) : order.date;

  const actionsBox = $('viewerAdminActions');
  if (actionsBox) {
    actionsBox.innerHTML = '';
    const isAdmin = currentRole === 'admin' || !document.body.classList.contains('is-cajero');
    if (isAdmin && order.paymentStatus !== 'Confirmado') {
      actionsBox.innerHTML = `
        <button type="button" class="btn btn-outline btn-sm" onclick="closeAllModals(); openRejectPaymentModal(${order.id});" style="color:var(--danger);border-color:#fecaca;">
          ❌ Rechazar Pago
        </button>
        <button type="button" class="btn btn-success btn-sm" onclick="closeAllModals(); adminApprovePayment(${order.id});" style="font-weight:800;">
          ✅ Aprobar Pago Ahora
        </button>
      `;
    }
  }

  modal.classList.remove('hidden');
};


window.adminApprovePayment = async function (orderId) {
  const order = onlineOrders.find(
    o => String(o.id) === String(orderId)
  );

  if (!order) {
    alert('No se encontró el pedido.');
    return;
  }

  if (!activeStoreId || activeStoreRole !== 'admin') {
    alert('Solo el administrador de esta bodega puede aprobar pagos.');
    return;
  }

  if (order.paymentStatus === 'Confirmado') {
    showToast(`El pedido ${order.code} ya fue aprobado.`);
    return;
  }

  if (order.paymentStatus === 'Rechazado') {
    alert('Este pedido fue rechazado y no puede aprobarse directamente.');
    return;
  }

  const completed = await executeSaleTransaction({
    channel: 'online',
    orderId: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    paymentMethod: order.paymentMethod,
    cashReceived: null,
    change: null,
    items: order.items,
    subtotal: order.subtotal,
    total: order.total
  });

  if (!completed) return;

  renderPaymentVerificationTable();
  renderOnlineOrdersTable();
  updateDashboardStats();

  showToast(`¡Pedido ${order.code} aprobado y registrado en Firebase!`);
};


window.openRejectPaymentModal = function (orderId) {
  const order = onlineOrders.find((o) => o.id === orderId);
  if (!order) return;

  activeRejectOrderId = order.id;
  if ($('rejectModalOrderCode')) $('rejectModalOrderCode').textContent = order.code;
  if ($('rejectionReasonInput')) $('rejectionReasonInput').value = '';

  $('modalRejectPayment')?.classList.remove('hidden');
};

window.setRejectionReasonTag = function (tag) {
  if ($('rejectionReasonInput')) {
    $('rejectionReasonInput').value = tag;
  }
};

window.confirmRejectPaymentSubmit = function () {
  if (!activeRejectOrderId) return;
  const order = onlineOrders.find((o) => o.id === activeRejectOrderId);
  if (!order) return;

  const reason = $('rejectionReasonInput')?.value.trim();
  if (!reason) {
    alert('Por favor especifica el motivo del rechazo del pago.');
    $('rejectionReasonInput')?.focus();
    return;
  }

  const adminName = currentUser ? currentUser.name : 'Don Pepe (Admin)';
  const rejectDate = nowFormatted();

  order.paymentStatus = 'Rechazado';
  order.rejectionReason = reason;
  order.rejectedAt = rejectDate;
  order.rejectedBy = adminName;

  if (!order.verificationHistory) order.verificationHistory = [];
  order.verificationHistory.push({
    action: 'Pago Rechazado',
    timestamp: rejectDate,
    adminName: adminName,
    notes: `Motivo: ${reason}`
  });

  Storage.saveOnlineOrders(onlineOrders);

  closeAllModals();
  renderPaymentVerificationTable();
  renderOnlineOrdersTable();
  updateDashboardStats();
  showToast(`Pago del pedido ${order.code} RECHAZADO.`);
};

// ==================== GESTIÓN GENERAL DE PEDIDOS ONLINE (ADMIN & CAJERO) ====================
function initOnlineOrdersModule() {
  $('ordersSearch')?.addEventListener('input', renderOnlineOrdersTable);
  $('ordersStatusFilter')?.addEventListener('change', renderOnlineOrdersTable);
}

function renderOnlineOrdersTable() {
  const tbody = $('onlineOrdersTableBody');
  if (!tbody) return;

  const query = ($('ordersSearch')?.value || '').toLowerCase().trim();
  const statusFilter = $('ordersStatusFilter')?.value || 'todos';

  const filtered = onlineOrders.filter((o) => {
    const matchesSearch = (o.code + ' ' + o.customerName + ' ' + (o.customerPhone || '')).toLowerCase().includes(query);
    if (!matchesSearch) return false;

    if (statusFilter === 'todos') return true;
    if (statusFilter === 'pay_pendiente') return o.paymentStatus === 'Pendiente de verificación';
    if (statusFilter === 'pay_revision') return o.paymentStatus === 'En revisión';
    if (statusFilter === 'pay_confirmado') return o.paymentStatus === 'Confirmado';
    if (statusFilter === 'pay_rechazado') return o.paymentStatus === 'Rechazado';
    if (statusFilter === 'ord_preparacion') return o.orderStatus === 'En preparación';
    if (statusFilter === 'ord_listo') return o.orderStatus === 'Listo para entregar';
    if (statusFilter === 'del_camino') return o.deliveryStatus === 'En camino';
    if (statusFilter === 'del_entregado') return o.deliveryStatus === 'Entregado';

    return true;
  });

  tbody.innerHTML = '';

  const activeOrdersCount = onlineOrders.filter((o) => o.orderStatus !== 'Completado' && o.orderStatus !== 'Cancelado').length;
  const navBadge = $('navOrdersBadge');
  if (navBadge) {
    navBadge.textContent = activeOrdersCount;
    navBadge.classList.toggle('hidden', activeOrdersCount === 0);
  }

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:36px;color:var(--muted)">No se encontraron pedidos online.</td></tr>';
    return;
  }

  filtered.slice().reverse().forEach((o) => {
    const isPaid = o.paymentStatus === 'Confirmado';
    const cleanPhone = o.customerPhone ? o.customerPhone.replace(/\D/g, '') : '';
    const phoneLink = cleanPhone ? `<a href="https://wa.me/51${cleanPhone}" target="_blank" style="color:var(--success);font-weight:700;">📲 ${o.customerPhone}</a>` : '—';
    const itemsSummary = o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');

    // Badges de estados
    let payClass = 'b-pay-pendiente';
    if (o.paymentStatus === 'En revisión') payClass = 'b-pay-revision';
    if (o.paymentStatus === 'Confirmado') payClass = 'b-pay-confirmado';
    if (o.paymentStatus === 'Rechazado') payClass = 'b-pay-rechazado';

    // Selectores independientes para OrderStatus y DeliveryStatus
    const orderStatusSelect = `
      <select class="category-filter" style="padding:4px 6px;font-size:11.5px;" onchange="updateOnlineOrderStatusDirect(${o.id}, 'orderStatus', this.value)">
        <option value="Pendiente" ${o.orderStatus === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
        <option value="Aceptado" ${o.orderStatus === 'Aceptado' ? 'selected' : ''}>Aceptado</option>
        <option value="En preparación" ${o.orderStatus === 'En preparación' ? 'selected' : ''}>En preparación</option>
        <option value="Listo para entregar" ${o.orderStatus === 'Listo para entregar' ? 'selected' : ''}>Listo para entrega</option>
        <option value="Completado" ${o.orderStatus === 'Completado' ? 'selected' : ''}>Completado</option>
        <option value="Cancelado" ${o.orderStatus === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
      </select>
    `;

    const deliveryStatusSelect = `
      <select class="category-filter" style="padding:4px 6px;font-size:11.5px;" onchange="updateOnlineOrderStatusDirect(${o.id}, 'deliveryStatus', this.value)">
        <option value="Pendiente" ${o.deliveryStatus === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
        <option value="En camino" ${o.deliveryStatus === 'En camino' ? 'selected' : ''}>En camino</option>
        <option value="Entregado" ${o.deliveryStatus === 'Entregado' ? 'selected' : ''}>Entregado</option>
      </select>
    `;

    // Voucher
    let voucherHtml = '<span class="voucher-thumb-empty" title="Sin comprobante">Sin voucher</span>';
    if (o.voucher && o.voucher.image) {
      voucherHtml = `
        <div class="voucher-thumb-wrap" onclick="openVoucherModal(${o.id})" title="Ver comprobante">
          <img class="voucher-thumb-img" src="${o.voucher.image}" alt="Voucher" />
        </div>
      `;
    }

    const deliveryBadge = o.deliveryType === 'delivery'
      ? `<span class="badge" style="background:#e0f2fe;color:#0369a1;font-size:11px;" title="${o.deliveryAddress || ''}">🛵 Domicilio</span>`
      : `<span class="badge" style="background:#f1f5f9;color:#334155;font-size:11px;">🏪 Recojo</span>`;

    tbody.insertAdjacentHTML(
      'beforeend',
      `<tr>
        <td><strong>${o.code}</strong></td>
        <td>${formatDateTime(o.date)}</td>
        <td><strong>${o.customerName}</strong><br><small>${phoneLink}</small></td>
        <td>${deliveryBadge}</td>
        <td style="max-width:180px;font-size:12px;" title="${itemsSummary}">${itemsSummary}</td>
        <td><strong>${formatMoney(o.total)}</strong></td>
        <td><span class="badge b-purple">${o.paymentMethod}</span></td>
        <td><span class="badge ${payClass}">${o.paymentStatus}</span></td>
        <td>${orderStatusSelect}</td>
        <td>${deliveryStatusSelect}</td>
        <td>${voucherHtml}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${
              !isPaid
                ? `<button class="btn btn-success btn-sm" onclick="adminApprovePayment(${o.id})" style="font-weight:800;" title="Aprobar pago">
                     ✅ Aprobar
                   </button>`
                : `<button class="btn btn-outline btn-sm" onclick="resendOrderWhatsApp(${o.id})" style="color:var(--success);border-color:#bbf7d0;">
                     📲 WhatsApp
                   </button>`
            }
            <button class="btn btn-outline btn-sm" onclick="openClientOrderTracking(${o.id})" title="Ver seguimiento de este pedido">
              👁️
            </button>
          </div>
        </td>
      </tr>`
    );
  });
}

window.updateOnlineOrderStatusDirect = function (orderId, field, value) {
  const order = onlineOrders.find((o) => o.id === orderId);
  if (!order) return;

  order[field] = value;
  if (!order.verificationHistory) order.verificationHistory = [];
  order.verificationHistory.push({
    action: `Estado ${field} actualizado`,
    timestamp: nowFormatted(),
    adminName: currentUser ? currentUser.name : 'Don Pepe (Admin)',
    notes: `Cambió a: ${value}`
  });

  Storage.saveOnlineOrders(onlineOrders);
  showToast(`Pedido ${order.code}: ${field} actualizado a "${value}"`);
  renderOnlineOrdersTable();
};

window.resendOrderWhatsApp = function (orderId) {
  const order = onlineOrders.find((o) => o.id === orderId);
  if (!order) return;

  const simulatedSale = {
    code: order.code,
    date: order.date,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    channel: 'online',
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    total: order.total,
    items: order.items
  };

  openWhatsAppForSale(simulatedSale);
};

// ==================== TRANSACCIÓN NÚCLEO: DESCUENTO DE STOCK Y BOLETA ====================

async function executeSaleTransaction(saleData) {
  if (!activeStoreId || !['admin', 'cajero'].includes(activeStoreRole)) {
    alert('No tienes permisos para registrar ventas en esta bodega.');
    return false;
  }

  if (!saleData.items?.length) {
    alert('La venta no contiene productos.');
    return false;
  }

  const quantities = new Map();

  for (const item of saleData.items) {
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      alert('La cantidad de un producto no es válida.');
      return false;
    }

    quantities.set(item.id, (quantities.get(item.id) || 0) + qty);
  }

  const saleDate = nowFormatted();
  const operator = currentUser ? currentUser.name : 'Usuario';
  const saleId = Date.now();
  const saleCode = Storage.getNextSaleCode(sales);

  const newSale = {
    id: saleId,
    code: saleCode,
    channel: saleData.channel,
    date: saleDate,
    customerName: saleData.customerName,
    customerPhone: saleData.customerPhone || '',
    operatorName: operator,
    paymentMethod: saleData.paymentMethod,
    paymentStatus: 'Pagado',
    cashReceived: saleData.cashReceived ?? null,
    change: saleData.change ?? null,
    subtotal: saleData.subtotal,
    total: saleData.total,
    items: saleData.items
  };

  try {
    await db.runTransaction(async (transaction) => {
      const productRefs = [];
      const productSnapshots = [];

      for (const [productId] of quantities) {
        const prod = products.find(p => String(p.id) === String(productId));

        if (!prod) {
          throw new Error(`Producto ${productId} no encontrado.`);
        }

        const ref = getStoreCollection('productos').doc(String(prod.id));
        const snapshot = await transaction.get(ref);

        if (!snapshot.exists) {
          throw new Error(`El producto "${prod.name}" ya no existe.`);
        }

        productRefs.push({ ref, prod, productId });
        productSnapshots.push(snapshot);
      }

      let orderRef = null;
      let orderSnapshot = null;

      if (saleData.orderId != null) {
        orderRef = getStoreCollection('pedidos').doc(String(saleData.orderId));
        orderSnapshot = await transaction.get(orderRef);

        if (!orderSnapshot.exists) {
          throw new Error('El pedido ya no existe.');
        }

        if (orderSnapshot.data().paymentStatus === 'Confirmado') {
          throw new Error('Este pedido ya fue aprobado.');
        }
      }

      const movementRefs = [];
      let movementIndex = 0;

      for (const { ref, prod, productId } of productRefs) {
        const snapshot = productSnapshots[movementIndex];
        const currentStock = Number(snapshot.data().stock) || 0;
        const qty = quantities.get(productId);

        if (currentStock < qty) {
          throw new Error(
            `Stock insuficiente de "${prod.name}". Disponible: ${currentStock}; solicitado: ${qty}.`
          );
        }

        const movement = {
          id: saleId + movementIndex,
          type: 'out',
          subType: saleData.channel === 'online'
            ? 'venta_online'
            : 'venta_presencial',
          product: prod.name,
          qty,
          date: saleDate,
          user: `${saleData.channel === 'online' ? 'Online' : 'Caja'} (${operator})`,
          note: `${saleData.channel === 'online' ? 'Venta tienda online' : 'Venta presencial mostrador'} Boleta #${saleCode}`
        };

        transaction.update(ref, {
          stock: currentStock - qty
        });

        transaction.set(
          getStoreCollection('movimientos').doc(String(movement.id)),
          movement
        );

        movementRefs.push(movement);
        movementIndex++;
      }

      transaction.set(
        getStoreCollection('ventas').doc(String(newSale.id)),
        newSale
      );

      if (orderRef && orderSnapshot) {
        const order = orderSnapshot.data();
        const history = [...(order.verificationHistory || [])];

        history.push({
          action: 'Pago Aprobado',
          timestamp: saleDate,
          adminName: operator,
          notes: 'Pago verificado y aprobado. Stock descontado del inventario.'
        });

        transaction.update(orderRef, {
          paymentStatus: 'Confirmado',
          orderStatus: 'Aceptado',
          verifiedAt: saleDate,
          verifiedBy: operator,
          verificationHistory: history
        });
      }
    });

    for (const [productId, qty] of quantities) {
      const prod = products.find(p => String(p.id) === String(productId));
      if (prod) prod.stock = Number(prod.stock || 0) - qty;
    }

    movements.push(...movementRefs);
    sales.push(newSale);

    if (saleData.orderId != null) {
      const order = onlineOrders.find(
        o => String(o.id) === String(saleData.orderId)
      );

      if (order) {
        order.paymentStatus = 'Confirmado';
        order.orderStatus = 'Aceptado';
        order.verifiedAt = saleDate;
        order.verifiedBy = operator;

        if (!order.verificationHistory) order.verificationHistory = [];

        order.verificationHistory.push({
          action: 'Pago Aprobado',
          timestamp: saleDate,
          adminName: operator,
          notes: 'Pago verificado y aprobado. Stock descontado del inventario.'
        });
      }
    }

    renderAllViews();

    if (saleData.customerPhone?.trim()) {
      setTimeout(() => openWhatsAppForSale(newSale), 450);
    }

    viewBoleta(saleCode);
    showToast(`Venta ${saleCode} guardada correctamente en Firebase.`);

    console.log('Venta guardada en Firebase:', newSale);
    return true;

  } catch (error) {
    console.error('Error en la transacción de venta:', error);
    alert('No se pudo completar la venta: ' + error.message);
    return false;
  }
}

// ==================== APERTURA DE WHATSAPP CON MENSAJE PREPARADO ====================
function generateWhatsAppReceiptText(sale) {
  const storeName = storeConfig.storeName || 'BodegaControl';
  let msg = `*🧾 ${storeName.toUpperCase()} - COMPROBANTE DE PAGO*\n`;
  msg += `*Boleta N.º:* ${sale.code}\n`;
  msg += `*Fecha y Hora:* ${sale.date}\n`;
  msg += `*Cliente:* ${sale.customerName || 'Cliente'}\n`;
  msg += `*Canal:* ${sale.channel === 'online' ? 'Tienda Online' : 'Venta Presencial (POS)'}\n`;
  msg += `----------------------------------------\n`;
  msg += `*PRODUCTOS COMPRADOS:*\n`;
  sale.items.forEach((item) => {
    msg += `• ${item.quantity}x ${item.name} (${formatMoney(item.price)} c/u) = ${formatMoney(item.subtotal)}\n`;
  });
  msg += `----------------------------------------\n`;
  msg += `*TOTAL PAGADO:* ${formatMoney(sale.total)}\n`;
  msg += `*MÉTODO DE PAGO:* ${sale.paymentMethod} (Pago confirmado ✓)\n`;
  msg += `----------------------------------------\n`;
  msg += `${storeConfig.whatsappGreeting || '¡Muchas gracias por su compra! Que tenga un excelente día y vuelva pronto.'}\n`;
  if (storeConfig.address) msg += `📍 ${storeConfig.address}\n`;
  if (storeConfig.phone) msg += `📞 Consultas: ${storeConfig.phone}`;
  return msg;
}

function openWhatsAppForSale(sale) {
  let phone = sale.customerPhone ? String(sale.customerPhone).replace(/\D/g, '') : '';
  if (!phone || phone.length < 8) {
    phone = prompt('Ingresa el número de WhatsApp del cliente para enviar la boleta (Ej: 987654321):', phone);
    if (!phone) return;
    phone = phone.replace(/\D/g, '');
  }

  // Formato internacional para celulares de Perú (9 dígitos)
  if (phone.length === 9) {
    phone = (storeConfig.whatsappPrefix || '51') + phone;
  }

  const message = generateWhatsAppReceiptText(sale);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  // Abrir WhatsApp Web / App
  window.open(url, '_blank');
}

window.openCurrentBoletaWhatsApp = function () {
  if (currentBoleta) openWhatsAppForSale(currentBoleta);
};

// ==================== BOLETAS Y COMPROBANTES ====================
function renderBoletasTable() {
  const tbody = $('boletasTableBody');
  if (!tbody) return;

  const query = ($('boletaSearch')?.value || '').toLowerCase().trim();

  const filtered = sales.filter((s) => {
    return (s.code + ' ' + (s.customerName || '') + ' ' + s.channel + ' ' + s.paymentMethod).toLowerCase().includes(query);
  });

  tbody.innerHTML = '';

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:36px;color:var(--muted)">No se encontraron boletas de venta.</td></tr>';
    return;
  }

  filtered.slice().reverse().forEach((s) => {
    const totalItems = s.items.reduce((acc, i) => acc + i.quantity, 0);
    const isOnline = s.channel === 'online';

    tbody.insertAdjacentHTML(
      'beforeend',
      `<tr>
        <td><strong>${s.code}</strong></td>
        <td>${formatDateTime(s.date)}</td>
        <td><span class="badge ${isOnline ? 'b-channel-online' : 'b-channel-presencial'}">${isOnline ? '🛍️ Online' : '🛒 Presencial'}</span></td>
        <td>
          <div><strong>${s.customerName || 'Cliente'}</strong></div>
          <small style="color:var(--muted);">${s.customerPhone || 'Sin WhatsApp'}</small>
        </td>
        <td>${totalItems} un.</td>
        <td><span class="badge b-purple">${s.paymentMethod}</span></td>
        <td><strong>${formatMoney(s.total)}</strong></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="viewBoleta('${s.code}')">👁️ Ver</button>
            <button class="btn btn-success btn-sm" onclick="sendWhatsAppForBoletaCode('${s.code}')" style="background:#25d366;border-color:#25d366;color:#ffffff;font-weight:700;">📲 WhatsApp</button>
          </div>
        </td>
      </tr>`
    );
  });
}

window.viewBoleta = function (code) {
  const sale = sales.find((s) => s.code === code);
  if (!sale) return;

  currentBoleta = sale;
  const container = $('boletaTicketContainer');
  if (!container) return;

  const isOnline = sale.channel === 'online';
  const itemsRows = sale.items
    .map(
      (item) => `
    <tr>
      <td>${item.quantity}</td>
      <td>${item.name}</td>
      <td style="text-align:right;">${formatMoney(item.price)}</td>
      <td style="text-align:right;font-weight:bold;">${formatMoney(item.subtotal)}</td>
    </tr>`
    )
    .join('');

  const logoHtml = storeConfig.logoImage
    ? `<img src="${storeConfig.logoImage}" class="receipt-logo-thumb" alt="Logo" />`
    : `<div style="font-size:32px;margin-bottom:4px;">🏪</div>`;

  container.innerHTML = `
    <div class="receipt-wrapper">
      <div class="receipt-header">
        ${logoHtml}
        <h3>${storeConfig.storeName}</h3>
        <div class="receipt-meta">${storeConfig.subtitle}</div>
        <div class="receipt-meta">RUC: ${storeConfig.ruc}</div>
        <div class="receipt-meta">${storeConfig.address}</div>
        <div class="receipt-meta">Teléf: ${storeConfig.phone}</div>
      </div>

      <div class="receipt-info-row">
        <span><strong>BOLETA DE VENTA</strong></span>
        <span><strong>${sale.code}</strong></span>
      </div>
      <div class="receipt-info-row">
        <span>Canal:</span>
        <span><strong>${isOnline ? 'Tienda Online' : 'Venta Presencial en Bodega'}</strong></span>
      </div>
      <div class="receipt-info-row">
        <span>Fecha y Hora:</span>
        <span>${sale.date}</span>
      </div>
      <div class="receipt-info-row">
        <span>Cliente:</span>
        <span>${sale.customerName || 'Cliente'}</span>
      </div>
      ${sale.customerPhone ? `<div class="receipt-info-row"><span>WhatsApp:</span><span>${sale.customerPhone}</span></div>` : ''}
      <div class="receipt-info-row">
        <span>Método de pago:</span>
        <span><strong>${sale.paymentMethod}</strong></span>
      </div>
      <div class="receipt-info-row">
        <span>Estado del pago:</span>
        <span><strong style="color:var(--success);">PAGO CONFIRMADO ✓</strong></span>
      </div>

      <table class="receipt-table">
        <thead>
          <tr>
            <th style="width:12%;">Cant</th>
            <th>Descripción</th>
            <th style="width:22%;text-align:right;">P.Unit</th>
            <th style="width:24%;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="receipt-totals">
        <div class="receipt-total-row">
          <span>Subtotal:</span>
          <span>${formatMoney(sale.subtotal)}</span>
        </div>
        <div class="receipt-total-row grand">
          <span>TOTAL A PAGAR:</span>
          <span>${formatMoney(sale.total)}</span>
        </div>
        ${
          sale.paymentMethod === 'Efectivo' && sale.cashReceived
            ? `
        <div class="receipt-total-row" style="margin-top:6px;font-size:12px;color:#444;">
          <span>Efectivo recibido:</span>
          <span>${formatMoney(sale.cashReceived)}</span>
        </div>
        <div class="receipt-total-row" style="font-size:12px;color:#444;">
          <span>Vuelto entregado:</span>
          <span>${formatMoney(sale.change || 0)}</span>
        </div>`
            : ''
        }
      </div>

      <div class="receipt-footer">
        <p>${storeConfig.whatsappGreeting || '¡Gracias por su compra! Vuelva pronto.'}</p>
        <p>Comprobante emitido y enviado a WhatsApp.</p>
        <div class="receipt-barcode">||| | ||||| || |||||| | |||</div>
      </div>
    </div>
  `;

  $('modalBoleta')?.classList.remove('hidden');
};

window.sendWhatsAppForBoletaCode = function (code) {
  const sale = sales.find((s) => s.code === code);
  if (sale) openWhatsAppForSale(sale);
};

window.downloadBoletaTxt = function () {
  if (!currentBoleta) return;
  const sale = currentBoleta;

  let text = `========================================\n`;
  text += `        ${storeConfig.storeName.toUpperCase()}        \n`;
  text += `   RUC: ${storeConfig.ruc} - ${storeConfig.subtitle}   \n`;
  text += `   ${storeConfig.address} \n`;
  text += `   Teléf: ${storeConfig.phone} \n`;
  text += `========================================\n`;
  text += `BOLETA ELECTRÓNICA: ${sale.code}\n`;
  text += `Canal: ${sale.channel === 'online' ? 'Tienda Online' : 'Venta Presencial'}\n`;
  text += `Fecha: ${sale.date}\n`;
  text += `Cliente: ${sale.customerName || 'Cliente'}\n`;
  text += `WhatsApp: ${sale.customerPhone || 'N/A'}\n`;
  text += `Método de pago: ${sale.paymentMethod}\n`;
  text += `Estado: PAGO CONFIRMADO ✓\n`;
  text += `----------------------------------------\n`;
  text += `CANT  DESCRIPCIÓN             P.UNIT    TOTAL\n`;
  text += `----------------------------------------\n`;
  sale.items.forEach((i) => {
    const namePadded = i.name.padEnd(20, ' ').slice(0, 20);
    text += `${String(i.quantity).padEnd(5, ' ')} ${namePadded} ${formatMoney(i.price).padEnd(9, ' ')} ${formatMoney(i.subtotal)}\n`;
  });
  text += `----------------------------------------\n`;
  text += `TOTAL PAGADO: ${formatMoney(sale.total)}\n`;
  if (sale.cashReceived) {
    text += `Efectivo recibido: ${formatMoney(sale.cashReceived)}\n`;
    text += `Vuelto: ${formatMoney(sale.change || 0)}\n`;
  }
  text += `========================================\n`;
  text += `${storeConfig.whatsappGreeting || '¡Muchas gracias por su preferencia!'}\n`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Boleta_${sale.code}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Boleta ${sale.code} descargada.`);
};

window.copyBoletaText = function () {
  if (!currentBoleta) return;
  const msg = generateWhatsAppReceiptText(currentBoleta);
  navigator.clipboard.writeText(msg).then(() => {
    showToast('Texto de la boleta copiado al portapapeles.');
  });
};

// ==================== MOVIMIENTOS DE INVENTARIO ====================
function renderMovementsList() {
  const container = $('movementsTimeline');
  if (!container) return;

  const query = ($('movementSearch')?.value || '').toLowerCase().trim();

  let list = movements.filter((m) => {
    let matchesFilter = true;
    if (movementFilter === 'in') matchesFilter = m.type === 'in';
    else if (movementFilter === 'venta_presencial') matchesFilter = m.subType === 'venta_presencial';
    else if (movementFilter === 'venta_online') matchesFilter = m.subType === 'venta_online';

    const matchesSearch = (m.product + ' ' + (m.note || '') + ' ' + (m.user || '')).toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  container.innerHTML = '';

  if (!list.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">No hay movimientos registrados con el filtro actual.</div>';
    return;
  }

  list.slice().reverse().forEach((m) => {
    const isIn = m.type === 'in';
    const isOnline = m.subType === 'venta_online';

    container.insertAdjacentHTML(
      'beforeend',
      `<div class="movement-card">
        <div class="move-icon ${isIn ? 'in' : 'out'}">
          ${isIn ? '📥' : isOnline ? '🛍️' : '🛒'}
        </div>
        <div class="move-details">
          <div style="display:flex;align-items:center;gap:8px;">
            <strong>${m.product}</strong>
            <span class="badge ${isIn ? 'b-ok' : isOnline ? 'b-channel-online' : 'b-channel-presencial'}">
              ${isIn ? 'Entrada / Reposición' : isOnline ? 'Venta Tienda Online' : 'Venta Presencial'}
            </span>
          </div>
          <span>${m.note || ''} · ${formatDateTime(m.date)} · Resp: <b>${m.user || 'Personal'}</b></span>
        </div>
        <div class="move-qty ${isIn ? 'in' : 'out'}">
          ${isIn ? `+${m.qty}` : `−${m.qty}`} un.
        </div>
      </div>`
    );
  });
}

window.setMovementFilter = function (filter) {
  movementFilter = filter;
  document.querySelectorAll('.mov-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.filter === filter);
  });
  renderMovementsList();
};

// ==================== REPORTES Y DASHBOARD ====================
function initReportsModule() {}

function updateDashboardStats() {
  const totalProducts = products.length;
  const totalUnits = products.reduce((acc, p) => acc + Number(p.stock), 0);
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.min).length;
  const totalRev = sales.reduce((acc, s) => acc + Number(s.total), 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRev = sales.filter((s) => s.date.slice(0, 10) === todayStr).reduce((acc, s) => acc + Number(s.total), 0);

  const onlineRev = sales.filter((s) => s.channel === 'online').reduce((acc, s) => acc + Number(s.total), 0);
  const presencialRev = sales.filter((s) => s.channel === 'presencial').reduce((acc, s) => acc + Number(s.total), 0);

  const inventoryValue = products.reduce((acc, p) => acc + (p.stock * p.price), 0);
  const pendingVerifCount = onlineOrders.filter((o) => o.paymentStatus === 'Pendiente de verificación' || o.paymentStatus === 'En revisión').length;
  const activeOrdersCount = onlineOrders.filter((o) => o.orderStatus !== 'Completado' && o.orderStatus !== 'Cancelado').length;

  if ($('statProducts')) $('statProducts').textContent = totalProducts;
  if ($('statUnits')) $('statUnits').textContent = totalUnits;
  if ($('statLow')) $('statLow').textContent = lowStockCount;
  if ($('statSalesRevenue')) $('statSalesRevenue').textContent = formatMoney(totalRev);
  if ($('statTodaySales')) $('statTodaySales').textContent = formatMoney(todayRev || totalRev);
  if ($('statOnlineSales')) $('statOnlineSales').textContent = formatMoney(onlineRev);
  if ($('statPresencialSales')) $('statPresencialSales').textContent = formatMoney(presencialRev);
  if ($('statPendingVerifications')) $('statPendingVerifications').textContent = pendingVerifCount;
  if ($('statInventoryValue')) $('statInventoryValue').textContent = formatMoney(inventoryValue);

  // Badges en navegación
  const navLow = $('navLowBadge');
  if (navLow) {
    navLow.textContent = lowStockCount;
    navLow.classList.toggle('hidden', lowStockCount === 0);
  }

  const navVerif = $('navVerifBadge');
  if (navVerif) {
    navVerif.textContent = pendingVerifCount;
    navVerif.classList.toggle('hidden', pendingVerifCount === 0);
  }

  const navOrders = $('navOrdersBadge');
  if (navOrders) {
    navOrders.textContent = activeOrdersCount;
    navOrders.classList.toggle('hidden', activeOrdersCount === 0);
  }

  // Últimas ventas en dashboard
  const dashSales = $('dashboardRecentSales');
  if (dashSales) {
    dashSales.innerHTML = '';
    sales.slice(-4).reverse().forEach((s) => {
      const isOnline = s.channel === 'online';
      dashSales.insertAdjacentHTML(
        'beforeend',
        `<tr>
          <td><strong>${s.code}</strong></td>
          <td><span class="badge ${isOnline ? 'b-channel-online' : 'b-channel-presencial'}">${isOnline ? '🛍️ Online' : '🛒 Presencial'}</span></td>
          <td>${s.customerName || 'Cliente'}</td>
          <td>${s.paymentMethod}</td>
          <td><strong>${formatMoney(s.total)}</strong></td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="viewBoleta('${s.code}')">Ver</button>
          </td>
        </tr>`
      );
    });
  }

  // Alertas de stock bajo en dashboard
  const dashLow = $('dashboardLowStock');
  if (dashLow) {
    dashLow.innerHTML = '';
    const lowProds = products.filter((p) => p.stock <= p.min);
    if (!lowProds.length) {
      dashLow.innerHTML = '<div style="padding:16px;color:var(--muted);text-align:center;">¡Excelente! Todos los productos tienen buen stock.</div>';
    } else {
      lowProds.slice(0, 5).forEach((p) => {
        const isOut = p.stock === 0;
        dashLow.insertAdjacentHTML(
          'beforeend',
          `<div class="stock-item">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:20px;">${p.emoji}</span>
              <div>
                <strong>${p.name}</strong>
                <div style="font-size:11px;color:var(--muted);">Mínimo requerido: ${p.min} un.</div>
              </div>
            </div>
            <span class="badge ${isOut ? 'b-out' : 'b-low'}">${isOut ? 'Agotado' : `${p.stock} un.`}</span>
          </div>`
        );
      });
    }
  }
}

function renderReportsData() {
  const totalRev = sales.reduce((acc, s) => acc + Number(s.total), 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRev = sales.filter((s) => s.date.slice(0, 10) === todayStr).reduce((acc, s) => acc + Number(s.total), 0);

  const onlineSales = sales.filter((s) => s.channel === 'online');
  const presencialSales = sales.filter((s) => s.channel === 'presencial');

  const onlineRev = onlineSales.reduce((acc, s) => acc + Number(s.total), 0);
  const presencialRev = presencialSales.reduce((acc, s) => acc + Number(s.total), 0);

  if ($('repTotalRevenue')) $('repTotalRevenue').textContent = formatMoney(totalRev);
  if ($('repTodayRevenue')) $('repTodayRevenue').textContent = formatMoney(todayRev || totalRev);
  if ($('repOnlineRevenue')) $('repOnlineRevenue').textContent = formatMoney(onlineRev);
  if ($('repOnlineCount')) $('repOnlineCount').textContent = `${onlineSales.length} pedidos online`;
  if ($('repPresencialRevenue')) $('repPresencialRevenue').textContent = formatMoney(presencialRev);
  if ($('repPresencialCount')) $('repPresencialCount').textContent = `${presencialSales.length} ventas presenciales`;

  renderPaymentMethodsBreakdown();

  // Top productos
  const salesByProduct = {};
  sales.forEach((s) => {
    s.items.forEach((item) => {
      if (!salesByProduct[item.name]) salesByProduct[item.name] = { name: item.name, qty: 0, revenue: 0 };
      salesByProduct[item.name].qty += item.quantity;
      salesByProduct[item.name].revenue += item.subtotal;
    });
  });

  const top = Object.values(salesByProduct).sort((a, b) => b.qty - a.qty);
  const topTable = $('topProductsBody');
  if (topTable) {
    topTable.innerHTML = '';
    if (!top.length) {
      topTable.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:25px;color:var(--muted)">Sin datos de ventas aún.</td></tr>';
    } else {
      top.slice(0, 5).forEach((item, index) => {
        topTable.insertAdjacentHTML(
          'beforeend',
          `<tr>
            <td><strong>#${index + 1}</strong></td>
            <td><strong>${item.name}</strong></td>
            <td>${item.qty} un.</td>
            <td><strong>${formatMoney(item.revenue)}</strong></td>
          </tr>`
        );
      });
    }
  }

  renderSalesBars();
}

function renderPaymentMethodsBreakdown() {
  const container = $('paymentMethodsBreakdown');
  if (!container) return;

  const methods = { Efectivo: 0, Yape: 0, Plin: 0 };
  sales.forEach((s) => {
    if (methods[s.paymentMethod] !== undefined) {
      methods[s.paymentMethod] += s.total;
    } else {
      methods.Efectivo += s.total;
    }
  });

  const total = Object.values(methods).reduce((a, b) => a + b, 0) || 1;

  container.innerHTML = `
    <div style="border-bottom:1px solid #f1f3f9;padding-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">
        <span>💵 Efectivo</span>
        <span>${formatMoney(methods.Efectivo)} (${Math.round((methods.Efectivo / total) * 100)}%)</span>
      </div>
      <div style="height:8px;background:#f1f5f9;border-radius:999px;margin-top:6px;overflow:hidden;">
        <div style="height:100%;width:${(methods.Efectivo / total) * 100}%;background:var(--success);border-radius:999px;"></div>
      </div>
    </div>
    <div style="border-bottom:1px solid #f1f3f9;padding-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">
        <span>🟣 Yape</span>
        <span>${formatMoney(methods.Yape)} (${Math.round((methods.Yape / total) * 100)}%)</span>
      </div>
      <div style="height:8px;background:#f1f5f9;border-radius:999px;margin-top:6px;overflow:hidden;">
        <div style="height:100%;width:${(methods.Yape / total) * 100}%;background:var(--yape);border-radius:999px;"></div>
      </div>
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">
        <span>🔵 Plin</span>
        <span>${formatMoney(methods.Plin)} (${Math.round((methods.Plin / total) * 100)}%)</span>
      </div>
      <div style="height:8px;background:#f1f5f9;border-radius:999px;margin-top:6px;overflow:hidden;">
        <div style="height:100%;width:${(methods.Plin / total) * 100}%;background:var(--plin);border-radius:999px;"></div>
      </div>
    </div>
  `;
}

function renderSalesBars() {
  const barsContainer = $('salesBarsContainer');
  const labelsContainer = $('salesBarsLabels');
  if (!barsContainer || !labelsContainer) return;

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' });
    days.push({ key: dateKey, label, total: 0 });
  }

  sales.forEach((s) => {
    const sDate = s.date.slice(0, 10);
    const day = days.find((d) => d.key === sDate);
    if (day) day.total += s.total;
    else if (days.length > 0) days[days.length - 1].total += s.total;
  });

  const maxTotal = Math.max(...days.map((d) => d.total), 40);

  barsContainer.innerHTML = '';
  labelsContainer.innerHTML = '';

  days.forEach((day) => {
    const heightPercent = Math.max(12, Math.min(100, (day.total / maxTotal) * 100));
    barsContainer.insertAdjacentHTML(
      'beforeend',
      `<div class="bar-col">
        <div style="font-size:11px;font-weight:bold;color:var(--primary);margin-bottom:4px;">${day.total > 0 ? formatMoney(day.total) : ''}</div>
        <div class="bar" style="height:${heightPercent}%;" title="${day.label}: ${formatMoney(day.total)}"></div>
      </div>`
    );
    labelsContainer.insertAdjacentHTML('beforeend', `<span>${day.label}</span>`);
  });
}

// ==================== GESTIÓN DE USUARIOS Y CAJEROS ====================
function initUsersModule() {
  const cashierForm = $('cashierForm');
  if (cashierForm) {
    cashierForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('cashierName').value.trim();
      const username = $('cashierUser').value.trim().toLowerCase();
      const password = $('cashierPass').value.trim();
      const phone = $('cashierPhone').value.trim();
      const email = $('cashierEmail').value.trim();

      if (!name || !username || !password) {
        alert('Por favor completa todos los campos requeridos para el cajero.');
        return;
      }

      if (users.some((u) => u.username.toLowerCase() === username)) {
        alert(`El nombre de usuario "${username}" ya existe.`);
        return;
      }

      users.push({
        id: Date.now(),
        name,
        username,
        password,
        role: 'cajero',
        roleLabel: 'Cajero',
        phone,
        email: email || `${username}@bodegacontrol.pe`
      });

      Storage.saveUsers(users);
      closeAllModals();
      renderUsersTable();
      showToast(`Cuenta de cajero para "${name}" creada exitosamente.`);
    });
  }
}

function renderUsersTable() {
  const tbody = $('usersTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  users.forEach((u) => {
    const isAdmin = u.role === 'admin';
    const isCajero = u.role === 'cajero';

    const roleBadge = isAdmin
      ? '<span class="badge b-purple">👑 Administrador</span>'
      : isCajero
      ? '<span class="badge b-channel-presencial">🧑‍💻 Cajero</span>'
      : '<span class="badge b-channel-online">🛍️ Cliente</span>';

    tbody.insertAdjacentHTML(
      'beforeend',
      `<tr>
        <td><strong>${u.name}</strong></td>
        <td><code>@${u.username}</code></td>
        <td>${roleBadge}</td>
        <td>${u.phone || '—'}</td>
        <td>${u.email || '—'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="switchActiveUserTo('${u.username}')">
            ${u.username === localStorage.getItem('bc_session_user') ? 'Activo ✓' : 'Iniciar Como'}
          </button>
        </td>
      </tr>`
    );
  });
}

window.openCashierModal = function () {
  $('cashierForm')?.reset();
  $('modalCashier')?.classList.remove('hidden');
};

window.switchActiveUserTo = function (username) {
  const u = users.find((x) => x.username === username);
  if (!u) return;

  loginSuccess(u, true);
};

// ==================== CONFIGURACIÓN DEL SISTEMA ====================
function initConfigModule() {
  $('generalConfigForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    storeConfig.storeName = $('cfgStoreName').value.trim();
    storeConfig.subtitle = $('cfgSubtitle').value.trim();
    storeConfig.ruc = $('cfgRuc').value.trim();
    storeConfig.phone = $('cfgPhone').value.trim();
    storeConfig.address = $('cfgAddress').value.trim();

    Storage.saveConfig(storeConfig);
    applyStoreBranding();
    showToast('Datos de la bodega actualizados correctamente.');
  });

  $('paymentsConfigForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    storeConfig.yapeNumber = $('cfgYapeNumber').value.trim();
    storeConfig.yapeOwner = $('cfgYapeOwner').value.trim();
    storeConfig.plinNumber = $('cfgPlinNumber').value.trim();
    storeConfig.plinOwner = $('cfgPlinOwner').value.trim();

    Storage.saveConfig(storeConfig);
    renderPaymentQRs();
    showToast('Configuración de QR y cuentas guardada.');
  });

  $('whatsappConfigForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    storeConfig.whatsappPrefix = $('cfgWaPrefix').value.trim();
    storeConfig.currency = $('cfgCurrency').value.trim();
    storeConfig.whatsappGreeting = $('cfgWaGreeting').value.trim();

    Storage.saveConfig(storeConfig);
    showToast('Configuración de WhatsApp guardada.');
  });
}

function renderConfigFields() {
  if ($('cfgStoreName')) $('cfgStoreName').value = storeConfig.storeName || '';
  if ($('cfgSubtitle')) $('cfgSubtitle').value = storeConfig.subtitle || '';
  if ($('cfgRuc')) $('cfgRuc').value = storeConfig.ruc || '';
  if ($('cfgPhone')) $('cfgPhone').value = storeConfig.phone || '';
  if ($('cfgAddress')) $('cfgAddress').value = storeConfig.address || '';

  if ($('cfgYapeNumber')) $('cfgYapeNumber').value = storeConfig.yapeNumber || '';
  if ($('cfgYapeOwner')) $('cfgYapeOwner').value = storeConfig.yapeOwner || '';
  if ($('cfgPlinNumber')) $('cfgPlinNumber').value = storeConfig.plinNumber || '';
  if ($('cfgPlinOwner')) $('cfgPlinOwner').value = storeConfig.plinOwner || '';

  if ($('cfgWaPrefix')) $('cfgWaPrefix').value = storeConfig.whatsappPrefix || '51';
  if ($('cfgCurrency')) $('cfgCurrency').value = storeConfig.currency || 'S/';
  if ($('cfgWaGreeting')) $('cfgWaGreeting').value = storeConfig.whatsappGreeting || '';
}

// ==================== 6. MÓDULO DE MÉTODOS DE PAGO (ADMINISTRADOR) ====================
function initPaymentMethodsModule() {
  renderPaymentMethodsSettings();
}

function renderPaymentMethodsSettings() {
  paymentMethods = Storage.getPaymentMethods();

  // 1. YAPE
  const yape = paymentMethods.yape || {};
  if ($('cfgMethodYapeActive')) $('cfgMethodYapeActive').checked = !!yape.active;
  if ($('labelMethodYapeStatus')) $('labelMethodYapeStatus').textContent = yape.active ? 'Habilitado' : 'Deshabilitado';
  if ($('cfgMethodYapeOwner')) $('cfgMethodYapeOwner').value = yape.owner || '';
  if ($('cfgMethodYapePhone')) $('cfgMethodYapePhone').value = yape.phone || '';
  if ($('cfgMethodYapeInstructions')) $('cfgMethodYapeInstructions').value = yape.instructions || '';
  if ($('cfgMethodYapeQrImg') && $('cfgMethodYapeQrPlaceholder')) {
    if (yape.qrImage) {
      $('cfgMethodYapeQrImg').src = yape.qrImage;
      $('cfgMethodYapeQrImg').classList.remove('hidden');
      $('cfgMethodYapeQrPlaceholder').classList.add('hidden');
    } else {
      $('cfgMethodYapeQrImg').src = '';
      $('cfgMethodYapeQrImg').classList.add('hidden');
      $('cfgMethodYapeQrPlaceholder').classList.remove('hidden');
    }
  }

  // 2. PLIN
  const plin = paymentMethods.plin || {};
  if ($('cfgMethodPlinActive')) $('cfgMethodPlinActive').checked = !!plin.active;
  if ($('labelMethodPlinStatus')) $('labelMethodPlinStatus').textContent = plin.active ? 'Habilitado' : 'Deshabilitado';
  if ($('cfgMethodPlinOwner')) $('cfgMethodPlinOwner').value = plin.owner || '';
  if ($('cfgMethodPlinPhone')) $('cfgMethodPlinPhone').value = plin.phone || '';
  if ($('cfgMethodPlinInstructions')) $('cfgMethodPlinInstructions').value = plin.instructions || '';
  if ($('cfgMethodPlinQrImg') && $('cfgMethodPlinQrPlaceholder')) {
    if (plin.qrImage) {
      $('cfgMethodPlinQrImg').src = plin.qrImage;
      $('cfgMethodPlinQrImg').classList.remove('hidden');
      $('cfgMethodPlinQrPlaceholder').classList.add('hidden');
    } else {
      $('cfgMethodPlinQrImg').src = '';
      $('cfgMethodPlinQrImg').classList.add('hidden');
      $('cfgMethodPlinQrPlaceholder').classList.remove('hidden');
    }
  }

  // 3. TRANSFERENCIA BANCARIA
  const trans = paymentMethods.transferencia || {};
  if ($('cfgMethodTransferenciaActive')) $('cfgMethodTransferenciaActive').checked = !!trans.active;
  if ($('labelMethodTransferenciaStatus')) $('labelMethodTransferenciaStatus').textContent = trans.active ? 'Habilitado' : 'Deshabilitado';
  if ($('cfgMethodBankName')) $('cfgMethodBankName').value = trans.bankName || '';
  if ($('cfgMethodBankOwner')) $('cfgMethodBankOwner').value = trans.owner || '';
  if ($('cfgMethodBankAccount')) $('cfgMethodBankAccount').value = trans.accountNumber || '';
  if ($('cfgMethodBankCci')) $('cfgMethodBankCci').value = trans.cci || '';
  if ($('cfgMethodBankInstructions')) $('cfgMethodBankInstructions').value = trans.instructions || '';
  if ($('cfgMethodBankQrImg') && $('cfgMethodBankQrPlaceholder')) {
    if (trans.qrImage) {
      $('cfgMethodBankQrImg').src = trans.qrImage;
      $('cfgMethodBankQrImg').classList.remove('hidden');
      $('cfgMethodBankQrPlaceholder').classList.add('hidden');
    } else {
      $('cfgMethodBankQrImg').src = '';
      $('cfgMethodBankQrImg').classList.add('hidden');
      $('cfgMethodBankQrPlaceholder').classList.remove('hidden');
    }
  }

  // 4. EFECTIVO
  const efec = paymentMethods.efectivo || {};
  if ($('cfgMethodEfectivoActive')) $('cfgMethodEfectivoActive').checked = !!efec.active;
  if ($('labelMethodEfectivoStatus')) $('labelMethodEfectivoStatus').textContent = efec.active ? 'Habilitado' : 'Deshabilitado';
  if ($('cfgMethodEfectivoInstructions')) $('cfgMethodEfectivoInstructions').value = efec.instructions || '';
}

window.togglePaymentMethodActive = function (methodKey, isActive) {
  if (paymentMethods[methodKey]) {
    paymentMethods[methodKey].active = isActive;
    const keyCap = methodKey.charAt(0).toUpperCase() + methodKey.slice(1);
    const label = $(`labelMethod${keyCap}Status`);
    if (label) label.textContent = isActive ? 'Habilitado' : 'Deshabilitado';
  }
};

window.handleMethodQrUpload = function (methodKey, input) {
  const file = input.files && input.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('La imagen seleccionada supera el límite máximo de 5 MB.');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    tempMethodQrImages[methodKey] = dataUrl;
    if (paymentMethods[methodKey]) {
      paymentMethods[methodKey].qrImage = dataUrl;
    }

    let imgId = '';
    let placeholderId = '';
    if (methodKey === 'yape') { imgId = 'cfgMethodYapeQrImg'; placeholderId = 'cfgMethodYapeQrPlaceholder'; }
    if (methodKey === 'plin') { imgId = 'cfgMethodPlinQrImg'; placeholderId = 'cfgMethodPlinQrPlaceholder'; }
    if (methodKey === 'transferencia') { imgId = 'cfgMethodBankQrImg'; placeholderId = 'cfgMethodBankQrPlaceholder'; }

    if ($(imgId) && $(placeholderId)) {
      $(imgId).src = dataUrl;
      $(imgId).classList.remove('hidden');
      $(placeholderId).classList.add('hidden');
    }
    showToast('Código QR cargado. Recuerda hacer clic en "Guardar Métodos de Pago".');
  };
  reader.readAsDataURL(file);
};

window.saveAllPaymentMethods = function () {
  // Yape
  if (!paymentMethods.yape) paymentMethods.yape = { id: 'yape', name: 'Yape', icon: '🟣' };
  paymentMethods.yape.active = $('cfgMethodYapeActive') ? $('cfgMethodYapeActive').checked : true;
  paymentMethods.yape.owner = $('cfgMethodYapeOwner') ? $('cfgMethodYapeOwner').value.trim() : '';
  paymentMethods.yape.phone = $('cfgMethodYapePhone') ? $('cfgMethodYapePhone').value.trim() : '';
  paymentMethods.yape.instructions = $('cfgMethodYapeInstructions') ? $('cfgMethodYapeInstructions').value.trim() : '';
  if (tempMethodQrImages.yape) paymentMethods.yape.qrImage = tempMethodQrImages.yape;

  // Plin
  if (!paymentMethods.plin) paymentMethods.plin = { id: 'plin', name: 'Plin', icon: '🔵' };
  paymentMethods.plin.active = $('cfgMethodPlinActive') ? $('cfgMethodPlinActive').checked : true;
  paymentMethods.plin.owner = $('cfgMethodPlinOwner') ? $('cfgMethodPlinOwner').value.trim() : '';
  paymentMethods.plin.phone = $('cfgMethodPlinPhone') ? $('cfgMethodPlinPhone').value.trim() : '';
  paymentMethods.plin.instructions = $('cfgMethodPlinInstructions') ? $('cfgMethodPlinInstructions').value.trim() : '';
  if (tempMethodQrImages.plin) paymentMethods.plin.qrImage = tempMethodQrImages.plin;

  // Transferencia Bancaria
  if (!paymentMethods.transferencia) paymentMethods.transferencia = { id: 'transferencia', name: 'Transferencia Bancaria', icon: '🏦' };
  paymentMethods.transferencia.active = $('cfgMethodTransferenciaActive') ? $('cfgMethodTransferenciaActive').checked : true;
  paymentMethods.transferencia.bankName = $('cfgMethodBankName') ? $('cfgMethodBankName').value.trim() : '';
  paymentMethods.transferencia.owner = $('cfgMethodBankOwner') ? $('cfgMethodBankOwner').value.trim() : '';
  paymentMethods.transferencia.accountNumber = $('cfgMethodBankAccount') ? $('cfgMethodBankAccount').value.trim() : '';
  paymentMethods.transferencia.cci = $('cfgMethodBankCci') ? $('cfgMethodBankCci').value.trim() : '';
  paymentMethods.transferencia.instructions = $('cfgMethodBankInstructions') ? $('cfgMethodBankInstructions').value.trim() : '';
  if (tempMethodQrImages.transferencia) paymentMethods.transferencia.qrImage = tempMethodQrImages.transferencia;

  // Efectivo
  if (!paymentMethods.efectivo) paymentMethods.efectivo = { id: 'efectivo', name: 'Efectivo', icon: '💵' };
  paymentMethods.efectivo.active = $('cfgMethodEfectivoActive') ? $('cfgMethodEfectivoActive').checked : true;
  paymentMethods.efectivo.instructions = $('cfgMethodEfectivoInstructions') ? $('cfgMethodEfectivoInstructions').value.trim() : '';

  Storage.savePaymentMethods(paymentMethods);
  showToast('¡Configuración de métodos de pago guardada con éxito!');
  renderOnlineActivePaymentMethods();
};

// Compatibilidad
function initPaymentsModule() {}
function renderPendingPaymentsTable() {
  renderPaymentVerificationTable();
}
function renderPaymentQRs() {
  renderPaymentMethodsSettings();
}

function generateQRCodeSvg(brandColor, brandText, number) {
  return `
    <svg viewBox="0 0 160 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="160" rx="12" fill="#ffffff" />
      <rect x="15" y="15" width="36" height="36" rx="6" fill="${brandColor}" />
      <rect x="21" y="21" width="24" height="24" rx="4" fill="#ffffff" />
      <rect x="27" y="27" width="12" height="12" rx="2" fill="${brandColor}" />
      <rect x="109" y="15" width="36" height="36" rx="6" fill="${brandColor}" />
      <rect x="115" y="21" width="24" height="24" rx="4" fill="#ffffff" />
      <rect x="121" y="27" width="12" height="12" rx="2" fill="${brandColor}" />
      <rect x="15" y="109" width="36" height="36" rx="6" fill="${brandColor}" />
      <rect x="21" y="115" width="24" height="24" rx="4" fill="#ffffff" />
      <rect x="27" y="121" width="12" height="12" rx="2" fill="${brandColor}" />
      <g fill="#1f2937">
        <rect x="60" y="16" width="6" height="6" rx="1" />
        <rect x="74" y="16" width="6" height="6" rx="1" />
        <rect x="88" y="16" width="6" height="6" rx="1" />
        <rect x="66" y="26" width="8" height="6" rx="1" />
        <rect x="82" y="26" width="10" height="6" rx="1" />
        <rect x="60" y="38" width="8" height="8" rx="1" />
        <rect x="80" y="38" width="6" height="6" rx="1" />
        <rect x="16" y="60" width="8" height="6" rx="1" />
        <rect x="32" y="60" width="6" height="8" rx="1" />
        <rect x="44" y="60" width="8" height="6" rx="1" />
        <rect x="16" y="74" width="6" height="10" rx="1" />
        <rect x="32" y="80" width="12" height="6" rx="1" />
        <rect x="16" y="92" width="10" height="6" rx="1" />
        <rect x="110" y="60" width="10" height="6" rx="1" />
        <rect x="130" y="60" width="6" height="8" rx="1" />
        <rect x="110" y="74" width="8" height="6" rx="1" />
        <rect x="126" y="78" width="12" height="6" rx="1" />
        <rect x="60" y="112" width="8" height="6" rx="1" />
        <rect x="78" y="112" width="8" height="8" rx="1" />
        <rect x="62" y="126" width="6" height="8" rx="1" />
        <rect x="76" y="130" width="12" height="6" rx="1" />
        <rect x="98" y="120" width="8" height="8" rx="1" />
        <rect x="116" y="116" width="10" height="6" rx="1" />
        <rect x="132" y="116" width="6" height="8" rx="1" />
      </g>
      <rect x="58" y="58" width="44" height="44" rx="10" fill="#ffffff" stroke="${brandColor}" stroke-width="2" />
      <rect x="62" y="62" width="36" height="36" rx="8" fill="${brandColor}" />
      <text x="80" y="84" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="11" text-anchor="middle">${brandText}</text>
    </svg>
  `;
}

// ==================== GESTIÓN DE MODALES ====================
function initModals() {
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllModals();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}

window.closeAllModals = function () {
  document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.add('hidden'));
};

// ==================== NOTIFICACIONES TOAST ====================
let toastTimer = null;
function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

// ==================== RENDERIZACIÓN GLOBAL ====================
function renderAllViews() {
  populateCategoryPillsAndSelects();
  updateDashboardStats();
  renderInventoryTable();
  renderPosProducts();
  renderPosCart();
  renderClientProducts();
  renderClientCartUI();
  renderOnlineOrdersTable();
  renderPaymentVerificationTable();
  renderPaymentMethodsSettings();
  renderCategoriesTable();
  renderBoletasTable();
  renderMovementsList();
  renderReportsData();
  renderUsersTable();
  renderConfigFields();
  applyStoreBranding();
}
