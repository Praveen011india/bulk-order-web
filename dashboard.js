/**
 * ============================================================================
 * BULKORDERBUDDY ENTERPRISE EDITION - MASTER DASHBOARD CONTROLLER (V3.0)
 * ============================================================================
 * Architecture: Modular MVC with Redux-style State Management.
 * Features: Deep DOM validation, secure Chrome extension bridging, 
 * advanced CSV parsing, resilient polling, and strict Payment Vault sanitization.
 */

// ==========================================
// 1. SYSTEM CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
    SUPABASE_URL: 'https://fsqdpnoygftookrcukdi.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzcWRwbm95Z2Z0b29rcmN1a2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMDY3MDYsImV4cCI6MjEwMzc4MjcwNn0.GpFEqhJ76N6KC5FDW4IaaZdJLcuCMkx5b787ptscUiU',
    GEMINI_API_KEY: 'AQ.Ab8RN6KRVzMyEYPONgoNoXFUPZWEZY8UUjR-2nSsIZkYdPEYdA',
    POLL_INTERVAL_MS: 4000,
    MAX_BATCH_SIZE: 1000,
    MAX_RETRIES: 3,
    TIMEOUT_MS: 15000,
    SUPPORTED_PLATFORMS: ['amazon', 'flipkart', 'shopsy'],
    REGEX: {
        ASIN: /^[A-Z0-9]{10}$/i,
        AMAZON_URL: /(?:dp|o|gp|-|asin)[/=-]([A-Z0-9]{10})/i,
        EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        CVV: /^[0-9]{3,4}$/,
        LAST4: /^[0-9]{4}$/
    }
};

// Initialize Supabase Client
const _supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ==========================================
// 2. ADVANCED LOGGING SYSTEM
// ==========================================
class EnterpriseLogger {
    constructor() {
        this.history = [];
        this.debugMode = true;
    }
    
    _log(level, message, meta = {}) {
        const entry = { timestamp: new Date().toISOString(), level, message, meta };
        this.history.push(entry);
        if (this.history.length > 1000) this.history.shift(); // Prevent memory leaks
        
        if (this.debugMode) {
            const styles = {
                INFO: 'color: #3b82f6; font-weight: bold;',
                WARN: 'color: #f59e0b; font-weight: bold;',
                ERROR: 'color: #ef4444; font-weight: bold;',
                SUCCESS: 'color: #10b981; font-weight: bold;'
            };
            console.log(`%c[${level}] ${message}`, styles[level], meta);
        }
    }

    info(msg, meta) { this._log('INFO', msg, meta); }
    warn(msg, meta) { this._log('WARN', msg, meta); }
    error(msg, meta) { this._log('ERROR', msg, meta); }
    success(msg, meta) { this._log('SUCCESS', msg, meta); }
    
    exportLogs() {
        return JSON.stringify(this.history, null, 2);
    }
}
const Logger = new EnterpriseLogger();

// ==========================================
// 3. STATE MANAGEMENT (REDUX PATTERN)
// ==========================================
class StateStore {
    constructor() {
        this.state = {
            user: null,
            activeTab: 'orders',
            queue: [],
            liveOrders: [],
            pollTimer: null,
            globalCoupon: '',
            useSuperCoins: true,
            isSyncing: false,
            wallet: []
        };
        this.listeners = [];
    }

    getState() {
        return this.state;
    }

    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.notifyListeners();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notifyListeners() {
        this.listeners.forEach(listener => listener(this.state));
    }
}
const Store = new StateStore();

// ==========================================
// 4. CORE UTILITIES
// ==========================================
const Utils = {
    formatCurrency(amount) {
        if (isNaN(amount) || amount === null) return '₹0.00';
        return new Intl.NumberFormat('en-IN', { 
            style: 'currency', 
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    },

    determinePlatform(identifier) {
        if (!identifier) return 'amazon';
        identifier = identifier.trim().toUpperCase();
        if (identifier.startsWith('B') && identifier.length === 10) return 'amazon';
        if (/^\d+$/.test(identifier)) return 'flipkart';
        if (identifier.includes('shopsy')) return 'shopsy';
        return 'amazon'; // Default fallback
    },

    generateShortId(longId) {
        if (!longId) return 'UNKNOWN';
        return longId.toString().substring(0, 8).toUpperCase();
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        const toast = document.createElement('div');
        
        const colors = { 
            success: 'bg-emerald-600', 
            error: 'bg-red-600', 
            warning: 'bg-amber-500', 
            info: 'bg-blue-600' 
        };
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.className = `${colors[type]} text-white px-6 py-4 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0 min-w-[300px] z-[9999]`;
        toast.innerHTML = `<span class="text-lg">${icons[type]}</span> <span>${message}</span>`;
        
        container.appendChild(toast);
        
        // Trigger animation in
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        });
        
        // Trigger animation out
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 4000);

        Logger.info(`Toast rendered: ${message}`, { type });
    },

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
        return container;
    }
};

