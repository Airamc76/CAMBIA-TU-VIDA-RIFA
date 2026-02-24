import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing config");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Query all purchase requests to see status
    console.log("Querying purchase_requests...");
    const { data, error } = await supabase
        .from('purchase_requests')
        .select('id, raffle_id, status, national_id, amount, ticket_qty');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${data.length} total purchase requests`);
        const approved = data.filter(d => d.status === 'approved');
        console.log(`Found ${approved.length} APPROVED purchase requests`);

        // Check RPC
        if (approved.length > 0) {
            const raffleId = approved[0].raffle_id;
            console.log(`\nTesting get_top_buyers for raffle: ${raffleId}`);
            const rpcResult = await supabase.rpc('get_top_buyers', { p_raffle_id: raffleId });
            console.log("RPC Result:", rpcResult);
        }
    }
}

main();
