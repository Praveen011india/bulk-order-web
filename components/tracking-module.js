/**
 * components/tracking-module.js
 * Handles live logistics and delivery tracking UI using real Supabase data.
 */

window.TrackingModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full';
        
        const liveOrders = window.AppState ? window.AppState.liveOrders : [];
        const shipped = liveOrders.filter(o => o.tracking_status === 'shipped').length;
        const outForDelivery = liveOrders.filter(o => o.tracking_status === 'out_for_delivery').length;
        const delivered = liveOrders.filter(o => o.tracking_status === 'delivered').length;

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg mb-8">
                <div class="p-5 border-b border-white/10 bg-black/20">
                    <h3 class="font-bold text-white flex items-center gap-2">🚚 Logistics & Delivery Tracking</h3>
                    <p class="text-xs text-slate-400 mt-1">Monitor real-time shipment updates across all platforms.</p>
                </div>
                
                <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p class="text-slate-400 text-xs uppercase tracking-wider mb-1">In Transit</p>
                        <p class="text-3xl font-bold text-blue-400">${shipped}</p>
                    </div>
                    <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p class="text-slate-400 text-xs uppercase tracking-wider mb-1">Out for Delivery</p>
                        <p class="text-3xl font-bold text-amber-400">${outForDelivery}</p>
                    </div>
                    <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p class="text-slate-400 text-xs uppercase tracking-wider mb-1">Delivered</p>
                        <p class="text-3xl font-bold text-emerald-400">${delivered}</p>
                    </div>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse border-t border-white/10">
                        <thead class="bg-slate-800/50 text-slate-300 text-xs uppercase tracking-wider">
                            <tr>
                                <th class="p-4 font-semibold">ASIN</th>
                                <th class="p-4 font-semibold">Courier</th>
                                <th class="p-4 font-semibold">Tracking ID</th>
                                <th class="p-4 font-semibold">Status</th>
                                <th class="p-4 font-semibold">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5 text-sm">
                            ${this.generateTrackingRows(liveOrders)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },

    generateTrackingRows(liveOrders) {
        const validOrders = liveOrders.filter(o => o.status === 'completed');
        
        if (validOrders.length === 0) {
            return `<tr><td colspan="5" class="p-12 text-center text-slate-500">No completed orders available for tracking.</td></tr>`;
        }
        
        return validOrders.map(order => {
            // Pulling REAL data from your Supabase database
            const trackingId = order.tracking_id || 'Pending Sync';
            const courier = order.courier || 'Pending...';
            let tStatus = order.tracking_status || 'processing';
            
            let badgeStyle = 'bg-slate-700 text-slate-300';
            if(tStatus === 'shipped') badgeStyle = 'bg-blue-900/50 text-blue-400 border border-blue-500/30';
            if(tStatus === 'out_for_delivery') badgeStyle = 'bg-amber-900/50 text-amber-400 border border-amber-500/30';
            if(tStatus === 'delivered') badgeStyle = 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30';

            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-4 text-white font-mono">${order.asin}</td>
                    <td class="p-4 text-slate-300">${courier}</td>
                    <td class="p-4 text-blue-400 font-mono">${trackingId}</td>
                    <td class="p-4">
                        <span class="${badgeStyle} px-2 py-1 rounded text-xs">${tStatus.toUpperCase().replace('_', ' ')}</span>
                    </td>
                    <td class="p-4">
                        <button class="sync-track-btn text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white transition-colors" data-dbid="${order.id}">Sync Live Data</button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    bindEvents(wrapper) {
        const buttons = wrapper.querySelectorAll('.sync-track-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dbId = e.target.getAttribute('data-dbid');
                const amazonId = prompt("Enter the 17-digit Amazon Order ID to fetch live tracking:");
                
                if (amazonId && amazonId.length >= 15) {
                    e.target.innerText = "Syncing...";
                    e.target.disabled = true;
                    
                    document.dispatchEvent(new CustomEvent('FetchAmazonTracking', { 
                        detail: { amazonOrderId: amazonId.trim(), dbOrderId: dbId } 
                    }));
                    
                    if(window.Utils) window.Utils.showToast("Bot dispatched to scrape tracking...", "success");
                }
            });
        });
    }
};