// ==========================================
// 5. DATABASE LAYER (SUPABASE)
// ==========================================
const DatabaseEngine = {
    /**
     * Fetches real-time orders strictly associated with the active user.
     * Includes automated retry logic for network instability.
     */
    async fetchLiveOrders(retries = CONFIG.MAX_RETRIES) {
        const { user } = Store.getState();
        if (!user || !user.email) {
            Logger.warn("Attempted to fetch orders without active user session.");
            return [];
        }

        try {
            Logger.info(`Fetching live orders for ${user.email}...`);
            const { data, error } = await _supabase
                .from('bulk_orders')
                .select('*')
                .eq('user_id', user.email)
                .order('created_at', { ascending: false })
                .limit(CONFIG.MAX_BATCH_SIZE);

            if (error) throw error;
            Logger.success(`Successfully fetched ${data.length} live orders.`);
            return data || [];
            
        } catch (error) {
            Logger.error("Supabase Read Error", error);
            if (retries > 0) {
                Logger.info(`Retrying fetch... (${retries} attempts left)`);
                await new Promise(r => setTimeout(r, 1000));
                return this.fetchLiveOrders(retries - 1);
            }
            Utils.showToast("Database synchronization failed.", "error");
            return [];
        }
    },

    /**
     * Pushes the local CSV queue to the cloud database.
     * Enriches payload with global coupons, exact timestamps, and deterministic statuses.
     */
    async pushQueueToCloud(queueArray) {
        const { user, globalCoupon, useSuperCoins } = Store.getState();
        if (!user || queueArray.length === 0) return false;

        const enrichedPayload = queueArray.map(item => ({
            user_id: user.email,
            asin: item.asin,
            quantity: item.quantity || 1,
            platform: Utils.determinePlatform(item.asin),
            status: 'pending',
            tracking_status: 'unfulfilled',
            refund_status: 'none',
            taxable_value: 0.00, 
            gst_amount: 0.00,
            coupon_code: globalCoupon || item.coupon_code || null,
            supercoins_enabled: useSuperCoins,
            created_at: new Date().toISOString()
        }));

        try {
            Logger.info(`Pushing ${enrichedPayload.length} items to Supabase...`);
            const { error } = await _supabase.from('bulk_orders').insert(enrichedPayload);
            
            if (error) throw error;
            
            Logger.success("Queue successfully pushed to database.");
            return true;
        } catch (error) {
            Logger.error("Failed to push queue", error);
            Utils.showToast(`Upload Failed: ${error.message}`, "error");
            return false;
        }
    },

    /**
     * Executes a targeted PATCH request for a specific order.
     */
    async patchOrder(orderId, payload) {
        try {
            const { error } = await _supabase.from('bulk_orders').update(payload).eq('id', orderId);
            if (error) throw error;
            Logger.info(`Successfully patched order ${orderId}`, payload);
            return true;
        } catch (error) {
            Logger.error(`Patch failed for ${orderId}`, error);
            return false;
        }
    },

    /**
     * Clears all completed orders from the database to save space.
     */
    async clearCompletedOrders() {
        const { user } = Store.getState();
        if (!user) return false;

        try {
            const { error } = await _supabase
                .from('bulk_orders')
                .delete()
                .eq('user_id', user.email)
                .eq('status', 'completed');
                
            if (error) throw error;
            Logger.success("Completed orders wiped from database.");
            return true;
        } catch (error) {
            Logger.error("Clear completed failed", error);
            return false;
        }
    }
};

// ==========================================
// 6. CSV PARSING ENGINE
// ==========================================
const CSVProcessor = {
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // File validation
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            Utils.showToast("Invalid file format. Please upload a .CSV file.", "error");
            event.target.value = '';
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            Utils.showToast("File too large. Maximum size is 5MB.", "error");
            event.target.value = '';
            return;
        }

        Utils.showToast("Analyzing CSV manifest...", "info");
        
        const reader = new FileReader();
        reader.onload = (e) => this.parseData(e.target.result);
        reader.onerror = () => Utils.showToast("Failed to read file.", "error");
        reader.readAsText(file);
        
        event.target.value = ''; // Reset input
    },

    parseData(csvText) {
        try {
            const rows = csvText.split(/\r?\n/);
            const parsedQueue = [];
            let errorCount = 0;
            
            // Auto-detect headers
            const firstRow = rows[0].toLowerCase();
            const startIdx = (firstRow.includes('asin') || firstRow.includes('url') || firstRow.includes('product')) ? 1 : 0;

            for (let i = startIdx; i < rows.length; i++) {
                const row = rows[i].trim();
                if (!row) continue;

                // Handle quotes and commas properly
                const cols = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                if (!cols || cols.length === 0) continue;

                let rawIdentifier = cols[0].replace(/(^"|"$)/g, '').trim();
                let finalIdentifier = rawIdentifier;
                
                // Smart Extraction: Pull ASIN from messy Amazon URLs
                const urlMatch = rawIdentifier.match(CONFIG.REGEX.AMAZON_URL);
                if (urlMatch && urlMatch[1]) {
                    finalIdentifier = urlMatch[1].toUpperCase();
                } else if (CONFIG.REGEX.ASIN.test(rawIdentifier)) {
                    finalIdentifier = rawIdentifier.toUpperCase();
                }

                if (!finalIdentifier) {
                    errorCount++;
                    continue;
                }

                const quantity = cols.length >= 2 ? parseInt(cols[1].replace(/(^"|"$)/g, '').trim(), 10) : 1;
                const safeQty = (isNaN(quantity) || quantity < 1) ? 1 : quantity;
                
                const customCoupon = cols.length >= 3 ? cols[2].replace(/(^"|"$)/g, '').trim() : null;

                parsedQueue.push({
                    asin: finalIdentifier,
                    quantity: safeQty,
                    coupon_code: customCoupon,
                    status: 'pending_sync'
                });

                if (parsedQueue.length >= CONFIG.MAX_BATCH_SIZE) {
                    Utils.showToast(`Batch limit reached. Truncating to ${CONFIG.MAX_BATCH_SIZE} items.`, "warning");
                    break;
                }
            }

            if (parsedQueue.length === 0) {
                Utils.showToast("No valid products found in CSV.", "error");
                return;
            }

            if (errorCount > 0) {
                Logger.warn(`Skipped ${errorCount} malformed rows during parsing.`);
            }

            Store.setState({ queue: parsedQueue });
            Utils.showToast(`Successfully parsed ${parsedQueue.length} targets. Ready to sync.`, "success");
            AppController.renderActiveTab();
            
        } catch (error) {
            Logger.error("CSV Parsing Error", error);
            Utils.showToast("Fatal error parsing CSV structure.", "error");
        }
    }
};

// ==========================================
// 7. UI MODULES (VIEWS)
// ==========================================

const BaseModule = {
    createWrapper() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full animate-float opacity-100 transition-opacity duration-300';
        return wrapper;
    }
};

/**
 * MODULE 1: BULK ORDERING
 * Handles CSV Drag & Drop, Status Tables, and Cloud Sync execution.
 */
