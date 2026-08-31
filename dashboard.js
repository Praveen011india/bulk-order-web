const SUPABASE_URL = 'https://kjcvmchftyeiccfpiemd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY3ZtY2hmdHllaWNjZnBpZW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTM2MjcsImV4cCI6MjEwMzU4OTYyN30.m4wUParS14xU7FnAU3y-Eqtxjyvd3rNKFFrP0EL_Chk';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AppState = {
    queue: [],
    liveOrders: [],
    pollInterval: null
};

window.addEventListener('load', async () => {
    await window.Clerk.load();

    document.querySelectorAll('.demo-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('demo-modal').classList.remove('hidden');
        });
    });

    if (window.Clerk.user) {
        document.getElementById('landing-view').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
        document.getElementById('dashboard-view').classList.add('flex');
        window.Clerk.mountUserButton(document.getElementById('user-button'));
        
        AppController.init();
    } else {
        window.Clerk.mountSignIn(document.getElementById('auth-container'));
    }
});

const AppController = {
    init() {
        this.renderModule();
        this.startLiveSync();
    },

    async startLiveSync() {
        await this.fetchRealOrders();
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => this.fetchRealOrders(), 3000);
    },

    async fetchRealOrders() {
        const { data, error } = await _supabase
            .from('bulk_orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error) {
            AppState.liveOrders = data || [];
            if (AppState.queue.length === 0) this.renderLiveTable();
        }
    },

    async syncDatabase() {
        if (AppState.queue.length === 0) return;
        const btn = document.getElementById('process-btn');
        btn.innerText = "Syncing to Database...";
        btn.disabled = true;

        // FIXED: Pushing only ASIN, quantity, and status to match your exact Supabase schema
        const { error } = await _supabase.from('bulk_orders').insert(AppState.queue);

        if (error) {
            alert("Database write failed: " + error.message);
            btn.innerText = "Retry Synchronization";
            btn.disabled = false;
        } else {
            AppState.queue = [];
            btn.classList.add('hidden');
            await this.fetchRealOrders();
        }
    },

    renderModule() {
        const container = document.getElementById('module-container');
        container.innerHTML = `
            <div class="glass-card border-2 border-dashed border-white/20 hover:border-gold-500/50 p-12 text-center rounded-2xl mb-8">
                <h3 class="font-bold text-xl text-white mb-2">Upload Deployment Manifest</h3>
                <p class="text-slate-400 text-sm mb-6">Format: ASIN, Quantity</p>
                <input type="file" id="csv-file" accept=".csv" class="mx-auto block text-slate-400 file:bg-gold-500 file:rounded file:border-0 file:px-4 file:py-2 file:text-royal-900 file:font-bold cursor-pointer">
            </div>
            <button id="process-btn" class="hidden w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-4 rounded-xl mb-12">Synchronize Orders to Cloud Database</button>
            
            <div class="glass-card rounded-2xl overflow-hidden border border-white/10">
                <div class="p-6 border-b border-white/10 bg-black/20 text-white font-bold">Live Fleet Tracking</div>
                <table class="w-full text-left text-sm text-slate-300">
                    <thead class="bg-black/40 text-gold-400 uppercase">
                        <tr><th class="p-4">ASIN</th><th class="p-4">Qty</th><th class="p-4">Status</th></tr>
                    </thead>
                    <tbody id="table-body" class="divide-y divide-white/5"></tbody>
                </table>
            </div>
        `;

        document.getElementById('csv-file').addEventListener('change', (e) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const rows = event.target.result.split('\n');
                AppState.queue = [];
                for (let i = 1; i < rows.length; i++) {
                    const cols = rows[i].split(',');
                    const asin = cols[0] ? cols[0].trim() : '';
                    
                    // FIXED: Removed the invalid "platform" key causing the crash
                    if (asin) {
                        AppState.queue.push({ 
                            asin: asin, 
                            quantity: parseInt(cols[1]) || 1, 
                            status: 'pending' 
                        });
                    }
                }
                if (AppState.queue.length > 0) {
                    document.getElementById('process-btn').classList.remove('hidden');
                    this.renderLiveTable();
                }
            };
            if (e.target.files[0]) reader.readAsText(e.target.files[0]);
        });

        document.getElementById('process-btn').addEventListener('click', () => this.syncDatabase());
    },

    renderLiveTable() {
        const tbody = document.getElementById('table-body');
        const data = AppState.queue.length > 0 ? AppState.queue : AppState.liveOrders;
        
        tbody.innerHTML = data.map(order => {
            let color = order.status === 'completed' ? 'text-emerald-400' : order.status === 'running' ? 'text-blue-400' : 'text-amber-400';
            return `<tr class="hover:bg-white/5"><td class="p-4 text-white">${order.asin}</td><td class="p-4">${order.quantity}</td><td class="p-4 font-bold ${color}">${order.status.toUpperCase()}</td></tr>`;
        }).join('');
    }
};