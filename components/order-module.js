/**
 * components/order-module.js
 * Handles mass CSV ingestion, AI-powered URL resolution, and real-time live data rendering.
 */

window.OrderModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full';

        wrapper.innerHTML = `
            <!-- AI Smart Add (Gemini API Integration) -->
            <div class="glass-panel border-2 border-purple-500/30 rounded-xl p-8 mb-8 relative overflow-hidden group">
                <div class="absolute inset-0 bg-purple-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                <div class="relative z-10 flex flex-col md:flex-row gap-4 items-center">
                    <div class="flex-1 w-full">
                        <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            🤖 AI Smart Order Placement
                        </h3>
                        <p class="text-xs text-slate-400 mb-4">Paste a raw product URL or exact product name. The AI will automatically extract the correct ASIN/Product ID.</p>
                        <div class="flex gap-3">
                            <input type="text" id="ai-product-input" placeholder="e.g., https://amazon.in/dp/B08L5WHFT9" class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-500">
                            <input type="number" id="ai-product-qty" value="1" min="1" class="w-24 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-500" placeholder="Qty">
                            <button id="ai-submit-btn" class="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-lg transition-colors">Resolve & Add</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mass Ingestion Zone -->
            <div class="glass-panel border-2 border-dashed border-slate-600 hover:border-gold-500/50 transition-colors rounded-xl p-10 text-center mb-8 relative group">
                <div class="text-4xl mb-4">🛒</div>
                <h3 class="text-xl font-bold text-white mb-2">Upload Bulk Order Manifest</h3>
                <p class="text-slate-400 text-sm mb-6 max-w-md mx-auto">Upload a CSV (ASIN, Quantity). Processes up to 500 orders automatically across multiple platforms.</p>
                <input type="file" id="csv-file" accept=".csv" class="block mx-auto text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-gold-500 file:text-royal-900 hover:file:bg-gold-400 cursor-pointer transition-colors">
            </div>

            <button id="process-btn" class="hidden w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-royal-900 font-bold py-4 rounded-xl mb-8 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all transform hover:-translate-y-1 text-lg">
                Synchronize Queue to Cloud Database
            </button>

            <!-- Order Management Grid (REAL DATA ONLY) -->
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <h3 class="font-bold text-white">📦 Real-Time Order Management</h3>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                            <tr>
                                <th class="p-4 font-semibold">Target ID (ASIN)</th>
                                <th class="p-4 font-semibold">Platform</th>
                                <th class="p-4 font-semibold">Qty</th>
                                <th class="p-4 font-semibold">Live Status</th>
                            </tr>
                        </thead>
                        <tbody id="table-body" class="divide-y divide-white/5 text-sm">
                        </tbody>
                    </table>
                    <div id="empty-state" class="p-12 text-center text-slate-500">
                        No active orders found in the database.
                    </div>
                </div>
            </div>
        `;

        this.bindEvents(wrapper);
        // Delay render slightly to ensure AppState is fully mounted
        setTimeout(() => this.renderTable(wrapper), 50);
        return wrapper;
    },

    bindEvents(wrapper) {
        const fileInput = wrapper.querySelector('#csv-file');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (window.CSVManager) window.CSVManager.handleFileUpload(e);
            });
        }

        const processBtn = wrapper.querySelector('#process-btn');
        if (processBtn) {
            processBtn.addEventListener('click', () => {
                if (window.AppController) window.AppController.syncDatabase();
            });
        }

        const aiBtn = wrapper.querySelector('#ai-submit-btn');
        if (aiBtn) {
            aiBtn.addEventListener('click', async () => {
                const inputVal = wrapper.querySelector('#ai-product-input').value.trim();
                const qtyVal = parseInt(wrapper.querySelector('#ai-product-qty').value) || 1;

                if (!inputVal) {
                    if (window.Utils) window.Utils.showToast("Please enter a URL or product name.", "error");
                    return;
                }

                aiBtn.innerText = "Resolving...";
                aiBtn.disabled = true;

                try {
                    const asin = await this.resolveAsinWithGemini(inputVal);
                    if (asin) {
                        window.AppState.queue.push({
                            asin: asin,
                            quantity: qtyVal,
                            coupon_code: null,
                            status: 'pending_sync'
                        });
                        
                        if (window.Utils) window.Utils.showToast(`Resolved Target: ${asin}`, "success");
                        wrapper.querySelector('#ai-product-input').value = '';
                        this.renderTable(wrapper);
                    } else {
                        throw new Error("Extraction failed.");
                    }
                } catch (err) {
                    if (window.Utils) window.Utils.showToast("AI Resolution Failed.", "error");
                } finally {
                    aiBtn.innerText = "Resolve & Add";
                    aiBtn.disabled = false;
                }
            });
        }
    },

    async resolveAsinWithGemini(query) {
        // Replace with your actual Gemini API Key inside a secure edge function for production
        const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'; 
        const prompt = `Extract ONLY the 10-character Amazon ASIN, or Flipkart/Shopsy Product ID from this input. Return ONLY the alphanumeric ID. Input: ${query}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();
        const rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return rawOutput.trim().replace(/[^a-zA-Z0-9]/g, '');
    },

    renderTable(wrapper) {
        const tbody = wrapper.querySelector('#table-body');
        const emptyState = wrapper.querySelector('#empty-state');
        const processBtn = wrapper.querySelector('#process-btn');
        
        if (!tbody || !emptyState) return;

        // Strictly use real live data from Supabase and the active local queue[cite: 3]
        const combinedData = [...(window.AppState.queue || []), ...(window.AppState.liveOrders || [])];
        tbody.innerHTML = '';
        
        if (combinedData.length === 0) {
            emptyState.classList.remove('hidden');
            if (processBtn) processBtn.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        if (window.AppState.queue.length > 0 && processBtn) processBtn.classList.remove('hidden');

        combinedData.forEach(order => {
            let bgStyle = 'bg-slate-800/40 text-slate-400';
            const status = (order.status || 'pending').toLowerCase();
            
            if (status === 'completed') bgStyle = 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30';
            else if (status.includes('pending')) bgStyle = 'bg-blue-900/40 text-blue-400 border border-blue-500/30';
            else if (status === 'running') bgStyle = 'bg-amber-900/40 text-amber-400 border border-amber-500/30';
            else if (status === 'otp_required') bgStyle = 'bg-purple-900/40 text-purple-400 border border-purple-500/30';

            // Determine platform for the UI[cite: 3]
            const platform = order.platform || (window.Utils ? window.Utils.determinePlatform(order.asin) : 'Unknown');

            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td class="p-4 text-white font-mono">${order.asin}</td>
                    <td class="p-4 text-slate-300 capitalize">${platform}</td>
                    <td class="p-4 text-slate-300">${order.quantity}</td>
                    <td class="p-4 font-bold tracking-wider text-xs">
                        <span class="${bgStyle} px-3 py-1 rounded-full">${status.toUpperCase().replace('_', ' ')}</span>
                    </td>
                </tr>
            `;
        });
    }
};