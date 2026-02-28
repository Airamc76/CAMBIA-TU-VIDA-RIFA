import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
)

async function check() {
    const { data, count } = await supabase
        .from('purchase_requests')
        .select('id, full_name, telegram_chat_id')
        .not('telegram_chat_id', 'is', null)

    console.log(`Found ${count} linked Telegram accounts:`, data)
}
