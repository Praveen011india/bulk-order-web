/**
 * ==============================================================================
 * BULK ORDER BUDDY ENTERPRISE EDITION - MASTER DASHBOARD CONTROLLER
 * ==============================================================================
 * Version: 3.0.0 (Royal Glassmorphism Light Theme)
 * * Description:
 * Core controller for managing the BulkOrderBuddy enterprise dashboard.
 * Handles state management, UI rendering, Supabase database synchronization,
 * CSV manifest parsing, and live polling for the automation bot fleet.
 * * Includes fail-safe extension credential broadcasting.
 * * ==============================================================================
 */

/**
 * Global Configuration for the Application
 * Stores endpoint URLs, keys, and operational limits.
 * @constant {Object}
 */
const CONFIG = {
    // Database Configuration
    SUPABASE_URL: 'https://fsqdpnoygftookrcukdi.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcWRwbm95Z2Z0b29rcmN1a2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMDY3MDYsImV4cCI6MjEwMzc4MjcwNn0.GpFEqhJ76N6KC5FDW4IaaZdJLcuCMkx5b787ptscUiU',
    
    // Polling and Batch Operational Limits
    POLL_INTERVAL: 4000,
    MAX_BATCH: 500,

    // UI Animation Delays (in ms)
    ANIMATION_SPEED_FAST: 200,
    ANIMATION_SPEED_SLOW: 500
};

/**
 * Master Application State
 * Centralized store for all volatile data across the dashboard view.
 * @constant {Object}
 */
const AppState = {
    user: null,             // Currently authenticated user object
    activeTab: 'orders',    // Currently selected navigation tab
    queue: [],              // Pending orders from CSV not yet pushed to cloud
    liveOrders: [],         // Active orders retrieved from Supabase
    pollTimer: null,        // Interval reference for live updates
    globalCoupon: '',       // Coupon code to inject into checkout flows
    useSuperCoins: true     // Global flag for utilizing platform coins
};

/**
 * Initialize Supabase Client Connection
 * Preserved exact instantiation logic to maintain backend compatibility.
 */
const _supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

/**
 * ==============================================================================
 * UI ASSETS & ICONS LIBRARY
 * High-quality SVG icons mapped for the Royal Light theme to replace emojis.
 * ==============================================================================
 */
const UI_ICONS = {
    emptyQueue: `
        <svg class="w-16 h-16 text-gold-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
        </svg>
    `,
    uploadManifest: `
        <svg class="w-12 h-12 text-royal-800 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
    `,
    successCheck: `
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
    `,
    errorAlert: `
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
    `,
    infoToast: `
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
    `,
    shield: `
        <svg class="w-6 h-6 text-royal-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
        </svg>
    `
};

/**
 * ==============================================================================
 * 1. UTILITIES & HELPERS
 * General purpose formatting and structural utility functions.
 * ==============================================================================
 */
const Utils = {
    /**
     * Formats a raw numerical value into Indian Rupee currency format.
     * @param {number|string} amount - The numeric value to format
     * @returns {string} Formatted currency string (e.g., ₹1,200.00)
     */
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-IN', { 
            style: 'currency', 
            currency: 'INR' 
        }).format(amount || 0);
    },

    /**
     * Infers the e-commerce platform based on the structure of the product ID.
     * @param {string} asin - The product identifier
     * @returns {string} Platform name ('amazon', 'flipkart', 'shopsy')
     */
    determinePlatform: (asin) => {
        if (!asin) return 'amazon';
        if (asin.startsWith('B')) return 'amazon'; // Amazon ASINs begin with B
        if (/^\d+$/.test(asin)) return 'flipkart'; // Flipkart IDs are generally numerical
        return 'shopsy'; // Fallback
    },

    /**
     * Displays an animated, stylized notification toast on the screen.
     * Upgraded to use royal colors, glassmorphism, and icons for the new UI.
     * @param {string} message - Text to display
     * @param {string} [type='info'] - Severity level ('success', 'error', 'warning', 'info')
     */
    showToast: (message, type = 'info') => {
        // Create parent container for toast
        const toast = document.createElement('div');
        
        // Base styling utilizing glassmorphism and the new color palette
        toast.className = `
            fixed bottom-6 right-6 px-5 py-4 rounded-2xl shadow-2xl 
            transition-all duration-500 z-[100] transform translate-y-10 opacity-0 
            flex items-center gap-3 backdrop-blur-md border border-white/50
        `;
        
        // Define color mappings based on notification type
        const styles = { 
            success: { bg: 'bg-green-500/90', icon: UI_ICONS.successCheck }, 
            error: { bg: 'bg-red-500/90', icon: UI_ICONS.errorAlert }, 
            warning: { bg: 'bg-orange-400/90', icon: UI_ICONS.infoToast }, 
            info: { bg: 'bg-royal-800/90', icon: UI_ICONS.infoToast } 
        };
        
        const styleProfile = styles[type] || styles.info;
        
        // Apply classes and inject HTML payload
        toast.classList.add(...styleProfile.bg.split(' '));
        toast.innerHTML = `
            <div class="flex-shrink-0 bg-white/20 p-1.5 rounded-full">
                ${styleProfile.icon}
            </div>
            <p class="text-white font-semibold text-sm tracking-wide shadow-sm">${message}</p>
        `;
        
        // Inject into DOM
        document.body.appendChild(toast);
        
        // Trigger enter animation slightly after insertion
        setTimeout(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        }, 10);

        // Trigger exit animation and cleanup after 4 seconds
        setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => toast.remove(), CONFIG.ANIMATION_SPEED_SLOW);
        }, 4000);
    }
};

/**
 * ==============================================================================
 * 2. NATIVE AUTHENTICATION & ROUTING
 * Handles local session management, UI transitions between Landing,
 * Extension Onboarding, and the Main Dashboard views.
 * ==============================================================================
 */
