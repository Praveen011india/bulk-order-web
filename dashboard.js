/**
 * ============================================================================
 * ADVANCED BULK ORDERING AUTOMATION ENGINE (v2.0.0)
 * Features: High-Speed Concurrency, Multi-Platform (Amazon, Flipkart, Shopsy),
 * GST Integration, OTP Management, Refund Tracking, SuperCoins/Coupons, Analytics.
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. CONFIGURATION & CONSTANTS
// ----------------------------------------------------------------------------
const CONFIG = {
    SUPABASE_URL: 'https://kjcvmchftyeiccfpiemd.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY3ZtY2hmdHllaWNjZnBpZW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTM2MjcsImV4cCI6MjEwMzU4OTYyN30.m4wUParS14xU7FnAU3y-Eqtxjyvd3rNKFFrP0EL_Chk',
    APP_NAME: 'OmniOrder Automator Pro',
    MAX_CONCURRENT_TASKS: 10, // High-speed automation (500 orders / 10 mins = ~0.8 orders/sec)
    POLLING_INTERVAL_MS: 5000,
    PLATFORMS: {
        AMAZON: 'amazon',
        FLIPKART: 'flipkart',
        SHOPSY: 'shopsy'
    },
    ORDER_STATUS: {
        PENDING: 'pending',
        QUEUED: 'queued',
        PROCESSING: 'processing',
        PLACED: 'placed',
        SHIPPED: 'shipped',
        DELIVERED: 'delivered',
        FAILED: 'failed',
        REFUND_REQUESTED: 'refund_requested',
        REFUNDED: 'refunded'
    }
};

// ----------------------------------------------------------------------------
// 2. CSS INJECTION (Dynamic UI Styling)
// ----------------------------------------------------------------------------
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --bg-dark: #0f172a; --bg-card: #1e293b; --text-main: #f8fafc; --text-muted: #94a3b8;
            --primary: #3b82f6; --primary-hover: #2563eb; --success: #10b981; --warning: #f59e0b; --danger: #ef4444;
            --border: #334155; --flipkart: #2874f0; --amazon: #ff9900;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', system-ui, sans-serif; }
        body { background-color: var(--bg-dark); color: var(--text-main); line-height: 1.5; }
        .app-container { display: flex; height: 100vh; overflow: hidden; }
        
        /* Sidebar */
        .sidebar { width: 260px; background: var(--bg-card); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .sidebar-header { padding: 20px; font-size: 1.25rem; font-weight: bold; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
        .nav-menu { flex: 1; padding: 10px 0; list-style: none; }
        .nav-item { padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; color: var(--text-muted); transition: all 0.2s; }
        .nav-item:hover, .nav-item.active { background: rgba(59, 130, 246, 0.1); color: var(--primary); border-right: 3px solid var(--primary); }
        
        /* Main Content */
        .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .topbar { height: 60px; background: var(--bg-card); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; padding: 0 20px; }
        .dashboard-area { flex: 1; padding: 24px; overflow-y: auto; }
        
        /* Cards & Grid */
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 24px; }
        .stat-card { background: var(--bg-card); padding: 20px; border-radius: 8px; border: 1px solid var(--border); }
        .stat-value { font-size: 2rem; font-weight: bold; margin-top: 8px; }
        
        /* Tables */
        .table-container { background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border); overflow-x: auto; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th, td { padding: 12px 16px; border-bottom: 1px solid var(--border); white-space: nowrap; }
        th { background: rgba(255,255,255,0.02); color: var(--text-muted); font-weight: 600; font-size: 0.875rem; text-transform: uppercase; }
        tr:hover td { background: rgba(255,255,255,0.02); }
        
        /* Badges */
        .badge { padding: 4px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
        .badge.success { background: rgba(16, 185, 129, 0.2); color: var(--success); }
        .badge.warning { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
        .badge.danger { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
        .badge.info { background: rgba(59, 130, 246, 0.2); color: var(--primary); }
        .badge.flipkart { background: rgba(40, 116, 240, 0.2); color: var(--flipkart); }
        .badge.amazon { background: rgba(255, 153, 0, 0.2); color: var(--amazon); }
        
        /* Controls */
        .controls-bar { display: flex; gap: 12px; margin-bottom: 20px; align-items: center; background: var(--bg-card); padding: 16px; border-radius: 8px; border: 1px solid var(--border); }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s; color: white; display: inline-flex; align-items: center; gap: 8px; }
        .btn-primary { background: var(--primary); }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-success { background: var(--success); }
        .btn-danger { background: var(--danger); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .input-file { display: none; }
        .file-label { padding: 8px 16px; background: var(--border); border-radius: 6px; cursor: pointer; font-weight: 600; display: inline-block; transition: 0.2s; }
        .file-label:hover { background: #475569; }
        
        /* Toasts */
        #toast-container { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 10px; z-index: 9999; }
        .toast { padding: 12px 20px; border-radius: 6px; background: var(--bg-card); border-left: 4px solid var(--primary); box-shadow: 0 4px 6px rgba(0,0,0,0.3); animation: slideIn 0.3s ease forwards; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        
        /* Logs Terminal */
        .terminal { background: #000; color: #0f0; font-family: monospace; padding: 16px; border-radius: 8px; height: 300px; overflow-y: auto; border: 1px solid var(--border); }
        .log-line { margin-bottom: 4px; border-bottom: 1px solid #111; padding-bottom: 2px; }
        .log-time { color: #888; margin-right: 8px; }
        .log-error { color: #f00; }
        .log-warn { color: #ff0; }
        
        /* Loader */
        .spinner { width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s ease-in-out infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
};

// ----------------------------------------------------------------------------
// 3. UTILITIES & LOGGING
// ----------------------------------------------------------------------------
class Logger {
    constructor() { this.logs = []; }
    _log(level, msg, data = null) {
        const time = new Date().toLocaleTimeString();
        const entry = { level, msg, data, time };
        this.logs.push(entry);
        console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[${time}] ${msg}`, data || '');
        this._renderToTerminal(entry);
    }
    info(msg, data) { this._log('info', msg, data); }
    warn(msg, data) { this._log('warn', msg, data); }
    error(msg, data) { this._log('error', msg, data); }
    success(msg, data) { this._log('info', `✅ ${msg}`, data); }
    
    _renderToTerminal(entry) {
        const terminal = document.getElementById('log-terminal');
        if (!terminal) return;
        const div = document.createElement('div');
        div.className = `log-line log-${entry.level}`;
        div.innerHTML = `<span class="log-time">[${entry.time}]</span> ${entry.msg}`;
        terminal.appendChild(div);
        terminal.scrollTop = terminal.scrollHeight;
    }
}
const logger = new Logger();

const Toast = {
    show: (msg, type = 'info') => {
        const container = document.getElementById('toast-container') || (function() {
            const c = document.createElement('div');
            c.id = 'toast-container';
            document.body.appendChild(c);
            return c;
        })();
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.borderLeftColor = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)';
        toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

// ----------------------------------------------------------------------------
// 4. DATA MODELS
// ----------------------------------------------------------------------------
class OrderModel {
    constructor(data) {
        this.id = data.id || generateId();
        this.productId = data.productId || '';
        this.platform = (data.platform || CONFIG.PLATFORMS.AMAZON).toLowerCase();
        this.quantity = parseInt(data.quantity) || 1;
        this.status = data.status || CONFIG.ORDER_STATUS.PENDING;
        
        // Advanced Features Data
        this.coupons = {
            useSuperCoins: data.useSuperCoins === 'true' || data.useSuperCoins === true,
            promoCode: data.promoCode || '',
            giftCardBalance: parseFloat(data.giftCardBalance) || 0.0
        };
        
        this.gst = {
            gstin: data.gstin || '',
            businessName: data.businessName || '',
            claimGST: !!data.gstin
        };
        
        this.tracking = {
            courierName: data.courierName || '',
            awb: data.awb || '',
            deliveryOTP: data.deliveryOTP || '', // Extremely important for high-value Flipkart orders
            estimatedDelivery: data.estimatedDelivery || null
        };
        
        this.financials = {
            totalAmount: parseFloat(data.totalAmount) || 0.0,
            refundStatus: data.refundStatus || 'none',
            refundAmount: parseFloat(data.refundAmount) || 0.0
        };
        
        this.metadata = {
            buyerAccountId: data.buyerAccountId || '',
            shippingAddressId: data.shippingAddressId || '',
            createdAt: data.createdAt || new Date().toISOString()
        };
    }

    toDBFormat() {
        return {
            product_id: this.productId,
            platform: this.platform,
            quantity: this.quantity,
            status: this.status,
            use_super_coins: this.coupons.useSuperCoins,
            promo_code: this.coupons.promoCode,
            gstin: this.gst.gstin,
            business_name: this.gst.businessName,
            delivery_otp: this.tracking.deliveryOTP,
            awb: this.tracking.awb,
            refund_status: this.financials.refundStatus,
            created_at: this.metadata.createdAt
        };
    }
}

// ----------------------------------------------------------------------------
// 5. DATABASE API (Supabase Wrapper)
// ----------------------------------------------------------------------------
class DatabaseService {
    constructor() {
        if (!window.supabase) throw new Error("Supabase SDK not found globally.");
        this.client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        this.table = 'bulk_orders';
    }

    async insertBatch(ordersArray) {
        try {
            const dbPayload = ordersArray.map(o => o.toDBFormat());
            const { data, error } = await this.client.from(this.table).insert(dbPayload).select();
            if (error) throw error;
            return data;
        } catch (error) {
            logger.error(`Database Insert Error: ${error.message}`);
            throw error;
        }
    }

    async fetchAll(limit = 1000) {
        try {
            const { data, error } = await this.client
                .from(this.table)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return data;
        } catch (error) {
            logger.error(`Database Fetch Error: ${error.message}`);
            return [];
        }
    }

    async updateStatus(id, newStatus, additionalData = {}) {
        try {
            const payload = { status: newStatus, ...additionalData };
            const { data, error } = await this.client.from(this.table).update(payload).eq('id', id);
            if (error) throw error;
            return data;
        } catch (error) {
            logger.error(`Database Update Error for ID ${id}: ${error.message}`);
        }
    }
}

// ----------------------------------------------------------------------------
// 6. CORE AUTOMATION ENGINE (The "Bot")
// ----------------------------------------------------------------------------
class AutomationEngine {
    constructor(dbService) {
        this.db = dbService;
        this.queue = [];
        this.activeWorkers = 0;
        this.isRunning = false;
        this.stats = { processed: 0, success: 0, failed: 0 };
    }

    loadQueue(ordersArray) {
        this.queue = [...this.queue, ...ordersArray];
        logger.info(`Loaded ${ordersArray.length} orders into the automation engine.`);
        AppUI.updateDashboardStats();
    }

    async start() {
        if (this.isRunning) return;
        if (this.queue.length === 0) {
            Toast.show('Queue is empty. Upload CSV first.', 'warning');
            return;
        }
        
        this.isRunning = true;
        logger.success('High-Speed Automation Engine Started.');
        AppUI.toggleEngineState(true);
        
        // Spawn workers based on max concurrency config (simulates high speed)
        for (let i = 0; i < CONFIG.MAX_CONCURRENT_TASKS; i++) {
            this._workerLoop(i);
        }
    }

    stop() {
        this.isRunning = false;
        logger.warn('Automation Engine Stopped.');
        AppUI.toggleEngineState(false);
    }

    async _workerLoop(workerId) {
        while (this.isRunning && this.queue.length > 0) {
            this.activeWorkers++;
            const order = this.queue.shift(); // Dequeue
            order.status = CONFIG.ORDER_STATUS.PROCESSING;
            AppUI.renderTables(); // Update UI
            
            try {
                await this._simulateOrderPlacement(order, workerId);
                order.status = CONFIG.ORDER_STATUS.PLACED;
                this.stats.success++;
                this.stats.processed++;
                logger.success(`[W-${workerId}] Successfully placed order for ${order.productId} on ${order.platform}`);
                
                // Real implementation would sync status back to DB here:
                // await this.db.updateStatus(order.id, order.status, { delivery_otp: order.tracking.deliveryOTP });

            } catch (error) {
                order.status = CONFIG.ORDER_STATUS.FAILED;
                this.stats.failed++;
                this.stats.processed++;
                logger.error(`[W-${workerId}] Failed to place order ${order.productId}: ${error.message}`);
            }
            
            this.activeWorkers--;
            AppUI.updateDashboardStats();
            AppUI.renderTables();
            
            // Artificial delay to prevent API rate limiting (simulating realistic bot interactions)
            await new Promise(res => setTimeout(res, 800 + Math.random() * 1000));
        }

        if (this.queue.length === 0 && this.activeWorkers === 0) {
            this.stop();
            Toast.show('All orders in queue processed!', 'success');
        }
    }

    // This simulates the complex headless browser / API interactions
    async _simulateOrderPlacement(order, workerId) {
        logger.info(`[W-${workerId}] Initiating checkout for ${order.productId}...`);
        
        // Simulate Network Latency
        await new Promise(res => setTimeout(res, 1500));
        
        // Simulate Platform Specific Logic
        if (order.platform === CONFIG.PLATFORMS.FLIPKART || order.platform === CONFIG.PLATFORMS.SHOPSY) {
            logger.info(`[W-${workerId}] Applying SuperCoins logic for Flipkart ecosystem...`);
            if (order.coupons.useSuperCoins) {
                await new Promise(res => setTimeout(res, 500));
                logger.info(`[W-${workerId}] Deducted SuperCoins.`);
            }
            // Generate mock Delivery OTP
            order.tracking.deliveryOTP = Math.floor(100000 + Math.random() * 900000).toString();
            logger.info(`[W-${workerId}] Fetched Delivery OTP: ${order.tracking.deliveryOTP}`);
        }
        
        if (order.gst.claimGST) {
            logger.info(`[W-${workerId}] Applying GSTIN: ${order.gst.gstin} for B2B invoice.`);
            await new Promise(res => setTimeout(res, 400));
        }

        // Simulate random failure (5% chance)
        if (Math.random() < 0.05) {
            throw new Error("Payment Gateway Timeout or Captcha Blocked");
        }
        
        return true;
    }
}

// ----------------------------------------------------------------------------
// 7. CSV PARSER (Advanced Data Extraction)
// ----------------------------------------------------------------------------
class CSVProcessor {
    static async parse(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const rows = text.split('\n').map(r => r.trim()).filter(r => r);
                    if (rows.length < 2) throw new Error("CSV is empty or missing headers.");
                    
                    const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
                    const parsedOrders = [];
                    
                    for (let i = 1; i < rows.length; i++) {
                        const cols = rows[i].split(',').map(c => c.trim());
                        
                        // Map CSV columns dynamically based on header names
                        const getVal = (key) => {
                            const idx = headers.findIndex(h => h.includes(key));
                            return idx !== -1 ? cols[idx] : null;
                        };

                        const orderData = {
                            productId: getVal('asin') || getVal('product_id') || getVal('id'),
                            quantity: getVal('qty') || getVal('quantity') || 1,
                            platform: getVal('platform') || CONFIG.PLATFORMS.AMAZON,
                            useSuperCoins: getVal('supercoin') || getVal('super_coins') || false,
                            promoCode: getVal('promo') || getVal('coupon') || '',
                            gstin: getVal('gstin') || getVal('gst') || '',
                            businessName: getVal('business') || ''
                        };

                        if (orderData.productId) {
                            parsedOrders.push(new OrderModel(orderData));
                        }
                    }
                    resolve(parsedOrders);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("Failed to read file."));
            reader.readAsText(file);
        });
    }

    static generateExportCSV(orders) {
        const headers = ["ID", "ProductID", "Platform", "Quantity", "Status", "GSTIN", "DeliveryOTP", "RefundStatus"];
        const rows = orders.map(o => [
            o.id, o.productId, o.platform, o.quantity, o.status, 
            o.gst.gstin, o.tracking.deliveryOTP, o.financials.refundStatus
        ].join(','));
        return [headers.join(','), ...rows].join('\n');
    }
    
    static downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }
}

// ----------------------------------------------------------------------------
// 8. UI MANAGER (DOM Generation & View Handling)
// ----------------------------------------------------------------------------
class UIController {
    constructor(engine, db) {
        this.engine = engine;
        this.db = db;
        this.currentView = 'dashboard';
        this.masterData = [];
    }

    init() {
        document.body.innerHTML = '';
        const app = document.createElement('div');
        app.className = 'app-container';
        
        // Build Sidebar
        const sidebar = document.createElement('aside');
        sidebar.className = 'sidebar';
        sidebar.innerHTML = `
            <div class="sidebar-header">
                🤖 <span>OmniOrder Pro</span>
            </div>
            <ul class="nav-menu">
                <li class="nav-item active" data-view="dashboard">📊 Dashboard & Queue</li>
                <li class="nav-item" data-view="tracking">🚚 Tracking & OTPs</li>
                <li class="nav-item" data-view="refunds">💰 Refunds & GST</li>
                <li class="nav-item" data-view="logs">📜 System Logs</li>
            </ul>
        `;

        // Build Main Content Area
        const main = document.createElement('main');
        main.className = 'main-content';
        main.innerHTML = `
            <header class="topbar">
                <div id="auth-container"></div>
                <div id="user-button"></div>
            </header>
            <div class="dashboard-area" id="view-container">
                <!-- Views Injected Here -->
            </div>
        `;

        app.appendChild(sidebar);
        app.appendChild(main);
        document.body.appendChild(app);

        this.bindNavEvents();
        this.renderView();
    }

    bindNavEvents() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentView = e.currentTarget.getAttribute('data-view');
                this.renderView();
            });
        });
    }

    renderView() {
        const container = document.getElementById('view-container');
        container.innerHTML = ''; // Clear current

        if (this.currentView === 'dashboard') {
            container.innerHTML = `
                <div class="grid-cards">
                    <div class="stat-card">
                        <div style="color: var(--text-muted)">Total in Queue</div>
                        <div class="stat-value" id="stat-queued">0</div>
                    </div>
                    <div class="stat-card">
                        <div style="color: var(--text-muted)">Successfully Placed</div>
                        <div class="stat-value" style="color: var(--success)" id="stat-success">0</div>
                    </div>
                    <div class="stat-card">
                        <div style="color: var(--text-muted)">Failed Orders</div>
                        <div class="stat-value" style="color: var(--danger)" id="stat-failed">0</div>
                    </div>
                </div>

                <div class="controls-bar">
                    <label class="file-label">
                        📄 Upload CSV
                        <input type="file" id="csv-upload" class="input-file" accept=".csv" />
                    </label>
                    <button class="btn btn-primary" id="btn-sync-db">☁️ Sync to DB</button>
                    <button class="btn btn-success" id="btn-start-engine">⚡ Start Auto-Engine</button>
                    <button class="btn btn-danger" id="btn-stop-engine" style="display:none;">🛑 Stop Engine</button>
                    <button class="btn" style="background:#475569" id="btn-export">📥 Export Data</button>
                </div>

                <div class="table-container">
                    <table id="main-table">
                        <thead>
                            <tr>
                                <th>Platform</th>
                                <th>Product ID</th>
                                <th>Qty</th>
                                <th>SuperCoins/Promo</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="main-tbody">
                            <tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No orders in queue. Upload a CSV to begin.</td></tr>
                        </tbody>
                    </table>
                </div>
            `;
            this.bindDashboardEvents();
            this.renderTables(); // Re-render table data if exists
            this.updateDashboardStats();

        } else if (this.currentView === 'tracking') {
            container.innerHTML = `
                <h2>🚚 Tracking & Delivery OTPs</h2>
                <p style="color: var(--text-muted); margin-bottom: 20px;">Manage fulfillment, AWB tracking, and high-value delivery OTPs required by Flipkart/Shopsy.</p>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Product ID</th>
                                <th>Platform</th>
                                <th>AWB Tracking</th>
                                <th>Delivery OTP</th>
                                <th>Fulfillment Status</th>
                            </tr>
                        </thead>
                        <tbody id="tracking-tbody"></tbody>
                    </table>
                </div>
            `;
            this.renderTrackingTable();

        } else if (this.currentView === 'refunds') {
             container.innerHTML = `
                <h2>💰 Refunds & GST Insights</h2>
                <div class="table-container" style="margin-top:20px;">
                    <table>
                        <thead>
                            <tr>
                                <th>Product ID</th>
                                <th>GSTIN Used</th>
                                <th>B2B Business Name</th>
                                <th>Refund Status</th>
                                <th>Refund Amount</th>
                            </tr>
                        </thead>
                        <tbody id="financials-tbody"></tbody>
                    </table>
                </div>
            `;
            this.renderFinancialsTable();

        } else if (this.currentView === 'logs') {
            container.innerHTML = `
                <h2>📜 Engine Telemetry & Logs</h2>
                <div class="terminal" id="log-terminal" style="margin-top: 20px;"></div>
            `;
            // Re-render old logs
            const term = document.getElementById('log-terminal');
            logger.logs.forEach(entry => {
                const div = document.createElement('div');
                div.className = `log-line log-${entry.level}`;
                div.innerHTML = `<span class="log-time">[${entry.time}]</span> ${entry.msg}`;
                term.appendChild(div);
            });
            term.scrollTop = term.scrollHeight;
        }
    }

    bindDashboardEvents() {
        const uploadInput = document.getElementById('csv-upload');
        if(uploadInput) {
            uploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const parsed = await CSVProcessor.parse(file);
                    this.engine.loadQueue(parsed);
                    Toast.show(`Successfully loaded ${parsed.length} orders from CSV`, 'success');
                    e.target.value = ''; // Reset
                } catch (err) {
                    Toast.show(err.message, 'error');
                }
            });
        }

        const startBtn = document.getElementById('btn-start-engine');
        if(startBtn) startBtn.addEventListener('click', () => this.engine.start());

        const stopBtn = document.getElementById('btn-stop-engine');
        if(stopBtn) stopBtn.addEventListener('click', () => this.engine.stop());

        const syncBtn = document.getElementById('btn-sync-db');
        if(syncBtn) {
            syncBtn.addEventListener('click', async () => {
                if (this.engine.queue.length === 0) {
                    return Toast.show('Queue is empty.', 'warning');
                }
                syncBtn.innerHTML = '<div class="spinner"></div> Syncing...';
                syncBtn.disabled = true;
                try {
                    await this.db.insertBatch(this.engine.queue);
                    Toast.show('Successfully synced to Supabase!', 'success');
                } catch (err) {
                    Toast.show('Database sync failed.', 'error');
                } finally {
                    syncBtn.innerHTML = '☁️ Sync to DB';
                    syncBtn.disabled = false;
                }
            });
        }

        const exportBtn = document.getElementById('btn-export');
        if(exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = [...this.engine.queue]; // Combine queue and historical here if needed
                if(data.length === 0) return Toast.show('No data to export', 'warning');
                const csv = CSVProcessor.generateExportCSV(data);
                CSVProcessor.downloadCSV(csv, `OmniOrder_Export_${new Date().getTime()}.csv`);
            });
        }
    }

    renderTables() {
        const tbody = document.getElementById('main-tbody');
        if (!tbody) return;
        
        if (this.engine.queue.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No orders in queue.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        // Only render top 50 to avoid DOM lag during high-speed ops
        const displayList = this.engine.queue.slice(0, 50); 
        
        displayList.forEach(order => {
            const tr = document.createElement('tr');
            
            let platBadge = `badge ${order.platform}`;
            let statusBadge = 'badge ';
            if(order.status === 'placed') statusBadge += 'success';
            else if(order.status === 'failed') statusBadge += 'danger';
            else if(order.status === 'processing') statusBadge += 'warning';
            else statusBadge += 'info';

            let couponText = '-';
            if (order.coupons.useSuperCoins) couponText = '🪙 SuperCoins';
            if (order.coupons.promoCode) couponText += ` 🎟️ ${order.coupons.promoCode}`;

            tr.innerHTML = `
                <td><span class="${platBadge}">${order.platform}</span></td>
                <td style="font-family: monospace;">${order.productId}</td>
                <td>${order.quantity}</td>
                <td>${couponText}</td>
                <td><span class="${statusBadge}">${order.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderTrackingTable() {
        const tbody = document.getElementById('tracking-tbody');
        if (!tbody) return;
        
        const validOrders = this.engine.queue.filter(o => o.status === 'placed' || o.status === 'shipped');
        if(validOrders.length === 0) {
             tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No processed orders to track yet.</td></tr>';
             return;
        }

        tbody.innerHTML = '';
        validOrders.forEach(order => {
            const tr = document.createElement('tr');
            const otpDisplay = order.tracking.deliveryOTP ? 
                `<span style="color:var(--danger); font-weight:bold; letter-spacing: 2px;">${order.tracking.deliveryOTP}</span>` : 
                '<span style="color:var(--text-muted)">N/A</span>';

            tr.innerHTML = `
                <td style="font-family: monospace;">${order.productId}</td>
                <td><span class="badge ${order.platform}">${order.platform}</span></td>
                <td>${order.tracking.awb || 'Awaiting Dispatch...'}</td>
                <td>${otpDisplay}</td>
                <td>${order.status.toUpperCase()}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderFinancialsTable() {
         const tbody = document.getElementById('financials-tbody');
        if (!tbody) return;
        
        if(this.engine.queue.length === 0) {
             tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No financial data available.</td></tr>';
             return;
        }

        tbody.innerHTML = '';
        this.engine.queue.forEach(order => {
            const tr = document.createElement('tr');
            const hasGst = order.gst.claimGST ? '✅ Yes' : '❌ No';
            tr.innerHTML = `
                <td style="font-family: monospace;">${order.productId}</td>
                <td>${hasGst} <br><small style="color:var(--text-muted)">${order.gst.gstin}</small></td>
                <td>${order.gst.businessName || '-'}</td>
                <td><span class="badge ${order.financials.refundStatus === 'none' ? 'info' : 'warning'}">${order.financials.refundStatus}</span></td>
                <td>₹${order.financials.refundAmount.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    updateDashboardStats() {
        const elQ = document.getElementById('stat-queued');
        const elS = document.getElementById('stat-success');
        const elF = document.getElementById('stat-failed');
        
        if(elQ) elQ.innerText = this.engine.queue.length;
        if(elS) elS.innerText = this.engine.stats.success;
        if(elF) elF.innerText = this.engine.stats.failed;
    }

    toggleEngineState(isRunning) {
        const startBtn = document.getElementById('btn-start-engine');
        const stopBtn = document.getElementById('btn-stop-engine');
        if(startBtn && stopBtn) {
            startBtn.style.display = isRunning ? 'none' : 'inline-flex';
            stopBtn.style.display = isRunning ? 'inline-flex' : 'none';
        }
    }
}

// ----------------------------------------------------------------------------
// 9. AUTHENTICATION (Clerk Wrapper)
// ----------------------------------------------------------------------------
class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.user = null;
    }

    async initClerk() {
        try {
            if (!window.Clerk) {
                logger.warn("Clerk script not loaded. Running in unauthenticated developer mode.");
                this.isAuthenticated = true; // Fallback for local testing if script fails
                return true;
            }

            await window.Clerk.load();
            if (window.Clerk.user) {
                this.isAuthenticated = true;
                this.user = window.Clerk.user;
                const authContainer = document.getElementById('auth-container');
                if(authContainer) authContainer.style.display = 'none';
                
                const userBtn = document.getElementById('user-button');
                if(userBtn) window.Clerk.mountUserButton(userBtn);
                
                logger.success(`Authenticated as ${this.user.primaryEmailAddress.emailAddress}`);
                return true;
            } else {
                const authContainer = document.getElementById('auth-container');
                if(authContainer) window.Clerk.mountSignIn(authContainer);
                return false;
            }
        } catch (error) {
            logger.error(`Auth Initialization Failed: ${error.message}`);
            return false;
        }
    }
}

// ----------------------------------------------------------------------------
// 10. APPLICATION BOOTSTRAPPER
// ----------------------------------------------------------------------------
const App = {
    async start() {
        console.log("🚀 Bootstrapping OmniOrder Automator Pro...");
        injectStyles();
        
        // Initialize Core Services
        const db = new DatabaseService();
        const engine = new AutomationEngine(db);
        const ui = new UIController(engine, db);
        const auth = new AuthManager();

        // Build Initial Base UI (Pre-Auth)
        ui.init(); 

        // Wait for Clerk Auth
        const isAuthed = await auth.initClerk();
        if (!isAuthed) {
            document.getElementById('view-container').innerHTML = `
                <div style="display:flex; height:100%; align-items:center; justify-content:center; flex-direction:column;">
                    <h2>Authentication Required</h2>
                    <p style="color:var(--text-muted); margin-top:10px;">Please sign in using the widget above to access the automation dashboard.</p>
                </div>
            `;
            return;
        }

        // Live Polling Mechanism (Optional: fetches external additions to DB)
        setInterval(async () => {
            if (engine.isRunning) return; // Don't poll while actively placing orders to save DB reads
            try {
                // Fetch recent remote updates if needed
                // const remoteData = await db.fetchAll(50);
                // Sync local state if required
            } catch (e) {}
        }, CONFIG.POLLING_INTERVAL_MS);
        
        logger.info("Application successfully initialized and ready.");
    }
};

// Start application on DOM Load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.start);
} else {
    App.start();
}