import { db, collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, increment, serverTimestamp, getDoc, onSnapshot } from './firebase-config.js';
import { API_BASE_URL, RAZORPAY_KEY, DEFAULT_SETTINGS } from './constants.js';

// Global Settings State
let siteSettings = { ...DEFAULT_SETTINGS };

async function checkBackendStatus() {
    const warningId = 'backend-offline-warning';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const checkUrl = isLocal ? `http://${window.location.hostname}:5001` : 'https://handloom-backend-one.vercel.app';

    try {
        const res = await fetch(`${checkUrl}/api/status`);
        if (res.ok) {
            console.log("Backend Status: Online");
            const existing = document.getElementById(warningId);
            if (existing) existing.remove();
        } else {
            throw new Error("Offline");
        }
    } catch (err) {
        console.warn("Backend is unreachable.");
        if (window.location.pathname.includes('checkout.html') && !document.getElementById(warningId)) {
            const warning = document.createElement('div');
            warning.id = warningId;
            warning.style.cssText = "background: #fff5f5; color: #c53030; padding: 20px; border: 1px solid #feb2b2; border-radius: 12px; margin-bottom: 25px; text-align: center; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.05); animation: fadeIn 0.3s ease;";
            warning.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 5px;">
                    <i class="fas fa-exclamation-triangle"></i> 
                    <span>Payment server is offline</span>
                </div>
                <div style="font-size: 0.85rem; font-weight: 400; opacity: 0.8; margin-bottom: 10px;">
                    Please start the backend with "npm start" in the backend folder.
                </div>
                <button onclick="checkBackendStatus()" style="background: #c53030; color: white; border: none; padding: 5px 15px; border-radius: 20px; font-size: 0.8rem; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-sync-alt"></i> Retry Connection
                </button>
            `;
            const container = document.querySelector('.checkout-container');
            if (container) container.prepend(warning);
        }
    }
}
window.checkBackendStatus = checkBackendStatus; // Make globally accessible for the button

async function loadArticles() {
    const productGrid = document.querySelector('.product-grid');
    const shopGrid = document.querySelector('.shop-grid');
    const pdpContent = document.getElementById('pdp-content');
    if (!productGrid && !shopGrid && !pdpContent) return;

    // Check which category we need for specific pages
    let categoryFilter = null;
    if (window.location.pathname.includes('handloom.html')) categoryFilter = 'HANDLOOM';
    if (window.location.pathname.includes('god-clothes.html')) categoryFilter = 'GOD CLOTHES';
    if (window.location.pathname.includes('fancy-articles.html')) categoryFilter = 'FANCY ARTICLES';

    try {
        let q;
        if (categoryFilter) {
            q = query(collection(db, "articles"), orderBy('createdAt', 'desc'));
        } else {
            q = query(collection(db, "articles"), orderBy('createdAt', 'desc'));
        }

        // Use onSnapshot for REAL-TIME inventory updates
        onSnapshot(q, (querySnapshot) => {
            let articles = [];
            querySnapshot.forEach(doc => articles.push({ id: doc.id, ...doc.data() }));

            // Apply case-insensitive category filter client-side
            if (categoryFilter) {
                articles = articles.filter(a =>
                    (a.category || '').toUpperCase() === categoryFilter.toUpperCase()
                );
            }

            console.log(`Firestore articles loaded (filter: ${categoryFilter || 'ALL'}):`, articles.length, articles);
            window.allArticles = articles;

            if (categoryFilter) {
                articles.sort((a, b) => {
                    const tA = a.createdAt ? a.createdAt.seconds : 0;
                    const tB = b.createdAt ? b.createdAt.seconds : 0;
                    return tB - tA;
                });
            }

            // Render helper
            const renderTo = (grid, articlesToRender) => {
                if (!grid) return;
                console.log("Rendering to grid:", grid.className || grid.id, "Items:", articlesToRender.length);
                if (articlesToRender.length === 0) {
                    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No articles found in this category.</p>';
                    return;
                }
                grid.innerHTML = articlesToRender.map(a => {
                    const displayName = a.name || a.title || 'Unnamed Product';
                    const displayImg  = a.image || a.img || 'https://via.placeholder.com/400x500?text=No+Image';
                    const displayPrice = a.price || a.discountPrice || a.actualPrice || 0;

                    const isOutOfStock = (a.stock !== undefined && a.stock <= 0);
                    return `
                    <div class="product-card reveal active ${isOutOfStock ? 'out-of-stock' : ''}" data-id="${a.id}">
                        <div class="product-img" style="position: relative;">
                            <a href="product.html?id=${a.id}">
                                <img src="${displayImg}" alt="${displayName}" style="${isOutOfStock ? 'filter: grayscale(1); opacity: 0.7;' : ''}; width: 100%; aspect-ratio: 4/5; object-fit: cover;">
                            </a>
                            ${isOutOfStock ? 
                                `<div class="out-of-stock-badge" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 10px 20px; font-weight: 600; letter-spacing: 2px; font-size: 0.8rem; border-radius: 4px; pointer-events: none;">OUT OF STOCK</div>` 
                                : `<div class="quick-add"><button><i class="fas fa-shopping-cart"></i> Quick Add</button></div>`
                            }
                        </div>
                        <div class="product-info">
                            <p class="category-label">${a.category}</p>
                            <h3><a href="product.html?id=${a.id}" style="color: inherit; text-decoration: none;">${displayName}</a></h3>
                            ${a.styleNo ? `<p class="style-no">STYLE NO. ${a.styleNo}</p>` : ''}
                            <div class="price">From ₹${displayPrice.toLocaleString('en-IN')}</div>
                            ${isOutOfStock ? 
                                `<div class="out-of-stock-msg" style="color:#e53e3e; font-weight:600; font-size:0.85rem; margin-top:15px; text-transform: uppercase;">Currently Unavailable</div>`
                                : `<div class="quantity-selector">
                                    <button class="qty-btn minus">-</button>
                                    <input type="number" class="qty-input" value="0" min="0" max="${a.stock || 10}">
                                    <button class="qty-btn plus">+</button>
                                </div>`
                            }
                        </div>
                    </div>
                `}).join('');
            };

            if (window.location.pathname.includes('product.html')) {
                const urlParams = new URLSearchParams(window.location.search);
                const productId = urlParams.get('id');
                const product = articles.find(a => a.id === productId);
                
                const pdpContent = document.getElementById('pdp-content');
                if (product && pdpContent) {
                    // Normalize fields
                    const displayName  = product.name  || product.title        || 'Unnamed Product';
                    const displayImg   = product.image || product.img          || 'https://via.placeholder.com/400x500?text=No+Image';
                    const displayPrice = product.price || product.discountPrice || product.actualPrice || 0;

                    const isOutOfStock = (product.stock !== undefined && product.stock <= 0);
                    const imgUrl = displayImg;

                    // Preserve existing qty value if it was already changed by user
                    let existingQty = 1;
                    const qtyInputEl = document.getElementById('pdpQty');
                    if (qtyInputEl) existingQty = parseInt(qtyInputEl.value) || 1;

                    pdpContent.innerHTML = `
                        <div class="pdp-layout" style="display: flex; gap: 60px; flex-wrap: wrap;">
                            <div class="pdp-image" style="flex: 1; min-width: 300px;">
                                <img src="${imgUrl}" alt="${displayName}" style="width: 100%; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); ${isOutOfStock ? 'filter: grayscale(1); opacity: 0.7;' : ''}">
                            </div>
                            <div class="pdp-details" style="flex: 1; min-width: 300px;">
                                <h1 style="font-size: 2.5rem; margin-bottom: 10px; font-family: 'Cormorant Garamond', serif;">${displayName}</h1>
                                ${product.styleNo ? `<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px; letter-spacing: 1px;">STYLE NO. ${product.styleNo}</p>` : ''}
                                <div style="font-size: 2rem; font-weight: 500; margin-bottom: 30px; font-family: 'Outfit', sans-serif;">From ₹${displayPrice.toLocaleString('en-IN')}</div>
                                
                                <div style="margin-bottom: 30px;">
                                    <div style="font-weight: 600; margin-bottom: 10px;">Quantity</div>
                                    <div class="quantity-selector" style="display: inline-flex; border-radius: 4px; overflow: hidden; border: 1px solid #ddd;">
                                        <button class="pdp-qty-btn pdp-minus" style="padding: 10px 15px; background: transparent; border: none; cursor: pointer; font-size: 1.2rem;">-</button>
                                        <input type="number" id="pdpQty" value="${existingQty}" min="1" max="${product.stock || 10}" style="width: 50px; text-align: center; border: none; border-left: 1px solid #ddd; border-right: 1px solid #ddd; font-family: 'Outfit', sans-serif; font-size: 1rem;">
                                        <button class="pdp-qty-btn pdp-plus" style="padding: 10px 15px; background: transparent; border: none; cursor: pointer; font-size: 1.2rem;">+</button>
                                    </div>
                                </div>

                                <div style="display: flex; gap: 15px; margin-bottom: 40px; flex-wrap: wrap;">
                                    <button id="pdpAddToCart" class="btn primary" style="flex: 2; min-width: 200px; padding: 15px; font-size: 1.1rem; border: none; cursor: pointer; border-radius: 4px; ${isOutOfStock ? 'background: #ccc; pointer-events: none;' : ''}">${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</button>
                                    <a href="https://wa.me/919999999999?text=I'm interested in ${encodeURIComponent(product.name)}" target="_blank" class="btn" style="flex: 1; min-width: 150px; background: #25D366; color: white; border: none; padding: 15px; display: flex; align-items: center; justify-content: center; gap: 10px; text-decoration: none; border-radius: 4px;"><i class="fab fa-whatsapp" style="font-size: 1.2rem;"></i> Buy on WhatsApp</a>
                                </div>

                                <div style="border-top: 1px solid #eee; border-bottom: 1px solid #eee; display: flex; justify-content: space-around; padding: 20px 0; margin-bottom: 30px;">
                                    <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem;"><i class="fas fa-truck" style="display: block; font-size: 1.5rem; margin-bottom: 8px; color: var(--secondary);"></i> Free Shipping</div>
                                    <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem;"><i class="fas fa-undo" style="display: block; font-size: 1.5rem; margin-bottom: 8px; color: var(--secondary);"></i> Easy Returns</div>
                                    <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem;"><i class="fas fa-shield-alt" style="display: block; font-size: 1.5rem; margin-bottom: 8px; color: var(--secondary);"></i> Secure Payment</div>
                                </div>

                                <div class="pdp-tabs">
                                    <div style="display: flex; border-bottom: 1px solid #eee; margin-bottom: 20px;">
                                        <div style="padding: 10px 20px; font-weight: 600; border-bottom: 2px solid var(--primary); cursor: pointer; font-family: 'Outfit', sans-serif;">Description</div>
                                        <div style="padding: 10px 20px; color: var(--text-muted); cursor: pointer; font-family: 'Outfit', sans-serif;">Care</div>
                                        <div style="padding: 10px 20px; color: var(--text-muted); cursor: pointer; font-family: 'Outfit', sans-serif;">Shipping</div>
                                    </div>
                                    <div style="font-size: 0.95rem; line-height: 1.8; color: var(--text-dark);">
                                        <p>${product.description || 'Premium quality hand-woven piece that speaks of timeless heritage and modern elegance. Comfort fit designed for everyday luxury.'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

                    const pdpAddToCartBtn = document.getElementById('pdpAddToCart');
                    if (pdpAddToCartBtn && !isOutOfStock) {
                        pdpAddToCartBtn.addEventListener('click', () => {
                            const qty = parseInt(document.getElementById('pdpQty').value) || 1;
                            const existingItemIndex = cart.findIndex(item => item.id === product.id);
                            if (existingItemIndex > -1) {
                                cart[existingItemIndex].quantity += qty;
                            } else {
                                cart.push({ id: product.id, name: displayName, price: displayPrice, quantity: qty, img: imgUrl });
                            }
                            updateCartUI();
                            
                            const originalText = pdpAddToCartBtn.innerHTML;
                            pdpAddToCartBtn.innerHTML = '<i class="fas fa-check"></i> Added to Bag';
                            pdpAddToCartBtn.style.background = '#800000';
                            
                            setTimeout(() => {
                                pdpAddToCartBtn.innerHTML = originalText;
                                pdpAddToCartBtn.style.background = '';
                            }, 2000);

                            document.getElementById('cartSidebar').classList.add('active');
                            document.getElementById('cartOverlay').classList.add('active');
                            document.body.style.overflow = 'hidden';
                        });
                    }
                    
                    const pdpMinus = document.querySelector('.pdp-minus');
                    const pdpPlus = document.querySelector('.pdp-plus');
                    const pdpInput = document.getElementById('pdpQty');
                    if (pdpMinus && pdpPlus && pdpInput) {
                        pdpMinus.addEventListener('click', () => {
                            let val = parseInt(pdpInput.value) || 1;
                            if (val > 1) pdpInput.value = val - 1;
                        });
                        pdpPlus.addEventListener('click', () => {
                            let val = parseInt(pdpInput.value) || 1;
                            const max = parseInt(pdpInput.getAttribute('max')) || 10;
                            if (val < max) pdpInput.value = val + 1;
                        });
                    }
                } else if (pdpContent) {
                    pdpContent.innerHTML = `<div style="text-align: center; padding: 100px;"><h2>Product not found</h2><a href="index.html" class="btn primary" style="margin-top:20px; display: inline-block;">Return to Shop</a></div>`;
                }
            } else if (categoryFilter) {
                renderTo(productGrid, articles);
                renderTo(shopGrid, articles);
            } else {
                // Homepage logic
                const allProductsGrid = document.querySelector('.shop-grid');
                if (allProductsGrid && allProductsGrid.id === '') {
                    renderTo(allProductsGrid, articles.slice(0, 8));
                }
                
                // Specific Grids with Case-Insensitive Filter
                const getByCat = (cat) => articles.filter(a => (a.category || '').toUpperCase() === cat.toUpperCase()).slice(0, 4);
                
                const handloomGrid = document.getElementById('handloom-grid');
                if (handloomGrid) renderTo(handloomGrid, getByCat('HANDLOOM'));
                
                const godClothesGrid = document.getElementById('god-clothes-grid');
                if (godClothesGrid) renderTo(godClothesGrid, getByCat('GOD CLOTHES'));
                
                const fancyArticlesGrid = document.getElementById('fancy-articles-grid');
                if (fancyArticlesGrid) renderTo(fancyArticlesGrid, getByCat('FANCY ARTICLES'));
            }

            // Sync quantities after rendering
            updateCartUI();
        }, (error) => {
            console.error("Firestore onSnapshot Error:", error);
            const msg = `<p style="grid-column: 1/-1; text-align: center; color: red;">Error loading articles from database: ${error.message}</p>`;
            if (productGrid) productGrid.innerHTML = msg;
            if (shopGrid) shopGrid.innerHTML = msg;
            if (pdpContent) pdpContent.innerHTML = msg;
        });
    } catch (err) {
        console.error("Error in loadArticles function:", err);
    }
}