const OrderModule = {
    render() {
        const wrapper = BaseModule.createWrapper();
        const { queue } = Store.getState();
        const hasQueue = queue.length > 0;

        wrapper.innerHTML = `
            <div class="glass-panel border-2 border-dashed ${hasQueue ? 'border-emerald-500/50 bg-emerald-900/10' : 'border-slate-600 hover:border-gold-500/50'} transition-colors rounded-xl p-10 text-center mb-8 relative cursor-pointer group shadow-2xl">
                <input type="file" id="csv-upload" accept=".csv" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20">
                <div class="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">${hasQueue ? '✅' : '📁'}</div>
                <h3 class="text-2xl font-bold text-white mb-2 font-serif">${hasQueue ? 'Manifest Loaded' : 'Upload Bulk Order Manifest'}</h3>
                <p class="text-slate-400 text-sm mb-2 max-w-md mx-auto">Upload a CSV (Col 1: Name/URL/ASIN | Col 2: Quantity).</p>
                <div id="upload-status" class="mt-4 text-sm font-bold ${hasQueue ? 'text-emerald-400' : 'text-gold-400'}">
                    ${hasQueue ? `${queue.length} items ready for synchronization.` : 'Drag & Drop or Click to Browse'}
                </div>
            </div>

            <button id="execute-sync-btn" class="${hasQueue ? 'block' : 'hidden'} w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-royal-900 font-black py-5 rounded-xl mb-8 shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all transform hover:-translate-y-1 text-xl uppercase tracking-wider">
                Synchronize Queue to Cloud Database 🚀
            </button>

            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <div class="p-6 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <h3 class="font-bold text-white text-lg flex items-center gap-2">📦 Real-Time Cloud Queue</h3>
                    <button id="clear-completed-btn" class="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white text-xs px-4 py-2 rounded-lg transition-colors font-bold hidden">
                        Clear Completed
                    </button>
                </div>
                <div class="overflow-x-auto min-h-[300px]">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-widest">
                            <tr>
                                <th class="p-5 font-semibold">Target ID (ASIN)</th>
                                <th class="p-5 font-semibold">Platform</th>
                                <th class="p-5 font-semibold">Qty</th>
                                <th class="p-5 font-semibold text-right">Live Status</th>
                            </tr>
                        </thead>
                        <tbody id="order-table-body" class="divide-y divide-white/5 text-sm">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                    <div id="order-empty-state" class="p-20 text-center text-slate-500 flex flex-col items-center hidden">
                        <span class="text-4xl mb-4 opacity-50">📭</span>
                        <p class="font-medium">No active orders found in the database.</p>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            this.bindEvents(wrapper);
            this.updateTableUI(wrapper);
        }, 0);
        
        return wrapper;
    },

    bindEvents(wrapper) {
        const fileInput = wrapper.querySelector('#csv-upload');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => CSVProcessor.handleFileUpload(e));
        }

        const syncBtn = wrapper.querySelector('#execute-sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => AppController.executeCloudSync());
        }

        const clearBtn = wrapper.querySelector('#clear-completed-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (confirm("Permanently delete all COMPLETED orders from your cloud database?")) {
                    clearBtn.innerText = "Clearing...";
                    clearBtn.disabled = true;
                    await DatabaseEngine.clearCompletedOrders();
                    AppController.triggerDataRefresh();
                }
            });
        }
    },

    updateTableUI(wrapper) {
        const tbody = wrapper.querySelector('#order-table-body');
        const emptyState = wrapper.querySelector('#order-empty-state');
        const clearBtn = wrapper.querySelector('#clear-completed-btn');
        
        if (!tbody || !emptyState) return;

        const { queue, liveOrders } = Store.getState();
        const combinedData = [...queue, ...liveOrders];
        
        tbody.innerHTML = '';
        
        if (combinedData.length === 0) {
            emptyState.classList.remove('hidden');
            if (clearBtn) clearBtn.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        
        const hasCompleted = combinedData.some(o => o.status === 'completed');
        if (clearBtn) {
            hasCompleted ? clearBtn.classList.remove('hidden') : clearBtn.classList.add('hidden');
        }

        const rowsHtml = combinedData.map(order => {
            const status = (order.status || 'pending').toLowerCase();
            let badgeClass = 'bg-slate-800 text-slate-400 border border-slate-700';
            let icon = '⏳';
            
            if (status === 'completed') { badgeClass = 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30'; icon = '✅'; }
            else if (status.includes('pending')) { badgeClass = 'bg-blue-900/40 text-blue-400 border border-blue-500/30'; icon = '🔄'; }
            else if (status === 'running') { badgeClass = 'bg-amber-900/40 text-amber-400 border border-amber-500/30 animate-pulse'; icon = '⚡'; }
            else if (status === 'otp_required') { badgeClass = 'bg-purple-900/40 text-purple-400 border border-purple-500/30'; icon = '🔐'; }
            else if (status === 'failed') { badgeClass = 'bg-red-900/40 text-red-400 border border-red-500/30'; icon = '❌'; }

            const platform = order.platform || Utils.determinePlatform(order.asin);
            const displayAsin = order.asin.length > 25 ? order.asin.substring(0,25) + '...' : order.asin;

            return `
                <tr class="hover:bg-white/5 transition-colors group">
                    <td class="p-5 text-white font-mono font-medium">${displayAsin}</td>
                    <td class="p-5 text-slate-300 capitalize flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full ${platform === 'amazon' ? 'bg-orange-500' : 'bg-blue-500'}"></span>
                        ${platform}
                    </td>
                    <td class="p-5 text-slate-300 font-mono">${order.quantity}</td>
                    <td class="p-5 text-right">
                        <span class="${badgeClass} px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide shadow-sm inline-flex items-center gap-2">
                            <span>${icon}</span> ${status.toUpperCase().replace('_', ' ')}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml;
    }
};

/**
 * MODULE 2: LOGISTICS TRACKING
 * Visualizes shipment statuses and provides webhooks to scrape live tracking data.
 */
