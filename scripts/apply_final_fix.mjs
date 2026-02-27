import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    const sql = fs.readFileSync('supabase/migrations/20240227150000_fix_bugs_raffle_and_emails.sql', 'utf8');

    console.log('Applying migration via RPC or direct query if possible...');

    // Note: Most Supabase projects don't have a public 'exec_sql' RPC for security.
    // I'll try to use a common one if it exists or just report the need for manual execution.
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Could not apply SQL via RPC (expected for security):', error.message);
        console.log('\n--- PLEASE APPLY THIS SQL MANUALLY IN SUPABASE DASHBOARD ---\n');
        console.log(sql);
        console.log('\n------------------------------------------------------------\n');
    } else {
        console.log('Migration applied successfully!');
    }
}

applyMigration();
