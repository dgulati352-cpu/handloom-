import { db, collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, increment, serverTimestamp, getDoc, onSnapshot } from './firebase-config.js';
import { API_BASE_URL, RAZORPAY_KEY, DEFAULT_SETTINGS } from './constants.js';

let siteSettings = { ...DEFAULT_SETTINGS };

async function checkBackendStatus() {
    const warningId = 'backend-offline-warning';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const checkUrl = isLocal ? `http://${window.location.hostname}:5001` : 'https://handloom-backend-one.vercel.app';

    try {
        const res = await fetch(`${checkUrl}/api/status`);
        if (res.ok) {
            const existing = document.getElementById(warningId);
            if (existing) existing.remove();
        } else {
            throw new Error("Offline");
        }
    } catch (err) {
        if (window.location.pathname.includes('checkout.html') && !document.getElementById(warningId)) {
            const warning = document.createElement('div');
            warning.id = warningId;
            warning.style.cssText = "background: #fff5f5; color: #c53030; padding: 20px; border: 1px solid #feb2b2; border-radius: 8px; margin-bottom: 25px; text-align: center; font-weight: 600;";
            warning.innerHTML = `<span><i class="fas fa-exclamation-triangle"></i> Payment server is offline. Please start the backend.</span>`;
            const container = document.querySelector('.checkout-container');
            if (container) container.prepend(warning);
        }
    }
}