const TrackingModule = {
    render() {
        const wrapper = BaseModule.createWrapper();
        const { liveOrders } = Store.getState();
        const validOrders = liveOrders.filter(o => o.status === 'completed');
        
        const metrics = {
            shipped: validOrders.filter(o => o.tracking_status === 'shipped').length,
            out: validOrders.filter(o => o.tracking_status === 'out_for_delivery').length,
            delivered: validOrders.filter(o => o.tracking_status === 'delivered').length
        };

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl mb-8">
                <div class="p-6 border-b border-white/10 bg-black/20">
                    <h3 class="font-bold text-white text-lg flex items-center gap-2">🚚 Executive Logistics Dashboard</h3>
                    <p class="text-xs text-slate-400 mt-1 font-medium">Monitor real-time shipment updates across all platforms.</p>
                </div>
                
                <div class="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-black/10">
                    <div class="bg-slate-900/80 rounded-xl p-6 border border-blue-500/20 shadow-inner relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 text-6xl opacity-10">🚢</div>
                        <p class="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">In Transit</p>
                        <p class="text-4xl font-black text-white">${metrics.shipped}</p>
                    </div>
                    <div class="bg-slate-900/80 rounded-xl p-6 border border-amber-500/20 shadow-inner relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 text-6xl opacity-10">🛵</div>
                        <p class="text-amber-400 text-xs font-black uppercase tracking-widest mb-2">Out for Delivery</p>
                        <p class="text-4xl font-black text-white">${metrics.out}</p>
                    </div>
                    <div class="bg-slate-900/80 rounded-xl p-6 border border-emerald-500/20 shadow-inner relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 text-6xl opacity-10">📦</div>
                        <p class="text-emerald-400 text-xs font-black uppercase tracking-widest mb-2">Delivered</p>
                        <p class="text-4xl font-black text-white">${metrics.delivered}</p>
                    </div>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse border-t border-white/10">
                        <thead class="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-widest">
                            <tr>
                                <th class="p-5 font-semibold">Order Ref</th>
                                <th class="p-5 font-semibold">Courier</th>
                                <th class="p-5 font-semibold">AWB / Tracking ID</th>
                                <th class="p-5 font-semibold">Logistics Status</th>
                                <th class="p-5 font-semibold text-right">Webhook</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5 text-sm">
                            ${this.generateRows(validOrders)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },

    generateRows(validOrders) {
        if (validOrders.length === 0) {
            return `<tr><td colspan="5" class="p-16 text-center text-slate-500 font-medium">No fulfilled orders available for tracking synchronization.</td></tr>`;
        }
        
        return validOrders.map(order => {
            const trackingId = order.tracking_id || 'Awaiting Sync';
            const courier = order.courier || 'Pending Assignment';
            let tStatus = order.tracking_status || 'processing';
            
            let badgeStyle = 'bg-slate-800 text-slate-400 border-slate-700';
            if(tStatus === 'shipped') badgeStyle = 'bg-blue-900/40 text-blue-400 border-blue-500/30';
            if(tStatus === 'out_for_delivery') badgeStyle = 'bg-amber-900/40 text-amber-400 border-amber-500/30';
            if(tStatus === 'delivered') badgeStyle = 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30';

            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-5 text-slate-400 font-mono text-xs uppercase">${Utils.generateShortId(order.id)}</td>
                    <td class="p-5 text-white font-medium">${courier}</td>
                    <td class="p-5 text-blue-400 font-mono">${trackingId}</td>
                    <td class="p-5">
                        <span class="border ${badgeStyle} px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide">${tStatus.toUpperCase().replace(/_/g, ' ')}</span>
                    </td>
                    <td class="p-5 text-right">
                        <button class="sync-track-btn text-xs font-bold bg-royal-800 hover:bg-royal-700 border border-royal-700 px-4 py-2 rounded-lg text-white transition-all shadow-md" data-dbid="${order.id}">
                            Pull Live Data
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    bindEvents(wrapper) {
        wrapper.querySelectorAll('.sync-track-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dbId = e.target.getAttribute('data-dbid');
                const amazonId = prompt("Enter the precise 17-digit Amazon Order ID to execute tracking webhook:");
                
                if (amazonId && amazonId.length >= 15) {
                    e.target.innerText = "Executing...";
                    e.target.classList.add('animate-pulse', 'bg-gold-600', 'border-gold-500');
                    e.target.disabled = true;
                    
                    document.dispatchEvent(new CustomEvent('FetchAmazonTracking', { 
                        detail: { amazonOrderId: amazonId.trim(), dbOrderId: dbId } 
                    }));
                    
                    Utils.showToast("Tracking Webhook Dispatched to Extension Engine.", "success");
                    
                    setTimeout(() => {
                        e.target.innerText = "Pull Live Data";
                        e.target.classList.remove('animate-pulse', 'bg-gold-600', 'border-gold-500');
                        e.target.disabled = false;
                    }, 5000);
                } else if (amazonId) {
                    Utils.showToast("Invalid Order ID Format.", "error");
                }
            });
        });
    }
};

/**
 * MODULE 3: GST INVOICING
 * Reads the actual finalized taxable value from the database.
 */
const GSTModule = {
    render() {
        const wrapper = BaseModule.createWrapper();
        const { liveOrders } = Store.getState();
        const completed = liveOrders.filter(o => o.status === 'completed');

        // Calculate Totals
        let totalTaxable = 0;
        let totalGST = 0;
        completed.forEach(o => {
            if (!isNaN(parseFloat(o.taxable_value))) totalTaxable += parseFloat(o.taxable_value);
            if (!isNaN(parseFloat(o.gst_amount))) totalGST += parseFloat(o.gst_amount);
        });

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <div class="p-6 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-white text-lg flex items-center gap-2">🧾 B2B GST Invoicing</h3>
                        <p class="text-xs text-slate-400 mt-1 font-medium">Auto-calculated 18% deductions derived from final cart checkout values.</p>
                    </div>
                    <button class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-lg transition-transform hover:-translate-y-0.5">
                        Export Monthly PDF
                    </button>
                </div>
                
                <div class="grid grid-cols-2 border-b border-white/10">
                    <div class="p-6 bg-black/10 border-r border-white/10 text-center">
                        <p class="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Taxable Value</p>
                        <p class="text-3xl font-black text-white">${Utils.formatCurrency(totalTaxable)}</p>
                    </div>
                    <div class="p-6 bg-black/10 text-center">
                        <p class="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Input Tax Credit (18%)</p>
                        <p class="text-3xl font-black text-emerald-400">${Utils.formatCurrency(totalGST)}</p>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-widest">
                            <tr>
                                <th class="p-5 font-semibold">Order Ref</th>
                                <th class="p-5 font-semibold">Target (ASIN)</th>
                                <th class="p-5 font-semibold text-right">Taxable Value</th>
                                <th class="p-5 font-semibold text-right">GST (18%)</th>
                                <th class="p-5 font-semibold text-center">Invoice</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5 text-sm">
                            ${this.generateRows(completed)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        return wrapper;
    },
    
    generateRows(completed) {
        if (completed.length === 0) {
            return `<tr><td colspan="5" class="p-16 text-center text-slate-500 font-medium">No completed orders available for GST calculation.</td></tr>`;
        }

        return completed.map(o => {
            const val = parseFloat(o.taxable_value);
            const gst = parseFloat(o.gst_amount);
            const isPending = isNaN(val) || val === 0;

            const displayVal = isPending ? '<span class="text-slate-500 italic text-xs">Awaiting Extension Sync</span>' : `<span class="text-white font-medium">${Utils.formatCurrency(val)}</span>`;
            const displayGst = isPending ? '<span class="text-slate-500 italic text-xs">--</span>' : `<span class="text-emerald-400 font-bold">${Utils.formatCurrency(gst)}</span>`;

            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-5 text-slate-400 font-mono text-xs uppercase">${Utils.generateShortId(o.id)}</td>
                    <td class="p-5 text-slate-300 font-mono">${o.asin}</td>
                    <td class="p-5 text-right">${displayVal}</td>
                    <td class="p-5 text-right">${displayGst}</td>
                    <td class="p-5 text-center">
                        <button class="${isPending ? 'text-slate-600 cursor-not-allowed' : 'text-gold-400 hover:text-gold-300 hover:underline'} text-xs font-bold tracking-wide" ${isPending ? 'disabled' : ''}>
                            ${isPending ? 'LOCKED' : 'DOWNLOAD'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
};

/**
 * MODULE 4: PAYMENT VAULT
 * Strictly validates CVV and Card formats before broadcasting to Extension.
 */
const WalletModule = {
    render() {
        const wrapper = BaseModule.createWrapper();
        const savedCards = JSON.parse(localStorage.getItem('bob_wallet') || '[]');
        
        let slotsHTML = '';
        for(let i = 0; i < 4; i++) {
            const card = savedCards[i] || { last4: '', cvv: '', bank: '' };
            slotsHTML += `
                <div class="bg-slate-900/80 border ${card.last4 ? 'border-emerald-500/30' : 'border-slate-700'} rounded-xl p-6 shadow-inner relative">
                    ${card.last4 ? `<div class="absolute top-4 right-4 text-emerald-500 text-xs font-bold flex items-center gap-1"><span>✅</span> Active</div>` : ''}
                    <p class="text-white font-bold mb-4 text-sm flex items-center gap-2">
                        <span class="bg-royal-800 text-white w-6 h-6 rounded flex items-center justify-center text-xs">${i + 1}</span> 
                        Payment Card Slot
                    </p>
                    <div class="space-y-4">
                        <div>
                            <label class="text-xs text-slate-400 font-bold tracking-wider uppercase mb-1 block">Card Issuer Alias</label>
                            <input type="text" id="bank-${i}" value="${card.bank}" placeholder="e.g. Corporate HDFC" class="w-full bg-black/40 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all">
                        </div>
                        <div class="flex gap-4">
                            <div class="flex-1">
                                <label class="text-xs text-slate-400 font-bold tracking-wider uppercase mb-1 block">Last 4 Digits</label>
                                <input type="text" id="last4-${i}" value="${card.last4}" maxlength="4" placeholder="1234" class="w-full bg-black/40 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-center font-mono tracking-widest transition-all">
                            </div>
                            <div class="w-24">
                                <label class="text-xs text-slate-400 font-bold tracking-wider uppercase mb-1 block">CVV</label>
                                <input type="password" id="cvv-${i}" value="${card.cvv}" maxlength="4" placeholder="***" class="w-full bg-black/40 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-center font-mono tracking-widest transition-all">
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <div class="p-6 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-white text-lg flex items-center gap-2">💳 Encrypted Payment Vault</h3>
                        <p class="text-xs text-slate-400 mt-1 font-medium">Card data is strictly stored in local browser memory and never uploaded to Supabase.</p>
                    </div>
                    <button id="save-wallet" class="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-royal-900 px-6 py-3 rounded-xl font-black text-sm transition-all shadow-lg shadow-gold-500/20 transform hover:-translate-y-0.5">
                        Encrypt & Sync to Bot
                    </button>
                </div>
                <div class="p-8 bg-black/10">
                    <div class="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-8 flex gap-4 items-start">
                        <span class="text-2xl">ℹ️</span>
                        <p class="text-sm text-blue-200 leading-relaxed">
                            <strong>Crucial Setup:</strong> The Extension requires exact "Last 4" digits to locate the correct radio button on Amazon's checkout page. Ensure the cards saved here precisely match the cards pre-saved in your Amazon account.
                        </p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        ${slotsHTML}
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },

    bindEvents(wrapper) {
        wrapper.querySelector('#save-wallet').addEventListener('click', () => {
            const cards = [];
            let validationError = false;

            for(let i = 0; i < 4; i++) {
                const bank = wrapper.querySelector(`#bank-${i}`).value.trim();
                const last4 = wrapper.querySelector(`#last4-${i}`).value.trim();
                const cvv = wrapper.querySelector(`#cvv-${i}`).value.trim();

                if (last4 || cvv) {
                    if (!CONFIG.REGEX.LAST4.test(last4)) {
                        Utils.showToast(`Slot ${i+1}: Last 4 must be exactly 4 digits.`, "error");
                        validationError = true;
                        break;
                    }
                    if (!CONFIG.REGEX.CVV.test(cvv)) {
                        Utils.showToast(`Slot ${i+1}: CVV must be 3 or 4 digits.`, "error");
                        validationError = true;
                        break;
                    }
                    cards.push({ bank, last4, cvv });
                } else {
                    cards.push({ bank: '', last4: '', cvv: '' });
                }
            }

            if (validationError) return;

            localStorage.setItem('bob_wallet', JSON.stringify(cards));
            Store.setState({ wallet: cards });
            
            // Dispatch to Bridge
            document.dispatchEvent(new CustomEvent('SyncWalletCards', { detail: { cards: cards } }));
            
            Utils.showToast("Payment Vault secured and synced to Extension Engine.", "success");
            
            // Re-render to show active badges
            setTimeout(() => AppController.renderActiveTab(), 500);
        });
    }
};

/**
 * MODULE 5: OTP GATE
 */
const OTPModule = {
    render() {
        const wrapper = BaseModule.createWrapper();
        const { liveOrders } = Store.getState();
        const otpOrders = liveOrders.filter(o => o.status === 'otp_required');

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <div class="p-6 border-b border-white/10 bg-purple-900/30">
                    <h3 class="font-bold text-white text-lg flex items-center gap-2">🔐 Manual Intervention Gate</h3>
                    <p class="text-xs text-purple-200 mt-1 font-medium">If the bot encounters a 2FA wall on Amazon, it will pause and await input here.</p>
                </div>
                ${otpOrders.length === 0 ? 
                    `<div class="p-20 text-center text-slate-500 flex flex-col items-center">
                        <span class="text-5xl mb-4 opacity-50 drop-shadow-lg">🛡️</span>
                        <p class="font-medium text-lg">No active OTP blocks.</p>
                        <p class="text-sm mt-2">Bot fleet is running with zero friction.</p>
                    </div>` : 
                    `<div class="p-8 grid gap-6 bg-black/10">
                        ${otpOrders.map(o => `
                            <div class="bg-slate-900/80 border border-purple-500/50 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
                                <div class="flex items-center gap-4">
                                    <div class="w-12 h-12 bg-purple-900/50 rounded-full flex items-center justify-center text-xl border border-purple-500/30">📱</div>
                                    <div>
                                        <p class="text-white font-bold text-lg mb-1">Auth Required: ${o.platform.toUpperCase()}</p>
                                        <p class="text-sm text-slate-400">Target ASIN: <span class="font-mono text-purple-300 font-bold">${o.asin}</span> | Bot Engine Paused</p>
                                    </div>
                                </div>
                                <div class="flex gap-3 w-full md:w-auto">
                                    <input type="text" id="otp-${o.id}" placeholder="Enter 6-digit OTP" class="flex-1 md:w-48 bg-black/50 border border-purple-500/50 rounded-lg px-4 py-3 text-white font-mono tracking-widest outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all text-center">
                                    <button class="otp-submit bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-lg shadow-lg shadow-purple-600/30 transition-all transform hover:-translate-y-0.5" data-id="${o.id}">
                                        Inject OTP
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;

        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },

    bindEvents(wrapper) {
        wrapper.querySelectorAll('.otp-submit').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const val = wrapper.querySelector(`#otp-${id}`).value.trim();
                
                if (!val) {
                    Utils.showToast("OTP field cannot be empty.", "warning");
                    return;
                }

                e.target.innerText = "Injecting...";
                e.target.classList.add('animate-pulse');
                e.target.disabled = true;

                // 1. Update Database Status to un-pause bot
                const success = await DatabaseEngine.patchOrder(id, { status: 'running' });
                
                // 2. Dispatch event to bridge.js to physically type it on Amazon
                document.dispatchEvent(new CustomEvent('InjectAmazonOTP', { 
                    detail: { otp: val } 
                }));

                if (success) {
                    Utils.showToast("OTP successfully injected into Amazon pipeline.", "success");
                    AppController.triggerDataRefresh();
                } else {
                    e.target.innerText = "Retry Injection";
                    e.target.classList.remove('animate-pulse');
                    e.target.disabled = false;
                }
            });
        });
    }
};

/**
 * MODULE 6: PROMO ENGINE
 */
const CouponModule = {
    render() {
        const wrapper = BaseModule.createWrapper();
        const { globalCoupon, useSuperCoins } = Store.getState();

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <div class="p-6 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-white text-lg flex items-center gap-2">🎟️ Central Promo Engine</h3>
                        <p class="text-xs text-slate-400 mt-1 font-medium">Configure rules applied to all future uploads.</p>
                    </div>
                </div>
                <div class="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-black/10">
                    <div class="bg-slate-900/80 border border-slate-700 rounded-xl p-6 shadow-inner">
                        <label class="block text-sm font-bold text-white mb-2 tracking-wide">Global Amazon Coupon Code</label>
                        <p class="text-xs text-slate-400 mb-4">Automatically typed into the Amazon promo box at checkout.</p>
                        <div class="flex gap-3">
                            <input type="text" id="global-coupon" value="${globalCoupon}" placeholder="e.g. SAVE20" class="flex-1 bg-black/50 border border-slate-600 rounded-lg px-4 py-3 text-white font-mono uppercase outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all">
                            <button id="save-coupon" class="bg-royal-800 hover:bg-royal-700 border border-royal-600 text-white px-6 py-3 rounded-lg font-bold transition-all shadow-md">Set Rule</button>
                        </div>
                    </div>
                    
                    <div class="bg-slate-900/80 border border-slate-700 rounded-xl p-6 shadow-inner flex flex-col justify-center">
                        <label class="flex items-center gap-4 cursor-pointer group">
                            <div class="relative">
                                <input type="checkbox" id="supercoins-toggle" class="sr-only" ${useSuperCoins ? 'checked' : ''}>
                                <div class="block bg-slate-700 w-14 h-8 rounded-full border border-slate-600 transition-colors ${useSuperCoins ? 'bg-emerald-600' : ''}"></div>
                                <div class="dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${useSuperCoins ? 'transform translate-x-6' : ''}"></div>
                            </div>
                            <div>
                                <span class="text-white font-bold text-sm tracking-wide">Enable Flipkart SuperCoins</span>
                                <p class="text-xs text-slate-400 mt-1">Bot will attempt to click "Pay with SuperCoins" if available.</p>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },
    
    bindEvents(wrapper) {
        wrapper.querySelector('#save-coupon').addEventListener('click', () => {
            const val = wrapper.querySelector('#global-coupon').value.trim().toUpperCase();
            Store.setState({ globalCoupon: val });
            Utils.showToast("Global discount rule saved securely.", "success");
        });

        wrapper.querySelector('#supercoins-toggle').addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            // Update custom toggle UI
            const bg = e.target.nextElementSibling;
            const dot = e.target.nextElementSibling.nextElementSibling;
            if (isChecked) {
                bg.classList.add('bg-emerald-600');
                dot.classList.add('translate-x-6');
            } else {
                bg.classList.remove('bg-emerald-600');
                dot.classList.remove('translate-x-6');
            }
            
            Store.setState({ useSuperCoins: isChecked });
            Utils.showToast(`SuperCoins globally ${isChecked ? 'enabled' : 'disabled'}.`, "info");
        });
    }
};

