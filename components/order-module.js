/**
 * components/order-module.js
 * Handles mass CSV ingestion, AI-powered URL resolution, real-time live data rendering, and DB cleanup.
 */

window.OrderModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full';

        wrapper.innerHTML = `
            <!-- AI Smart Add -->
            <div class="glass-panel border-2 border-purple-500/30 rounded-xl p-8 mb-8 relative overflow-hidden group">
                <div class="absolute inset-0 bg-purple-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                <div class="relative z-10 flex flex-col md:flex-row gap-4 items-center">
                    <div class="flex-1 w-full">
                        <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            🤖 AI Smart Order Placement
                        </h3>
                        <p class="text-xs text-slate-400 mb-4">Paste a raw product URL or exact product name.</p>
                        <div class="flex gap-3">
                            <input type="text" id="ai-product-input" placeholder="e.g., https://amazon.in/dp/B08L5WHFT9" class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-500">
                            <input type="number" id="ai-product-qty" value="1" min="1" class="w-24 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white outline-none focus:border-purple-500" placeholder="Qty">
                            <button id="ai-submit-btn" class="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-lg transition-colors">Resolve & Add</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Smart Mass CSV Ingestion Zone -->
            <div class="glass-panel border-2 border-dashed border-slate-600 hover:border-blue-500/50 transition-colors rounded-xl p-10 text-center mb-8 relative cursor-pointer group">
                <input type="file" id="csv-file" accept=".csv" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20">
                <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">📁</div>
                <h3 class="text-xl font-bold text-white mb-2">Upload Bulk Order Manifest (CSV)</h3>
                <p class="text-slate-400 text-sm mb-2 max-w-md mx-auto">Col 1: Name, URL, or ASIN | Col 2: Quantity</p>
                <div id="upload-status" class="mt-4 text-sm font-bold text-blue-400">Drag & Drop or Click to Browse</div>
            </div>

            <button id="process-btn" class="hidden w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-royal-900 font-bold py-4 rounded-xl mb-8 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all transform hover:-translate-y-1 text-lg">
                Synchronize Queue to Cloud Database
            </button>

            <!-- Order Management Grid (REAL DATA ONLY) -->
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <h3 class="font-bold text-white">📦 Real-Time Order Management</h3>
                    
                    <!-- NEW: Bulk Database Cleanup Button -->
                    <button id="clear-completed-btn" class="bg-red-600/80 hover:bg-red-500 text-white text-xs px-4 py-2 rounded transition-colors flex items-center gap-2 shadow-lg hidden">
                        <span>🧹</span> Clear Completed
                    </button>
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
        setTimeout(() => this.renderTable(wrapper), 50);
        return wrapper;
    },

    bindEvents(wrapper) {
        const fileInput = wrapper.querySelector('#csv-file');
        const statusText = wrapper.querySelector('#upload-status');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                statusText.innerText = "Processing CSV data...";
                statusText.className = "mt-4 text-sm font-bold text-emerald-400 animate-pulse";

                const reader = new FileReader();
                reader.onload = async (event) => {
                    const text = event.target.result;
                    const rows = text.split('\n').filter(row => row.trim().length > 0);
                    
                    const payload = rows.map((row, index) => {
                        if (index === 0 && row.toLowerCase().includes('quantity')) return null;
                        
                        const cols = row.split(',');
                        let rawProduct = cols[0] ? cols[0].trim() : '';
                        let quantity = cols[1] ? parseInt(cols[1].trim()) : 1;
                        if (isNaN(quantity) || quantity < 1) quantity = 1;
                        
                        let finalIdentifier = rawProduct;
                        const urlMatch = rawProduct.match(/(?:dp|o|gp|-|asin)[/=-]([A-Z0-9]{10})/i);
                        if (urlMatch && urlMatch[1]) {
                            finalIdentifier = urlMatch[1].toUpperCase();
                        } else if (/^[A-Z0-9]{10}$/i.test(rawProduct)) {
                            finalIdentifier = rawProduct.toUpperCase();
                        }

                        return {
                            user_id: window.AppState.user.email,
                            asin: finalIdentifier,
                            quantity: quantity,
                            status: 'pending',
                            coupon_code: window.AppState.globalCoupon || ''
                        };
                    }).filter(Boolean);

                    try {
                        const response = await fetch(`${window.CONFIG.SUPABASE_URL}/rest/v1/bulk_orders`, {
                            method: 'POST',
                            headers: {
                                'apikey': window.CONFIG.SUPABASE_ANON_KEY,
                                'Authorization': `Bearer ${window.CONFIG.SUPABASE_ANON_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload)
                        });
                        
                        if (response.ok) {
                            statusText.innerText = `✅ Successfully queued ${payload.length} items!`;
                            statusText.classList.remove('animate-pulse');
                            if (window.AppController) window.AppController.fetchLiveOrders();
                        } else {
                            throw new Error("DB response not OK");
                        }
                    } catch (err) {
                        statusText.innerText = "❌ Database Upload Failed. Check API Keys.";
                        statusText.className = "mt-4 text-sm font-bold text-red-500";
                    }
                };
                reader.readAsText(file);
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
                            coupon_code: window.AppState.globalCoupon || null,
                            status: 'pending_sync'
                        });
                        
                        if (window.Utils) window.Utils.showToast(`Resolved Target: ${asin}`, "success");
                        wrapper.querySelector('#ai-product-input').value = '';
                        this.renderTable(wrapper);
                    }
                } catch (err) {
                    if (window.Utils) window.Utils.showToast("AI Resolution Failed.", "error");
                } finally {
                    aiBtn.innerText = "Resolve & Add";
                    aiBtn.disabled = false;
                }
            });
        }

        // --- NEW: Database Deletion Logic ---
        const clearBtn = wrapper.querySelector('#clear-completed-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                const confirmDelete = confirm("Are you sure you want to permanently delete all completed orders from the database to free up space?");
                if (!confirmDelete) return;

                clearBtn.innerHTML = `<span>⏳</span> Clearing...`;
                clearBtn.disabled = true;

                try {
                    // Send DELETE request to Supabase targeting ONLY completed orders for this user
                    const deleteEndpoint = `${window.CONFIG.SUPABASE_URL}/rest/v1/bulk_orders?status=eq.completed&user_id=eq.${encodeURIComponent(window.AppState.user.email)}`;
                    
                    const response = await fetch(deleteEndpoint, {
                        method: 'DELETE',
                        headers: {
                            'apikey': window.CONFIG.SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${window.CONFIG.SUPABASE_ANON_KEY}`
                        }
                    });

                    if (response.ok) {
                        if (window.Utils) window.Utils.showToast("Database successfully cleaned.", "success");
                        // Refresh the UI table
                        if (window.AppController) window.AppController.fetchLiveOrders();
                    } else {
                        throw new Error("Deletion failed");
                    }
                } catch (err) {
                    if (window.Utils) window.Utils.showToast("Error cleaning database.", "error");
                } finally {
                    clearBtn.innerHTML = `<span>🧹</span> Clear Completed`;
                    clearBtn.disabled = false;
                }
            });
        }
    },

    async resolveAsinWithGemini(query) {
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
        const clearBtn = wrapper.querySelector('#clear-completed-btn');
        
        if (!tbody || !emptyState) return;

        const combinedData = [...(window.AppState.queue || []), ...(window.AppState.liveOrders || [])];
        tbody.innerHTML = '';
        
        if (combinedData.length === 0) {
            emptyState.classList.remove('hidden');
            if (processBtn) processBtn.classList.add('hidden');
            if (clearBtn) clearBtn.classList.add('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        if (window.AppState.queue.length > 0 && processBtn) processBtn.classList.remove('hidden');

        // Reveal the Clear button only if there is at least one "completed" order
        const hasCompleted = combinedData.some(o => (o.status || '').toLowerCase() === 'completed');
        if (clearBtn) {
            if (hasCompleted) clearBtn.classList.remove('hidden');
            else clearBtn.classList.add('hidden');
        }

        combinedData.forEach(order => {
            let bgStyle = 'bg-slate-800/40 text-slate-400';
            const status = (order.status || 'pending').toLowerCase();
            
            if (status === 'completed') bgStyle = 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30';
            else if (status.includes('pending')) bgStyle = 'bg-blue-900/40 text-blue-400 border border-blue-500/30';
            else if (status === 'running') bgStyle = 'bg-amber-900/40 text-amber-400 border border-amber-500/30';

            const platform = order.platform || (window.Utils ? window.Utils.determinePlatform(order.asin) : 'Amazon');
            const displayAsin = order.asin.length > 25 ? order.asin.substring(0,25) + '...' : order.asin;

            tbody.innerHTML += `
                <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td class="p-4 text-white font-mono">${displayAsin}</td>
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