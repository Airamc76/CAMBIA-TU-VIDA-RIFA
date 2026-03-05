import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnhwzzmcmlelpmqptwwz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaHd6em1jbWxlbHBtcXB0d3d6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE3NzI4MCwiZXhwIjoyMDg0NzUzMjgwfQ.uZZ8j5mxqlA4Fke8b3JueZ3fU8weVCj7_WCK26vE8Yo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPurchases() {
    console.log("Checking purchases in the last 3 days...");
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('purchase_requests')
        .select('id, status, amount, created_at, full_name, reference')
        .gte('created_at', threeDaysAgo)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching purchases:", error);
        return;
    }

    console.log(`Found ${data?.length || 0} purchases in the last 3 days.`);
    if (data && data.length > 0) {
        console.log(JSON.stringify(data, null, 2));
    }
}

checkPurchases();