async function loadArticles() {
    const shopGrid = document.querySelector('.shop-grid');
    const productGrid = document.querySelector('.product-grid');
    const pdpContent = document.getElementById('pdp-content');
    if (!shopGrid && !productGrid && !pdpContent) return;

    let categoryFilter = null;
    const path = window.location.pathname;
    if (path.includes('handloom.html')) categoryFilter = 'HANDLOOM';
    else if (path.includes('god-clothes.html')) categoryFilter = 'GOD CLOTHES';
    else if (path.includes('fancy-articles.html')) categoryFilter = 'FANCY ARTICLES';

    try {
        const q = query(collection(db, "articles"), orderBy('createdAt', 'desc'));
        onSnapshot(q, (querySnapshot) => {
            let articles = [];
            querySnapshot.forEach(doc => articles.push({ id: doc.id, ...doc.data() }));

            if (categoryFilter) {
                articles = articles.filter(a => (a.category || '').toUpperCase() === categoryFilter.toUpperCase());
            }
            window.allArticles = articles;

            const renderTo = (grid, items) => {
                if (!grid) return;
                if (items.length === 0) {
                    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No products found.</p>';
                    return;
                }
                grid.innerHTML = items.map(a => {
                    const name = a.name || a.title || 'Unnamed';
                    const img = a.image || a.img || 'https://via.placeholder.com/400x500';
                    const price = a.price || a.discountPrice || 0;
                    const isOutOfStock = (a.stock !== undefined && a.stock <= 0);

                    return `
                        <div class="product-card reveal active ${isOutOfStock ? 'out-of-stock' : ''}" data-id="${a.id}">
                            <div class="product-img">
                                <a href="product.html?id=${a.id}">
                                    <img src="${img}" alt="${name}">
                                </a>
                                ${isOutOfStock ? 
                                    `<div class="out-of-stock-badge">OUT OF STOCK</div>` : 
                                    `<div class="quick-add"><button><i class="fas fa-plus"></i> Quick Add</button></div>`
                                }
                            </div>
                            <div class="product-info">
                                <p class="category-label">${a.category || ''}</p>
                                <h3><a href="product.html?id=${a.id}" style="color: inherit; text-decoration: none;">${name}</a></h3>
                                <div class="price">₹${price.toLocaleString('en-IN')}</div>
                                ${!isOutOfStock ? `
                                    <div class="quantity-selector">
                                        <button class="qty-btn minus"><i class="fas fa-minus"></i></button>
                                        <input type="number" class="qty-input" value="0" min="0" max="${a.stock || 10}">
                                        <button class="qty-btn plus"><i class="fas fa-plus"></i></button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            };

            // Main Grids
            if (path.includes('product.html')) {
                renderPDP(articles);
            } else if (categoryFilter) {
                renderTo(productGrid, articles);
                renderTo(shopGrid, articles);
            } else {
                // Homepage grids
                const getByCat = (cat) => articles.filter(a => (a.category || '').toUpperCase() === cat.toUpperCase()).slice(0, 4);
                renderTo(shopGrid, articles.slice(0, 8));
                renderTo(document.getElementById('handloom-grid'), getByCat('HANDLOOM'));
                renderTo(document.getElementById('god-clothes-grid'), getByCat('GOD CLOTHES'));
                renderTo(document.getElementById('fancy-articles-grid'), getByCat('FANCY ARTICLES'));
            }
            updateCartUI();
        });
    } catch (err) { console.error(err); }
}

function renderPDP(articles) {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const product = articles.find(a => a.id === productId);
    const pdpContent = document.getElementById('pdp-content');
    if (!product || !pdpContent) return;

    const name = product.name || product.title || 'Unnamed';
    const img = product.image || product.img || 'https://via.placeholder.com/400x500';
    const price = product.price || product.discountPrice || 0;
    const isOutOfStock = (product.stock !== undefined && product.stock <= 0);

    let existingQty = 1;
    const qtyInputEl = document.getElementById('pdpQty');
    if (qtyInputEl) existingQty = parseInt(qtyInputEl.value) || 1;

    pdpContent.innerHTML = `
        <div class="pdp-layout">
            <div class="pdp-image">
                <img src="${img}" alt="${name}" style="width: 100%; border-radius: 4px;">
            </div>
            <div class="pdp-details">
                <p class="category-label">${product.category || ''}</p>
                <h1>${name}</h1>
                <div style="font-size: 2rem; margin-bottom: 30px; font-weight: 600;">₹${price.toLocaleString('en-IN')}</div>
                <div style="margin-bottom: 40px;">
                    <div style="font-weight: 600; margin-bottom: 15px; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 2px;">Quantity</div>
                    <div class="quantity-selector" style="height: 45px;">
                        <button class="pdp-qty-btn pdp-minus" style="width: 45px; height: 100%; border:none; background:none; cursor:pointer;"><i class="fas fa-minus"></i></button>
                        <input type="number" id="pdpQty" value="${existingQty}" min="1" max="${product.stock || 10}" style="width: 60px; height: 100%; border:none; border-left:1px solid var(--border); border-right:1px solid var(--border); text-align:center;">
                        <button class="pdp-qty-btn pdp-plus" style="width: 45px; height: 100%; border:none; background:none; cursor:pointer;"><i class="fas fa-plus"></i></button>
                    </div>
                </div>
                <button id="pdpAddToCart" class="btn primary" style="width: 100%; padding: 20px;" ${isOutOfStock ? 'disabled' : ''}>${isOutOfStock ? 'OUT OF STOCK' : 'ADD TO BAG'}</button>
                <div class="pdp-tabs">
                    <p style="color: var(--text-muted); line-height: 1.8;">${product.description || 'A masterpiece of traditional weaving, blending centuries-old techniques with modern aesthetic sensibility. Crafted with the finest natural materials.'}</p>
                </div>
            </div>
        </div>
    `;

    // Listeners for PDP
    document.getElementById('pdpAddToCart').addEventListener('click', () => {
        const qty = parseInt(document.getElementById('pdpQty').value) || 1;
        const index = cart.findIndex(i => i.id === product.id);
        if (index > -1) cart[index].quantity += qty;
        else cart.push({ id: product.id, name, price, quantity: qty, img });
        updateCartUI();
        document.getElementById('cartSidebar').classList.add('active');
        document.getElementById('cartOverlay').classList.add('active');
    });

    document.querySelector('.pdp-minus').addEventListener('click', () => {
        const input = document.getElementById('pdpQty');
        let val = parseInt(input.value) || 1;
        if (val > 1) input.value = val - 1;
    });
    document.querySelector('.pdp-plus').addEventListener('click', () => {
        const input = document.getElementById('pdpQty');
        let val = parseInt(input.value) || 1;
        if (val < (product.stock || 10)) input.value = val + 1;
    });
}

// Global Logic
let cart = JSON.parse(localStorage.getItem('vanyaCart')) || [];

function syncCartWithInput(input, shouldOpenCart = false) {
    const card = input.closest('.product-card');
    if (!card) return;
    const id = card.getAttribute('data-id');
    const qty = parseInt(input.value) || 0;
    const index = cart.findIndex(i => i.id === id);

    if (qty === 0) {
        if (index > -1) cart.splice(index, 1);
    } else {
        if (index > -1) cart[index].quantity = qty;
        else {
            const name = card.querySelector('h3').innerText;
            const priceStr = card.querySelector('.price').innerText;
            const price = parseInt(priceStr.replace(/[^0-9]/g, ''));
            const img = card.querySelector('.product-img img').src;
            cart.push({ id, name, price, quantity: qty, img });
        }
    }
    updateCartUI();
    if (shouldOpenCart && qty > 0) {
        document.getElementById('cartSidebar').classList.add('active');
        document.getElementById('cartOverlay').classList.add('active');
    }
}

document.addEventListener('click', (e) => {
    // Qty Buttons
    const btn = e.target.closest('.qty-btn');
    if (btn) {
        const input = btn.parentElement.querySelector('.qty-input');
        const isPlus = btn.classList.contains('plus');
        let val = parseInt(input.value) || 0;
        let next = isPlus ? val + 1 : val - 1;
        if (next >= 0 && next <= (parseInt(input.max) || 100)) {
            input.value = next;
            syncCartWithInput(input, false);
        }
        return;
    }

    // Quick Add
    const qa = e.target.closest('.quick-add button');
    if (qa) {
        const input = qa.closest('.product-card').querySelector('.qty-input');
        input.value = (parseInt(input.value) || 0) + 1;
        syncCartWithInput(input, true);
        return;
    }

    // Overlays
    if (e.target.closest('#searchIcon')) {
        document.getElementById('searchOverlay').classList.add('active');
    } else if (e.target.closest('#closeSearch')) {
        document.getElementById('searchOverlay').classList.remove('active');
    } else if (e.target.closest('#cartIcon')) {
        document.getElementById('cartSidebar').classList.add('active');
        document.getElementById('cartOverlay').classList.add('active');
    } else if (e.target.closest('#closeCart') || e.target.id === 'cartOverlay') {
        document.getElementById('cartSidebar').classList.remove('active');
        document.getElementById('cartOverlay').classList.remove('active');
    } else if (e.target.id === 'checkoutBtn') {
        window.location.href = 'checkout.html';
    }
});

// Bespoke Request Form
const orderForm = document.getElementById('orderForm');
if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const feedback = document.getElementById('formFeedback');
        const submitBtn = orderForm.querySelector('button');
        
        try {
            submitBtn.innerText = 'Submitting...';
            submitBtn.disabled = true;

            const requestData = {
                customerName: document.getElementById('name').value,
                customerEmail: document.getElementById('email').value,
                category: document.getElementById('collection').value,
                details: document.getElementById('details').value,
                status: 'New',
                type: 'Bespoke Request',
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'bespoke_requests'), requestData);

            feedback.style.display = 'block';
            feedback.style.color = '#059669';
            feedback.innerHTML = '<i class="fas fa-check-circle"></i> Thank you! Your bespoke request has been sent. We will contact you soon.';
            orderForm.reset();
        } catch (err) {
            console.error(err);
            feedback.style.display = 'block';
            feedback.style.color = '#dc2626';
            feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to send request. Please try again.';
        } finally {
            submitBtn.innerText = 'Submit Request';
            submitBtn.disabled = false;
        }
    });
}