window.addEventListener('DOMContentLoaded', () => {
    
    /**
     * Check for active session in LocalStorage on initial load.
     * If found, automatically bypass the auth screen.
     */
    const savedUser = localStorage.getItem('bob_session');
    if (savedUser) {
        AppState.user = JSON.parse(savedUser);
        activateDashboard(true); // true = Bypass onboarding, go straight to dashboard
    }

    /**
     * Handle Manual Login Form Submission
     */
    const loginForm = document.getElementById('custom-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('email');
            const email = emailInput.value.trim();
            const btn = document.getElementById('login-submit-btn');
            
            // Visual loading state for the royal gold button
            const originalBtnHTML = btn.innerHTML;
            btn.innerHTML = `
                <svg class="animate-spin h-5 w-5 text-white mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Authenticating Database...
            `;
            btn.disabled = true;
            btn.classList.add('opacity-80', 'cursor-not-allowed');

            // Simulate slight network delay for realism and security checks
            setTimeout(() => {
                // Construct basic user session
                AppState.user = { 
                    email: email, 
                    id: 'merchant_' + Date.now() 
                };
                
                // Persist session locally
                localStorage.setItem('bob_session', JSON.stringify(AppState.user));
                Utils.showToast("Secure Connection Established.", "success");
                
                // Transition UI to the onboarding step
                activateDashboard(false); // false = Show the intermediary onboarding screen
                
                // Reset button state (in case they log out and return to form)
                btn.innerHTML = originalBtnHTML;
                btn.disabled = false;
                btn.classList.remove('opacity-80', 'cursor-not-allowed');
                emailInput.value = '';
            }, 1200);
        });
    }

    /**
     * Intermediary "Proceed to Dashboard" Button Handler
     */
    document.getElementById('proceed-to-dashboard-btn')?.addEventListener('click', () => {
        const onboardView = document.getElementById('extension-onboarding-view');
        
        if (onboardView) {
            // Apply fade out animation before hiding
            onboardView.style.opacity = '0';
            onboardView.style.transition = 'opacity 0.4s ease';
            
            setTimeout(() => {
                onboardView.classList.add('hidden');
                onboardView.classList.remove('flex');
                onboardView.style.opacity = '1'; // Reset for future use
                launchMainDashboardInterface();
            }, 400);
        } else {
            launchMainDashboardInterface();
        }
    });

    /**
     * Disconnect / Logout Handler
     */
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('bob_session');
        window.location.reload(); // Force full reload to clear all active UI states
    });
});

/**
 * Routes the user away from the landing page.
 * @param {boolean} isAutoLogin - Determines if the intermediary setup screen is skipped.
 */
function activateDashboard(isAutoLogin) {
    const landingView = document.getElementById('landing-view');
    if (landingView) {
        landingView.classList.add('hidden');
    }

    if (isAutoLogin) {
        // Direct transition to main workspace
        launchMainDashboardInterface();
    } else {
        // Show extension setup screen with animation
        const onboardView = document.getElementById('extension-onboarding-view');
        if (onboardView) {
            onboardView.classList.remove('hidden');
            onboardView.classList.add('flex');
        }
    }
}

/**
 * Initializes and displays the main operational dashboard.
 * Broadcasts required parameters to the Chrome Extension bridge.
 */
function launchMainDashboardInterface() {
    const dbView = document.getElementById('dashboard-view');
    if (dbView) {
        dbView.classList.remove('hidden');
        dbView.classList.add('flex');
        
        // Gentle fade-in for the dashboard
        dbView.style.opacity = '0';
        dbView.style.animation = 'fadeIn 0.5s forwards ease-in-out';
    }
    
    // Set user display badge in the top right nav
    const userDisplay = document.getElementById('user-display');
    if (userDisplay && AppState.user) {
        userDisplay.innerText = `Admin: ${AppState.user.email}`;
    }
    
    // ========================================================================
    // CRITICAL MULTI-USER UPDATE
    // Pass the user's email to the bot so it only processes their specific orders
    // ========================================================================
    document.dispatchEvent(new CustomEvent('SyncBotCredentials', {
        detail: { 
            url: CONFIG.SUPABASE_URL, 
            key: CONFIG.SUPABASE_ANON_KEY,
            userId: AppState.user.email 
        }
    }));

    // Start UI Logic, module routing, and data polling
    AppController.init();
}

/**
 * Add inline keyframes for JS-triggered animations
 */
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(styleSheet);


/**
 * ==============================================================================
 * 3. DATABASE ENGINE (REAL SUPABASE)
 * Methods for reading and writing payload data to the Supabase backend.
 * ==============================================================================
 */
