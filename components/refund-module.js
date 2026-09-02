/**
 * components/refund-module.js
 * Initiates automated returns and cancellations on Amazon.
 */

window.RefundModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full';
        
        const liveOrders = window.AppState ? window.AppState.liveOrders : [];
        const refundedOrders = liveOrders.filter(o => o.refund_status && o.refund_status !== 'none');

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg mb-8">
                <div class="p-5 border-b border-white/10 bg-black/20">
                    <h3 class="font-bold text-white flex items-center gap-2">💰 Trigger Amazon Return / Cancel</h3>
                    <p class="text-xs text-slate-400 mt-1">Enter the 17-digit Amazon Order ID to force the bot to navigate to the order and initiate a return.</p>
                </div>
                <div class="p-6">
                    <div class="flex gap-3">
                        <input type="text" id="amazon-order-id" placeholder="e.g. 405-1234567-8901234" class="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-red-500">
                        <button id="trigger-refund-btn" class="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded transition-colors">Execute Return Bot</button>
                    </div>
                </div>
            </div>

            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20">
                    <h3 class="font-bold text-white flex items-center gap-2">📋 Return Monitoring History</h3>
                </div>
                ${refundedOrders.length === 0 ? `
                    <div class="p-12 text-center text-slate-500">
                        <div class="text-4xl mb-4">✔️</div>
                        No active return requests logged in the database.
                    </div>
                ` : `
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                                <tr>
                                    <th class="p-4 font-semibold">ASIN / Product</th>
                                    <th class="p-4 font-semibold">Platform</th>
                                    <th class="p-4 font-semibold">Refund Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5 text-sm">
                                ${refundedOrders.map(order => `
                                    <tr class="hover:bg-white/5 transition-colors">
                                        <td class="p-4 text-white font-mono">${order.asin}</td>
                                        <td class="p-4 text-slate-300 capitalize">${order.platform || 'Unknown'}</td>
                                        <td class="p-4 font-bold text-amber-400">${order.refund_status.toUpperCase()}</td>
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
                if (!orderId || orderId.length < 15) {
                    if (window.Utils) window.Utils.showToast("Please enter a valid Amazon Order ID.", "error");
                    return;
                }

                btn.innerText = "Executing...";
                btn.disabled = true;

                // Dispatch event to the bridge
                document.dispatchEvent(new CustomEvent('TriggerAmazonRefund', { 
                    detail: { amazonOrderId: orderId } 
                }));

                if (window.Utils) window.Utils.showToast(`Navigating bot to Order ${orderId}`, "success");

                setTimeout(() => {
                    btn.innerText = "Execute Return Bot";
                    btn.disabled = false;
                    input.value = '';
                }, 2000);
            });
        }
    }
};