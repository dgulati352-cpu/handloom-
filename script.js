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
let cart = JSON.parse(localStorage.getItem('vanyaCart')) || [];

document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
});

document.querySelectorAll('.quick-add button').forEach(btn => {
    btn.addEventListener('click', function () {
        const productCard = this.closest('.product-card');
        const productName = productCard.querySelector('h3').innerText;
        const priceStr = productCard.querySelector('.price').innerText;
        const qtyInput = productCard.querySelector('.qty-input');
        const quantity = qtyInput ? parseInt(qtyInput.value) : 1;
        const imgSrc = productCard.querySelector('img').src;

        // Parse price (remove "From ₹" and commas)
        const price = parseInt(priceStr.replace(/[^0-9]/g, ''));

        // Add to cart array
        const existingItem = cart.find(item => item.name === productName);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.push({ name: productName, price: price, quantity: quantity, img: imgSrc });
        }

        updateCartUI();

        // Visual feedback
        const originalText = this.innerHTML;
        this.innerHTML = '<i class="fas fa-check"></i> Added';
        this.style.background = '#800000';

        // Open sidebar to show it was added
        document.getElementById('cartSidebar').classList.add('active');
        document.getElementById('cartOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
            this.innerHTML = '<i class="fas fa-shopping-cart"></i> Quick Add';
            this.style.background = '#1A1A1A';
        }, 2000);
    });
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

// Modal Logic
const modal = document.getElementById('articlesModal');
const viewAllBtn = document.getElementById('viewAllArticles');
const closeBtn = document.querySelector('.close-modal');
const allArticlesGrid = document.getElementById('allArticlesGrid');

const articles = [
    { title: "The Alchemy of Indigo", img: "assets/indigo.png", desc: "Uncovering the secrets of the world's oldest natural dye and its cultural significance." },
    { title: "Lost Weaves of the East", img: "assets/artisan.png", desc: "A journey through the forgotten patterns of artisanal weaving across the Bengal coast." },
    { title: "Sustainability in Every Loop", img: "assets/hero.png", desc: "Why handloom is the ultimate answer to the environmental impact of fast fashion." },
    { title: "Threads of Resilience", img: "assets/silk.png", desc: "How handloom communities are thriving in the modern digital age." },
    { title: "Cotton: The Breathable Gold", img: "assets/cotton.png", desc: "The history of fine Indian cottons that once captivated the world." },
    { title: "Pattern and Poetry", img: "assets/artisan.png", desc: "Understanding the geometric language behind Ikat and Jamdani weaves." }
];

function populateArticles() {
    allArticlesGrid.innerHTML = articles.map(art => `
        <article class="card">
            <div class="card-img">
                <img src="${art.img}" alt="${art.title}">
            </div>
            <div class="card-body">
                <h3>${art.title}</h3>
                <p>${art.desc}</p>
                <a href="#" class="read-more">Read Article →</a>
            </div>
        </article>
    `).join('');
}

if (viewAllBtn) {
    viewAllBtn.onclick = function () {
        populateArticles();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Disable scroll
    }
}

if (closeBtn) {
    closeBtn.onclick = function () {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto'; // Enable scroll
    }
}

window.onclick = function (event) {
    if (event.target == modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// Quantity Selector Logic
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('qty-btn')) {
        const isPlus = e.target.classList.contains('plus');
        const input = e.target.parentElement.querySelector('.qty-input');

        if (input) {
            let currentValue = parseInt(input.value) || 0;
            let min = 0; // Allow it to drop to 0
            let max = parseInt(input.max) || 10;

            if (isPlus && currentValue < max) {
                input.value = currentValue + 1;
            } else if (!isPlus && currentValue > min) {
                input.value = currentValue - 1;
            }

            // Immediately sync with cart
            const productCard = e.target.closest('.product-card');
            if (productCard) {
                const productName = productCard.querySelector('h3').innerText;
                const priceStr = productCard.querySelector('.price').innerText;
                const imgSrc = productCard.querySelector('img').src;
                const price = parseInt(priceStr.replace(/[^0-9]/g, ''));
                const finalQuantity = parseInt(input.value);

                const existingItemIndex = cart.findIndex(item => item.name === productName);

                if (finalQuantity === 0) {
                    if (existingItemIndex > -1) {
                        cart.splice(existingItemIndex, 1);
                    }
                } else {
                    if (existingItemIndex > -1) {
                        cart[existingItemIndex].quantity = finalQuantity;
                    } else {
                        cart.push({ name: productName, price: price, quantity: finalQuantity, img: imgSrc });
                    }
                }

                updateCartUI();

                if (finalQuantity > 0) {
                    // Open sidebar to show it was added
                    document.getElementById('cartSidebar').classList.add('active');
                    document.getElementById('cartOverlay').classList.add('active');
                    document.body.style.overflow = 'hidden';
                }
            }
        }
    }
});

