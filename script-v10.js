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
            // Fetch all articles and filter client-side (case-insensitive) to handle
            // articles saved by different dashboards with different casing (e.g. 'Handloom' vs 'HANDLOOM')
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
                    // Normalize fields: support both dashboard formats
                    // handloom/dashboard.js saves: name, image, price, styleNo
                    // handloom backend saves:       title, img, discountPrice
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
                    // Normalize fields for product detail page
                    const displayName  = product.name  || product.title        || 'Unnamed Product';
                    const displayImg   = product.image || product.img          || 'https://via.placeholder.com/400x500?text=No+Image';
                    const displayPrice = product.price || product.discountPrice || product.actualPrice || 0;

                    const isOutOfStock = (product.stock !== undefined && product.stock <= 0);
                    const imgUrl = displayImg;
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
                                        <input type="number" id="pdpQty" value="1" min="1" max="${product.stock || 10}" style="width: 50px; text-align: center; border: none; border-left: 1px solid #ddd; border-right: 1px solid #ddd; font-family: 'Outfit', sans-serif; font-size: 1rem;">
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
                            
                            // Visual feedback
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
                
                // Specific Grids
                const handloomGrid = document.getElementById('handloom-grid');
                if (handloomGrid) renderTo(handloomGrid, articles.filter(a => a.category === 'HANDLOOM').slice(0, 4));
                
                const godClothesGrid = document.getElementById('god-clothes-grid');
                if (godClothesGrid) renderTo(godClothesGrid, articles.filter(a => a.category === 'GOD CLOTHES').slice(0, 4));
                
                const fancyArticlesGrid = document.getElementById('fancy-articles-grid');
                if (fancyArticlesGrid) renderTo(fancyArticlesGrid, articles.filter(a => a.category === 'FANCY ARTICLES').slice(0, 4));
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
        
        // Use onSnapshot for REAL-TIME updates
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
    // Update Announcement Bar
    const announceBars = document.querySelectorAll('.announcement-bar');
    announceBars.forEach(bar => {
        if (!siteSettings.announcementText) return;

        let track = bar.querySelector('.announcement-track');
        
        // If track doesn't exist (overwritten or missing), rebuild it
        if (!track) {
            bar.innerHTML = '<div class="announcement-track"></div>';
            track = bar.querySelector('.announcement-track');
        }

        // Ensure exactly 12 spans for smooth looping across wide screens
        const currentSpans = track.querySelectorAll('span');
        if (currentSpans.length !== 12) {
            track.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>';
        }

        const spans = track.querySelectorAll('span');
        spans.forEach(span => {
            span.innerText = siteSettings.announcementText;
        });
    });

    // Update Store Name (Logo)
    const logos = document.querySelectorAll('.logo');
    logos.forEach(logo => {
        if (siteSettings.storeName) logo.innerText = siteSettings.storeName;
    });

    // Update Title if needed
    if (siteSettings.storeName && document.title.includes('Vanya Handlooms')) {
        document.title = document.title.replace('Vanya Handlooms', siteSettings.storeName);
    }

    // If on checkout page, re-render to update shipping
    if (window.location.pathname.includes('checkout.html') || window.location.href.includes('checkout.html')) {
        if (typeof renderCheckoutSummary === 'function') renderCheckoutSummary();
    }
}

// Reveal elements on scroll
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

// Initial check
reveal();

// Form Handling
const orderForm = document.getElementById('orderForm');
const formFeedback = document.getElementById('formFeedback');

if (orderForm) {
    orderForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const submitBtn = orderForm.querySelector('.submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerText = 'Transmitting...';

        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            collection: document.getElementById('collection').value,
            details: document.getElementById('details').value
        };

        setTimeout(() => {
            orderForm.style.opacity = '0.3';
            orderForm.style.pointerEvents = 'none';
            formFeedback.style.display = 'block';
            formFeedback.innerHTML = `
                <div style="background: #f0fff4; padding: 25px; border-left: 4px solid #38a169;">
                    <h3 style="color: #2f855a; margin-bottom: 10px;">Request Received</h3>
                    <p>Thank you, ${formData.name}. Our master weavers have been notified of your interest in <strong>${formData.collection}</strong>. We will contact you at ${formData.email} shortly.</p>
                </div>
            `;
            submitBtn.innerText = 'Submitted';
            formFeedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 1500);
    });
}

