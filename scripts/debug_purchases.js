
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function debug() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    console.log('--- 🛡️ DEBUGGING PURCHASE VISIBILITY ---');

    // 1. Check total counts
    const { count: total, error: countErr } = await supabase
        .from('purchase_requests')
        .select('*', { count: 'exact', head: true });

    if (countErr) {
        console.error('Error counting requests:', countErr);
    } else {
        console.log(`Total purchase requests: ${total}`);
    }

    // 2. Last 10 purchases
    const { data: lastPurchases, error: lastErr } = await supabase
        .from('purchase_requests')
        .select('id, full_name, email, national_id, status, created_at, raffle_id, reference')
        .order('created_at', { ascending: false })
        .limit(10);

    if (lastErr) {
        console.error('Error fetching last purchases:', lastErr);
    } else {
        console.log('\n--- LAST 10 PURCHASES ---');
        console.table(lastPurchases);
    }

    // 3. Check for any 'pending' that might be hidden
    const { data: pending, error: pendErr } = await supabase
        .from('purchase_requests')
        .select('id, full_name, status')
        .eq('status', 'pending');

    if (pendErr) {
        console.error('Error fetching pending:', pendErr);
    } else {
        console.log(`\nPending count (from service_role): ${pending?.length || 0}`);
    }
}

debug();
