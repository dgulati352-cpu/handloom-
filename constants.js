// API and Third-Party Configuration
export const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5001' 
    : 'https://handloom-backend-one.vercel.app';

export const RAZORPAY_KEY = 'rzp_live_Snuoc39A5uuidU';

export const DEFAULT_SETTINGS = {
    announcementText: "Preserving Heritage: 100% Authentic Hand-woven Collection | Free Shipping Worldwide",
    shippingCost: 0,
    storeName: "Hridyang Collection",
    whatsAppNumber: "918791416116"
};