/**
 * MODULE 7: REFUND MONITOR
 */
const RefundModule = {
    render() {
        const wrapper = BaseModule.createWrapper();
        const { liveOrders } = Store.getState();
        const refunds = liveOrders.filter(o => o.refund_status && o.refund_status !== 'none');
        
        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl mb-8">
                <div class="p-6 border-b border-white/10 bg-rose-900/20 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-white text-lg flex items-center gap-2">💣 Trigger Return / Cancellation Webhook</h3>
                        <p class="text-xs text-rose-200 mt-1 font-medium">Execute the bot to navigate to an order page and physically click Cancel/Return.</p>
                    </div>
                </div>
                <div class="p-8 bg-black/10">
                    <div class="flex gap-4 max-w-2xl">
                        <input type="text" id="amazon-order-id" placeholder="Amazon Order ID (e.g. 405-1234567-8901234)" class="flex-1 bg-black/50 border border-slate-600 rounded-xl px-5 py-3.5 text-white font-mono outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all">
                        <button id="trigger-refund-btn" class="bg-rose-600 hover:bg-rose-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-rose-600/30 transition-transform hover:-translate-y-0.5">
                            Execute Protocol
                        </button>
                    </div>
                </div>
            </div>

            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <div class="p-6 border-b border-white/10 bg-black/20">
                    <h3 class="font-bold text-white text-lg flex items-center gap-2">📋 Cancellation History Log</h3>
                </div>
                ${refunds.length === 0 ? 
                    `<div class="p-16 text-center text-slate-500 flex flex-col items-center">
                        <span class="text-4xl mb-4 opacity-50">✔️</span>
                        <p class="font-medium">No active return requests logged in the database.</p>
                    </div>` : 
                    `<div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-widest">
                                <tr><th class="p-5 font-semibold">ASIN</th><th class="p-5 font-semibold">Platform</th><th class="p-5 font-semibold">Cloud Status</th></tr>
                            </thead>
                            <tbody class="divide-y divide-white/5 text-sm">
                                ${refunds.map(o => `
                                    <tr class="hover:bg-white/5 transition-colors">
                                        <td class="p-5 text-white font-mono font-medium">${o.asin}</td>
                                        <td class="p-5 text-slate-300 capitalize">${o.platform}</td>
                                        <td class="p-5 font-bold text-rose-400 flex items-center gap-2"><span>⚠️</span> ${o.refund_status.toUpperCase()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`
                }
            </div>
        `;

        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },

    bindEvents(wrapper) {
        wrapper.querySelector('#trigger-refund-btn').addEventListener('click', (e) => {
            const input = wrapper.querySelector('#amazon-order-id');
            const orderId = input.value.trim();
            
            if (!orderId || orderId.length < 15) {
                Utils.showToast("Please enter a strictly valid 17-digit Amazon Order ID.", "error");
                return;
            }

            e.target.innerText = "Executing...";
            e.target.disabled = true;

            document.dispatchEvent(new CustomEvent('TriggerAmazonRefund', { 
                detail: { amazonOrderId: orderId } 
            }));

            Utils.showToast(`Navigating bot directly to Receipt: ${orderId}`, "success");

            setTimeout(() => {
                e.target.innerText = "Execute Protocol";
                e.target.disabled = false;
                input.value = '';
            }, 3000);
        });
    }
};

// ==========================================
// 8. MASTER APPLICATION CONTROLLER
// ==========================================
const AppController = {
    init() {
        Logger.info("Initializing BulkOrderBuddy Enterprise Engine...");
        
        let currentTab = Store.getState().activeTab;

        // Subscribe UI Re-renders to State Changes
        Store.subscribe((state) => {
            // 1. Navigation Event: If user clicked a different tab, ALWAYS render the new screen
            if (state.activeTab !== currentTab) {
                currentTab = state.activeTab;
                this.renderActiveTab();
                return;
            }
            
            // 2. Data Refresh Event: Update data seamlessly without breaking UI inputs
            if (state.activeTab === 'orders') {
                OrderModule.updateTableUI(document);
            } else if (['tracking', 'gst', 'refunds'].includes(state.activeTab)) {
                this.renderActiveTab();
            }
        });

        this.bindGlobalNavigation();
        this.triggerDataRefresh();
        this.startBackgroundPolling();
        
        // Highlight default nav item
        this.updateNavUI('orders');
        this.renderActiveTab();
    },

    bindGlobalNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.dataset.target;
                
                // Prevent unnecessary re-renders if clicking the active tab
                if (Store.getState().activeTab === target) return;
                
                this.updateNavUI(target);
                Store.setState({ activeTab: target });
                Logger.info(`Navigated to module: ${target}`);
            });
        });
    },

    updateNavUI(activeTarget) {
        document.querySelectorAll('.nav-item').forEach(n => {
            n.classList.remove('bg-royal-900', 'text-white', 'shadow-lg');
            n.classList.add('text-royal-800');
        });
        const activeNav = document.querySelector(`[data-target="${activeTarget}"]`);
        if (activeNav) {
            activeNav.classList.add('bg-royal-900', 'text-white', 'shadow-lg');
            activeNav.classList.remove('text-royal-800');
        }
    },

    renderActiveTab() {
        const container = document.getElementById('module-container');
        if (!container) return;
        
        container.innerHTML = '';
        const { activeTab } = Store.getState();
        
        let moduleWrapper;
        switch(activeTab) {
            case 'orders': moduleWrapper = OrderModule.render(); break;
            case 'tracking': moduleWrapper = TrackingModule.render(); break;
            case 'gst': moduleWrapper = GSTModule.render(); break;
            case 'otp': moduleWrapper = OTPModule.render(); break;
            case 'coupons': moduleWrapper = CouponModule.render(); break;
            case 'refunds': moduleWrapper = RefundModule.render(); break;
            case 'wallet': moduleWrapper = WalletModule.render(); break;
            default: moduleWrapper = OrderModule.render();
        }
        
        container.appendChild(moduleWrapper);
    },

    async triggerDataRefresh() {
        const newData = await DatabaseEngine.fetchLiveOrders();
        Store.setState({ liveOrders: newData });
    },

    startBackgroundPolling() {
        const { pollTimer } = Store.getState();
        if (pollTimer) clearInterval(pollTimer);
        
        const newTimer = setInterval(() => {
            const { queue } = Store.getState();
            // Pause polling if the user has an active unsynced queue to prevent UI flickering
            if (queue.length === 0) {
                this.triggerDataRefresh();
            }
        }, CONFIG.POLL_INTERVAL_MS);
        
        Store.setState({ pollTimer: newTimer });
        Logger.info("Background telemetry polling established.");
    },

    async executeCloudSync() {
        const { queue } = Store.getState();
        if (queue.length === 0) return;

        const btn = document.getElementById('execute-sync-btn');
        if (btn) {
            btn.innerHTML = `<span class="animate-pulse">Pushing Data to Supabase Cluster...</span>`;
            btn.disabled = true;
        }

        // FAIL-SAFE: Broadcast exact keys and user ID to Extension immediately prior to sync
        document.dispatchEvent(new CustomEvent('SyncBotCredentials', {
            detail: { 
                url: CONFIG.SUPABASE_URL, 
                key: CONFIG.SUPABASE_ANON_KEY,
                userId: Store.getState().user?.email
            }
        }));

        const success = await DatabaseEngine.pushQueueToCloud(queue);
        
        if (success) {
            Store.setState({ queue: [] });
            this.triggerDataRefresh();
        } else {
            if (btn) {
                btn.innerText = "Synchronization Failed - Click to Retry";
                btn.disabled = false;
                btn.classList.replace('from-emerald-500', 'from-red-500');
                btn.classList.replace('to-emerald-600', 'to-red-600');
            }
        }
    }
};

