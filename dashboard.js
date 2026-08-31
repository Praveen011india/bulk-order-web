/**
 * Master SPA Router & Auth Controller (dashboard.js)
 * Orchestrates component routing, global state, and Clerk authentication.
 */

const AppState = {
    user: null,
    activeRoute: 'orders',
    queue: [],
    liveData: [],
    platformFilter: 'all'
};

// 1. Clerk Authentication Lifecycle
window.addEventListener('load', async () => {
    try {
        if (!window.Clerk) throw new Error("Clerk library failed to load from CDN.");
        
        await window.Clerk.load();

        if (window.Clerk.user) {
            AppState.user = window.Clerk.user;
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('dashboard-content').style.display = 'flex';
            
            window.Clerk.mountUserButton(document.getElementById('user-button'));
            
            // Initialize Router and Database once authenticated
            Router.init();
            DatabaseEngine.startLivePolling();
        } else {
            document.getElementById('dashboard-content').style.display = 'none';
            document.getElementById('auth-container').style.display = 'flex';
            window.Clerk.mountSignIn(document.getElementById('auth-container'));
        }
    } catch (error) {
        console.error("[Auth Error] Critical failure during initialization:", error);
        UI.showToast("Authentication failed. Please refresh the page.", "error");
    }
});

// 2. Component Router
const Router = {
    init() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Update UI active states
                navItems.forEach(nav => nav.classList.remove('active', 'border-emerald-500', 'bg-emerald-500/10'));
                item.classList.add('active', 'border-emerald-500', 'bg-emerald-500/10');
                
                // Extract target route (e.g., 'orders', 'tracking', 'otp')
                const route = item.innerText.split(' ')[1].toLowerCase().replace(' ', '-');
                this.navigate(route);
            });
        });

        // Load default route
        this.navigate('ordering');
    },

    async navigate(route) {
        AppState.activeRoute = route;
        const mainContainer = document.querySelector('main .max-w-6xl');
        
        // Clear previous module
        const existingModules = mainContainer.querySelectorAll('.dynamic-module');
        existingModules.forEach(mod => mod.remove());

        const moduleWrapper = document.createElement('div');
        moduleWrapper.className = 'dynamic-module animate-fade-in';

        // Lazy load module logic based on route
        switch(route) {
            case 'ordering':
                if (window.OrderModule) moduleWrapper.appendChild(window.OrderModule.render());
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
            default:
                moduleWrapper.innerHTML = `<div class="p-12 text-center text-slate-500">Module [${route}] is loading or unavailable.</div>`;
        }

        mainContainer.appendChild(moduleWrapper);
    }
};

// 3. Global Database Polling Engine (Mocked until supabase.js is injected)
const DatabaseEngine = {
    interval: null,
    
    startLivePolling() {
        if (this.interval) clearInterval(this.interval);
        
        // Poll every 5 seconds for status updates
        this.interval = setInterval(async () => {
            if (window.SupabaseClient) {
                const newData = await window.SupabaseClient.fetchActiveOrders();
                
                // Check for critical OTP interruptions
                const newOTPs = newData.filter(o => o.status === 'otp_required').length;
                const oldOTPs = AppState.liveData.filter(o => o.status === 'otp_required').length;
                
                if (newOTPs > oldOTPs) {
                    UI.showToast("Critical: Bot requires manual OTP intervention!", "warning");
                }
                
                AppState.liveData = newData;
                
                // Re-render the active module silently with new data
                if (['ordering', 'tracking', 'otp'].includes(AppState.activeRoute)) {
                    Router.navigate(AppState.activeRoute);
                }
            }
        }, 5000);
    }
};

// 4. Global UI Utilities
const UI = {
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-bold shadow-xl transition-all duration-500 z-50 transform translate-y-0 opacity-100`;
        
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
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