import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    'https://lnhwzzmcmlelpmqptwwz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaHd6em1jbWxlbHBtcXB0d3d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNzcyODAsImV4cCI6MjA4NDc1MzI4MH0.ZhZAlKuZCsT8BFjn_pFPRZQyOl9jWEJjX-gIUg6V6Ss'
)

async function check() {
    const { data, count } = await supabase
        .from('purchase_requests')
        .select('id, full_name, telegram_chat_id')
        .not('telegram_chat_id', 'is', null)

    console.log(`Found ${count} linked Telegram accounts:`, data)
}