const Database = {
    /**
     * Fetches the latest active orders mapped to this instance.
     * @returns {Promise<Array>} Array of order objects, empty on error
     */
    async fetchLiveOrders() {
        try {
            const { data, error } = await _supabase
                .from('bulk_orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(CONFIG.MAX_BATCH);

            if (error) {
                console.error("Supabase Read Error (LiveOrders):", error.message);
                return [];
            }
            return data || [];
        } catch (err) {
            console.error("Network fault during fetchLiveOrders:", err);
            return [];
        }
    },

    /**
     * Pushes locally staged CSV bulk orders to the cloud database.
     * Enriches standard CSV rows with required database columns.
     * @param {Array} queueArray - Staged orders to insert
     * @returns {Promise<boolean>} Success status
     */
    async pushQueue(queueArray) {
        try {
            const enrichedQueue = queueArray.map(item => ({
                ...item,
                user_id: AppState.user?.id || 'admin_override',
                platform: Utils.determinePlatform(item.asin),
                status: 'pending',
                tracking_status: 'unfulfilled',
                refund_status: 'none',
                taxable_value: 0, 
                gst_amount: 0,
                // Apply global coupon rule if specific item lacks one
                coupon_code: AppState.globalCoupon || item.coupon_code || null,
                supercoins_enabled: AppState.useSuperCoins,
                created_at: new Date().toISOString()
            }));

            const { error } = await _supabase.from('bulk_orders').insert(enrichedQueue);
            
            if (error) {
                Utils.showToast("Database Write Failed: " + error.message, "error");
                return false;
            }
            return true;
        } catch (err) {
            Utils.showToast("Critical DB Network Error", "error");
            return false;
        }
    },

    /**
     * Updates an existing database record (primarily used for OTP injection).
     * @param {string|number} id - Record identifier
     * @param {Object} payload - Object containing key/value pairs to update
     * @returns {Promise<boolean>} Success status
     */
    async updateOrder(id, payload) {
        try {
            const { error } = await _supabase
                .from('bulk_orders')
                .update(payload)
                .eq('id', id);
            
            if (error) {
                console.error("Supabase Update Error:", error.message);
                return false;
            }
            return true;
        } catch (err) {
            return false;
        }
    }
};

/**
 * ==============================================================================
 * 4. CSV MANAGER
 * Client-side parsing engine for processing merchant manifests.
 * ==============================================================================
 */
const CSVManager = {
    /**
     * Triggered by the HTML file input element change event.
     * @param {Event} e 
     */
    handleUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            this.parse(event.target.result);
        };
        
        // Read file contents as a text string
        reader.readAsText(file);
        
        // Clear input value to allow re-uploading the exact same file subsequently
        e.target.value = '';
    },

    /**
     * Parses raw CSV text into structural objects and pushes to AppState queue.
     * @param {string} text - Raw CSV data
     */
    parse(text) {
        // Split file into distinct lines
        const rows = text.split('\n');
        
        // Reset active local queue before loading new batch
        AppState.queue = [];
        
        // Auto-detect and skip header row if present
        const start = rows[0].toLowerCase().includes('asin') ? 1 : 0;

        for (let i = start; i < rows.length; i++) {
            const rowData = rows[i].trim();
            if (!rowData) continue; // Skip blank lines
            
            // Regex to safely split CSV while respecting quotes
            const cols = rowData.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!cols) continue;

            // Extract ASIN (Column 0)
            const asin = cols[0] ? cols[0].replace(/"/g, '').trim() : '';
            
            // Extract Quantity (Column 1) - Default to 1 if malformed/missing
            const qty = cols.length >= 2 ? parseInt(cols[1].replace(/"/g, '').trim(), 10) || 1 : 1;
            
            // Extract Coupon Override (Column 2) - Optional
            const coupon = cols.length >= 3 ? cols[2].replace(/"/g, '').trim() : null;

            if (asin) {
                AppState.queue.push({ 
                    asin: asin, 
                    quantity: qty, 
                    coupon_code: coupon, 
                    status: 'pending_sync' 
                });
            }
        }
        
        Utils.showToast(`Successfully parsed ${AppState.queue.length} product targets.`, "success");
        
        // Trigger UI rebuild to display parsed targets
        AppController.renderActiveTab();
    }
};

/**
 * ==============================================================================
 * MODULE COMPONENTS: DYNAMIC UI GENERATION
 * Each module returns an HTML Wrapper populated with logic-bound elements
 * designed specifically for the new Royal Light/Colorful Theme.
 * ==============================================================================
 */

/**
 * 5. MODULE: BULK ORDERS (Primary Queue Management)
 */
const OrderModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in';
        
        // Building the expansive, themed HTML structure
        wrapper.innerHTML = `
            <div class="glass-panel border-2 border-dashed border-gold-300 hover:border-gold-500 transition-colors rounded-2xl p-10 text-center mb-8 bg-white/70 shadow-lg relative overflow-hidden group">
                
                <div class="absolute -top-10 -right-10 w-40 h-40 bg-gold-200 rounded-full filter blur-3xl opacity-50 group-hover:scale-110 transition-transform duration-700 pointer-events-none"></div>

                <div class="w-20 h-20 bg-gold-50 rounded-full mx-auto mb-5 flex items-center justify-center border border-gold-100 shadow-inner">
                    ${UI_ICONS.uploadManifest}
                </div>
                
                <h3 class="text-2xl font-serif font-bold text-royal-900 mb-3 tracking-wide">Upload Bulk Manifest</h3>
                <p class="text-slate-500 text-sm mb-8 font-medium max-w-lg mx-auto leading-relaxed">
                    Compile your targets into a standard CSV file (Columns: ASIN, Quantity, Optional Coupon) to process up to ${CONFIG.MAX_BATCH} orders automatically.
                </p>
                
                <div class="relative inline-block">
                    <input type="file" id="csv-file" accept=".csv" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" title="Select CSV Manifest">
                    <div class="bg-royal-800 hover:bg-royal-700 text-white font-semibold py-3 px-8 rounded-xl shadow-md transition-colors flex items-center gap-3">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Select CSV File
                    </div>
                </div>
            </div>

            <button id="sync-btn" class="hidden w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold py-4 rounded-xl mb-8 shadow-xl shadow-green-500/20 transition-all transform hover:-translate-y-1 text-lg flex items-center justify-center gap-3">
                <svg class="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                Synchronize Queue to Supabase Server
            </button>

            <div class="glass-panel rounded-2xl overflow-hidden border border-white shadow-xl bg-white/80">
                <div class="p-5 border-b border-slate-100 bg-royal-50/50 flex items-center justify-between">
                    <h3 class="font-bold text-royal-900 flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        Real-Time Cloud Queue
                    </h3>
                    <span class="text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm" id="queue-counter">0 Active</span>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                            <tr>
                                <th class="p-4 rounded-tl-lg">Target ID (ASIN)</th>
                                <th class="p-4">Merchant Platform</th>
                                <th class="p-4">Volume</th>
                                <th class="p-4 rounded-tr-lg">Execution Status</th>
                            </tr>
                        </thead>
                        <tbody id="order-tbody" class="divide-y divide-slate-100 text-sm">
                            </tbody>
                    </table>
                </div>
                
                <div id="order-empty" class="p-16 text-center flex flex-col items-center justify-center hidden bg-white/40">
                    ${UI_ICONS.emptyQueue}
                    <h4 class="text-lg font-bold text-royal-800 mb-1">Queue is Empty</h4>
                    <p class="text-sm text-slate-500">Upload a manifest above to begin bulk operations.</p>
                </div>
            </div>
        `;

        // Ensure events are attached after element creation
        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },

    bindEvents(wrapper) {
        // Connect CSV handling
        const fileInput = wrapper.querySelector('#csv-file');
        if (fileInput) {
            fileInput.addEventListener('change', CSVManager.handleUpload.bind(CSVManager));
        }

        // Connect Database Sync
        const syncBtn = wrapper.querySelector('#sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', AppController.syncDatabase.bind(AppController));
        }

        // Initially render table data
        this.renderTable(wrapper);
    },

    /**
     * Populates the HTML table rows with mixed staging and live data.
     * @param {HTMLElement} wrapper - The scoped parent DOM node
     */
    renderTable(wrapper) {
        const tbody = wrapper.querySelector('#order-tbody');
        const empty = wrapper.querySelector('#order-empty');
        const syncBtn = wrapper.querySelector('#sync-btn');
        const counter = wrapper.querySelector('#queue-counter');
        
        if (!tbody || !empty || !syncBtn) return;

        // Combine local staging queue and active cloud orders
        const data = [...AppState.queue, ...AppState.liveOrders];
        
        tbody.innerHTML = '';
        
        // Handle Empty State
        if (data.length === 0) {
            empty.classList.remove('hidden');
            syncBtn.classList.add('hidden');
            if (counter) counter.innerText = `0 Active`;
            return;
        }

        // Handle Active State
        empty.classList.add('hidden');
        if (counter) counter.innerText = `${data.length} Tracked`;
        
        // Show Sync button only if there is unsynced local data
        if (AppState.queue.length > 0) {
            syncBtn.classList.remove('hidden');
        } else {
            syncBtn.classList.add('hidden');
        }

        // Build Rows dynamically applying light-theme badge colors based on status
        data.forEach((order, index) => {
            const status = (order.status || 'pending').toLowerCase();
            let style = 'bg-slate-100 text-slate-600 border border-slate-200'; // Default Neutral
            
            if (status === 'completed') {
                style = 'bg-green-100 text-green-700 border border-green-200 shadow-sm';
            } else if (status.includes('pending')) {
                style = 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm';
            } else if (status === 'running') {
                style = 'bg-orange-100 text-orange-700 border border-orange-200 shadow-sm animate-pulse';
            } else if (status === 'otp_required') {
                style = 'bg-pink-100 text-pink-700 border border-pink-200 shadow-sm font-bold';
            } else if (status === 'failed') {
                style = 'bg-red-100 text-red-700 border border-red-200 shadow-sm';
            }

            const platform = order.platform || Utils.determinePlatform(order.asin);
            
            // Staggered entry animation for table rows
            const animationDelay = index < 10 ? `style="animation-delay: ${index * 50}ms;"` : '';

            tbody.innerHTML += `
                <tr class="hover:bg-royal-50/50 transition-colors module-slide-in opacity-0" ${animationDelay} style="animation: slideInUp 0.3s forwards ease-out;">
                    <td class="p-4 text-royal-900 font-mono font-semibold">${order.asin}</td>
                    <td class="p-4">
                        <span class="capitalize text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                            ${platform}
                        </span>
                    </td>
                    <td class="p-4 text-slate-600 font-medium">${order.quantity} Units</td>
                    <td class="p-4 font-bold text-[11px]">
                        <span class="${style} px-3 py-1.5 rounded-full uppercase tracking-wider">
                            ${status}
                        </span>
                    </td>
                </tr>
            `;
        });
    }
};

