/**
 * components/coupon-module.js
 * Configuration panel for global discounts and rewards.
 */

window.CouponModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full';

        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg">
                <div class="p-5 border-b border-white/10 bg-black/20">
                    <h3 class="font-bold text-white flex items-center gap-2">🎟️ Coupons & SuperCoins Engine</h3>
                    <p class="text-xs text-slate-400 mt-1">Configure global discount rules applied automatically during bot checkout.</p>
                </div>
                <div class="p-6">
                    <div class="bg-slate-800 border border-slate-700 rounded-lg p-5 mb-4">
                        <label class="block text-sm font-bold text-white mb-2">Global Amazon Coupon Code</label>
                        <div class="flex gap-3">
                            <input type="text" placeholder="e.g. SAVE20" class="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-blue-500 transition-colors">
                            <button class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold transition-colors">Apply Rule</button>
                        </div>
                    </div>
                    <div class="bg-slate-800 border border-slate-700 rounded-lg p-5">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" class="w-5 h-5 rounded bg-slate-900 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800" checked>
                            <span class="text-white font-bold">Automatically Apply Flipkart SuperCoins</span>
                        </label>
                        <p class="text-xs text-slate-400 mt-2 ml-8">If checked, the extension will attempt to click 'Pay with SuperCoins' on the payment page before finalization.</p>
                    </div>
                </div>
            </div>
        `;
        return wrapper;
    }
};