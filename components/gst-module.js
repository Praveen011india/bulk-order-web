/**
 * components/gst-module.js
 * Handles GST calculation and invoice generation from real Supabase data.
 */

window.GSTModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full';
        
        const liveOrders = window.AppState ? window.AppState.liveOrders : [];

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20 flex justify-between items-center">
                    <h3 class="font-bold text-white flex items-center gap-2">🧾 B2B GST Invoicing</h3>
                    <button class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded shadow transition-colors">Download Monthly Report</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                            <tr>
                                <th class="p-4 font-semibold">Order Ref</th>
                                <th class="p-4 font-semibold">ASIN</th>
                                <th class="p-4 font-semibold">Taxable Value</th>
                                <th class="p-4 font-semibold">GST Amount</th>
                                <th class="p-4 font-semibold">Status</th>
                                <th class="p-4 font-semibold">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5 text-sm">
                            ${this.generateGSTRows(liveOrders)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        return wrapper;
    },

    generateGSTRows(liveOrders) {
        const completed = liveOrders.filter(o => o.status === 'completed');
        
        if (completed.length === 0) {
            return `<tr><td colspan="6" class="p-12 text-center text-slate-500">No completed orders available for GST generation.</td></tr>`;
        }

        return completed.map(order => {
            // 1. Pull real data from Supabase instead of Math.random()
            const val = parseFloat(order.taxable_value);
            const gst = parseFloat(order.gst_amount);
            const shortId = order.id ? order.id.toString().substring(0, 8) : 'ORD-123';

            // 2. Determine if the bot has updated the final price yet
            const isPending = isNaN(val) || val === 0;

            const displayVal = isPending ? 'Syncing...' : `₹${val.toFixed(2)}`;
            const displayGst = isPending ? 'Syncing...' : `₹${gst.toFixed(2)} (18%)`;
            
            const statusBadge = isPending 
                ? `<span class="bg-amber-900/40 text-amber-400 border border-amber-500/30 px-2 py-1 rounded text-xs">Pending Data</span>`
                : `<span class="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-xs">Generated</span>`;
                
            const actionBtn = isPending
                ? `<button class="text-slate-500 cursor-not-allowed text-xs transition-colors">PDF Invoice</button>`
                : `<button class="text-blue-400 hover:text-blue-300 underline text-xs transition-colors">PDF Invoice</button>`;

            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-4 text-slate-400 font-mono text-xs uppercase">${shortId}...</td>
                    <td class="p-4 text-white font-mono">${order.asin}</td>
                    <td class="p-4 text-slate-300">${displayVal}</td>
                    <td class="p-4 text-amber-400">${displayGst}</td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4">${actionBtn}</td>
                </tr>
            `;
        }).join('');
    }
};