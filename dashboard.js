document.getElementById('csv-file').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split('\n');
        
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = ''; // Clear old data
        
        // Skip header row if exists, loop through data
        for (let i = 1; i < rows.length; i++) {
            const columns = rows[i].split(',');
            if (columns.length >= 2) {
                const asin = columns[0].trim();
                const qty = columns[1].trim();
                
                if (asin) {
                    tbody.innerHTML += `
                        <tr>
                            <td>${asin}</td>
                            <td>${qty}</td>
                            <td>Pending Upload</td>
                        </tr>
                    `;
                }
            }
        }
        
        document.getElementById('order-table').style.display = 'table';
        document.getElementById('process-btn').style.display = 'block';
    };
    
    reader.readAsText(file);
});