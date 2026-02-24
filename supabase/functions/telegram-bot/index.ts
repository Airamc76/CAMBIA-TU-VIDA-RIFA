import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const payload = await req.json();
        console.log("Telegram Webhook received:", JSON.stringify(payload, null, 2));

        const message = payload.message;
        if (!message || !message.text) {
            return new Response("ok", { status: 200 });
        }

        const chatId = message.chat.id;
        const text = message.text;

        console.log(`Received from ${chatId}: ${text}`);

        // Pattern: /start PURCHASE_UUID
        if (text.startsWith("/start ")) {
            const purchaseId = text.split(" ")[1];

            if (purchaseId && purchaseId.length > 30) {
                const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

                const { error } = await supabase
                    .from("purchase_requests")
                    .update({ telegram_chat_id: chatId.toString() })
                    .eq("id", purchaseId);

                if (error) {
                    console.error("Error linking chat_id:", error);
                    await sendTelegramMessage(chatId, "❌ Hubo un error al vincular tus tickets. Por favor intenta de nuevo.");
                } else {
                    await sendTelegramMessage(chatId, "✅ ¡Vinculado con éxito! Recibirás tus tickets por aquí en cuanto el administrador apruebe tu pago.\n\n🔔 *Funciones:* \n• Te avisaremos cuando tus tickets sean aprobados o si hay algún problema.\n• Puedes escribir /compras en cualquier momento para ver el estatus de tus reportes y números de rifa.");
                    console.log(`Linked chatId ${chatId} to purchase ${purchaseId}`);
                }
            } else {
                await sendTelegramMessage(chatId, "⚠️ El código de vinculación parece inválido. Asegúrate de usar el enlace que aparece al finalizar tu reporte.");
            }
        } else if (text === "/start") {
            await sendTelegramMessage(chatId, "👋 ¡Hola! Soy el bot de notificaciones de David. \n\nPara recibir tus tickets por aquí, presiona el botón 'RECIBIR POR TELEGRAM' que te aparecerá al finalizar tu reporte de pago en nuestra web.\n\n🔔 *Funciones:* \n• Te avisaremos cuando tus tickets sean aprobados.\n• Te avisaremos si hay algún problema con tu pago.\n• Puedes escribir /compras en cualquier momento para ver el estatus de tus reportes y números de rifa.");
        } else if (text === "/estado") {
            await sendTelegramMessage(chatId, "⚠️ El comando cambió: usa /compras para ver tus compras y tickets confirmados.");
        } else if (text === "/compras") {
            const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

            // Buscar las últimas compras vinculadas a este chat_id
            const { data, error } = await supabase
                .from("purchase_requests")
                .select("id, status, raffle_id, amount, assigned_numbers, raffles(title)")
                .eq("telegram_chat_id", chatId.toString())
                .order("created_at", { ascending: false })
                .limit(5);

            if (error || !data || data.length === 0) {
                await sendTelegramMessage(chatId, "📝 No registramos compras confirmadas todavía. \n\nAsegúrate de haber presionado el botón de vinculación en la web al finalizar tu reporte.");
            } else {
                let statusMsg = "📊 *Tus compras:* \n\n";
                data.forEach((p: any) => {
                    const statusIcon = p.status === 'approved' ? '✅' : p.status === 'rejected' ? '❌' : '⏳';
                    const statusText = p.status === 'approved' ? 'Aprobado' : p.status === 'rejected' ? 'Rechazado' : 'Pendiente';

                    statusMsg += `• Rifa: ${p.raffles?.title || 'Generíca'}\n`;
                    statusMsg += `• Compra UID: ${p.id.slice(0, 8)}\n`;
                    statusMsg += `• Estado: ${statusIcon} ${statusText}\n`;

                    if (p.assigned_numbers && p.assigned_numbers.length > 0) {
                        const maxDisplay = 10;
                        const numbers = p.assigned_numbers;
                        const displayNums = numbers.slice(0, maxDisplay).join(", ");
                        statusMsg += `• Números: ${displayNums}${numbers.length > maxDisplay ? ` (+${numbers.length - maxDisplay} más)` : ''}\n`;
                    }

                    if (p.amount) {
                        statusMsg += `• Total: ${p.amount} BS\n`;
                    }
                    statusMsg += `—\n\n`;
                });

                if (data.some((p: any) => p.status === 'rejected')) {
                    statusMsg += "⚠️ *Nota:* Si tienes un reporte rechazado, por favor contacta a soporte vía WhatsApp.";
                }

                await sendTelegramMessage(chatId, statusMsg);
            }
        } else {
            console.log("No specific command match.");
        }

        return new Response("ok", { status: 200 });
    } catch (error: any) {
        console.error("Webhook error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
});

async function sendTelegramMessage(chatId: number, text: string) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
        }),
    });
}