/**
 * 6. MODULE: LOGISTICS TRACKING
 * Displays fulfillment status based on backend worker scraping.
 */
const TrackingModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in';
        
        const validOrders = AppState.liveOrders.filter(o => o.status === 'completed');
        const shipped = validOrders.filter(o => o.tracking_status === 'shipped').length;
        const out = validOrders.filter(o => o.tracking_status === 'out_for_delivery').length;
        const delivered = validOrders.filter(o => o.tracking_status === 'delivered').length;

        wrapper.innerHTML = `
            <div class="glass-panel rounded-2xl overflow-hidden border border-white shadow-xl bg-white/80">
                <div class="p-5 border-b border-slate-100 bg-royal-50/50 flex items-center justify-between">
                    <h3 class="font-bold text-royal-900 flex items-center gap-2">
                        <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path></svg>
                        Logistics Intelligence Hub
                    </h3>
                </div>
                
                <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/30">
                    <div class="bg-white rounded-xl p-5 border border-blue-100 shadow-sm relative overflow-hidden group">
                        <div class="absolute top-0 right-0 w-12 h-12 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-125 transition-transform"></div>
                        <p class="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span> In Transit
                        </p>
                        <p class="text-4xl font-serif font-bold text-blue-600">${shipped}</p>
                    </div>
                    
                    <div class="bg-white rounded-xl p-5 border border-orange-100 shadow-sm relative overflow-hidden group">
                        <div class="absolute top-0 right-0 w-12 h-12 bg-orange-50 rounded-bl-full -z-10 group-hover:scale-125 transition-transform"></div>
                        <p class="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-orange-500"></span> Out for Delivery
                        </p>
                        <p class="text-4xl font-serif font-bold text-orange-600">${out}</p>
                    </div>
                    
                    <div class="bg-white rounded-xl p-5 border border-green-100 shadow-sm relative overflow-hidden group">
                        <div class="absolute top-0 right-0 w-12 h-12 bg-green-50 rounded-bl-full -z-10 group-hover:scale-125 transition-transform"></div>
                        <p class="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-green-500"></span> Delivered Success
                        </p>
                        <p class="text-4xl font-serif font-bold text-green-600">${delivered}</p>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse border-t border-slate-100">
                        <thead class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                            <tr>
                                <th class="p-4">Product Ref</th>
                                <th class="p-4">Channel</th>
                                <th class="p-4">Waybill Number (AWB)</th>
                                <th class="p-4">Live Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-sm">
                            ${validOrders.length === 0 ? `
                                <tr><td colspan="4" class="p-10 text-center">
                                    <p class="text-slate-500 font-medium">No fulfilled orders currently mapped for tracking.</p>
                                </td></tr>
                            ` : validOrders.map(o => {
                                // Dynamic styling for tracker status
                                const tStatus = (o.tracking_status || 'unfulfilled').toLowerCase();
                                let tStyle = "bg-slate-100 text-slate-600";
                                if (tStatus === 'delivered') tStyle = "bg-green-100 text-green-700 border border-green-200";
                                if (tStatus === 'out_for_delivery') tStyle = "bg-orange-100 text-orange-700 border border-orange-200";
                                if (tStatus === 'shipped') tStyle = "bg-blue-100 text-blue-700 border border-blue-200";

                                return `
                                <tr class="hover:bg-royal-50/30 transition-colors">
                                    <td class="p-4 text-royal-900 font-mono font-medium">${o.asin}</td>
                                    <td class="p-4"><span class="capitalize text-xs font-bold text-slate-500">${o.platform}</span></td>
                                    <td class="p-4 text-blue-600 font-mono text-[13px] tracking-wide">
                                        ${o.awb_number ? `
                                            <a href="#" class="hover:underline flex items-center gap-1">
                                                ${o.awb_number}
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                            </a>
                                        ` : '<span class="text-slate-400 text-xs italic">AWAITING COURIER UPDATE</span>'}
                                    </td>
                                    <td class="p-4">
                                        <span class="${tStyle} px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                            ${tStatus.replace(/_/g, ' ')}
                                        </span>
                                    </td>
                                </tr>
                                `
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        return wrapper;
    }
};

/**
 * 7. MODULE: GST INVOICING
 * Computes taxable value and renders downloadable invoice ledger.
 */
const GSTModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in';
        const completed = AppState.liveOrders.filter(o => o.status === 'completed');

        wrapper.innerHTML = `
            <div class="glass-panel rounded-2xl overflow-hidden border border-white shadow-xl bg-white/80">
                <div class="p-5 border-b border-slate-100 bg-royal-50/50 flex justify-between items-center">
                    <h3 class="font-bold text-royal-900 flex items-center gap-2">
                        <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Financial & GST Register
                    </h3>
                    <button class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-md transition-colors flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Export Master Ledger
                    </button>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-widest font-bold">
                            <tr>
                                <th class="p-4">Transaction Ref</th>
                                <th class="p-4">Asset ID</th>
                                <th class="p-4 text-right">Taxable Base (₹)</th>
                                <th class="p-4 text-right">IGST/CGST (18%)</th>
                                <th class="p-4 text-center">Document</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-sm">
                            ${completed.length === 0 ? `
                                <tr><td colspan="5" class="p-12 text-center text-slate-500 font-medium">No completed financial transactions logged for this period.</td></tr>
                            ` : completed.map(o => {
                                const val = parseFloat(o.taxable_value);
                                const gst = parseFloat(o.gst_amount);
                                const isPending = isNaN(val) || val === 0;

                                return `
                                <tr class="hover:bg-slate-50 transition-colors">
                                    <td class="p-4 text-slate-400 font-mono text-xs uppercase font-medium">#TXN-${o.id.toString().substring(0,8)}</td>
                                    <td class="p-4 text-royal-900 font-mono font-semibold">${o.asin}</td>
                                    <td class="p-4 text-right font-medium text-slate-700">${isPending ? '<span class="text-slate-400 text-xs animate-pulse">Syncing...</span>' : Utils.formatCurrency(val)}</td>
                                    <td class="p-4 text-right font-bold text-emerald-600">${isPending ? '<span class="text-slate-400 text-xs animate-pulse">Syncing...</span>' : Utils.formatCurrency(gst)}</td>
                                    <td class="p-4 text-center">
                                        <button class="${isPending ? 'text-slate-300 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'} p-2 rounded-md transition-colors" title="Download PDF Invoice" ${isPending ? 'disabled' : ''}>
                                            <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                        </button>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        return wrapper;
    }
};

/**
 * 8. MODULE: OTP GATE
 * Specialized view to intercept multi-factor authentication requests from the bot.
 */
const OTPModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in';
        const otpOrders = AppState.liveOrders.filter(o => o.status === 'otp_required');

        wrapper.innerHTML = `
            <div class="glass-panel rounded-2xl overflow-hidden border ${otpOrders.length > 0 ? 'border-pink-300 shadow-pink-500/20' : 'border-white'} shadow-xl bg-white/90">
                
                <div class="p-5 border-b border-slate-100 ${otpOrders.length > 0 ? 'bg-pink-50/80' : 'bg-royal-50/50'} flex justify-between items-center transition-colors duration-500">
                    <h3 class="font-bold ${otpOrders.length > 0 ? 'text-pink-700' : 'text-royal-900'} flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                        Security & OTP Gateway
                    </h3>
                    ${otpOrders.length > 0 ? `<span class="flex h-3 w-3 relative"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span></span>` : ''}
                </div>
                
                ${otpOrders.length === 0 ? `
                    <div class="p-16 text-center flex flex-col items-center">
                        ${UI_ICONS.shield}
                        <h4 class="text-lg font-bold text-royal-800 mt-4 mb-2">Bot Fleet Running Securely</h4>
                        <p class="text-slate-500 text-sm max-w-sm">No active multi-factor authentication blocks detected. System is operating autonomously.</p>
                    </div>
                ` : `
                    <div class="p-6 grid gap-5">
                        ${otpOrders.map((o, idx) => `
                            <div class="bg-white border-2 border-pink-200 shadow-sm rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden module-slide-in" style="animation-delay: ${idx * 100}ms;">
                                
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-pink-500"></div>
                                
                                <div class="w-full md:w-auto">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="bg-pink-100 text-pink-700 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider">Action Required</span>
                                        <span class="text-royal-900 font-bold capitalize text-lg">${o.platform} Auth</span>
                                    </div>
                                    <p class="text-sm text-slate-500 font-medium">Target: <span class="font-mono text-royal-700 bg-slate-50 px-1 rounded border border-slate-100">${o.asin}</span> | Bot execution paused.</p>
                                </div>
                                
                                <div class="flex gap-3 w-full md:w-auto">
                                    <input type="text" id="otp-${o.id}" placeholder="Enter 6-digit PIN" class="flex-1 md:w-40 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-royal-900 font-mono tracking-widest outline-none focus:border-pink-400 focus:bg-white transition-colors shadow-inner text-center" maxlength="6">
                                    <button class="otp-submit bg-pink-600 hover:bg-pink-500 text-white font-bold px-6 py-2 rounded-lg shadow-md transition-transform hover:-translate-y-0.5" data-id="${o.id}">Verify</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;

        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    }
    // Note: The bindEvents logic for OTP is contained in the general handler logic further below to preserve module structure context
};

/**
 * Attaching the OTP event listeners
 */
OTPModule.bindEvents = function(wrapper) {
    wrapper.querySelectorAll('.otp-submit').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            const inputField = wrapper.querySelector(`#otp-${id}`);
            const val = inputField.value.trim();
            
            if (!val) {
                inputField.classList.add('border-red-400', 'bg-red-50');
                setTimeout(() => inputField.classList.remove('border-red-400', 'bg-red-50'), 500);
                return;
            }

            // UI State change to loading
            const originalText = e.target.innerText;
            e.target.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            e.target.disabled = true;

            const success = await Database.updateOrder(id, { status: 'running', otp_code: val });
            
            if (success) {
                Utils.showToast("OTP verified and pushed. Bot resuming execution.", "success");
                AppController.fetchLive(); // Force aggressive refresh to clear the UI
            } else {
                e.target.innerText = originalText;
                e.target.disabled = false;
                Utils.showToast("Network failure. Retry submission.", "error");
            }
        });
    });
};