function initSiteSettings() {
    try {
        const docRef = doc(db, "settings", "main");
        onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                siteSettings = { ...siteSettings, ...data };
                applySettings();
                console.log("Settings updated in real-time:", data);
            }
        });
    } catch (err) {
        console.error("Error initializing site settings:", err);
    }
}

function applySettings() {
    const announceBars = document.querySelectorAll('.announcement-bar');
    announceBars.forEach(bar => {
        if (!siteSettings.announcementText) return;
        let track = bar.querySelector('.announcement-track');
        if (!track) {
            bar.innerHTML = '<div class="announcement-track"></div>';
            track = bar.querySelector('.announcement-track');
        }
        const currentSpans = track.querySelectorAll('span');
        if (currentSpans.length !== 12) {
            track.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>';
        }
        const spans = track.querySelectorAll('span');
        spans.forEach(span => {
            span.innerText = siteSettings.announcementText;
        });
    });

    const logos = document.querySelectorAll('.logo');
    logos.forEach(logo => {
        if (siteSettings.storeName) logo.innerText = siteSettings.storeName;
    });

    if (siteSettings.storeName && document.title.includes('Vanya Handlooms')) {
        document.title = document.title.replace('Vanya Handlooms', siteSettings.storeName);
    }

    if (window.location.pathname.includes('checkout.html')) {
        if (typeof renderCheckoutSummary === 'function') renderCheckoutSummary();
    }
}

