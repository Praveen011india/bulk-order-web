/**
 * lib/supabase.js
 * Core Database Engine for BulkOrderBuddy Cloud Dashboard
 */

window.SupabaseEngine = {
    client: null,
    
    // Credentials from your environment[cite: 4]
    config: {
        url: 'https://kjcvmchftyeiccfpiemd.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY3ZtY2hmdHllaWNjZnBpZW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTM2MjcsImV4cCI6MjEwMzU4OTYyN30.m4wUParS14xU7FnAU3y-Eqtxjyvd3rNKFFrP0EL_Chk'
    },

    init() {
        if (!window.supabase) {
            console.error("[Supabase] CDN not loaded.");
            return;
        }
        this.client = window.supabase.createClient(this.config.url, this.config.key);
        console.log("[Supabase] Database engine initialized.");
    },

    /**
     * Fetches the latest live queue for the dashboard tracking tables.
     */
    async fetchLiveOrders(limit = 500) {
        if (!this.client) this.init();
        
        try {
            const { data, error } = await this.client
                .from('bulk_orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("[Supabase] Fetch Error:", error.message);
            return [];
        }
    },

    /**
     * Mass inserts parsed CSV data into the cloud queue.
     */
    async pushQueueToDatabase(queueArray) {
        if (!this.client) this.init();
        
        try {
            const { data, error } = await this.client
                .from('bulk_orders')
                .insert(queueArray);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error("[Supabase] Mass Insert Error:", error.message);
            return false;
        }
    },

    /**
     * Updates an individual order (e.g., passing an OTP gate manually)[cite: 4].
     */
    async updateOrderStatus(orderId, updatePayload) {
        if (!this.client) this.init();

        try {
            const { error } = await this.client
                .from('bulk_orders')
                .update(updatePayload)
                .eq('id', orderId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error(`[Supabase] Update Error for ${orderId}:`, error.message);
            return false;
        }
    }
};

// Auto-initialize if the CDN is already ready
if (window.supabase) window.SupabaseEngine.init();