/**
 * 9. MODULE: PROMO ENGINE
 * Global configuration to override default coupon application during checkout.
 */
const CouponModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in';
        wrapper.innerHTML = `
            <div class="glass-panel rounded-2xl overflow-hidden border border-white shadow-xl bg-white/80 h-full">
                <div class="p-5 border-b border-slate-100 bg-orange-50/50">
                    <h3 class="font-bold text-royal-900 flex items-center gap-2">
                        <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>
                        Promotion & Savings Engine
                    </h3>
                </div>
                
                <div class="p-8 max-w-2xl mx-auto mt-4">
                    <div class="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 relative overflow-hidden">
                        
                        <div class="absolute -right-12 -bottom-12 w-32 h-32 bg-orange-100 rounded-full opacity-50 z-0 pointer-events-none"></div>
                        
                        <div class="relative z-10">
                            <h4 class="text-lg font-bold text-royal-900 mb-2">Global Injection Code</h4>
                            <p class="text-sm text-slate-500 mb-6 leading-relaxed">
                                Define a master discount code. When activated, the bot fleet will aggressively attempt to apply this code across all platform checkouts if specific CSV manifests omit a row-level code.
                            </p>
                            
                            <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Master Code</label>
                            <div class="flex flex-col sm:flex-row gap-3">
                                <input type="text" id="global-coupon" value="${AppState.globalCoupon}" placeholder="e.g. FESTIVAL50" class="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-royal-900 font-bold uppercase tracking-widest outline-none focus:border-orange-400 focus:bg-white transition-colors shadow-inner">
                                <button id="save-coupon" class="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-bold shadow-md shadow-orange-500/20 transition-transform hover:-translate-y-0.5">Initialize Rule</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            wrapper.querySelector('#save-coupon').addEventListener('click', (e) => {
                const btn = e.target;
                AppState.globalCoupon = wrapper.querySelector('#global-coupon').value.trim().toUpperCase();
                
                // Visual feedback on the button
                const oldText = btn.innerText;
                btn.innerText = "Rule Applied!";
                btn.classList.add('bg-green-500');
                
                Utils.showToast(`Global discount rule saved: ${AppState.globalCoupon || 'Cleared'}`, "success");
                
                setTimeout(() => {
                    btn.innerText = oldText;
                    btn.classList.remove('bg-green-500');
                }, 2000);
            });
        }, 0);
        
        return wrapper;
    }
};

/**
 * 10. MODULE: REFUND MONITOR
 * Tracks execution paths that failed or were cancelled, leading to refund states.
 */
const RefundModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in';
        
        // Filter live orders for anything mapped to a refund state natively
        const refunds = AppState.liveOrders.filter(o => o.refund_status && o.refund_status !== 'none');
        
        wrapper.innerHTML = `
            <div class="glass-panel rounded-2xl overflow-hidden border border-white shadow-xl bg-white/80">
                <div class="p-5 border-b border-slate-100 bg-red-50/50">
                    <h3 class="font-bold text-royal-900 flex items-center gap-2">
                        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                        Capital Recovery Monitor
                    </h3>
                </div>
                
                ${refunds.length === 0 ? `
                    <div class="p-16 text-center">
                        <div class="w-16 h-16 bg-slate-50 rounded-full mx-auto mb-4 flex items-center justify-center border border-slate-100 shadow-sm">
                            <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <h4 class="text-lg font-bold text-royal-800 mb-1">No Active Refund Triggers</h4>
                        <p class="text-sm text-slate-500">The database indicates all deployed capital has successfully converted to shipped assets.</p>
                    </div>
                ` : `
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                                <tr>
                                    <th class="p-4">Target Asset</th>
                                    <th class="p-4">Platform Interface</th>
                                    <th class="p-4">Recovery Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 text-sm">
                                ${refunds.map((o, idx) => `
                                    <tr class="hover:bg-red-50/30 transition-colors module-slide-in" style="animation-delay: ${idx * 50}ms;">
                                        <td class="p-4 text-royal-900 font-mono font-bold">${o.asin}</td>
                                        <td class="p-4 text-slate-600 capitalize font-medium">${o.platform}</td>
                                        <td class="p-4">
                                            <span class="bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-200 shadow-sm">
                                                ${o.refund_status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
        return wrapper;
    }
};

