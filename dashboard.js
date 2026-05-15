import { db, storage, ref, uploadBytes, getDownloadURL, collection, getDocs, addDoc, query, orderBy, serverTimestamp, doc, getDoc, setDoc, updateDoc, increment, deleteDoc, onSnapshot } from './firebase-config.js';

// Image Preview Logic
const artImageFile = document.getElementById('artImageFile');
if (artImageFile) {
    artImageFile.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                document.getElementById('previewImg').src = e.target.result;
                document.getElementById('imagePreview').style.display = 'block';
                document.getElementById('uploadPlaceholder').style.display = 'none';
            }
            reader.readAsDataURL(file);
        }
    });
}

// Modal Helpers
window.openModal = (id) => document.getElementById(id).classList.add('active');
window.closeModal = (id) => document.getElementById(id).classList.remove('active');

async function switchSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

    const target = document.getElementById(section + 'Section');
    if (target) target.classList.add('active');

    // Find the nav item
    const items = document.querySelectorAll('.nav-item');
    items.forEach(item => {
        if (item.innerText.toLowerCase().includes(section)) {
            item.classList.add('active');
        }
    });

    loadData(section);
}

// Attach to window so onclick works
window.switchSection = switchSection;

async function loadData(type) {
    try {
        let q;
        if (type === 'orders') {
            q = query(collection(db, "orders"), orderBy('createdAt', 'desc'));
        } else if (type === 'promos') {
            q = query(collection(db, "promos"), orderBy('createdAt', 'desc'));
        } else if (type === 'articles') {
            q = query(collection(db, "articles"), orderBy('createdAt', 'desc'));
        }

        if (q) {
            const querySnapshot = await getDocs(q);
            const data = [];
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() });
            });

            if (type === 'orders') renderOrders(data);
            if (type === 'promos') renderPromos(data);
            if (type === 'articles') renderArticles(data);
        }

        if (type === 'settings') loadSettings();

        document.getElementById('apiStatus').innerHTML = '<i class="fas fa-circle"></i> Firebase Live';
    } catch (err) {
        console.error("Failed to fetch data", err);
        document.getElementById('apiStatus').innerHTML = '<i class="fas fa-circle" style="color:var(--danger)"></i> Firebase Error';
    }
}

window.loadData = loadData;

async function loadSettings() {
    try {
        const docRef = doc(db, "settings", "main");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('setAnnounceText').value = data.announcementText || "";
            document.getElementById('setShippingCost').value = data.shippingCost || 199;
            document.getElementById('setStoreName').value = data.storeName || "Hridyang Collection";
            document.getElementById('setWhatsApp').value = data.whatsAppNumber || "918791416116";
            document.getElementById('setWhatsAppKey').value = data.callMeBotKey || "";
            if (data.playNotifSound !== undefined) {
                document.getElementById('setNotifSound').checked = data.playNotifSound;
            }
            if (data.notifDuration !== undefined) {
                document.getElementById('setNotifDuration').value = data.notifDuration;
            }
        }
    } catch (err) {
        console.error("Error loading settings:", err);
    }
}

const saveSettingsBtn = document.getElementById('saveSettingsBtn');
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
        saveSettingsBtn.innerText = 'Saving...';
        saveSettingsBtn.disabled = true;

        try {
            const settingsData = {
                announcementText: document.getElementById('setAnnounceText').value,
                shippingCost: parseInt(document.getElementById('setShippingCost').value),
                storeName: document.getElementById('setStoreName').value,
                whatsAppNumber: document.getElementById('setWhatsApp').value,
                callMeBotKey: document.getElementById('setWhatsAppKey').value,
                playNotifSound: document.getElementById('setNotifSound').checked,
                notifDuration: parseFloat(document.getElementById('setNotifDuration').value) || 4.5,
                updatedAt: serverTimestamp()
            };

            await setDoc(doc(db, "settings", "main"), settingsData);
            alert("Settings updated successfully!");
        } catch (err) {
            alert("Error saving settings: " + err.message);
        } finally {
            saveSettingsBtn.innerText = 'Save Changes';
            saveSettingsBtn.disabled = false;
        }
    });
}