// Cart and Search Overlay Logic
const searchIcon = document.getElementById('searchIcon');
const searchOverlay = document.getElementById('searchOverlay');
const closeSearch = document.getElementById('closeSearch');
const searchInput = document.getElementById('searchInput');

if (searchIcon && searchOverlay && closeSearch) {
    searchIcon.addEventListener('click', (e) => {
        e.preventDefault();
        searchOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => searchInput.focus(), 100);
    });

    closeSearch.addEventListener('click', () => {
        searchOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    });
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

function updateCartUI() {
    const container = document.getElementById('cartItemsContainer');
    const totalValueEl = document.getElementById('cartTotalValue');
    const badge = document.getElementById('cartBadge');

    if (!container || !totalValueEl || !badge) return;

    let total = 0;
    let itemCount = 0;

    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart-msg" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">Your bag is currently empty.</div>';
        badge.style.display = 'none';
        totalValueEl.innerText = '₹0';
        return;
    }

    let html = '';
    cart.forEach((item, index) => {
        total += item.price * item.quantity;
        itemCount += item.quantity;

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

    badge.innerText = itemCount;
    badge.style.display = itemCount > 0 ? 'flex' : 'none';

    localStorage.setItem('vanyaCart', JSON.stringify(cart));
}

window.removeFromCart = function (index) {
    cart.splice(index, 1);
    updateCartUI();
};

// Checkout Button Navigation
const checkoutBtn = document.getElementById('checkoutBtn');
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function () {
        if (cart.length === 0) return;
        window.location.href = 'checkout.html';
    });
}

