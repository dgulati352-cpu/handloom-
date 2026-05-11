import { db, collection, getDocs, addDoc, query, orderBy, serverTimestamp, doc, getDoc, setDoc, updateDoc, increment, deleteDoc } from './firebase-config.js';

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
        }

        if (q) {
            const querySnapshot = await getDocs(q);
            const data = [];
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() });
            });
            
            if (type === 'orders') renderOrders(data);
            if (type === 'promos') renderPromos(data);
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
        const statusClass = o.status === 'Shipped' ? 'status-shipped' : 'status-pending';
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
        await updateDoc(doc(db, "orders", orderId), { status: newStatus });
        loadData('orders');
    } catch (err) {
        alert("Error updating order: " + err.message);
    }
}
window.updateOrderStatus = updateOrderStatus;

async function deleteItem(collectionName, id) {
    if (!confirm(`Are you sure you want to delete this ${collectionName.slice(0,-1)}?`)) return;
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
            
            document.querySelector('#promoModal h3').innerText = 'Edit Promo Code';
            openModal('promoModal');
        }
    } catch (err) {
        alert("Error loading promo: " + err.message);
    }
}
window.editPromo = editPromo;

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
            document.querySelector('#promoModal h3').innerText = 'Create Promo Code';
            loadData('promos');
        } catch (err) { 
            alert("Error saving promo: " + err.message); 
        } finally { 
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadData('orders');
});
