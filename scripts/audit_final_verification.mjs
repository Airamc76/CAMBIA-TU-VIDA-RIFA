
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.staging' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.staging");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
    console.log("--- Starting Backend Audit ---");

    // 1. Find the purchase
    const { data: purchase, error: findError } = await supabase
        .from('purchases')
        .select('*')
        .eq('dni', '99887766')
        .single();

    if (findError || !purchase) {
        console.error("Could not find test purchase for DNI 99887766:", findError?.message || "Not found");
        process.exit(1);
    }

    console.log(`Found Purchase: ${purchase.id} (Status: ${purchase.status})`);

    if (purchase.status === 'approved') {
        console.log("Purchase already approved. Skipping approval step.");
    } else {
        // 2. Approve the purchase using the RPC if possible or direct update
        // Note: The app uses an RPC 'assign_tickets' or similar likely triggered by update
        console.log("Approving purchase...");
        const { data: result, error: approveError } = await supabase.rpc('approve_purchase_v1', {
            p_purchase_id: purchase.id
        });

        if (approveError) {
            console.error("Error approving purchase via RPC:", approveError.message);
            // Fallback: direct update if RPC fails
            console.log("Attempting direct update fallback...");
            const { error: updateError } = await supabase
                .from('purchases')
                .update({ status: 'approved' })
                .eq('id', purchase.id);

            if (updateError) {
                console.error("Direct update failed:", updateError.message);
                process.exit(1);
            }
        }
        console.log("Purchase approved successfully.");
    }

    // 3. Verify tickets assigned
    const { data: tickets, error: ticketError } = await supabase
        .from('tickets')
        .select('number')
        .eq('purchase_id', purchase.id);

    if (ticketError) {
        console.error("Error fetching tickets:", ticketError.message);
        process.exit(1);
    }

    console.log(`Assigned Tickets: ${tickets.map(t => t.number).join(', ')}`);

    if (tickets.length === 0) {
        console.error("CRITICAL: No tickets assigned after approval!");
        process.exit(1);
    }

    console.log("--- Backend Audit Successful ---");
}

runAudit();
