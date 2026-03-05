import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

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
        console.table(data);
    }
}

checkPurchases();
