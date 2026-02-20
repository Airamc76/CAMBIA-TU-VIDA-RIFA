import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    'https://mcmlelpmqptwwzscymly.supabase.co',
    'SUPABASE_ANON_KEY' // I'll replace this with the actual key from env if I can, or just check the schema
)

async function check() {
    const { data, count } = await supabase
        .from('purchase_requests')
        .select('id, full_name, telegram_chat_id')
        .not('telegram_chat_id', 'is', null)

    console.log(`Found ${count} linked Telegram accounts:`, data)
}