// Quick Add Integration
let cart = [];
try {
    cart = JSON.parse(localStorage.getItem('vanyaCart')) || [];
} catch (e) {
    console.warn("Corrupted cart data, resetting...", e);
    localStorage.removeItem('vanyaCart');
}

// Initialize
initSiteSettings();
checkBackendStatus();
loadArticles();
updateCartUI();

document.addEventListener('DOMContentLoaded', () => {
    // Initial apply for any hardcoded elements
    applySettings();
    
    // Safety delay for some mobile browsers
    setTimeout(applySettings, 500);
});

document.addEventListener('click', function (e) {
    const quickAddBtn = e.target.closest('.quick-add button');
    if (quickAddBtn) {
        const productCard = quickAddBtn.closest('.product-card');
        const productId = productCard.getAttribute('data-id');

        const productName = productCard.querySelector('h3').innerText;
        const priceElement = productCard.querySelector('.price');
        const priceStr = priceElement.innerText;
        const price = parseInt(priceStr.replace(/[^0-9]/g, ''));
        const imgSrc = productCard.querySelector('img').src;
        const quantity = 1;

        // Check if item is already out of stock visually (extra safety)
        if (productCard.classList.contains('out-of-stock')) {
            alert("This item is currently out of stock.");
            return;
        }

        // Add to cart array
        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({ id: productId, name: productName, price: price, quantity: quantity, img: imgSrc });
        }

        updateCartUI();

        // Visual feedback
        const originalText = quickAddBtn.innerHTML;
        quickAddBtn.innerHTML = '<i class="fas fa-check"></i> Added';
        quickAddBtn.style.background = '#800000';

        // Open sidebar to show it was added
        document.getElementById('cartSidebar').classList.add('active');
        document.getElementById('cartOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            quickAddBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Quick Add';
            quickAddBtn.style.background = '#1A1A1A';
        }, 2000);
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Change Navbar background on scroll
window.addEventListener('scroll', function () {
    const nav = document.querySelector('nav');
    if (window.scrollY > 50) {
        nav.style.height = '70px';
        nav.style.boxShadow = '0 5px 20px rgba(0,0,0,0.1)';
    } else {
        nav.style.height = '80px';
        nav.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
    }
});

// Quantity Selector Logic
const handleQtyChange = function (e) {
    const qtyBtn = e.target.closest('.qty-btn');
    if (qtyBtn) {
        if (e.type === 'touchstart') e.preventDefault(); // Prevent double trigger
        
        const isPlus = qtyBtn.classList.contains('plus');
        const input = qtyBtn.parentElement.querySelector('.qty-input');

        if (input) {
            let currentValue = parseInt(input.value) || 0;
            let min = 0; 
            let max = parseInt(input.max) || 10;

            if (isPlus && currentValue < max) {
                input.value = currentValue + 1;
            } else if (!isPlus && currentValue > min) {
                input.value = currentValue - 1;
            }

            // Immediately sync with cart
            const productCard = qtyBtn.closest('.product-card');
            if (productCard) {
                const productId = productCard.getAttribute('data-id');
                const h3 = productCard.querySelector('h3');
                const productName = h3 ? h3.innerText : 'Product';
                const priceElement = productCard.querySelector('.price');
                
                if (!productId) return;

                let price = 0;
                if (priceElement) {
                    let priceStr = priceElement.innerText.split('\n')[0];
                    let match = priceStr.match(/[\d,]+/);
                    price = match ? parseInt(match[0].replace(/,/g, '')) : 0;
                }
                
                const imgEl = productCard.querySelector('img');
                const imgSrc = imgEl ? imgEl.src : '';
                
                const finalQuantity = parseInt(input.value);
                const existingItemIndex = cart.findIndex(item => item.id === productId);

                if (finalQuantity === 0) {
                    if (existingItemIndex > -1) {
                        cart.splice(existingItemIndex, 1);
                    }
                } else {
                    if (existingItemIndex > -1) {
                        cart[existingItemIndex].quantity = finalQuantity;
                    } else {
                        cart.push({ id: productId, name: productName, price: price, quantity: finalQuantity, img: imgSrc });
                    }
                }

                updateCartUI();

                if (finalQuantity > 0 && isPlus) {
                    // Open sidebar to show it was added
                    const sidebar = document.getElementById('cartSidebar');
                    const overlay = document.getElementById('cartOverlay');
                    if (sidebar && overlay) {
                        sidebar.classList.add('active');
                        overlay.classList.add('active');
                        document.body.style.overflow = 'hidden';
                    }
                }
            }
        }
    }
};

document.addEventListener('click', handleQtyChange);
document.addEventListener('touchstart', handleQtyChange, { passive: false });

// Cart and Search Overlay Logic
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

        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) {
                searchOverlay.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        });

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
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

                if (query.length < 2) {
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
                    return title.includes(query) || desc.includes(query) || cat.includes(query);
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
                            ${isOutOfStock ? 
                                `<div class="out-of-stock-badge" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 10px 20px; font-weight: 600; letter-spacing: 2px; font-size: 0.8rem; border-radius: 4px; pointer-events: none;">OUT OF STOCK</div>` 
                                : `<div class="quick-add"><button><i class="fas fa-shopping-cart"></i> Quick Add</button></div>`
                            }
                        </div>
                        <div class="product-info">
                            <p class="category-label">${a.category || ''}</p>
                            <h3><a href="product.html?id=${a.id}" style="color: inherit; text-decoration: none;">${displayName}</a></h3>
                            ${a.styleNo ? `<p class="style-no">STYLE NO. ${a.styleNo}</p>` : ''}
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
        function openCart(e) {
            if (e) e.preventDefault();
            cartSidebar.classList.add('active');
            cartOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeCartSidebar() {
            cartSidebar.classList.remove('active');
            cartOverlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }

        cartIcon.addEventListener('click', openCart);
        closeCart.addEventListener('click', closeCartSidebar);
        cartOverlay.addEventListener('click', closeCartSidebar);
    }

    // Checkout Button Navigation
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function () {
            if (cart.length === 0) return;
            window.location.href = 'checkout.html';
        });
    }
}

