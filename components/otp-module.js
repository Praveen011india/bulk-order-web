/**
 * components/otp-module.js
 * Manual Intervention Gate for handling OTPs and Captchas.
 */

window.OTPModule = {
    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'module-fade-in w-full';
        
        const liveOrders = window.AppState ? window.AppState.liveOrders : [];
        const otpOrders = liveOrders.filter(o => o.status === 'otp_required');
        
        wrapper.innerHTML = `
            <div class="glass-panel rounded-xl overflow-hidden border border-purple-500/30 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                <div class="p-5 border-b border-white/10 bg-purple-900/20">
                    <h3 class="font-bold text-white flex items-center gap-2">🔐 Manual Intervention Gate</h3>
                    <p class="text-xs text-slate-400 mt-1">If the Chrome Extension hits an authentication wall during bulk processing, it pauses and waits for your input here.</p>
                </div>
                
                ${otpOrders.length === 0 ? 
                    `<div class="p-12 text-center text-slate-500 flex flex-col items-center">
                        <span class="text-4xl mb-4 opacity-50">🛡️</span>
                        No active OTP gates. Bots are running freely.
                    </div>` 
                    : 
                    `<div class="p-6 grid grid-cols-1 gap-4">
                        ${otpOrders.map(order => `
                            <div class="bg-slate-800 border border-purple-500/40 rounded-lg p-5 flex justify-between items-center shadow-lg">
                                <div>
                                    <p class="text-white font-bold mb-1">Authentication Required: ${(order.platform || 'System').toUpperCase()}</p>
                                    <p class="text-sm text-slate-400">ASIN: <span class="font-mono text-purple-300">${order.asin}</span> | Bot requires delivery/login OTP.</p>
                                </div>
                                <div class="flex gap-3 items-center">
                                    <input type="text" id="otp-input-${order.id}" placeholder="Enter OTP..." class="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white outline-none focus:border-purple-500">
                                    <button class="submit-otp-btn bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded transition-colors" data-id="${order.id}">Submit & Resume</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;

        this.bindEvents(wrapper);
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
                    if(window.Utils) window.Utils.showToast("Please enter an OTP before submitting.", "error");
                    return;
                }

                e.target.innerText = "Submitting...";
                e.target.disabled = true;

                if (window.AppController) {
                    await window.AppController.submitOTP(orderId, otpValue);
                    input.value = '';
                }
            });
        });
    }
};