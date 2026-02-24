import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

serve(async (req) => {
    try {
        const botInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
        const botInfo = await botInfoRes.json();

        const webhookInfoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
        const webhookInfo = await webhookInfoRes.json();

        return new Response(JSON.stringify({
            bot_info: botInfo,
            webhook_info: webhookInfo,
            project_env: {
                has_token: !!TELEGRAM_BOT_TOKEN,
                token_prefix: TELEGRAM_BOT_TOKEN ? TELEGRAM_BOT_TOKEN.slice(0, 5) : null
            }
        }, null, 2), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
