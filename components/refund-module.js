/**
 * components/refund-module.js
 * Return and cancellation webhook listeners.
 */

window.RefundModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full';
        
        // Strictly pull from the real Supabase array[cite: 3]
        const liveOrders = window.AppState ? window.AppState.liveOrders : [];
        const refundedOrders = liveOrders.filter(o => o.refund_status && o.refund_status !== 'none');

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20">
                    <h3 class="font-bold text-white flex items-center gap-2">💰 Refund & Returns Monitor</h3>
                    <p class="text-xs text-slate-400 mt-1">Track automated cancellations and return processing states.</p>
                </div>
                
                ${refundedOrders.length === 0 ? `
                    <div class="p-12 text-center text-slate-500">
                        <div class="text-4xl mb-4">✔️</div>
                        No active return requests or refunds detected across your platforms.
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
        return wrapper;
    }
};