function renderOrders(orders) {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    tbody.innerHTML = orders.map(o => {
        const date = o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';

        // Dynamic Status Class
        let statusClass = 'status-pending';
        if (o.status === 'Shipped') statusClass = 'status-shipped';
        if (o.status === 'Delivered') statusClass = 'status-delivered';
        if (o.status === 'Cancelled') statusClass = 'status-cancelled';

        return `
            <tr>
                <td>#${o.id.toString().slice(-4)}</td>
                <td>
                    <div style="font-weight:600">${o.firstName || ''} ${o.lastName || o.customerName || ''}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted)"><i class="fas fa-phone"></i> ${o.phone}</div>
                    ${o.email ? `<div style="font-size:0.8rem; color:var(--text-muted)"><i class="fas fa-envelope"></i> ${o.email}</div>` : ''}
                    <div style="font-size:0.75rem; color:#888; max-width:200px; line-height:1.4; margin-top:6px; background: #f9f9f9; padding: 5px; border-radius: 4px;">
                        ${o.addressLine ? `${o.addressLine}<br>${o.city}, ${o.state} - ${o.pin}` : (o.address || 'No Address')}
                    </div>
                </td>
                <td>
                    <div style="font-size:0.85rem;">
                        ${o.items ? o.items.map(item => `<div style="margin-bottom:2px;">• ${item.name} (x${item.quantity})</div>`).join('') : 'No Items'}
                    </div>
                </td>
                <td style="font-weight:600">₹${o.total ? o.total.toLocaleString('en-IN') : 0}</td>
                <td>${date}</td>
                <td>
                    <select onchange="updateOrderStatus('${o.id}', this.value)" class="status-badge ${statusClass}" style="border:none; cursor:pointer; outline:none; font-family:inherit; padding: 5px 10px; border-radius: 12px; font-weight: 600;">
                        <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
            </tr>
        `}).join('');

    const statOrders = document.getElementById('statOrders');
    if (statOrders) statOrders.innerText = orders.length;

    const statRevenue = document.getElementById('statRevenue');
    if (statRevenue) {
        const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
        statRevenue.innerText = '₹' + revenue.toLocaleString('en-IN');
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);

        if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            const oldStatus = orderData.status;

            // Handle Stock Synchronization
            if (newStatus === 'Cancelled' && oldStatus !== 'Cancelled') {
                // Increment stock back
                for (const item of (orderData.items || [])) {
                    if (item.id) {
                        await updateDoc(doc(db, "articles", item.id), {
                            stock: increment(item.quantity)
                        });
                    }
                }
            } else if (oldStatus === 'Cancelled' && newStatus !== 'Cancelled') {
                // Decrement stock again
                for (const item of (orderData.items || [])) {
                    if (item.id) {
                        await updateDoc(doc(db, "articles", item.id), {
                            stock: increment(-item.quantity)
                        });
                    }
                }
            }

            await updateDoc(orderRef, { status: newStatus });
            loadData('orders');
        }
    } catch (err) {
        alert("Error updating order: " + err.message);
    }
}
window.updateOrderStatus = updateOrderStatus;

async function deleteItem(collectionName, id) {
    if (!confirm(`Are you sure you want to delete this ${collectionName.slice(0, -1)}?`)) return;
    try {
        await deleteDoc(doc(db, collectionName, id));
        loadData(collectionName);
    } catch (err) {
        alert("Error deleting item: " + err.message);
    }
}
window.deleteItem = deleteItem;

