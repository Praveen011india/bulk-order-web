/**
 * dashboard.js
 * Master SPA Router, State Manager, and Auth Controller.
 * Orchestrates component routing, global state, Clerk authentication, and the Gemini AI pipeline.
 */

// ==========================================
// 1. GLOBAL STATE MANAGEMENT
// ==========================================
window.AppState = {
    user: null,
    activeRoute: 'orders',
    queue: [],         // Local queue containing Gemini AI resolved ASINs & CSV uploads
    liveData: [],      // Live data polled from Supabase
    platformFilter: 'all',
    isPolling: false
};

// ==========================================
// 2. GLOBAL UI UTILITIES
// ==========================================
window.UI = {
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-bold shadow-xl transition-all duration-500 z-50 transform translate-y-0 opacity-100`;
        
        const colors = {
            success: '#10b981', // Emerald
            error: '#ef4444',   // Red
            warning: '#f59e0b', // Amber
            info: '#3b82f6'     // Blue
        };
        toast.style.backgroundColor = colors[type] || colors.info;
        toast.innerText = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }
};

// ==========================================
// 3. DATABASE ENGINE (Supabase Interop)
// ==========================================
// Note: If using lib/supabase.js, ensure this configuration matches your cloud keys.
const SUPABASE_URL = 'https://kjcvmchftyeiccfpiemd.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ACTUAL_ANON_KEY_HERE';
const _supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

window.SupabaseClient = {
    async fetchActiveOrders() {
        if (!_supabase) return [];
        const { data, error } = await _supabase
            .from('bulk_orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500); // High-speed automation claims up to 500 orders
            
        if (error) {
            console.error("Supabase Fetch Error:", error);
            return [];
        }
        return data || [];
    },

    async insertOrders(queueArray) {
        if (!_supabase || queueArray.length === 0) return false;
        
        // Enrich queue with metadata before cloud sync
        const enrichedQueue = queueArray.map(item => ({
            ...item,
            user_id: window.AppState.user?.id || 'anonymous',
            tracking_status: 'processing',
            refund_status: 'none',
            created_at: new Date().toISOString()
        }));

        const { error } = await _supabase.from('bulk_orders').insert(enrichedQueue);
        if (error) {
            console.error("Supabase Insert Error:", error);
            return false;
        }
        return true;
    }
};

// ==========================================
// 4. CLERK AUTHENTICATION LIFECYCLE
// ==========================================
window.addEventListener('load', async () => {
    try {
        if (!window.Clerk) throw new Error("Clerk CDN missing.");
        
        await window.Clerk.load();

        if (window.Clerk.user) {
            window.AppState.user = window.Clerk.user;
            
            // Hide login wall, show internal dashboard[cite: 1, 3]
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('dashboard-content').style.display = 'flex';
            window.Clerk.mountUserButton(document.getElementById('user-button'));
            
            // Initialize Router and Live Database Polling
            Router.init();
            DatabaseEngine.startLivePolling();
        } else {
            // Show login wall
            document.getElementById('dashboard-content').style.display = 'none';
            document.getElementById('auth-container').style.display = 'flex';
            window.Clerk.mountSignIn(document.getElementById('auth-container'));
        }
    } catch (error) {
        console.error("[Auth Error]:", error);
        window.UI.showToast("Authentication service unavailable.", "error");
    }
});

// ==========================================
// 5. COMPONENT ROUTER
// ==========================================
const Router = {
    init() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Update UI active states
                navItems.forEach(nav => nav.classList.remove('active', 'border-emerald-500', 'bg-emerald-500/10'));
                item.classList.add('active', 'border-emerald-500', 'bg-emerald-500/10');
                
                const route = item.dataset.target || 'orders';
                this.navigate(route);
            });
        });

        // Default route initialization
        this.navigate('orders');
    },

    navigate(route) {
        window.AppState.activeRoute = route;
        const mainContainer = document.getElementById('module-container');
        if (!mainContainer) return;
        
        mainContainer.innerHTML = ''; // Clear previous component

        const moduleWrapper = document.createElement('div');
        moduleWrapper.className = 'dynamic-module animate-fade-in w-full';

        // Dynamically mount external components based on the file structure
        try {
            switch(route) {
                case 'orders':
                    if (window.OrderModule) moduleWrapper.appendChild(window.OrderModule.render());
                    else moduleWrapper.innerHTML = `<p class="text-slate-500 p-8">OrderModule (components/order-module.js) is missing.</p>`;
                    break;
                case 'tracking':
                    if (window.TrackingModule) moduleWrapper.appendChild(window.TrackingModule.render());
                    break;
                case 'gst':
                    if (window.GSTModule) moduleWrapper.appendChild(window.GSTModule.render());
                    break;
                case 'otp':
                    if (window.OTPModule) moduleWrapper.appendChild(window.OTPModule.render());
                    break;
                case 'coupons':
                    if (window.CouponModule) moduleWrapper.appendChild(window.CouponModule.render());
                    break;
                case 'refunds':
                    if (window.RefundModule) moduleWrapper.appendChild(window.RefundModule.render());
                    break;
                default:
                    moduleWrapper.innerHTML = `<div class="p-12 text-center text-slate-500">Module [${route}] is loading...</div>`;
            }
        } catch (err) {
            console.error(`Router failed to load module: ${route}`, err);
        }

        mainContainer.appendChild(moduleWrapper);
    }
};

// ==========================================
// 6. LIVE POLLING ENGINE
// ==========================================
const DatabaseEngine = {
    interval: null,
    
    async fetchAndUpdate() {
        const newData = await window.SupabaseClient.fetchActiveOrders();
        
        // Detect critical OTP interruptions to alert user[cite: 1, 3]
        const oldOTPs = window.AppState.liveData.filter(o => o.status === 'otp_required').length;
        const newOTPs = newData.filter(o => o.status === 'otp_required').length;
        
        if (newOTPs > oldOTPs) {
            window.UI.showToast("Critical: Bot paused. Manual OTP intervention required!", "warning");
        }
        
        window.AppState.liveData = newData;
        
        // Silently re-render the active module to reflect live DB changes
        const activeMod = window.AppState.activeRoute;
        if (['orders', 'tracking', 'otp', 'gst', 'refunds'].includes(activeMod)) {
            // Prevent input wiping if the user is typing in the AI block or OTP gate
            const activeInputs = document.querySelectorAll('input:focus');
            if (activeInputs.length === 0) {
                Router.navigate(activeMod);
            }
        }
    },

    startLivePolling() {
        if (this.interval) clearInterval(this.interval);
        
        // Initial fetch
        this.fetchAndUpdate();
        
        // Poll every 5 seconds for status updates[cite: 1, 3]
        this.interval = setInterval(() => {
            if (window.AppState.queue.length === 0) {
                this.fetchAndUpdate();
            }
        }, 5000);
    }
};