function reveal() {
    var reveals = document.querySelectorAll(".reveal");
    for (var i = 0; i < reveals.length; i++) {
        var windowHeight = window.innerHeight;
        var elementTop = reveals[i].getBoundingClientRect().top;
        var elementVisible = 150;
        if (elementTop < windowHeight - elementVisible) {
            reveals[i].classList.add("active");
        }
    }
}
window.addEventListener("scroll", reveal);
reveal();

// Quick Add Integration
let cart = [];
try {
    cart = JSON.parse(localStorage.getItem('vanyaCart')) || [];
} catch (e) {
    console.warn("Corrupted cart data, resetting...", e);
    localStorage.removeItem('vanyaCart');
}

// Global Quantity Sync Logic
function syncCartWithInput(input, shouldOpenCart = false) {
    const productCard = input.closest('.product-card');
    if (!productCard) return;

    const productId = productCard.getAttribute('data-id');
    const finalQuantity = parseInt(input.value) || 0;
    const existingItemIndex = cart.findIndex(item => item.id === productId);

    if (finalQuantity === 0) {
        if (existingItemIndex > -1) {
            cart.splice(existingItemIndex, 1);
        }
    } else {
        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity = finalQuantity;
        } else {
            // New item - get info from card
            const productName = productCard.querySelector('h3').innerText;
            const priceElement = productCard.querySelector('.price');
            let priceStr = priceElement.innerText.split('\n')[0];
            const imgSrc = productCard.querySelector('img').src;
            
            let match = priceStr.match(/[\\d,]+/);
            const price = match ? parseInt(match[0].replace(/,/g, '')) : 0;
            
            cart.push({ id: productId, name: productName, price: price, quantity: finalQuantity, img: imgSrc });
        }
    }

    updateCartUI();

    if (shouldOpenCart && finalQuantity > 0) {
        document.getElementById('cartSidebar').classList.add('active');
        document.getElementById('cartOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Master Click Delegate
document.addEventListener('click', function (e) {
    // 1. Quantity Buttons
    const qtyBtn = e.target.closest('.qty-btn');
    if (qtyBtn) {
        const isPlus = qtyBtn.classList.contains('plus');
        const input = qtyBtn.parentElement.querySelector('.qty-input');
        if (input) {
            let currentValue = parseInt(input.value) || 0;
            let max = parseInt(input.max) || 100;
            let min = parseInt(input.min) || 0;

            let newValue = isPlus ? currentValue + 1 : currentValue - 1;
            if (newValue >= min && newValue <= max) {
                input.value = newValue;
                syncCartWithInput(input, false); // Don't open cart for +/- clicks
            }
        }
        return;
    }

    // 2. Quick Add Button
    const quickAddBtn = e.target.closest('.quick-add button');
    if (quickAddBtn) {
        const productCard = quickAddBtn.closest('.product-card');
        const input = productCard.querySelector('.qty-input');
        if (input) {
            input.value = (parseInt(input.value) || 0) + 1;
            syncCartWithInput(input, true); // Open cart for Quick Add

            // Visual feedback
            const originalText = quickAddBtn.innerHTML;
            quickAddBtn.innerHTML = '<i class="fas fa-check"></i> Added';
            quickAddBtn.style.background = '#800000';
            setTimeout(() => {
                quickAddBtn.innerHTML = originalText;
                quickAddBtn.style.background = '';
            }, 2000);
        }
        return;
    }
    
    // 3. Smooth scroll
    const anchor = e.target.closest('a[href^="#"]');
    if (anchor) {
        const targetId = anchor.getAttribute('href');
        if (targetId === '#') return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
            e.preventDefault();
            targetEl.scrollIntoView({ behavior: 'smooth' });
        }
    }
});

// Direct Input Sync
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('qty-input')) {
        syncCartWithInput(e.target, false);
    }
});