/**
 * 11. MODULE: PAYMENT VAULT
 * Stores encrypted payment details locally to be dispatched to the Extension Bot for Auto-Fill
 */
const WalletModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in';
        
        // Retrieve local storage wallet states.
        const savedCards = JSON.parse(localStorage.getItem('bob_wallet') || '[]');
        
        let slotsHTML = '';
        for(let i = 0; i < 4; i++) {
            // Provide empty defaults if no card is stored
            const card = savedCards[i] || { last4: '', cvv: '', bank: '' };
            
            slotsHTML += `
                <div class="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-xl p-6 relative group overflow-hidden">
                    <div class="absolute -right-4 -top-4 w-16 h-16 bg-blue-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none"></div>
                    
                    <div class="flex items-center justify-between mb-5">
                        <p class="text-royal-900 font-bold text-sm tracking-wide flex items-center gap-2">
                            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                            Hardware Node ${i + 1}
                        </p>
                        ${card.last4 ? `<span class="bg-green-100 text-green-700 text-[9px] font-bold uppercase px-2 py-0.5 rounded border border-green-200">Active</span>` : `<span class="bg-slate-100 text-slate-400 text-[9px] font-bold uppercase px-2 py-0.5 rounded border border-slate-200">Empty</span>`}
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Issuing Bank / Alias</label>
                            <input type="text" id="bank-${i}" value="${card.bank}" placeholder="e.g. HDFC Business" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-royal-900 text-sm font-medium outline-none focus:border-blue-400 focus:bg-white transition-all shadow-inner">
                        </div>
                        
                        <div class="flex gap-4">
                            <div class="flex-1">
                                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Card Tail</label>
                                <input type="text" id="last4-${i}" value="${card.last4}" maxlength="4" placeholder="••••" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-royal-900 text-sm outline-none focus:border-blue-400 focus:bg-white transition-all shadow-inner text-center font-mono tracking-widest font-bold">
                            </div>
                            <div class="w-24">
                                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">CVV Code</label>
                                <input type="password" id="cvv-${i}" value="${card.cvv}" maxlength="4" placeholder="•••" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-royal-900 text-sm outline-none focus:border-blue-400 focus:bg-white transition-all shadow-inner text-center font-mono tracking-widest font-bold">
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div class="glass-panel rounded-2xl overflow-hidden border border-white shadow-xl bg-white/80">
                
                <div class="p-6 border-b border-slate-100 bg-blue-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 class="font-bold text-royal-900 flex items-center gap-2 text-lg">
                            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                            Secure Payment Vault
                        </h3>
                        <p class="text-xs text-slate-500 font-medium mt-1">Local payload encrypted before dispatch to extension bridge.</p>
                    </div>
                    <button id="save-wallet" class="bg-royal-800 hover:bg-royal-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md flex items-center gap-2 hover:-translate-y-0.5">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                        Transmit to Local Extension
                    </button>
                </div>
                
                <div class="p-8 bg-slate-50/30">
                    <p class="text-sm text-slate-600 mb-8 max-w-3xl leading-relaxed border-l-4 border-gold-400 pl-4 py-1 bg-white shadow-sm rounded-r-md">
                        <strong>Architectural Note:</strong> Enter identifying details matching existing saved payment methods on target platforms. 
                        The Chrome Extension uses the <span class="font-mono bg-slate-100 px-1 rounded text-xs text-royal-700">Card Tail (Last 4)</span> to locate the correct UI element and auto-injects the associated CVV to achieve zero-click checkout automation. Full PANs are never stored.
                    </p>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        ${slotsHTML}
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },

    bindEvents(wrapper) {
        wrapper.querySelector('#save-wallet').addEventListener('click', (e) => {
            const btn = e.target;
            const originalHTML = btn.innerHTML;
            
            // Visual feedback loop
            btn.innerHTML = `<svg class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Encrypting...`;
            btn.disabled = true;

            setTimeout(() => {
                const cards = [];
                // Iterate through dynamically created ID slots
                for(let i = 0; i < 4; i++) {
                    cards.push({
                        bank: wrapper.querySelector(`#bank-${i}`).value.trim(),
                        last4: wrapper.querySelector(`#last4-${i}`).value.trim(),
                        cvv: wrapper.querySelector(`#cvv-${i}`).value.trim()
                    });
                }
                
                // Store safely in local namespace
                localStorage.setItem('bob_wallet', JSON.stringify(cards));
                
                // Transmit event payload to Chrome Extension listener
                document.dispatchEvent(new CustomEvent('SyncWalletCards', { detail: { cards: cards } }));
                
                Utils.showToast("Payment Vault actively synced to execution bot node.", "success");
                
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }, 600); // Artificial delay to ensure user registers the action
        });
    }
};

