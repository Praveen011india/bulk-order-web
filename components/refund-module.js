/**
 * components/refund-module.js
 * Initiates automated returns and cancellations on Amazon.
 */

window.RefundModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full animate-float opacity-100 transition-opacity duration-300';
        
        // CRITICAL FIX: Connect to the new Enterprise Store memory
        const state = window.Store ? window.Store.getState() : (window.AppState || { liveOrders: [] });
        const liveOrders = state.liveOrders || [];
        
        // Safely filter for orders that have a refund status
        const refundedOrders = liveOrders.filter(o => o && o.refund_status && o.refund_status !== 'none');

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
                ${refundedOrders.length === 0 ? `
                    <div class="p-16 text-center text-slate-500 flex flex-col items-center">
                        <span class="text-4xl mb-4 opacity-50">✔️</span>
                        <p class="font-medium">No active return requests logged in the database.</p>
                    </div>
                ` : `
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-widest">
                                <tr>
                                    <th class="p-5 font-semibold">ASIN / Product</th>
                                    <th class="p-5 font-semibold">Platform</th>
                                    <th class="p-5 font-semibold">Cloud Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5 text-sm">
                                ${refundedOrders.map(o => `
                                    <tr class="hover:bg-white/5 transition-colors">
                                        <td class="p-5 text-white font-mono font-medium">${o.asin}</td>
                                        <td class="p-5 text-slate-300 capitalize">${o.platform || 'Unknown'}</td>
                                        <td class="p-5 font-bold text-rose-400 flex items-center gap-2"><span>⚠️</span> ${o.refund_status.toUpperCase()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
        
        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },

    bindEvents(wrapper) {
        const btn = wrapper.querySelector('#trigger-refund-btn');
        const input = wrapper.querySelector('#amazon-order-id');

        if (btn && input) {
            btn.addEventListener('click', () => {
                const orderId = input.value.trim();
                
                // Amazon Order IDs are strictly 17 characters long (e.g., 405-1234567-8901234)
                if (!orderId || orderId.length < 15) {
                    if (window.Utils) window.Utils.showToast("Please enter a strictly valid 17-digit Amazon Order ID.", "error");
                    return;
                }

                btn.innerText = "Executing...";
                btn.disabled = true;
                btn.classList.add('animate-pulse');

                // Dispatch event to the bridge.js relay
                document.dispatchEvent(new CustomEvent('TriggerAmazonRefund', { 
                    detail: { amazonOrderId: orderId } 
                }));

                if (window.Utils) window.Utils.showToast(`Navigating bot directly to Receipt: ${orderId}`, "success");

                setTimeout(() => {
                    btn.innerText = "Execute Protocol";
                    btn.disabled = false;
                    btn.classList.remove('animate-pulse');
                    input.value = '';
                }, 3000);
            });
        }
    }
};