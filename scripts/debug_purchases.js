
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lnhwzzmcmlelpmqptwwz.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZCI6ImxuaHd6em1jbWxlbHBtcXB0d3d6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwNzQ5NTkxNSwiZXhwIjoyMDIzMDcxOTE1fQ.XoR4p-h-Vf_LqH4-U8weVCj7_WCK26vE8Yoe8b3JueZ3fU';

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