// ==========================================
// 9. AUTHENTICATION & BOOT SEQUENCE
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    Logger.info("DOM Loaded. Checking session tokens...");
    
    const savedSession = localStorage.getItem('bob_session');
    
    if (savedSession) {
        try {
            const userObj = JSON.parse(savedSession);
            if (userObj.email) {
                Store.setState({ user: userObj });
                bootApplication(true); 
            }
        } catch(e) {
            Logger.error("Corrupted session data.", e);
            localStorage.removeItem('bob_session');
        }
    }

    const loginForm = document.getElementById('custom-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('email').value.trim();
            const btn = document.getElementById('login-submit-btn');
            
            if (!CONFIG.REGEX.EMAIL.test(emailInput)) {
                Utils.showToast("Invalid email format.", "warning");
                return;
            }
            
            btn.innerHTML = `<span class="animate-pulse tracking-wider">Authenticating Database...</span>`;
            btn.disabled = true;

            setTimeout(() => {
                const sessionObj = { email: emailInput, id: 'merchant_' + Date.now() };
                Store.setState({ user: sessionObj });
                localStorage.setItem('bob_session', JSON.stringify(sessionObj));
                
                Utils.showToast("Secure Connection Established.", "success");
                bootApplication(false);
            }, 1200);
        });
    }

    document.getElementById('proceed-to-dashboard-btn')?.addEventListener('click', () => {
        const onboardView = document.getElementById('extension-onboarding-view');
        if (onboardView) {
            onboardView.classList.add('opacity-0');
            setTimeout(() => {
                onboardView.classList.add('hidden');
                onboardView.classList.remove('flex');
                revealDashboard();
            }, 500);
        }
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        if(confirm("Terminate active session?")) {
            localStorage.removeItem('bob_session');
            window.location.reload();
        }
    });
});