document.addEventListener('input', (e) => {
    if (e.target.classList.contains('qty-input')) syncCartWithInput(e.target, false);
});

function updateCartUI() {
    localStorage.setItem('vanyaCart', JSON.stringify(cart));
    const badge = document.getElementById('cartBadge');
    if (badge) {
        const count = cart.reduce((a, b) => a + b.quantity, 0);
        badge.innerText = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    // Sync cards
    document.querySelectorAll('.product-card').forEach(card => {
        const id = card.getAttribute('data-id');
        const input = card.querySelector('.qty-input');
        if (input) {
            const item = cart.find(i => i.id === id);
            input.value = item ? item.quantity : 0;
        }
    });

    const container = document.getElementById('cartItemsContainer');
    const totalEl = document.getElementById('cartTotalValue');
    if (!container || !totalEl) return;

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted);">Your bag is empty.</p>';
        totalEl.innerText = '₹0';
    } else {
        let total = 0;
        container.innerHTML = cart.map((item, idx) => {
            total += item.price * item.quantity;
            return `
                <div class="cart-item">
                    <img src="${item.img}" class="cart-item-img">
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.name}</div>
                        <div class="cart-item-price">₹${item.price.toLocaleString('en-IN')}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
                            <span>QTY: ${item.quantity}</span>
                            <button onclick="removeFromCart(${idx})" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:0.75rem; text-transform:uppercase; font-weight:600;">Remove</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        totalEl.innerText = '₹' + total.toLocaleString('en-IN');
    }
}

window.removeFromCart = (idx) => {
    cart.splice(idx, 1);
    updateCartUI();
};

// Checkout Page Logic
if (window.location.pathname.includes('checkout.html')) {
    const summaryContainer = document.getElementById('checkoutItemsContainer');
    const totalEl = document.getElementById('checkoutTotal');
    const subtotalEl = document.getElementById('checkoutSubtotal');

    window.renderCheckoutSummary = () => {
        if (!summaryContainer) return;
        if (cart.length === 0) {
            summaryContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Your cart is empty.</p>';
            if (subtotalEl) subtotalEl.innerText = '₹0';
            if (totalEl) totalEl.innerText = '₹0';
            return;
        }
        let subtotal = 0;
        summaryContainer.innerHTML = cart.map(item => {
            subtotal += item.price * item.quantity;
            return `
                <div class="summary-item">
                    <img src="${item.img}">
                    <div class="summary-item-details">
                        <div class="summary-item-name">${item.name}</div>
                        <div class="summary-item-meta">Qty: ${item.quantity}</div>
                    </div>
                    <div class="summary-item-price">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
                </div>
            `;
        }).join('');
        if (subtotalEl) subtotalEl.innerText = '₹' + subtotal.toLocaleString('en-IN');

        
        // Conditional Shipping: Free above 3000
        const shippingThreshold = 3000;
        const shipping = subtotal >= shippingThreshold ? 0 : (siteSettings.shippingCost || 0);
        
        const shippingEl = document.getElementById('checkoutShipping');
        const shippingLabel = document.getElementById('summaryShippingLabel');
        if (shippingEl) shippingEl.innerText = shipping === 0 ? 'Free' : '₹' + shipping.toLocaleString('en-IN');
        if (shippingLabel) shippingLabel.innerText = shipping === 0 ? 'Free' : '₹' + shipping.toLocaleString('en-IN');
        
        const grand = subtotal + shipping;
        if (totalEl) totalEl.innerText = '₹' + grand.toLocaleString('en-IN');

    };
    renderCheckoutSummary();

    // ── Place Order ──────────────────────────────────────────────────────────
    const placeBtn = document.getElementById('placeOrderBtn');
    if (placeBtn) {
        placeBtn.addEventListener('click', async () => {
            const firstName = document.getElementById('chkFirstName')?.value.trim();
            const lastName  = document.getElementById('chkLastName')?.value.trim();
            const email     = document.getElementById('chkEmail')?.value.trim();
            const phone     = document.getElementById('chkPhone')?.value.trim();
            const address   = document.getElementById('chkAddress')?.value.trim();
            const city      = document.getElementById('chkCity')?.value.trim();
            const state     = document.getElementById('chkState')?.value.trim() || 'Uttar Pradesh';
            const pin       = document.getElementById('chkPin')?.value.trim();

            if (!firstName || !phone || !address || !city || !pin) {
                alert('Please fill in all required fields.');
                return;
            }
            if (cart.length === 0) {
                alert('Your cart is empty!');
                return;
            }

            placeBtn.innerText = 'Initializing Payment...';
            placeBtn.disabled = true;

            try {
                // Dynamically load Razorpay to bypass Service Worker caching issues
                const loadRazorpay = () => new Promise(resolve => {
                    if (window.Razorpay) return resolve(true);
                    const script = document.createElement('script');
                    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                    script.onload = () => resolve(true);
                    script.onerror = () => resolve(false);
                    document.body.appendChild(script);
                });

                const isRzpLoaded = await loadRazorpay();
                if (!isRzpLoaded || typeof window.Razorpay === 'undefined') {
                    throw new Error('Razorpay SDK failed to load. Please check your network or disable adblockers.');
                }

                const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
                const shipping = subtotal >= 3000 ? 0 : (siteSettings.shippingCost || 0);
                const total = subtotal + shipping;

                // 1. Create Razorpay Order via Backend
                const orderRes = await fetch(`${API_BASE_URL}/api/create-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: total })
                });
                
                if (!orderRes.ok) throw new Error('Failed to initialize payment server.');
                const rzpOrder = await orderRes.json();

                // 2. Open Razorpay Modal
                const options = {
                    key: RAZORPAY_KEY,
                    amount: rzpOrder.amount,
                    currency: rzpOrder.currency,
                    name: "Hridyang Collection",
                    description: "Handloom Heritage Purchase",
                    order_id: rzpOrder.order_id,
                    handler: async function (response) {
                        placeBtn.innerText = 'Verifying Payment...';
                        
                        // 3. Verify Payment
                        const verifyRes = await fetch(`${API_BASE_URL}/api/verify-payment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature
                            })
                        });

                        const verifyData = await verifyRes.json();
                        if (!verifyData.verified) throw new Error('Payment verification failed.');

                        // 4. Save Order to Firestore
                        const { addDoc: _addDoc, collection: _col, serverTimestamp: _ts } =
                            await import('./firebase-config.js');

                        const orderData = {
                            firstName, lastName, email, phone,
                            addressLine: address, city, pin, state,
                            items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, img: i.img })),
                            subtotal, shipping, total,
                            razorpay_payment_id: response.razorpay_payment_id,
                            status: 'Pending',
                            createdAt: serverTimestamp()
                        };

                        await addDoc(collection(db, 'orders'), orderData);

                        // Decrement stock
                        for (const item of cart) {
                            if (item.id) {
                                try {
                                    await updateDoc(doc(db, 'articles', item.id), {
                                        stock: increment(-item.quantity)
                                    });
                                } catch (e) { }
                            }
                        }

                        cart = [];
                        localStorage.removeItem('vanyaCart');

                        document.querySelector('.checkout-container').innerHTML = `
                            <div style="text-align:center; padding: 80px 40px; max-width: 600px; margin: 0 auto;">
                                <div style="font-size: 4rem; margin-bottom: 20px;">🎉</div>
                                <h2 style="font-family:'Playfair Display',serif; font-size:2.5rem; margin-bottom:15px;">Order Placed!</h2>
                                <p style="color:var(--text-muted); margin-bottom:10px;">Thank you, <strong>${firstName}</strong>! Your order has been received.</p>
                                <p style="color:var(--text-muted); margin-bottom:40px;">Payment ID: ${response.razorpay_payment_id}</p>
                                <a href="index.html" class="btn primary">Continue Shopping</a>
                            </div>
                        `;
                    },
                    prefill: { name: `${firstName} ${lastName}`, email, contact: phone },
                    theme: { color: "#A34E4E" },
                    modal: {
                        ondismiss: function() {
                            placeBtn.innerText = 'Place Order';
                            placeBtn.disabled = false;
                        }
                    }
                };
                const rzp1 = new window.Razorpay(options);
                rzp1.open();

            } catch (err) {
                console.error(err);
                alert('Checkout Error: ' + err.message);
                placeBtn.innerText = 'Place Order';
                placeBtn.disabled = false;
            }

        });
    }
}


// ─── PWA Installation Logic ─────────────────────────────────────────────────
console.log("PWA Logic Initializing...");

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(() => console.log('ServiceWorker registered successfully'))
            .catch(err => console.warn('ServiceWorker registration failed:', err));
    });
}

if (!window.isSecureContext) {
    console.warn("PWA features require a Secure Context (HTTPS or localhost).");
}


let deferredPrompt = null;
let isInstalled = false;

// Detect browser for manual instructions
function getBrowserInstructions() {
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua);
    const isFirefox = /firefox/i.test(ua);
    const isChrome = /chrome/i.test(ua) && !/edg/i.test(ua);
    const isEdge = /edg/i.test(ua);

    if (isIOS || isSafari) {
        return {
            title: 'Install on iPhone / iPad',
            steps: [
                '1. Tap the <strong>Share</strong> button <span style="font-size:1.1rem">⎋</span> at the bottom of Safari',
                '2. Scroll down and tap <strong>"Add to Home Screen"</strong>',
                '3. Tap <strong>"Add"</strong> in the top right corner'
            ]
        };
    } else if (isFirefox) {
        return {
            title: 'Install in Firefox',
            steps: [
                '1. Click the <strong>three-dot menu (⋮)</strong> in the top right',
                '2. Select <strong>"Install"</strong> or <strong>"Add to Home Screen"</strong>',
                '3. Confirm the installation'
            ]
        };
    } else if (isEdge) {
        return {
            title: 'Install in Microsoft Edge',
            steps: [
                '1. Click the <strong>three-dot menu (⋯)</strong> in the top right',
                '2. Select <strong>"Apps" → "Install this site as an app"</strong>',
                '3. Click <strong>"Install"</strong>'
            ]
        };
    } else {
        return {
            title: 'Install in Chrome',
            steps: [
                '1. Look for the <strong>install icon (⊕)</strong> in the address bar on the right',
                '2. Or click the <strong>three-dot menu (⋮)</strong> → <strong>"Save and share"</strong> → <strong>"Install page as app"</strong>',
                '3. Click <strong>"Install"</strong> to confirm'
            ]
        };
    }
}

// Create and show the install instructions modal
function showInstallModal() {
    const existing = document.getElementById('pwaInstallModal');
    if (existing) { existing.style.display = 'flex'; return; }

    const { title, steps } = getBrowserInstructions();
    const modal = document.createElement('div');
    modal.id = 'pwaInstallModal';
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.55);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; backdrop-filter: blur(4px);
        animation: pwaFadeIn 0.25s ease;
    `;
    modal.innerHTML = `
        <style>
            @keyframes pwaFadeIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        </style>
        <div style="
            background: white; border-radius: 20px; padding: 40px;
            max-width: 440px; width: 90%; box-shadow: 0 25px 60px rgba(0,0,0,0.2);
            position: relative; text-align: center;
        ">
            <div style="font-size: 2.5rem; margin-bottom: 15px;">📲</div>
            <h3 style="font-family: 'Playfair Display', serif; font-size: 1.6rem; margin-bottom: 8px; color:#1A1A1A;">${title}</h3>
            <p style="color:#6B7280; font-size: 0.9rem; margin-bottom: 25px;">Follow these steps to install the app on your device:</p>
            <div style="text-align: left; background: #F8F5F2; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                ${steps.map(s => `<p style="margin-bottom:12px; font-size:0.9rem; color:#1A1A1A; line-height:1.6;">${s}</p>`).join('')}
            </div>
            <button onclick="document.getElementById('pwaInstallModal').style.display='none'"
                style="background:#1E3A8A; color:white; border:none; padding:12px 35px;
                border-radius:8px; font-size:0.9rem; font-weight:600;
                cursor:pointer; letter-spacing:1px; width:100%;">
                Got it!
            </button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

// Show install UI always (not just on beforeinstallprompt)
function showInstallUI() {
    document.querySelectorAll('.install-app-prompt').forEach(el => {
        el.style.display = 'inline-flex';
    });
    document.querySelectorAll('.install-app-section').forEach(el => {
        el.style.display = 'block';
    });
}

// Check if already running as installed PWA
function checkInstalledState() {
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
        isInstalled = true;
        // Hide all install UI — app is already installed
        document.querySelectorAll('.install-app-prompt, .install-app-section').forEach(el => {
            el.style.display = 'none';
        });
    } else {
        // Not installed → always show the install option
        showInstallUI();
    }
}

// Capture the native install prompt when browser supports it
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // UI is already shown via checkInstalledState(); nothing extra needed
});

// Handle install button clicks
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.install-app-btn');
    if (!btn) return;
    e.preventDefault();

    if (deferredPrompt) {
        // Native prompt available — use it
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('PWA install outcome:', outcome);
        deferredPrompt = null;
        if (outcome === 'accepted') {
            document.querySelectorAll('.install-app-prompt, .install-app-section').forEach(el => {
                el.style.display = 'none';
            });
        }
    } else {
        // No native prompt → show manual instructions
        showInstallModal();
    }
});

// Hide install UI once installed
window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredPrompt = null;
    document.querySelectorAll('.install-app-prompt, .install-app-section').forEach(el => {
        el.style.display = 'none';
    });
    const modal = document.getElementById('pwaInstallModal');
    if (modal) modal.style.display = 'none';
    console.log('PWA installed successfully');
});

// Run on page load — always show install UI unless already installed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkInstalledState);
} else {
    checkInstalledState();
}

// Init
onSnapshot(doc(db, "settings", "main"), (s) => {
    if (s.exists()) {
        siteSettings = { ...siteSettings, ...s.data() };
        
        // 1. Update Announcement Bar
        const announceEls = document.querySelectorAll('.announcement-track span');
        if (announceEls.length > 0) {
            announceEls.forEach(el => el.innerText = siteSettings.announcementText);
        }

        // 2. Update Checkout if on checkout page
        if (window.location.pathname.includes('checkout.html')) {
            if (typeof renderCheckoutSummary === 'function') renderCheckoutSummary();
        }

        // 3. Update Cart Badge/Total
        updateCartUI();
    }
});

checkBackendStatus();
loadArticles();
updateCartUI();

// ─── Reveal Animation (IntersectionObserver) ────────────────────────────────
// Without this, all .reveal sections stay invisible (opacity:0) forever
function initReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
} else {
    initReveal();
}