// Call overlay init
initOverlays();

function updateCartUI() {
    // Always persist to localStorage first
    localStorage.setItem('vanyaCart', JSON.stringify(cart));

    const container = document.getElementById('cartItemsContainer');
    const totalValueEl = document.getElementById('cartTotalValue');
    const badge = document.getElementById('cartBadge');

    // Update Badge (Header)
    if (badge) {
        const itemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
        badge.innerText = itemCount;
        badge.style.display = itemCount > 0 ? 'flex' : 'none';
    }

    // NEW: Sync all visible quantity inputs on the page
    document.querySelectorAll('.product-card').forEach(card => {
        const id = card.getAttribute('data-id');
        const input = card.querySelector('.qty-input');
        if (input) {
            const cartItem = cart.find(item => item.id === id);
            input.value = cartItem ? cartItem.quantity : 0;
        }
    });

    // Update Sidebar
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
            <div class="cart-item">
                <img src="${item.img}" class="cart-item-img" alt="${item.name}">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">₹${item.price.toLocaleString('en-IN')}</div>
                    <div style="display:flex; justify-content: space-between; align-items:center;">
                        <span style="font-size:0.9rem; color:var(--text-muted);">Qty: ${item.quantity}</span>
                        <button class="remove-item" onclick="removeFromCart(${index})">Remove</button>
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



// Checkout Page Logic
if (window.location.pathname.includes('checkout.html')) {
    const summaryContainer = document.getElementById('checkoutItemsContainer');
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const discountRow = document.getElementById('discountRow');
    const discountLabel = document.getElementById('discountLabel');
    const discountEl = document.getElementById('checkoutDiscount');
    const totalEl = document.getElementById('checkoutTotal');
    // shippingCost now comes dynamically from siteSettings in renderCheckoutSummary

    const promoInput = document.getElementById('promoInput');
    const promoBtn = document.getElementById('applyPromoBtn');
    const promoFeedback = document.getElementById('promoFeedback');

    function renderCheckoutSummary() {
        if (!summaryContainer) return;

        if (cart.length === 0) {
            summaryContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 40px 0;">Your bag is empty.</p>';
            subtotalEl.innerText = '₹0';
            totalEl.innerText = '₹0';
            const placeBtn = document.getElementById('placeOrderBtn');
            if (placeBtn) {
                placeBtn.disabled = true;
                placeBtn.style.opacity = '0.5';
                placeBtn.style.cursor = 'not-allowed';
            }
            return;
        }

        let html = '';
        let subtotal = 0;

        cart.forEach(item => {
            subtotal += item.price * item.quantity;
            html += `
                <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: center;">
                    <img src="${item.img}" style="width: 65px; height: 85px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);" alt="${item.name}">
                    <div style="flex-grow: 1;">
                        <h4 style="font-size: 0.95rem; font-weight: 500; margin-bottom: 5px; text-transform: uppercase; color: var(--text-dark);">${item.name}</h4>
                        <p style="font-size: 0.85rem; color: var(--text-muted);">Quantity: ${item.quantity}</p>
                    </div>
                    <div style="font-weight: 600; font-size: 1rem; color: var(--text-dark);">
                        ₹${(item.price * item.quantity).toLocaleString('en-IN')}
                    </div>
                </div>
            `;
        });

        summaryContainer.innerHTML = html;
        subtotalEl.innerText = '₹' + subtotal.toLocaleString('en-IN');

        // Discount Handling
        const discountPercent = parseFloat(localStorage.getItem('vanyaDiscount')) || 0;
        const discountAmount = (subtotal * discountPercent) / 100;
        
        if (discountPercent > 0) {
            discountRow.style.display = 'flex';
            discountLabel.innerText = `Promo Discount (${discountPercent}%)`;
            discountEl.innerText = '-₹' + discountAmount.toLocaleString('en-IN');
            
            // Update Promo Input UI
            if (promoInput && promoBtn) {
                promoInput.value = localStorage.getItem('vanyaPromoCode') || '';
                promoInput.disabled = true;
                promoBtn.textContent = 'Remove';
                promoBtn.style.background = '#e53e3e';
                
                promoFeedback.style.display = 'block';
                promoFeedback.style.color = '#38a169';
                promoFeedback.innerHTML = `<i class="fas fa-check-circle"></i> Discount applied! You saved ₹${discountAmount.toLocaleString('en-IN')}`;
            }
        } else {
            discountRow.style.display = 'none';
            if (promoInput && promoBtn) {
                promoInput.disabled = false;
                promoBtn.textContent = 'Apply';
                promoBtn.style.background = 'var(--text-dark)';
            }
        }

        const currentShippingCost = siteSettings.shippingCost || 0;
        const grandTotal = (subtotal - discountAmount) + currentShippingCost;
        if (totalEl) totalEl.innerText = '₹' + grandTotal.toLocaleString('en-IN');
        
        const shipEl = document.getElementById('checkoutShipping');
        if (shipEl) shipEl.innerText = currentShippingCost > 0 ? '₹' + currentShippingCost : 'Free';
        
        const shipRadioEl = document.getElementById('checkoutShippingRadio');
        if (shipRadioEl) shipRadioEl.innerText = currentShippingCost > 0 ? '₹' + currentShippingCost : 'Free';
    }

    // Promo Code Click Handler
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
                    
                    let subtotal = 0;
                    cart.forEach(item => subtotal += item.price * item.quantity);

                    if (subtotal < (promo.minAmount || 0)) {
                        showPromoError(`Min. order of ₹${promo.minAmount.toLocaleString('en-IN')} required.`);
                        return;
                    }

                    if ((promo.usedCount || 0) >= (promo.usageLimit || 9999)) {
                        showPromoError("This code has reached its usage limit.");
                        return;
                    }

                    localStorage.setItem('vanyaDiscount', promo.discount);
                    localStorage.setItem('vanyaPromoId', promoDoc.id);
                    localStorage.setItem('vanyaPromoCode', code);
                    renderCheckoutSummary();
                } else {
                    // Fallback for demo
                    if (code === 'VANYA10') {
                        localStorage.setItem('vanyaDiscount', 10);
                        localStorage.setItem('vanyaPromoCode', code);
                        renderCheckoutSummary();
                    } else {
                        showPromoError("Invalid or expired promo code.");
                    }
                }
            } catch (err) {
                console.error(err);
                showPromoError("Network error. Try again.");
            } finally {
                this.disabled = false;
                if (this.textContent.trim().toUpperCase() !== 'REMOVE') this.textContent = 'Apply';
            }
        });
    }

    function showPromoError(msg) {
        promoFeedback.style.display = 'block';
        promoFeedback.style.color = '#e53e3e';
        promoFeedback.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
        promoBtn.textContent = 'Apply';
    }

    renderCheckoutSummary();

    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', async function () {
            if (cart.length === 0) {
                alert("Your bag is empty.");
                return;
            }

            // Form Validation with highlighting
            const fields = [
                { id: 'chkFirstName', label: 'First Name' },
                { id: 'chkLastName', label: 'Last Name' },
                { id: 'chkEmail', label: 'Email' },
                { id: 'chkPhone', label: 'Phone' },
                { id: 'chkAddress', label: 'Address' },
                { id: 'chkCity', label: 'City' },
                { id: 'chkState', label: 'State' },
                { id: 'chkPin', label: 'PIN Code' }
            ];

            let missing = [];
            fields.forEach(f => {
                const el = document.getElementById(f.id);
                if (!el.value.trim()) {
                    missing.push(f.label);
                    el.style.borderColor = '#e53e3e';
                } else {
                    el.style.borderColor = '#ddd';
                }
            });

            if (missing.length > 0) {
                alert("Please fill in the following fields: " + missing.join(", "));
                return;
            }

            const fname = document.getElementById('chkFirstName').value.trim();
            const lname = document.getElementById('chkLastName').value.trim();
            const email = document.getElementById('chkEmail').value.trim();
            const phone = document.getElementById('chkPhone').value.trim();
            const address = document.getElementById('chkAddress').value.trim();
            const city = document.getElementById('chkCity').value.trim();
            const state = document.getElementById('chkState').value.trim();
            const pin = document.getElementById('chkPin').value.trim();

            // Calculate Totals
            let subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const discountPercent = parseFloat(localStorage.getItem('vanyaDiscount')) || 0;
            const discountAmount = (subtotal * discountPercent) / 100;
            const currentShippingCost = siteSettings.shippingCost || 0;
            const grandTotal = (subtotal - discountAmount) + currentShippingCost;

            this.innerText = 'Processing Order...';
            this.disabled = true;

            if (grandTotal < 1) {
                // Free order bypass (Razorpay requires min 1 INR)
                try {
                    const orderData = {
                        firstName: fname,
                        lastName: lname,
                        customerName: `${fname} ${lname}`,
                        email: email,
                        phone: phone,
                        addressLine: address,
                        city: city,
                        state: state,
                        pin: pin,
                        address: `${address}, ${city}, ${state} - ${pin}`,
                        items: cart,
                        total: grandTotal,
                        discount: discountAmount,
                        paymentId: 'FREE_PROMO_ORDER',
                        orderId: 'FREE_PROMO_ORDER',
                        paymentStatus: 'Paid',
                        status: 'Processing',
                        createdAt: serverTimestamp()
                    };

                    const docRef = await addDoc(collection(db, "orders"), orderData);

                    // Update Stock
                    for (const item of cart) {
                        if (item.id) {
                            try {
                                await updateDoc(doc(db, "articles", item.id), {
                                    stock: increment(-item.quantity)
                                });
                            } catch (sErr) {
                                console.warn("Could not update stock for item:", item.id, sErr);
                            }
                        }
                    }

                    // Show Success UI
                    document.querySelector('.checkout-container').innerHTML = `
                        <div style="text-align: center; padding: 100px 20px; width: 100%;">
                            <i class="fas fa-check-circle" style="font-size: 5rem; color: #38a169; margin-bottom: 30px;"></i>
                            <h2 style="color: #2f855a; font-family: 'Cormorant Garamond', serif; font-size: 3rem; margin-bottom: 15px;">Order Placed!</h2>
                            <p style="color: var(--text-muted); font-size: 1.2rem; line-height: 1.6; max-width: 600px; margin: 0 auto;">
                                Thank you for choosing Hridyang Collection. Your order #${docRef.id} has been confirmed.
                            </p>
                            <a href="index.html" class="btn primary" style="margin-top: 40px; display: inline-block;">Continue Shopping</a>
                        </div>
                    `;

                    // Cleanup
                    const usedPromoId = localStorage.getItem('vanyaPromoId');
                    if (usedPromoId) await updateDoc(doc(db, "promos", usedPromoId), { usedCount: increment(1) });
                    
                    cart = [];
                    localStorage.setItem('vanyaCart', JSON.stringify(cart));
                    localStorage.removeItem('vanyaDiscount');
                    localStorage.removeItem('vanyaPromoId');
                    localStorage.removeItem('vanyaPromoCode');
                    updateCartUI();
                } catch (e) {
                    console.error(e);
                    alert("Error saving free order: " + e.message);
                    this.innerText = 'Place Order';
                    this.disabled = false;
                }
                return;
            }

            try {
                // 1. Create Razorpay Order on Backend
                console.log("Creating Razorpay order at:", `${API_BASE_URL}/api/create-order`);
                const response = await fetch(`${API_BASE_URL}/api/create-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: grandTotal,
                        currency: 'INR',
                        receipt: `receipt_order_${Date.now()}`
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to create Razorpay order");
                }
                const rzpOrder = await response.json();

                // 2. Configure Razorpay Modal
                const options = {
                    key: RAZORPAY_KEY,
                    amount: rzpOrder.amount,
                    currency: rzpOrder.currency,
                    name: siteSettings.storeName || "Hridyang Collection",
                    description: "Handloom Heritage Purchase",
                    image: "assets/logo.png",
                    order_id: rzpOrder.order_id,
                    modal: {
                        ondismiss: function() {
                            console.log("Payment modal dismissed by user");
                            placeOrderBtn.innerText = 'Place Order';
                            placeOrderBtn.disabled = false;
                        }
                    },
                    handler: async function (response) {
                        // 3. Verify Payment on Backend
                        placeOrderBtn.innerText = 'Verifying Payment...';
                        
                        try {
                            console.log("Verifying payment at:", `${API_BASE_URL}/api/verify-payment`);
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

                            if (verifyData.verified) {
                                // 4. Save Final Order to Firebase
                                placeOrderBtn.innerText = 'Saving Order...';
                                
                                const orderData = {
                                    firstName: fname,
                                    lastName: lname,
                                    customerName: `${fname} ${lname}`,
                                    email: email,
                                    phone: phone,
                                    addressLine: address,
                                    city: city,
                                    state: state,
                                    pin: pin,
                                    address: `${address}, ${city}, ${state} - ${pin}`,
                                    items: cart,
                                    total: grandTotal,
                                    discount: discountAmount,
                                    paymentId: response.razorpay_payment_id,
                                    orderId: response.razorpay_order_id,
                                    paymentStatus: 'Paid',
                                    status: 'Processing',
                                    createdAt: serverTimestamp()
                                };

                                const docRef = await addDoc(collection(db, "orders"), orderData);

                                // Update Stock
                                for (const item of cart) {
                                    if (item.id) {
                                        try {
                                            await updateDoc(doc(db, "articles", item.id), {
                                                stock: increment(-item.quantity)
                                            });
                                        } catch (sErr) {
                                            console.warn("Could not update stock for item:", item.id, sErr);
                                        }
                                    }
                                }
                                
                                // WhatsApp Notification
                                let orderText = `*Order Confirmed - Hridyang Collection*\n\n`;
                                orderText += `*Order ID:* ${docRef.id}\n`;
                                orderText += `*Customer:* ${fname} ${lname}\n`;
                                orderText += `*Payment ID:* ${response.razorpay_payment_id}\n\n`;
                                orderText += `*Items:*\n`;
                                cart.forEach(item => orderText += `- ${item.name} (x${item.quantity})\n`);
                                orderText += `\n*Total:* ₹${grandTotal.toLocaleString('en-IN')}`;

                                const encodedMessage = encodeURIComponent(orderText);
                                const myPhoneNumber = siteSettings.whatsAppNumber; 
                                const myApiKey = siteSettings.callMeBotKey || "YOUR_API_KEY"; 
                                fetch(`https://api.callmebot.com/whatsapp.php?phone=${myPhoneNumber}&text=${encodedMessage}&apikey=${myApiKey}`, { mode: 'no-cors' });

                                // Show Success UI
                                document.querySelector('.checkout-container').innerHTML = `
                                    <div style="text-align: center; padding: 100px 20px; width: 100%;">
                                        <i class="fas fa-check-circle" style="font-size: 5rem; color: #38a169; margin-bottom: 30px;"></i>
                                        <h2 style="color: #2f855a; font-family: 'Cormorant Garamond', serif; font-size: 3rem; margin-bottom: 15px;">Order Placed!</h2>
                                        <p style="color: var(--text-muted); font-size: 1.2rem; line-height: 1.6; max-width: 600px; margin: 0 auto;">
                                            Thank you for choosing Hridyang Collection. Your order #${docRef.id} has been confirmed.
                                        </p>
                                        <a href="index.html" class="btn primary" style="margin-top: 40px; display: inline-block;">Continue Shopping</a>
                                    </div>
                                `;

                                // Cleanup
                                const usedPromoId = localStorage.getItem('vanyaPromoId');
                                if (usedPromoId) updateDoc(doc(db, "promos", usedPromoId), { usedCount: increment(1) });
                                
                                cart = [];
                                localStorage.setItem('vanyaCart', JSON.stringify(cart));
                                localStorage.removeItem('vanyaDiscount');
                                localStorage.removeItem('vanyaPromoId');
                                localStorage.removeItem('vanyaPromoCode');
                                updateCartUI();
                            } else {
                                alert("Payment verification failed: " + (verifyData.message || "Invalid signature"));
                                placeOrderBtn.innerText = 'Place Order';
                                placeOrderBtn.disabled = false;
                            }
                        } catch (vErr) {
                            console.error("Verification Error:", vErr);
                            alert("Verification error. Please check your internet connection.");
                            placeOrderBtn.innerText = 'Place Order';
                            placeOrderBtn.disabled = false;
                        }
                    },
                    prefill: {
                        name: `${fname} ${lname}`,
                        email: email,
                        contact: phone
                    },
                    theme: {
                        color: "#800000"
                    },
                    modal: {
                        ondismiss: function() {
                            console.log("Payment modal dismissed by user");
                            placeOrderBtn.innerText = 'Place Order';
                            placeOrderBtn.disabled = false;
                        }
                    }
                };

                const rzp1 = new Razorpay(options);
                
                rzp1.on('payment.failed', function (response) {
                    alert("Payment Failed: " + response.error.description);
                    console.error("Payment Failed", response.error);
                });

                rzp1.open();

            } catch (err) {
                console.error("Checkout Error:", err);
                alert("Error: " + err.message);
                this.innerText = 'Place Order';
                this.disabled = false;
            }
        });
    }
}