function renderPromos(promos) {
    const tbody = document.querySelector('#promosTable tbody');
    if (!tbody) return;

    tbody.innerHTML = promos.map(p => `
        <tr>
            <td style="font-weight:bold">${p.code}</td>
            <td>${p.discount}% OFF</td>
            <td><span class="status-badge ${p.active ? 'status-shipped' : 'status-pending'}" onclick="togglePromoStatus('${p.id}', ${!p.active})" style="cursor:pointer">${p.active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn" style="color:var(--primary)" onclick="editPromo('${p.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn" style="color:var(--danger)" onclick="deleteItem('promos', '${p.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');

    const statPromos = document.getElementById('statPromos');
    if (statPromos) statPromos.innerText = promos.filter(p => p.active).length;
}

function renderArticles(articles) {
    const tbody = document.querySelector('#articlesTable tbody');
    if (!tbody) return;

    tbody.innerHTML = articles.map(a => `
        <tr>
            <td><img src="${a.image || 'assets/placeholder.png'}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;"></td>
            <td style="font-weight:600">${a.name}</td>
            <td><span class="status-badge" style="background:#eee; color:#666">${a.category}</span></td>
            <td style="font-weight:600">₹${a.price.toLocaleString('en-IN')}</td>
            <td>
                <span class="status-badge ${a.stock > 0 ? 'status-shipped' : 'status-pending'}" style="font-size:0.75rem">
                    ${a.stock > 0 ? `${a.stock} In Stock` : 'Out of Stock'}
                </span>
            </td>
            <td>
                <button class="btn" style="color:var(--primary)" onclick="editArticle('${a.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn" style="color:var(--danger)" onclick="deleteItem('articles', '${a.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');

    const statArticles = document.getElementById('statArticles');
    if (statArticles) statArticles.innerText = articles.length;
}

let editingPromoId = null;

async function editPromo(id) {
    editingPromoId = id;
    try {
        const docSnap = await getDoc(doc(db, "promos", id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('promoCode').value = data.code;
            document.getElementById('promoDiscount').value = data.discount;
            document.getElementById('promoMinAmount').value = data.minAmount || 0;
            document.getElementById('promoLimit').value = data.usageLimit || 9999;

            document.getElementById('promoModalTitle').innerText = 'Edit Promo Code';
            openModal('promoModal');
        }
    } catch (err) {
        alert("Error loading promo: " + err.message);
    }
}
window.editPromo = editPromo;

let editingArticleId = null;

async function editArticle(id) {
    editingArticleId = id;
    try {
        const docSnap = await getDoc(doc(db, "articles", id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('artName').value = data.name;
            document.getElementById('artCategory').value = data.category;
            document.getElementById('artPrice').value = data.price;
            document.getElementById('artStyleNo').value = data.styleNo || "";
            document.getElementById('artStock').value = data.stock || 0;
            document.getElementById('artImage').value = data.image || "";

            // Set preview
            if (data.image) {
                document.getElementById('previewImg').src = data.image;
                document.getElementById('imagePreview').style.display = 'block';
                document.getElementById('uploadPlaceholder').style.display = 'none';
            } else {
                document.getElementById('imagePreview').style.display = 'none';
                document.getElementById('uploadPlaceholder').style.display = 'block';
            }

            document.getElementById('articleModalTitle').innerText = 'Edit Article';
            openModal('articleModal');
        }
    } catch (err) {
        alert("Error loading article: " + err.message);
    }
}
window.editArticle = editArticle;

async function togglePromoStatus(id, newStatus) {
    try {
        await updateDoc(doc(db, "promos", id), { active: newStatus });
        loadData('promos');
    } catch (err) {
        alert("Error updating promo: " + err.message);
    }
}
window.togglePromoStatus = togglePromoStatus;

const promoForm = document.getElementById('promoForm');
if (promoForm) {
    promoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = editingPromoId ? 'Updating...' : 'Creating...';
        btn.disabled = true;

        try {
            const promoData = {
                code: document.getElementById('promoCode').value.toUpperCase(),
                discount: parseInt(document.getElementById('promoDiscount').value),
                minAmount: parseInt(document.getElementById('promoMinAmount').value) || 0,
                usageLimit: parseInt(document.getElementById('promoLimit').value) || 9999,
                updatedAt: serverTimestamp()
            };

            if (editingPromoId) {
                await updateDoc(doc(db, "promos", editingPromoId), promoData);
            } else {
                promoData.active = true;
                promoData.usedCount = 0;
                promoData.createdAt = serverTimestamp();
                await addDoc(collection(db, "promos"), promoData);
            }

            closeModal('promoModal');
            e.target.reset();
            editingPromoId = null;
            document.getElementById('promoModalTitle').innerText = 'Create Promo Code';
            loadData('promos');
        } catch (err) {
            alert("Error saving promo: " + err.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

const articleForm = document.getElementById('articleForm');
if (articleForm) {
    articleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = editingArticleId ? 'Updating...' : 'Creating...';
        btn.disabled = true;

        try {
            let imageUrl = document.getElementById('artImage').value;
            const imageFile = document.getElementById('artImageFile').files[0];

            if (imageFile) {
                btn.innerText = 'Uploading Image...';
                const storageRef = ref(storage, `articles/${Date.now()}_${imageFile.name}`);
                const snapshot = await uploadBytes(storageRef, imageFile);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            const articleData = {
                name: document.getElementById('artName').value,
                category: document.getElementById('artCategory').value,
                price: parseInt(document.getElementById('artPrice').value),
                styleNo: document.getElementById('artStyleNo').value,
                stock: parseInt(document.getElementById('artStock').value) || 0,
                image: imageUrl,
                updatedAt: serverTimestamp()
            };

            if (editingArticleId) {
                await updateDoc(doc(db, "articles", editingArticleId), articleData);
            } else {
                articleData.createdAt = serverTimestamp();
                await addDoc(collection(db, "articles"), articleData);
            }

            closeModal('articleModal');
            e.target.reset();
            document.getElementById('imagePreview').style.display = 'none';
            document.getElementById('uploadPlaceholder').style.display = 'block';
            editingArticleId = null;
            document.getElementById('articleModalTitle').innerText = 'Add New Article';
            loadData('articles');
        } catch (err) {
            alert("Error saving article: " + err.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadData('orders');
    initNotifications();
});

/* ═══════════════════════════════════════════════
   NOTIFICATION SYSTEM
   ═══════════════════════════════════════════════ */

// Track seen order IDs to avoid duplicate toasts
let seenOrderIds = new Set();
let unreadCount = 0;

// Status icon mapping
function getStatusIcon(status) {
    const map = {
        'Pending':   { icon: 'fa-clock',        cls: 'pending' },
        'Shipped':   { icon: 'fa-shipping-fast', cls: 'shipped' },
        'Delivered': { icon: 'fa-check-circle',  cls: 'delivered' },
        'Cancelled': { icon: 'fa-times-circle',  cls: 'cancelled' },
    };
    return map[status] || { icon: 'fa-shopping-bag', cls: 'order' };
}

// Format relative time
function timeAgo(seconds) {
    if (!seconds) return 'Just now';
    const diff = Math.floor(Date.now() / 1000) - seconds;
    if (diff < 60)   return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
}

// Update badge
function updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.classList.add('visible');
    } else {
        badge.classList.remove('visible');
    }
}

// Play a simple notification beep
function playBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
        console.warn("Audio playback failed or disabled", e);
    }
}

// Show a toast popup
function showToast(title, subtitle, iconCls = 'order') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    // Read settings directly from the DOM for simplicity
    const soundEl = document.getElementById('setNotifSound');
    const playSound = soundEl ? soundEl.checked : true;
    
    const durationEl = document.getElementById('setNotifDuration');
    const durationSecs = durationEl ? (parseFloat(durationEl.value) || 4.5) : 4.5;

    const { icon } = getStatusIcon(null);
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="notif-icon ${iconCls}" style="width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-shopping-bag"></i>
        </div>
        <div class="toast-text">
            <strong>${title}</strong>
            <span>${subtitle}</span>
        </div>
    `;
    container.appendChild(toast);

    // Ring the bell
    const bell = document.getElementById('notifBell');
    if (bell) {
        bell.classList.add('ringing');
        setTimeout(() => bell.classList.remove('ringing'), 1000);
    }
    
    if (playSound) {
        playBeep();
    }

    setTimeout(() => {
        toast.classList.add('out');
        setTimeout(() => toast.remove(), 400);
    }, durationSecs * 1000);
}

// Render the notification dropdown list
function renderNotifList(orders) {
    const list = document.getElementById('notifList');
    if (!list) return;

    if (orders.length === 0) {
        list.innerHTML = `
            <div class="notif-empty">
                <i class="fas fa-bell-slash"></i>
                No notifications yet
            </div>`;
        return;
    }

    list.innerHTML = orders.map(o => {
        const { icon, cls } = getStatusIcon(o.status);
        const time = o.createdAt ? timeAgo(o.createdAt.seconds) : 'Just now';
        const customer = `${o.firstName || ''} ${o.lastName || o.customerName || ''}`.trim() || 'Customer';
        const itemCount = o.items ? o.items.length : 0;
        const isUnread = !seenOrderIds.has(o.id) ? '' : '';
        const unreadCls = o._unread ? 'unread' : '';

        return `
            <div class="notif-item ${unreadCls}" onclick="handleNotifClick('${o.id}')">
                <div class="notif-icon ${cls}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="notif-body">
                    <strong>New Order from ${customer}</strong>
                    <span>${itemCount} item${itemCount !== 1 ? 's' : ''} &bull; ₹${(o.total || 0).toLocaleString('en-IN')} &bull; ${o.status || 'Pending'}</span>
                </div>
                <div class="notif-time">${time}</div>
            </div>`;
    }).join('');
}

// Click a notification → go to orders section
window.handleNotifClick = function(orderId) {
    switchSection('orders');
    toggleNotifDropdown(false);
    // Mark that order as read by clearing unread count
    markAllAsRead();
};

// Toggle dropdown open/close
window.toggleNotifDropdown = function(forceState) {
    const dd = document.getElementById('notifDropdown');
    if (!dd) return;
    const isOpen = dd.classList.contains('open');
    const shouldOpen = forceState !== undefined ? forceState : !isOpen;
    dd.classList.toggle('open', shouldOpen);
};

// Mark all as read
window.markAllAsRead = function() {
    unreadCount = 0;
    updateBadge();
    // Remove unread styling
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.notif-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        toggleNotifDropdown(false);
    }
});

/* ═══════════════════════════════════════════════
   CSV DOWNLOAD
   ═══════════════════════════════════════════════ */

window.downloadOrdersCSV = async function () {
    const btn = document.getElementById('downloadOrdersBtn');
    if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...'; btn.disabled = true; }

    try {
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        const rows = [];

        // Header row
        rows.push([
            'Order ID', 'Date', 'Status',
            'First Name', 'Last Name', 'Phone', 'Email',
            'Address', 'City', 'State', 'PIN',
            'Items', 'Total (₹)', 'Promo Code', 'Discount (₹)', 'Shipping (₹)'
        ]);

        snapshot.forEach(docSnap => {
            const o = { id: docSnap.id, ...docSnap.data() };
            const date = o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleDateString('en-IN') : '';
            const itemsSummary = o.items
                ? o.items.map(i => `${i.name} x${i.quantity}`).join(' | ')
                : '';
            const address = o.addressLine || o.address || '';

            rows.push([
                o.id,
                date,
                o.status || 'Pending',
                o.firstName || '',
                o.lastName || o.customerName || '',
                o.phone || '',
                o.email || '',
                address,
                o.city || '',
                o.state || '',
                o.pin || '',
                itemsSummary,
                o.total || 0,
                o.promoCode || '',
                o.discount || 0,
                o.shipping || 0
            ]);
        });

        // Build CSV string with proper quoting
        const csvContent = rows.map(row =>
            row.map(cell => {
                const val = String(cell).replace(/"/g, '""');
                return val.includes(',') || val.includes('\n') || val.includes('"') ? `"${val}"` : val;
            }).join(',')
        ).join('\n');

        // Trigger download
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const today = new Date().toISOString().slice(0, 10);
        a.download = `hridyang-orders-${today}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        alert('Error downloading orders: ' + err.message);
    } finally {
        if (btn) { btn.innerHTML = '<i class="fas fa-file-download"></i> Download CSV'; btn.disabled = false; }
    }
};

// Real-time Firestore listener for orders
function initNotifications() {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        // Build ordered list
        const orders = [];
        snapshot.forEach(d => orders.push({ id: d.id, ...d.data() }));

        // Check for brand-new orders (added since last snapshot)
        let newCount = 0;
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const o = { id: change.doc.id, ...change.doc.data() };
                // Only toast if this isn't the very first load batch
                if (seenOrderIds.size > 0 && !seenOrderIds.has(o.id)) {
                    const customer = `${o.firstName || ''} ${o.lastName || o.customerName || ''}`.trim() || 'Customer';
                    showToast(
                        `New Order Received! 🛍️`,
                        `${customer} placed an order worth ₹${(o.total || 0).toLocaleString('en-IN')}`
                    );
                    newCount++;
                    o._unread = true;
                }
                seenOrderIds.add(o.id);
            }
        });

        if (newCount > 0) {
            unreadCount += newCount;
            updateBadge();
        }

        // Mark all existing orders in current list as unread if count > 0 already for first load?
        // On very first load, just seed seenOrderIds so subsequent additions trigger toasts
        const taggedOrders = orders.map(o => ({
            ...o,
            _unread: false // freshly loaded orders start as read visually
        }));

        renderNotifList(taggedOrders);
    }, (err) => {
        console.error('Notification listener error:', err);
    });
}
