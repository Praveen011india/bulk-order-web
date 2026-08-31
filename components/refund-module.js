/**
 * components/refund-module.js
 * Handles refund tracking and return requests across e-commerce platforms.
 */

window.RefundModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full';
        
        const liveOrders = window.AppState ? window.AppState.liveData : [];
        const refundedOrders = liveOrders.filter(o => o.refund_status && o.refund_status !== 'none');

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <div>
                        <h3 class="font-bold text-white flex items-center gap-2">💰 Refund & Returns Monitor</h3>
                        <p class="text-xs text-slate-400 mt-1">Track return processing and refund initiation across all active platforms.</p>
                    </div>
                    <button class="bg-slate-700 hover:bg-slate-600 text-white text-xs px-4 py-2 rounded shadow transition-colors">Export Report</button>
                </div>
                
                <div class="overflow-x-auto">
                    ${refundedOrders.length === 0 ? 
                        `<div class="p-12 text-center text-slate-500">
                            <span class="text-4xl block mb-3">✅</span>
                            No active return requests or refunds detected across platforms.
                        </div>` 
                        :
                        `<table class="w-full text-left border-collapse">
                            <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                                <tr>
                                    <th class="p-4 font-semibold">Order ID</th>
                                    <th class="p-4 font-semibold">ASIN</th>
                                    <th class="p-4 font-semibold">Platform</th>
                                    <th class="p-4 font-semibold">Refund Status</th>
                                    <th class="p-4 font-semibold">Action</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5 text-sm">
                                ${this.generateRefundRows(refundedOrders)}
                            </tbody>
                        </table>`
                    }
                </div>
            </div>
        `;
        return wrapper;
    },

    generateRefundRows(refundedOrders) {
        return refundedOrders.map(order => {
            let badgeStyle = 'bg-slate-800/40 border-slate-500/30 text-slate-400';
            const status = (order.refund_status || 'processing').toLowerCase();
            const shortId = order.id ? order.id.toString().substring(0, 8) : 'REF-123';
            
            if (status === 'completed') badgeStyle = 'bg-emerald-900/40 border-emerald-500/30 text-emerald-400';
            if (status === 'processing') badgeStyle = 'bg-amber-900/40 border-amber-500/30 text-amber-400';
            if (status === 'failed') badgeStyle = 'bg-red-900/40 border-red-500/30 text-red-400';

            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-4 text-slate-400 font-mono text-xs uppercase">${shortId}...</td>
                    <td class="p-4 text-white font-mono">${order.asin}</td>
                    <td class="p-4 text-slate-300 capitalize">${order.platform || 'Amazon'}</td>
                    <td class="p-4">
                        <span class="${badgeStyle} px-2 py-1 rounded text-xs border">${status.toUpperCase()}</span>
                    </td>
                    <td class="p-4">
                        <button class="text-blue-400 hover:text-blue-300 underline text-xs transition-colors">Check Details</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
};