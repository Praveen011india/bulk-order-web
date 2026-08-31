/**
 * components/order-module.js
 * Handles mass CSV ingestion and AI-powered single-item resolution.
 */

window.OrderModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full';

        wrapper.innerHTML = `
            <!-- AI Smart Add (Gemini API Integration) -->
            <div class="glass-panel border-2 border-emerald-500/30 rounded-xl p-8 mb-8 relative overflow-hidden group">
                <div class="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                <div class="relative z-10 flex flex-col md:flex-row gap-4 items-center">
                    <div class="flex-1 w-full">
                        <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            ✨ AI Smart Add
                        </h3>
                        <p class="text-xs text-slate-400 mb-4">Paste a product URL or exact product name. Gemini will automatically extract or search for the ASIN/Product ID.</p>
                        <div class="flex gap-3">
                            <input type="text" id="ai-product-input" placeholder="e.g., https://amazon.in/dp/B08L5WHFT9 OR Apple iPhone 13 128GB" class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white outline-none focus:border-emerald-500">
                            <input type="number" id="ai-product-qty" value="1" min="1" class="w-24 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white outline-none focus:border-emerald-500" placeholder="Qty">
                            <button id="ai-submit-btn" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-lg transition-colors">Resolve & Add</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mass Ingestion Zone -->
            <div class="glass-panel border-2 border-dashed border-slate-600 hover:border-gold-500/50 transition-colors rounded-xl p-10 text-center mb-8 relative group">
                <div class="text-4xl mb-4">📦</div>
                <h3 class="text-xl font-bold text-white mb-2">Upload Order Manifest</h3>
                <p class="text-slate-400 text-sm mb-6 max-w-md mx-auto">Upload a CSV (ASIN, Quantity). The bot processes up to 500 orders every 10 minutes[cite: 1, 2].</p>
                <input type="file" id="csv-file" accept=".csv" class="block mx-auto text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-gold-500 file:text-royal-900 hover:file:bg-gold-400 cursor-pointer transition-colors">
            </div>

            <button id="process-btn" class="hidden w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-royal-900 font-bold py-4 rounded-xl mb-8 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all transform hover:-translate-y-1 text-lg">
                Synchronize Queue to Cloud Database
            </button>

            <!-- Order Management Grid -->
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <h3 class="font-bold text-white">Live Execution Tracking</h3>
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
                        No active orders in the cloud queue.
                    </div>
                </div>
            </div>
        `;

        this.bindEvents(wrapper);
        this.renderTable(wrapper);
        return wrapper;
    },

    bindEvents(wrapper) {
        // 1. Handle CSV Uploads
        const fileInput = wrapper.querySelector('#csv-file');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    if (window.CSVParser) {
                        const result = window.CSVParser.parse(event.target.result);
                        if (result.success) {
                            window.AppState.queue = [...window.AppState.queue, ...result.data];
                            this.renderTable(wrapper);
                        }
                    }
                };
                reader.readAsText(file);
            });
        }

        // 2. Handle Supabase Database Synchronization
        const processBtn = wrapper.querySelector('#process-btn');
        if (processBtn) {
            processBtn.addEventListener('click', async () => {
                if (window.AppState.queue.length === 0) return;
                
                processBtn.innerText = "Syncing...";
                processBtn.disabled = true;

                if (window.SupabaseClient) {
                    const success = await window.SupabaseClient.insertOrders(window.AppState.queue);
                    if (success) {
                        if (window.UI) window.UI.showToast("Queue synchronized successfully", "success");
                        window.AppState.queue = [];
                        processBtn.classList.add('hidden');
                    } else {
                        if (window.UI) window.UI.showToast("Database sync failed", "error");
                    }
                }
                processBtn.innerText = "Synchronize Queue to Cloud Database";
                processBtn.disabled = false;
            });
        }

        // 3. Handle Gemini AI Lookup
        const aiBtn = wrapper.querySelector('#ai-submit-btn');
        if (aiBtn) {
            aiBtn.addEventListener('click', async () => {
                const inputVal = wrapper.querySelector('#ai-product-input').value.trim();
                const qtyVal = parseInt(wrapper.querySelector('#ai-product-qty').value) || 1;

                if (!inputVal) {
                    if (window.UI) window.UI.showToast("Please enter a URL or product name.", "error");
                    return;
                }

                aiBtn.innerText = "Resolving...";
                aiBtn.disabled = true;

                try {
                    const asin = await this.resolveAsinWithGemini(inputVal);
                    
                    if (asin) {
                        let platform = 'shopsy';
                        if (asin.startsWith('B')) platform = 'amazon';
                        else if (/^\d+$/.test(asin)) platform = 'flipkart';

                        window.AppState.queue.push({
                            asin: asin,
                            quantity: qtyVal,
                            platform: platform,
                            status: 'pending',
                            created_at: new Date().toISOString()
                        });
                        
                        if (window.UI) window.UI.showToast(`Resolved Target: ${asin}`, "success");
                        wrapper.querySelector('#ai-product-input').value = '';
                        this.renderTable(wrapper);
                    } else {
                        throw new Error("Could not extract ASIN.");
                    }
                } catch (err) {
                    if (window.UI) window.UI.showToast("AI Resolution Failed. Please verify the URL/Name.", "error");
                } finally {
                    aiBtn.innerText = "Resolve & Add";
                    aiBtn.disabled = false;
                }
            });
        }
    },

    async resolveAsinWithGemini(query) {
        // For production, proxy this key through a Vercel Edge Function so it is not exposed in the frontend
        const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE'; 
        
        const prompt = `Extract ONLY the 10-character Amazon ASIN, or Flipkart/Shopsy Product ID from this input. If it is a product name, find the most likely ASIN. Return ONLY the alphanumeric ID, nothing else. Input: ${query}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Scrub markdown or extra characters returned by the model
        return rawOutput.trim().replace(/[^a-zA-Z0-9]/g, '');
    },

    renderTable(wrapper) {
        const tbody = wrapper.querySelector('#table-body');
        const emptyState = wrapper.querySelector('#empty-state');
        const processBtn = wrapper.querySelector('#process-btn');
        
        // Merge unsynced local queue with live database orders[cite: 4]
        const combinedData = [...(window.AppState.queue || []), ...(window.AppState.liveData || [])];

        tbody.innerHTML = '';
        
        if (combinedData.length === 0) {
            emptyState.classList.remove('hidden');
            processBtn.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        if (window.AppState.queue.length > 0) processBtn.classList.remove('hidden');

        combinedData.forEach(order => {
            let bgStyle = 'bg-slate-800/40 text-slate-400';
            const status = (order.status || 'pending').toLowerCase();
            
            if (status === 'completed') bgStyle = 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30';
            else if (status === 'pending') bgStyle = 'bg-blue-900/40 text-blue-400 border border-blue-500/30';
            else if (status === 'running') bgStyle = 'bg-amber-900/40 text-amber-400 border border-amber-500/30';

            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td class="p-4 text-white font-mono">${order.asin}</td>
                    <td class="p-4 text-slate-300 capitalize">${order.platform || 'Unknown'}</td>
                    <td class="p-4 text-slate-300">${order.quantity}</td>
                    <td class="p-4 font-bold tracking-wider text-xs">
                        <span class="${bgStyle} px-3 py-1 rounded-full">${status.toUpperCase()}</span>
                    </td>
                </tr>
            `;
        });
    }
};