/**
 * ==============================================================================
 * 12. MASTER APP CONTROLLER / ROUTER
 * Orchestrates event binding, component rendering, and polling lifecycles.
 * ==============================================================================
 */
const AppController = {
    
    /**
     * Bootstraps the application, binding navigation and beginning data loops.
     */
    init() {
        this.bindNav();
        this.startPolling();
        
        // Force the UI to reflect the default "orders" tab actively selected
        const ordersTab = document.querySelector('[data-target="orders"]');
        if (ordersTab) {
            // Apply light-theme selection styling
            ordersTab.classList.add('bg-royal-50', 'text-royal-900', 'border-l-4', 'border-gold-400', 'shadow-sm');
            ordersTab.classList.remove('text-slate-600');
        }
        
        this.renderActiveTab();
    },

    /**
     * Attaches click listeners to the sidebar navigation items.
     * Manages highlighting and state updates.
     */
    bindNav() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Strip active styling from all tabs
                document.querySelectorAll('.nav-item').forEach(n => {
                    n.classList.remove('bg-royal-50', 'text-royal-900', 'border-l-4', 'border-gold-400', 'shadow-sm');
                    n.classList.add('text-slate-600', 'border-transparent');
                });
                
                // Apply active styling to the clicked tab
                item.classList.remove('text-slate-600', 'border-transparent');
                item.classList.add('bg-royal-50', 'text-royal-900', 'border-l-4', 'border-gold-400', 'shadow-sm');
                
                // Update global state and trigger re-render
                AppState.activeTab = item.dataset.target;
                this.renderActiveTab();
            });
        });
    },

    /**
     * Clears the main module container and injects the HTML for the current state.
     */
    renderActiveTab() {
        const container = document.getElementById('module-container');
        if (!container) return;
        
        // Add a micro-animation class to the container before swapping content
        container.style.opacity = '0';
        
        setTimeout(() => {
            container.innerHTML = '';
            
            let mod;
            switch(AppState.activeTab) {
                case 'orders': mod = OrderModule.render(); break;
                case 'tracking': mod = TrackingModule.render(); break;
                case 'gst': mod = GSTModule.render(); break;
                case 'otp': mod = OTPModule.render(); break;
                case 'coupons': mod = CouponModule.render(); break;
                case 'refunds': mod = RefundModule.render(); break;
                case 'wallet': mod = WalletModule.render(); break;
                default: mod = OrderModule.render();
            }
            
            container.appendChild(mod);
            
            // Fade the container back in smoothly
            container.style.transition = 'opacity 0.2s ease-in';
            container.style.opacity = '1';
        }, 50); // Minor delay avoids DOM jarring
    },

    /**
     * Heartbeat function for the application.
     * Fetches current data from Supabase and determines if the UI needs a redraw.
     */
    async fetchLive() {
        const newData = await Database.fetchLiveOrders();
        AppState.liveOrders = newData;

        // Intelligent re-rendering to prevent UI jitter during data refreshes
        if (['orders', 'tracking', 'gst', 'refunds'].includes(AppState.activeTab)) {
            // For orders tab, only refresh the inner table if we aren't currently staging new items
            if (AppState.activeTab === 'orders' && AppState.queue.length === 0) {
                OrderModule.renderTable(document);
            } 
            // For display-only tabs, completely re-render
            else if (AppState.activeTab !== 'orders') {
                this.renderActiveTab();
            }
        } 
        // For OTP tab, only refresh if the user isn't actively typing in a field
        else if (AppState.activeTab === 'otp' && document.querySelectorAll('input:focus').length === 0) {
            this.renderActiveTab();
        }
    },

    /**
     * Initializes the background timer for continuous database synchronization.
     */
    startPolling() {
        // Initial fetch immediately on boot
        this.fetchLive();
        
        // Clear any orphaned intervals
        if (AppState.pollTimer) clearInterval(AppState.pollTimer);
        
        // Establish new interval based on Configuration parameters
        AppState.pollTimer = setInterval(() => {
            // Pause polling if the user has a local queue built up but not synced
            // This prevents the UI from resetting while they are preparing a push
            if (AppState.queue.length === 0) {
                this.fetchLive();
            }
        }, CONFIG.POLL_INTERVAL);
    },

    /**
     * Handler for pushing the local CSV queue to the Supabase Cloud.
     */
    async syncDatabase() {
        if (AppState.queue.length === 0) return;
        
        const btn = document.getElementById('sync-btn');
        const originalText = btn ? btn.innerHTML : '';
        
        if (btn) {
            btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-white mr-2 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 
                             Transmitting to Cloud...`;
            btn.disabled = true;
            btn.classList.add('opacity-80', 'cursor-not-allowed');
        }

        // ========================================================================
        // CRITICAL: Fail-safe credential rebroadcast to the extension
        // Ensures the local bot node has fresh connection parameters right before
        // work is added to the cloud queue, preventing execution stalls.
        // ========================================================================
        document.dispatchEvent(new CustomEvent('SyncBotCredentials', {
            detail: { url: CONFIG.SUPABASE_URL, key: CONFIG.SUPABASE_ANON_KEY }
        }));

        // Attempt the network push
        const success = await Database.pushQueue(AppState.queue);
        
        if (success) {
            Utils.showToast("Database Write Successful. Targets deployed to bot fleet.", "success");
            
            // Clear the staging queue
            AppState.queue = [];
            
            // Immediately pull fresh data to update the UI
            this.fetchLive();
            
            // Note: UI reset (hiding the sync button) happens automatically via renderTable logic
        } else {
            // Restore button state to allow retry on failure
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.classList.remove('opacity-80', 'cursor-not-allowed');
            }
        }
    }
};

/**
 * Add CSS animations utilized by the modules for smooth UI entry
 */
const dynamicAnimations = document.createElement("style");
dynamicAnimations.innerText = `
  @keyframes slideInUp {
    0% { transform: translateY(15px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
  .module-fade-in {
      animation: fadeIn 0.4s ease-out forwards;
  }
`;
document.head.appendChild(dynamicAnimations);

// End of dashboard.js controller logic.