function updateCartUI() {
    localStorage.setItem('vanyaCart', JSON.stringify(cart));

    const container = document.getElementById('cartItemsContainer');
    const totalValueEl = document.getElementById('cartTotalValue');
    const badge = document.getElementById('cartBadge');

    if (badge) {
        const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
        badge.innerText = itemCount;
        badge.style.display = itemCount > 0 ? 'flex' : 'none';
    }

    // Sync grid inputs
    document.querySelectorAll('.product-card').forEach(card => {
        const id = card.getAttribute('data-id');
        const input = card.querySelector('.qty-input');
        if (input) {
            const cartItem = cart.find(item => item.id === id);
            input.value = cartItem ? cartItem.quantity : 0;
        }
    });

    if (!container || !totalValueEl) return;

    let total = 0;
    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart-msg" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">Your bag is currently empty.</div>';
        totalValueEl.innerText = '₹0';
        return;
    }

    let html = '';
    cart.forEach((item, index) => {
        total += item.price * item.quantity;
        html += `
            <div class=\"cart-item\">
                <img src=\"${item.img}\" class=\"cart-item-img\" alt=\"${item.name}\">
                <div class=\"cart-item-details\">
                    <div class=\"cart-item-title\">${item.name}</div>
                    <div class=\"cart-item-price\">₹${item.price.toLocaleString('en-IN')}</div>
                    <div style=\"display:flex; justify-content: space-between; align-items:center;\">
                        <span style=\"font-size:0.9rem; color:var(--text-muted);\">Qty: ${item.quantity}</span>
                        <button class=\"remove-item\" onclick=\"removeFromCart(${index})\">Remove</button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    totalValueEl.innerText = '₹' + total.toLocaleString('en-IN');
}

window.removeFromCart = function (index) {
    cart.splice(index, 1);
    updateCartUI();
};

function initOverlays() {
    const searchIcon = document.getElementById('searchIcon');
    const searchOverlay = document.getElementById('searchOverlay');
    const closeSearch = document.getElementById('closeSearch');
    const searchInput = document.getElementById('searchInput');

    if (searchIcon && searchOverlay && closeSearch) {
        searchIcon.addEventListener('click', (e) => {
            e.preventDefault();
            searchOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            if (searchInput) searchInput.focus();
        });

        closeSearch.addEventListener('click', () => {
            searchOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        });

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const queryStr = e.target.value.toLowerCase().trim();
                let resultsContainer = document.getElementById('searchResults');
                if (!resultsContainer) {
                    resultsContainer = document.createElement('div');
                    resultsContainer.id = 'searchResults';
                    resultsContainer.className = 'shop-grid';
                    resultsContainer.style.marginTop = '40px';
                    resultsContainer.style.maxHeight = '60vh';
                    resultsContainer.style.overflowY = 'auto';
                    resultsContainer.style.textAlign = 'left';
                    searchInput.parentNode.appendChild(resultsContainer);
                }

                if (queryStr.length < 2) {
                    resultsContainer.innerHTML = '';
                    return;
                }

                if (!window.allArticles) {
                    resultsContainer.innerHTML = '<p style="color: white; width: 100%;">Loading products...</p>';
                    return;
                }

                const filtered = window.allArticles.filter(a => {
                    const title = (a.name || a.title || '').toLowerCase();
                    const desc = (a.description || '').toLowerCase();
                    const cat = (a.category || '').toLowerCase();
                    return title.includes(queryStr) || desc.includes(queryStr) || cat.includes(queryStr);
                });

                if (filtered.length === 0) {
                    resultsContainer.innerHTML = '<p style="color: white; text-align: center; width: 100%;">No products found.</p>';
                } else {
                    resultsContainer.innerHTML = filtered.map(a => {
                        const displayName = a.name || a.title || 'Unnamed Product';
                        const displayImg  = a.image || a.img || 'https://via.placeholder.com/400x500?text=No+Image';
                        const displayPrice = a.price || a.discountPrice || a.actualPrice || 0;
                        const isOutOfStock = (a.stock !== undefined && a.stock <= 0);

                        return `
                    <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" data-id="${a.id}">
                        <div class="product-img" style="position: relative;">
                            <a href="product.html?id=${a.id}">
                                <img src="${displayImg}" alt="${displayName}" style="${isOutOfStock ? 'filter: grayscale(1); opacity: 0.7;' : ''}; width: 100%; aspect-ratio: 4/5; object-fit: cover;">
                            </a>
                        </div>
                        <div class="product-info">
                            <p class="category-label">${a.category || ''}</p>
                            <h3><a href="product.html?id=${a.id}" style="color: inherit; text-decoration: none;">${displayName}</a></h3>
                            <div class="price">From ₹${displayPrice.toLocaleString('en-IN')}</div>
                        </div>
                    </div>`;
                    }).join('');
                }
            });
        }
    }

    const cartIcon = document.getElementById('cartIcon');
    const cartOverlay = document.getElementById('cartOverlay');
    const cartSidebar = document.getElementById('cartSidebar');
    const closeCart = document.getElementById('closeCart');

    if (cartIcon && cartOverlay && cartSidebar && closeCart) {
        cartIcon.addEventListener('click', (e) => {
            e.preventDefault();
            cartSidebar.classList.add('active');
            cartOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        const close = () => {
            cartSidebar.classList.remove('active');
            cartOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        };
        closeCart.addEventListener('click', close);
        cartOverlay.addEventListener('click', close);
    }

    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length > 0) window.location.href = 'checkout.html';
        });
    }
}

// Initializations
initSiteSettings();
checkBackendStatus();
loadArticles();
updateCartUI();
initOverlays();

document.addEventListener('DOMContentLoaded', () => {
    applySettings();
    setTimeout(applySettings, 500);
});

// Checkout Page Logic
if (window.location.pathname.includes('checkout.html')) {
    const summaryContainer = document.getElementById('checkoutItemsContainer');
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const discountRow = document.getElementById('discountRow');
    const discountLabel = document.getElementById('discountLabel');
    const discountEl = document.getElementById('checkoutDiscount');
    const totalEl = document.getElementById('checkoutTotal');
    const promoInput = document.getElementById('promoInput');
    const promoBtn = document.getElementById('applyPromoBtn');
    const promoFeedback = document.getElementById('promoFeedback');

    window.renderCheckoutSummary = function() {
        if (!summaryContainer) return;
        if (cart.length === 0) {
            summaryContainer.innerHTML = '<p style=\"text-align:center; color: var(--text-muted); padding: 40px 0;\">Your bag is empty.</p>';
            subtotalEl.innerText = '₹0';
            totalEl.innerText = '₹0';
            return;
        }

        let subtotal = 0;
        summaryContainer.innerHTML = cart.map(item => {
            subtotal += item.price * item.quantity;
            return `
                <div style=\"display: flex; gap: 15px; margin-bottom: 20px; align-items: center;\">
                    <img src=\"${item.img}\" style=\"width: 65px; height: 85px; object-fit: cover; border-radius: 8px;\" alt=\"${item.name}\">
                    <div style=\"flex-grow: 1;\">
                        <h4 style=\"font-size: 0.95rem; font-weight: 500; margin-bottom: 5px; text-transform: uppercase;\">${item.name}</h4>
                        <p style=\"font-size: 0.85rem; color: var(--text-muted);\">Quantity: ${item.quantity}</p>
                    </div>
                    <div style=\"font-weight: 600;\">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
                </div>
            `;
        }).join('');

        subtotalEl.innerText = '₹' + subtotal.toLocaleString('en-IN');
        const discountPercent = parseFloat(localStorage.getItem('vanyaDiscount')) || 0;
        const discountAmount = (subtotal * discountPercent) / 100;
        
        if (discountPercent > 0) {
            discountRow.style.display = 'flex';
            discountLabel.innerText = `Promo Discount (${discountPercent}%)`;
            discountEl.innerText = '-₹' + discountAmount.toLocaleString('en-IN');
        } else {
            discountRow.style.display = 'none';
        }

        const currentShippingCost = siteSettings.shippingCost || 0;
        const grandTotal = (subtotal - discountAmount) + currentShippingCost;
        if (totalEl) totalEl.innerText = '₹' + grandTotal.toLocaleString('en-IN');
        const shipEl = document.getElementById('checkoutShipping');
        if (shipEl) shipEl.innerText = currentShippingCost > 0 ? '₹' + currentShippingCost : 'Free';
    };

    if (promoBtn) {
        promoBtn.addEventListener('click', async function() {
            if (this.textContent.trim().toUpperCase() === 'REMOVE') {
                localStorage.removeItem('vanyaDiscount');
                localStorage.removeItem('vanyaPromoId');
                localStorage.removeItem('vanyaPromoCode');
                promoInput.value = '';
                promoFeedback.style.display = 'none';
                renderCheckoutSummary();
                return;
            }
            const code = promoInput.value.trim().toUpperCase();
            if (!code) return;
            this.innerText = 'Verifying...';
            this.disabled = true;
            try {
                const q = query(collection(db, "promos"), where("code", "==", code), where("active", "==", true));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const promoDoc = querySnapshot.docs[0];
                    const promo = promoDoc.data();
                    localStorage.setItem('vanyaDiscount', promo.discount);
                    localStorage.setItem('vanyaPromoId', promoDoc.id);
                    localStorage.setItem('vanyaPromoCode', code);
                    renderCheckoutSummary();
                } else {
                    promoFeedback.style.display = 'block';
                    promoFeedback.style.color = '#e53e3e';
                    promoFeedback.innerText = 'Invalid promo code.';
                }
            } catch (err) { console.error(err); }
            finally { this.disabled = false; this.innerText = 'Apply'; }
        });
    }

    renderCheckoutSummary();

    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', async function () {
            if (cart.length === 0) return;
            const fields = ['chkFirstName', 'chkLastName', 'chkEmail', 'chkPhone', 'chkAddress', 'chkCity', 'chkState', 'chkPin'];
            let valid = true;
            fields.forEach(id => {
                const el = document.getElementById(id);
                if (!el.value.trim()) { valid = false; el.style.borderColor = 'red'; }
                else el.style.borderColor = '#ddd';
            });
            if (!valid) { alert("Please fill all fields."); return; }

            this.innerText = 'Processing...';
            this.disabled = true;

            // Simple Order Placement Logic
            try {
                const orderData = {
                    customerName: `${document.getElementById('chkFirstName').value} ${document.getElementById('chkLastName').value}`,
                    email: document.getElementById('chkEmail').value,
                    phone: document.getElementById('chkPhone').value,
                    address: `${document.getElementById('chkAddress').value}, ${document.getElementById('chkCity').value}, ${document.getElementById('chkState').value} - ${document.getElementById('chkPin').value}`,
                    items: cart,
                    status: 'Processing',
                    createdAt: serverTimestamp()
                };
                const docRef = await addDoc(collection(db, "orders"), orderData);
                
                // Success UI
                document.querySelector('.checkout-container').innerHTML = `
                    <div style=\"text-align: center; padding: 100px 20px;\">
                        <i class=\"fas fa-check-circle\" style=\"font-size: 5rem; color: #38a169;\"></i>
                        <h2>Order Placed!</h2>
                        <p>Order ID: ${docRef.id}</p>
                        <a href=\"index.html\" class=\"btn primary\">Return to Shop</a>
                    </div>
                `;
                cart = [];
                localStorage.setItem('vanyaCart', JSON.stringify(cart));
                updateCartUI();
            } catch (e) { alert("Error: " + e.message); this.disabled = false; this.innerText = 'Place Order'; }
        });
    }
}
