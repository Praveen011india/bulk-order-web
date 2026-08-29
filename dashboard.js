// Initialize Supabase (Replace with your actual project URL and anon key)
const supabaseUrl = 'https://kjcvmchftyeiccfpiemd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY3ZtY2hmdHllaWNjZnBpZW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTM2MjcsImV4cCI6MjEwMzU4OTYyN30.m4wUParS14xU7FnAU3y-Eqtxjyvd3rNKFFrP0EL_Chk';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let parsedQueue = [];

document.getElementById('csv-file').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split('\n');
        
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = ''; 
        parsedQueue = []; // Reset queue
        
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
                        <td>Pending Sync</td>
                    </tr>
                `;
            }
        }
        
        document.getElementById('order-table').style.display = 'table';
        document.getElementById('process-btn').style.display = 'block';
    };
    
    reader.readAsText(file);
});

// Sync data to Supabase
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
        this.textContent = "Synced Successfully";
    }
});