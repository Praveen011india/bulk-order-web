/**
 * lib/csv-parser.js
 * Utility for parsing and cleansing raw CSV manifest uploads.
 */

window.CSVParser = {
    /**
     * Parses raw CSV string into a clean JSON array suitable for Supabase insertion.
     */
    parse(csvText) {
        const rows = csvText.split('\n');
        let parsedQueue = [];
        let errors = 0;

        // Skip header dynamically if the first row contains 'asin'[cite: 1]
        const startIndex = rows[0].toLowerCase().includes('asin') ? 1 : 0;

        for (let i = startIndex; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            
            // Advanced regex parsing to handle escaped quotes inside CSVs[cite: 1]
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
                // Determine platform based on simple ASIN heuristics[cite: 1]
                let platform = 'shopsy';
                if (asin.startsWith('B')) platform = 'amazon';
                else if (/^\d+$/.test(asin)) platform = 'flipkart';

                parsedQueue.push({ 
                    asin: asin, 
                    quantity: qty, 
                    coupon_code: coupon,
                    platform: platform,
                    status: 'pending',
                    created_at: new Date().toISOString()
                });
            } else {
                errors++;
            }
        }

        return {
            success: true,
            data: parsedQueue,
            errorsSkipped: errors
        };
    }
};