// Checkout Page Logic
if (window.location.pathname.includes('checkout.html')) {
    const summaryContainer = document.getElementById('checkoutItemsContainer');
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const totalEl = document.getElementById('checkoutTotal');
    const shippingCost = 199;

    function renderCheckoutSummary() {
        if (!summaryContainer) return;

        if (cart.length === 0) {
            summaryContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Your bag is empty.</p>';
            subtotalEl.innerText = '₹0';
            totalEl.innerText = '₹0';
            document.getElementById('placeOrderBtn').disabled = true;
            return;
        }

        let html = '';
        let subtotal = 0;

        cart.forEach(item => {
            subtotal += item.price * item.quantity;
            html += `
                <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                    <img src="${item.img}" style="width: 60px; height: 80px; object-fit: cover; border-radius: 8px;" alt="${item.name}">
                    <div style="flex-grow: 1;">
                        <h4 style="font-size: 0.95rem; font-weight: 500; margin-bottom: 5px; text-transform: uppercase;">${item.name}</h4>
                        <p style="font-size: 0.85rem; color: var(--text-muted);">Qty: ${item.quantity}</p>
                    </div>
                    <div style="font-weight: 600; font-size: 0.95rem;">
                        ₹${(item.price * item.quantity).toLocaleString('en-IN')}
                    </div>
                </div>
            `;
        });

        summaryContainer.innerHTML = html;
        subtotalEl.innerText = '₹' + subtotal.toLocaleString('en-IN');
        totalEl.innerText = '₹' + (subtotal + shippingCost).toLocaleString('en-IN');
    }

    renderCheckoutSummary();

    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', function () {
            if (cart.length === 0) return;

            const fname = document.getElementById('chkFirstName').value.trim();
            const lname = document.getElementById('chkLastName').value.trim();
            const email = document.getElementById('chkEmail').value.trim();
            const phone = document.getElementById('chkPhone').value.trim();
            const address = document.getElementById('chkAddress').value.trim();
            const city = document.getElementById('chkCity').value.trim();
            const state = document.getElementById('chkState').value.trim();
            const pin = document.getElementById('chkPin').value.trim();

            if (!fname || !lname || !phone || !address || !city || !pin) {
                alert("Please fill out all required fields (Name, Phone, Address, City, State, PIN) before placing the order.");
                return;
            }

            // Construct WhatsApp Message
            let orderText = `*New Order from Vanya Handlooms*\n\n`;
            orderText += `*Customer:* ${fname} ${lname}\n`;
            orderText += `*Phone:* ${phone}\n`;
            orderText += `*Email:* ${email || 'N/A'}\n\n`;
            orderText += `*Delivery Location:*\n${address}, ${city}, ${state} - ${pin}\nIndia\n\n`;
            orderText += `*Payment Method:*\nRazorpay Secure Payment\n\n`;
            orderText += `*Order Items:*\n`;

            let totalQty = 0;
            let subtotal = 0;
            cart.forEach(item => {
                orderText += `- ${item.name} (Qty: ${item.quantity}) - ₹${item.price.toLocaleString('en-IN')}\n`;
                totalQty += item.quantity;
                subtotal += (item.price * item.quantity);
            });

            orderText += `\n*Total Pieces Ordered:* ${totalQty}\n`;
            orderText += `*Subtotal:* ₹${subtotal.toLocaleString('en-IN')}\n`;
            orderText += `*Shipping:* ₹199\n`;
            orderText += `*Grand Total:* ₹${(subtotal + 199).toLocaleString('en-IN')}\n`;

            const encodedMessage = encodeURIComponent(orderText);

            // --- AUTOMATIC BACKGROUND WHATSAPP SENDER (CALLMEBOT) ---
            // 1. Add ONE of these numbers to your contacts: +34 697 10 50 14 OR +34 624 54 14 36
            // 2. Send a WhatsApp message to it saying exactly: I allow callmebot to send me messages
            // 3. Put the API key it gives you below:
            const myPhoneNumber = "918791416116"; 
            const myApiKey = "YOUR_API_KEY_HERE"; 
            
            const callMeBotUrl = "https://api.callmebot.com/whatsapp.php?phone=" + myPhoneNumber + "&text=" + encodedMessage + "&apikey=" + myApiKey;
            fetch(callMeBotUrl, { mode: 'no-cors' }).then(res => console.log("Sent")).catch(err => console.log(err));
            const originalText = this.innerText;
            this.innerText = 'Processing Secure Payment...';
            this.style.background = '#800000';
            this.style.opacity = '0.8';
            this.style.pointerEvents = 'none';

            setTimeout(() => {
                document.querySelector('.checkout-container').innerHTML = `
                    <div style="text-align: center; padding: 100px 20px; width: 100%;">
                        <i class="fas fa-check-circle" style="font-size: 5rem; color: #38a169; margin-bottom: 30px;"></i>
                        <h2 style="color: #2f855a; font-family: 'Cormorant Garamond', serif; font-size: 3rem; margin-bottom: 15px;">Order Placed Successfully!</h2>
                        <p style="color: var(--text-muted); font-size: 1.2rem; line-height: 1.6; max-width: 600px; margin: 0 auto;">
                            Thank you for your purchase. Your premium heritage pieces will be shipped shortly. 
                            An order confirmation has been sent to your WhatsApp.
                        </p>
                        <a href="index.html" class="btn primary" style="margin-top: 40px; display: inline-block;">Return to Store</a>
                    </div>
                `;

                // Empty cart
                cart = [];
                localStorage.setItem('vanyaCart', JSON.stringify(cart));
                updateCartUI();
            }, 2500);
        });
    }
}
