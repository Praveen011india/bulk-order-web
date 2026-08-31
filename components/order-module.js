/**
 * components/order-module.js
 * Handles CSV mass ingestion and the main execution queue data grid.
 */

window.OrderModule = {
    localQueue: [],

    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full flex flex-col gap-8';

        wrapper.innerHTML = `
            <!-- MASS INGESTION ZONE -->
            <div class="glass-panel border-2 border-dashed border-slate-600 hover:border-emerald-500 transition-colors rounded-xl p-10 text-center relative overflow-hidden group">
                <div class="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                <div class="text-4xl mb-4 relative z-10">📦</div>
                <h3 class="text-xl font-bold text-white mb-2 relative z-10">Upload Deployment Manifest</h3>
                <p class="text-slate-400 text-sm mb-6 max-w-md mx-auto relative z-10">
                    Upload a CSV containing hundreds of ASINs. The local agent will process up to 500 orders every 10 minutes[cite: 1].
                </p>
                <input type="file" id="csv-file" accept=".csv" class="block mx-auto text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-6 file:rounded-lg file:border-0 file:font-bold file:bg-emerald-500 file:text-slate-900 hover:file:bg-emerald-400 cursor-pointer transition-colors relative z-10">
            </div>

            <button id="process-btn" class="hidden w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-900 font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all transform hover:-translate-y-1">
                Synchronize Queue to Cloud Database
            </button>

            <!-- ORDER MANAGEMENT GRID -->
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <h3 class="font-bold text-white flex items-center gap-3">
                        <span class="relative flex h-3 w-3">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        Live Execution Tracking
                    </h3>
                </div>
                <div class="overflow-x-auto">
                    <table id="order-table" class="w-full text-left border-collapse">
                        <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                            <tr>
                                <th class="p-4 font-semibold">Target ID (ASIN)</th>
                                <th class="p-4 font-semibold">Platform</th>
                                <th class="p-4 font-semibold">Qty</th>
                                <th class="p-4 font-semibold">Live Status</th>
                            </tr>
                        </thead>
                        <tbody id="table-body" class="divide-y divide-white/5 text-sm">
                            <!-- Dynamic rows injected here -->
                        </tbody>
                    </table>
                    <div id="empty-state" class="p-12 text-center text-slate-500">
                        No active orders in the cloud queue. Upload a manifest to begin.
                    </div>
                </div>
            </div>
        `;

        this.bindEvents(wrapper);
        this.renderLiveTable(wrapper);
        return wrapper;
    },

    bindEvents(wrapper) {
        const fileInput = wrapper.querySelector('#csv-file');
        const processBtn = wrapper.querySelector('#process-btn');

        // CSV File Handling
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const rows = event.target.result.split('\n');
                this.localQueue = [];

                // Parse CSV rows starting from line 1 (skipping header)
                for (let i = 1; i < rows.length; i++) {
                    const columns = rows[i].split(',');
                    const asin = columns[0] ? columns[0].trim() : '';
                    let qty = 1;

                    if (columns.length >= 2 && columns[1].trim() !== '') {
                        const parsedQty = parseInt(columns[1].trim(), 10);
                        if (!isNaN(parsedQty)) qty = parsedQty;
                    }

                    if (asin) {
                        this.localQueue.push({
                            asin: asin,
                            quantity: qty,
                            status: 'pending',
                            platform: asin.startsWith('B') ? 'amazon' : 'flipkart',
                            created_at: new Date().toISOString()
                        });
                    }
                }

                if (this.localQueue.length > 0) {
                    this.renderPreviewTable(wrapper);
                    processBtn.classList.remove('hidden');
                }
            };
            reader.readAsText(file);
        });

        // Sync Queue to Supabase
        processBtn.addEventListener('click', async () => {
            if (this.localQueue.length === 0) return;

            processBtn.innerHTML = `<span class="animate-pulse">Synchronizing to Database...</span>`;
            processBtn.disabled = true;

            const success = await window.SupabaseEngine.pushQueueToDatabase(this.localQueue);

            if (success) {
                if (window.UI) window.UI.showToast("Successfully synchronized to cloud database!", "success");
                this.localQueue = [];
                processBtn.classList.add('hidden');
                processBtn.disabled = false;
                processBtn.innerText = "Synchronize Queue to Cloud Database";
                
                // Trigger a global app state refresh
                if (window.DatabaseEngine) window.DatabaseEngine.startLivePolling();
            } else {
                if (window.UI) window.UI.showToast("Sync Failed. Check console.", "error");
                processBtn.innerText = "Retry Synchronization";
                processBtn.disabled = false;
            }
        });
    },

    renderPreviewTable(wrapper) {
        const tbody = wrapper.querySelector('#table-body');
        const emptyState = wrapper.querySelector('#empty-state');
        
        emptyState.style.display = 'none';
        tbody.innerHTML = '';

        this.localQueue.forEach(item => {
            tbody.innerHTML += `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-4 text-white font-mono">${item.asin}</td>
                    <td class="p-4 text-slate-300 capitalize">${item.platform}</td>
                    <td class="p-4 text-slate-300">${item.quantity}</td>
                    <td class="p-4 text-blue-400 font-bold tracking-wider text-xs">
                        <span class="bg-blue-900/40 px-3 py-1 rounded-full border border-blue-500/30">PENDING UPLOAD</span>
                    </td>
                </tr>
            `;
        });
    },

    renderLiveTable(wrapper) {
        // Only run if the user hasn't loaded a local CSV pending upload
        if (this.localQueue.length > 0) return;

        const tbody = wrapper.querySelector('#table-body');
        const emptyState = wrapper.querySelector('#empty-state');
        const liveData = window.AppState ? window.AppState.liveData : [];

        if (liveData.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        tbody.innerHTML = '';

        liveData.forEach(order => {
            let bgStyle = 'bg-slate-800/40 border-slate-500/30 text-slate-400';
            const status = (order.status || 'pending').toLowerCase();
            
            if (status === 'completed') bgStyle = 'bg-emerald-900/40 border-emerald-500/30 text-emerald-400';
            if (status === 'pending') bgStyle = 'bg-amber-900/40 border-amber-500/30 text-amber-400';
            if (status === 'running') bgStyle = 'bg-blue-900/40 border-blue-500/30 text-blue-400';
            if (status === 'error') bgStyle = 'bg-red-900/40 border-red-500/30 text-red-400';
            if (status === 'otp_required') bgStyle = 'bg-purple-900/40 border-purple-500/30 text-purple-400';

            tbody.innerHTML += `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5">
                    <td class="p-4 text-white font-mono">${order.asin}</td>
                    <td class="p-4 text-slate-300 capitalize">${order.platform || 'Amazon'}</td>
                    <td class="p-4 text-slate-300">${order.quantity}</td>
                    <td class="p-4 font-bold tracking-wider text-xs">
                        <span class="${bgStyle} px-3 py-1 rounded-full border">${status.toUpperCase().replace('_', ' ')}</span>
                    </td>
                </tr>
            `;
        });
    }
};