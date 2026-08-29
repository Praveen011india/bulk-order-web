// 1. Initialize Supabase
const supabaseUrl = 'https://kjcvmchftyeiccfpiemd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY3ZtY2hmdHllaWNjZnBpZW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTM2MjcsImV4cCI6MjEwMzU4OTYyN30.m4wUParS14xU7FnAU3y-Eqtxjyvd3rNKFFrP0EL_Chk';
const _supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let parsedQueue = [];
let liveTrackingInterval;

// 2. Initialize Clerk Authentication
const clerkPubKey = 'pk_test_ZGVlcC1nbG93d29ybS02ODYwLmNsZXJrLmFjY291bnRzLmRldiQ';

const script = document.createElement('script');
script.setAttribute('data-clerk-publishable-key', clerkPubKey);
script.async = true;
script.src = `https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`;
script.crossOrigin = 'anonymous';
document.head.appendChild(script);

script.onload = async () => {
    const Clerk = window.Clerk;
    await Clerk.load();

    if (Clerk.user) {
        // User is authenticated: Show dashboard, hide login, start live tracking
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard-content').style.display = 'block';
        Clerk.mountUserButton(document.getElementById('user-button'));
        
        fetchLiveTracking();
        liveTrackingInterval = setInterval(fetchLiveTracking, 5000); 
    } else {
        // User is not authenticated: Show login, hide dashboard
        document.getElementById('dashboard-content').style.display = 'none';
        Clerk.mountSignIn(document.getElementById('auth-container'));
    }
};

// 3. Automatic Tracking Engine (Polls Supabase every 5 seconds)
async function fetchLiveTracking() {
    // Pause live updates if the user is actively previewing an unsynced CSV file
    if (parsedQueue.length > 0) return;

    const { data, error } = await _supabase
        .from('bulk_orders')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error("Tracking Error:", error);
        return;
    }

    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = ''; 
    
    data.forEach(order => {
        let statusColor = '#fff';
        if (order.status === 'completed') statusColor = '#10b981'; // Green
        if (order.status === 'pending') statusColor = '#f59e0b'; // Yellow
        if (order.status === 'error') statusColor = '#ef4444'; // Red
        
        tbody.innerHTML += `
            <tr>
                <td>${order.asin}</td>
                <td>${order.quantity}</td>
                <td style="color: ${statusColor}; font-weight: bold;">${order.status.toUpperCase()}</td>
            </tr>
        `;
    });

    if (data.length > 0) {
        document.getElementById('order-table').style.display = 'table';
    }
}

// 4. CSV Upload & Preview Logic
document.getElementById('csv-file').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split('\n');
        
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = ''; 
        parsedQueue = []; // Reset queue for new upload
        
        for (let i = 1; i < rows.length; i++) {
            const columns = rows[i].split(',');
            const asin = columns[0] ? columns[0].trim() : '';
            
            // Default quantity to 1 if missing or invalid in the CSV
            let qty = 1; 
            if (columns.length >= 2 && columns[1].trim() !== '') {
                const parsed = parseInt(columns[1].trim(), 10);
                if (!isNaN(parsed)) qty = parsed;
            }
            
            if (asin) {
                parsedQueue.push({ asin: asin, quantity: qty, status: 'pending' });
                tbody.innerHTML += `
                    <tr>
                        <td>${asin}</td>
                        <td>${qty}</td>
                        <td style="color: #60a5fa; font-weight: bold;">PENDING UPLOAD</td>
                    </tr>
                `;
            }
        }
        
        document.getElementById('order-table').style.display = 'table';
        document.getElementById('process-btn').style.display = 'block';
    };
    
    reader.readAsText(file);
});

// 5. Sync Data to Supabase Database
document.getElementById('process-btn').addEventListener('click', async function() {
    if (parsedQueue.length === 0) {
        alert("No orders to sync.");
        return;
    }

    this.textContent = "Syncing...";
    this.disabled = true;

    // Bulk insert array directly into Supabase
    const { data, error } = await _supabase
        .from('bulk_orders')
        .insert(parsedQueue);

    if (error) {
        console.error("Supabase Error:", error);
        alert("Error syncing database: " + error.message);
        this.textContent = "Sync Orders to Database";
        this.disabled = false;
    } else {
        alert("Successfully synced to database!");
        this.textContent = "Sync Orders to Database";
        this.disabled = false;
        this.style.display = 'none'; // Hide button after success
        
        parsedQueue = []; // Clear local queue so live tracking resumes
        fetchLiveTracking(); // Instantly load live data from database
    }
});