function bootApplication(isAutoLogin) {
    const landingView = document.getElementById('landing-view');
    if (landingView) {
        landingView.classList.add('opacity-0');
        setTimeout(() => {
            landingView.classList.add('hidden');
            
            if (isAutoLogin) {
                revealDashboard();
            } else {
                const onboardView = document.getElementById('extension-onboarding-view');
                if (onboardView) {
                    onboardView.classList.remove('hidden');
                    onboardView.classList.add('flex');
                    // Small delay for fade effect
                    setTimeout(() => onboardView.classList.remove('opacity-0'), 50);
                }
            }
        }, 500); // Wait for fade out
    }
}

function revealDashboard() {
    const dbView = document.getElementById('dashboard-view');
    if (dbView) {
        dbView.classList.remove('hidden');
        dbView.classList.add('flex');
        
        // Staggered entrance animation
        setTimeout(() => dbView.classList.remove('opacity-0', 'translate-y-4'), 100);
    }
    
    const { user } = Store.getState();
    const userDisplay = document.getElementById('user-display');
    if (userDisplay && user) {
        userDisplay.innerText = user.email;
    }
    
    // Broadcast multi-tenant key
    document.dispatchEvent(new CustomEvent('SyncBotCredentials', {
        detail: { 
            url: CONFIG.SUPABASE_URL, 
            key: CONFIG.SUPABASE_ANON_KEY,
            userId: user.email 
        }
    }));

    AppController.init();
}