/**
 * components/otp-module.js
 * Manual Intervention Gate for handling OTPs and Captchas.
 */

window.OTPModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full animate-float opacity-100 transition-opacity duration-300';
        
        // Connect to the new Redux-style Enterprise Store
        const state = window.Store ? window.Store.getState() : { liveOrders: [] };
        const otpOrders = state.liveOrders.filter(o => o && o.status === 'otp_required');
        
        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <div class="p-6 border-b border-white/10 bg-purple-900/30">
                    <h3 class="font-bold text-white text-lg flex items-center gap-2">🔐 Manual Intervention Gate</h3>
                    <p class="text-xs text-purple-200 mt-1 font-medium">Check your phone/email for the Amazon OTP, enter it below, and the bot will physically type it into the checkout page.</p>
                </div>
                
                ${otpOrders.length === 0 ? 
                    `<div class="p-20 text-center text-slate-500 flex flex-col items-center">
                        <span class="text-5xl mb-4 opacity-50 drop-shadow-lg">🛡️</span>
                        <p class="font-medium text-lg">No active OTP blocks.</p>
                        <p class="text-sm mt-2">Bot fleet is running with zero friction.</p>
                    </div>` 
                    : 
                    `<div class="p-8 grid gap-6 bg-black/10">
                        ${otpOrders.map(order => `
                            <div class="bg-slate-900/80 border border-purple-500/50 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
                                <div class="flex items-center gap-4">
                                    <div class="w-12 h-12 bg-purple-900/50 rounded-full flex items-center justify-center text-xl border border-purple-500/30">📱</div>
                                    <div>
                                        <p class="text-white font-bold text-lg mb-1">Auth Required: ${(order.platform || 'amazon').toUpperCase()}</p>
                                        <p class="text-sm text-slate-400">ASIN: <span class="font-mono text-purple-300 font-bold">${order.asin}</span> | Bot Engine Paused</p>
                                    </div>
                                </div>
                                <div class="flex gap-3 w-full md:w-auto">
                                    <input type="text" id="otp-input-${order.id}" placeholder="Enter 6-digit OTP" class="flex-1 md:w-48 bg-black/50 border border-purple-500/50 rounded-lg px-4 py-3 text-white font-mono tracking-widest outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all text-center">
                                    <button class="submit-otp-btn bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-lg shadow-lg shadow-purple-600/30 transition-all transform hover:-translate-y-0.5" data-id="${order.id}">
                                        Inject OTP
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;

        setTimeout(() => this.bindEvents(wrapper), 0);
        return wrapper;
    },

    bindEvents(wrapper) {
        const buttons = wrapper.querySelectorAll('.submit-otp-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const orderId = e.target.getAttribute('data-id');
                const input = wrapper.querySelector(`#otp-input-${orderId}`);
                const otpValue = input.value.trim();

                if (!otpValue) {
                    if(window.Utils) window.Utils.showToast("OTP field cannot be empty.", "warning");
                    return;
                }

                e.target.innerText = "Injecting...";
                e.target.classList.add('animate-pulse');
                e.target.disabled = true;

                // 1. Update Database Status using the new DatabaseEngine to un-pause the bot
                if (window.DatabaseEngine) {
                    await window.DatabaseEngine.patchOrder(orderId, { status: 'running' });
                }

                // 2. Fire the OTP directly into the Chrome Extension pipeline
                document.dispatchEvent(new CustomEvent('InjectAmazonOTP', { 
                    detail: { otp: otpValue } 
                }));

                if(window.Utils) window.Utils.showToast("OTP successfully injected into Amazon pipeline.", "success");

                // 3. Force UI refresh
                if (window.AppController) {
                    window.AppController.triggerDataRefresh();
                }

                input.value = '';
                setTimeout(() => {
                    e.target.innerText = "Inject OTP";
                    e.target.classList.remove('animate-pulse');
                    e.target.disabled = false;
                }, 2000);
            });
        });
    }
};