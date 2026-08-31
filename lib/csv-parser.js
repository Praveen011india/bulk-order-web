/**
 * lib/csv-parser.js
 * Utility for parsing and cleansing raw CSV manifest uploads.
 */

window.CSVManager = {
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            this.parse(text);
        };
        reader.readAsText(file);
    },

    parse(csvText) {
        const rows = csvText.split('\n');
        window.AppState.queue = [];
        let errors = 0;

        const startIndex = rows[0].toLowerCase().includes('asin') ? 1 : 0;

        for (let i = startIndex; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            
            const columns = rows[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!columns) continue;

            const asin = columns[0] ? columns[0].replace(/"/g, '').trim() : '';
            let qty = 1;
            let coupon = null;

            if (columns.length >= 2 && columns[1].trim() !== '') {
                const parsedQty = parseInt(columns[1].replace(/"/g, '').trim(), 10);
                if (!isNaN(parsedQty)) qty = parsedQty;
            }

            if (columns.length >= 3 && columns[2].trim() !== '') {
                coupon = columns[2].replace(/"/g, '').trim();
            }

            if (asin) {
                let platform = 'shopsy';
                if (asin.startsWith('B')) platform = 'amazon';
                else if (/^\d+$/.test(asin)) platform = 'flipkart';

                window.AppState.queue.push({ 
                    asin: asin, 
                    quantity: qty, 
                    coupon_code: coupon,
                    platform: platform,
                    status: 'pending_sync',
                    created_at: new Date().toISOString()
                });
            } else {
                errors++;
            }
        }

        if (window.Utils) {
            window.Utils.showToast(`Parsed ${window.AppState.queue.length} orders successfully.`, "success");
        }
        
        // Re-render the active module table to show the pending sync items
        if (window.OrderModule) {
            const orderWrapper = document.querySelector('#module-container');
            if (orderWrapper) window.OrderModule.renderTable(orderWrapper);
        }
    }
};