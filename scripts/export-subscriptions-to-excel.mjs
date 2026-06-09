import { connectToDatabase } from '../server/mongo.js';
import { decrypt } from '../server/encryption.js';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportSubscriptionsToExcel() {
    try {
        console.log('🔄 Connecting to database...');
        const db = await connectToDatabase();
        
        // Find Perfecta Consulting company
        const companiesCollection = db.collection('companies');
        const perfectaCompany = await companiesCollection.findOne({ 
            $or: [
                { name: /Perfecta.*Consulting/i },
                { name: /Perfecta/i }
            ]
        });
        
        if (!perfectaCompany) {
            console.error('❌ Could not find Perfecta Consulting in database');
            console.log('Available companies:');
            const allCompanies = await companiesCollection.find({}).toArray();
            allCompanies.forEach(c => console.log(`  - ${c.name} (ID: ${c._id})`));
            return;
        }
        
        console.log('✓ Found company:', perfectaCompany.name);
        
        // Fetch active subscriptions
        const subscriptionsCollection = db.collection('subscriptions');
        const subscriptions = await subscriptionsCollection.find({
            tenantId: perfectaCompany._id.toString(),
            status: 'Active'
        }).toArray();
        
        console.log(`✓ Found ${subscriptions.length} active subscriptions`);
        
        if (subscriptions.length === 0) {
            console.log('⚠️  No active subscriptions found');
            return;
        }
        
        // Process subscriptions
        const subscriptionData = [];
        let totalMonthly = 0;
        
        for (const sub of subscriptions) {
            try {
                const serviceName = sub.serviceName || 'Unknown';
                const vendor = sub.vendor ? decrypt(sub.vendor) : '';
                const rawAmount = sub.lcyAmount || sub.totalAmountInclTax || sub.totalAmount || sub.amount;
                const amount = rawAmount ? parseFloat(decrypt(rawAmount)) : 0;
                const billingCycle = sub.billingCycle || 'Monthly';
                const category = sub.category || 'Other';
                
                // Calculate monthly equivalent
                let monthly = 0;
                const cycle = billingCycle.toLowerCase();
                if (cycle.includes('month')) monthly = amount;
                else if (cycle.includes('quarter')) monthly = amount / 3;
                else if (cycle.includes('year') || cycle.includes('annual')) monthly = amount / 12;
                else if (cycle.includes('week')) monthly = amount * 4;
                else monthly = amount;
                
                subscriptionData.push({
                    serviceName,
                    vendor,
                    amount,
                    billingCycle,
                    category,
                    monthly
                });
                
                totalMonthly += monthly;
            } catch (err) {
                console.warn(`⚠️  Could not process subscription: ${sub.serviceName}`, err.message);
            }
        }
        
        console.log(`✓ Processed ${subscriptionData.length} subscriptions`);
        console.log(`✓ Total Monthly Spend: $${totalMonthly.toFixed(2)}`);
        
        // Update Excel file
        const excelPath = path.join(__dirname, '../../Perfecta_Dashboard_With_Filters.xlsx');
        const workbook = new ExcelJS.Workbook();
        
        try {
            await workbook.xlsx.readFile(excelPath);
            console.log('✓ Loaded existing Excel file');
        } catch (err) {
            console.log('Creating new Excel file...');
        }
        
        // Remove old SubscriptionData sheet if exists
        let subSheet = workbook.getWorksheet('SubscriptionData');
        if (subSheet) {
            workbook.removeWorksheet(subSheet.id);
        }
        
        // Create new sheet
        subSheet = workbook.addWorksheet('SubscriptionData');
        
        // Headers
        subSheet.getRow(1).values = ['Service Name', 'Vendor', 'Amount (LCY)', 'Billing Cycle', 'Category', 'Monthly Equivalent'];
        subSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        subSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        subSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
        subSheet.getRow(1).height = 25;
        
        // Column widths
        subSheet.getColumn(1).width = 30;
        subSheet.getColumn(2).width = 25;
        subSheet.getColumn(3).width = 15;
        subSheet.getColumn(4).width = 15;
        subSheet.getColumn(5).width = 25;
        subSheet.getColumn(6).width = 18;
        
        // Add data
        subscriptionData.forEach((sub, index) => {
            const row = index + 4;
            subSheet.getRow(row).values = [
                sub.serviceName,
                sub.vendor,
                sub.amount,
                sub.billingCycle,
                sub.category
            ];
            
            subSheet.getCell(`C${row}`).numFmt = '$#,##0.00';
            
            // Formula for monthly equivalent
            const cycle = sub.billingCycle.toLowerCase();
            let formula = `C${row}`;
            if (cycle.includes('quarter')) formula = `C${row}/3`;
            else if (cycle.includes('year') || cycle.includes('annual')) formula = `C${row}/12`;
            else if (cycle.includes('week')) formula = `C${row}*4`;
            
            subSheet.getCell(`F${row}`).value = { formula };
            subSheet.getCell(`F${row}`).numFmt = '$#,##0.00';
            
            // Styling
            if (index % 2 === 0) {
                for (let col = 1; col <= 6; col++) {
                    subSheet.getRow(row).getCell(col).fill = { 
                        type: 'pattern', 
                        pattern: 'solid', 
                        fgColor: { argb: 'FFF2F2F2' } 
                    };
                }
            }
        });
        
        // Summary
        const summaryRow = subscriptionData.length + 5;
        subSheet.mergeCells(`A${summaryRow}:E${summaryRow}`);
        subSheet.getCell(`A${summaryRow}`).value = 'TOTAL MONTHLY SPEND';
        subSheet.getCell(`A${summaryRow}`).font = { bold: true, size: 12 };
        subSheet.getCell(`A${summaryRow}`).alignment = { horizontal: 'right' };
        
        subSheet.getCell(`F${summaryRow}`).value = { formula: `SUM(F4:F${summaryRow - 1})` };
        subSheet.getCell(`F${summaryRow}`).numFmt = '$#,##0.00';
        subSheet.getCell(`F${summaryRow}`).font = { bold: true, size: 14, color: { argb: 'FF2E75B6' } };
        subSheet.getCell(`F${summaryRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7F3FF' } };
        
        // Save
        await workbook.xlsx.writeFile(excelPath);
        
        console.log('\n✅ SUCCESS!');
        console.log(`✅ Updated Excel file with ${subscriptionData.length} real subscriptions`);
        console.log(`✅ Total Monthly Spend: $${totalMonthly.toFixed(2)}`);
        console.log('\n📊 Subscriptions:');
        subscriptionData.forEach((sub, i) => {
            console.log(`  ${i + 1}. ${sub.serviceName} ($${sub.monthly.toFixed(2)}/month)`);
        });
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

exportSubscriptionsToExcel();
