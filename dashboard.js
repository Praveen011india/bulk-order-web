// 1. Initialize Supabase
const supabaseUrl = 'https://kjcvmchftyeiccfpiemd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY3ZtY2hmdHllaWNjZnBpZW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTM2MjcsImV4cCI6MjEwMzU4OTYyN30.m4wUParS14xU7FnAU3y-Eqtxjyvd3rNKFFrP0EL_Chk';
const _supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let parsedQueue = [];
let liveTrackingInterval;

// 2. Initialize Clerk (Called safely by index.html script onload)
async function initClerk() {
    await window.Clerk.load();

    if (window.Clerk.user) {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard-content').style.display = 'block';
        window.Clerk.mountUserButton(document.getElementById('user-button'));
        
        fetchLiveTracking();
        liveTrackingInterval = setInterval(fetchLiveTracking, 5000); 
    } else {
        document.getElementById('dashboard-content').style.display = 'none';
        window.Clerk.mountSignIn(document.getElementById('auth-container'));
    }
}

// 3. Automatic Tracking Engine
async function fetchLiveTracking() {
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
        if (order.status === 'completed') statusColor = '#10b981'; 
        if (order.status === 'pending') statusColor = '#f59e0b'; 
        if (order.status === 'error') statusColor = '#ef4444'; 
        
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

// 4. CSV Upload Logic
document.getElementById('csv-file').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function(e) {
        const rows = e.target.result.split('\n');
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = ''; 
        parsedQueue = []; 
        
        for (let i = 1; i < rows.length; i++) {
            const columns = rows[i].split(',');
            const asin = columns[0] ? columns[0].trim() : '';
            
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
    if (parsedQueue.length === 0) return;

    this.textContent = "Syncing...";
    this.disabled = true;

    const { error } = await _supabase.from('bulk_orders').insert(parsedQueue);

    if (error) {
        alert("Error syncing database: " + error.message);
        this.textContent = "Sync Orders to Database";
        this.disabled = false;
    } else {
        alert("Successfully synced to database!");
        this.textContent = "Sync Orders to Database";
        this.disabled = false;
        this.style.display = 'none'; 
        
        parsedQueue = []; 
        fetchLiveTracking(); 
    }
});