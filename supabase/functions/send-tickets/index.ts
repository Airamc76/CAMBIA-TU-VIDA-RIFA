import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
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
        console.log("--- Iniciando send-tickets function ---");

        const body = await req.json();
        console.log("Payload recibido:", JSON.stringify(body, null, 2));

        const record = body.record;

        if (!record) {
            console.error("No record found in the request body.");
            return new Response(JSON.stringify({ error: "No record found" }), { status: 400 });
        }

        console.log(`Processing Purchase ID: ${record.id}, Status: ${record.status}`);

        if (record.status !== "approved" && record.status !== "rejected") {
            console.log("Status is not 'approved' or 'rejected', ignoring.");
            return new Response(JSON.stringify({ msg: "Status ignored" }), { status: 200 });
        }

        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
        const results: any = { email: null, telegram: null };

        // --- LÓGICA PARA COMPRA APROBADA ---
        if (record.status === "approved") {
            // 1. Obtener los números comprados
            let finalNumbers = [];
            const { data: tickets, error: tErr } = await supabase
                .from("raffle_numbers")
                .select("number")
                .eq("purchase_id", record.id);

            if (!tErr && tickets && tickets.length > 0) {
                finalNumbers = tickets.map(t => t.number);
            } else {
                finalNumbers = record.assigned_numbers || [];
            }

            // 2. Obtener info de la rifa
            const { data: raffle, error: rErr } = await supabase
                .from("raffles")
                .select("title, total_tickets")
                .eq("id", record.raffle_id)
                .single();

            if (rErr) throw new Error(`Error fetching raffle: ${rErr.message}`);

            const digits = (raffle.total_tickets - 1).toString().length;
            const ticketNumbersString = finalNumbers.map((n: any) => n.toString().padStart(digits, '0')).join(', ');

            // 3. Enviar EMAIL
            if (RESEND_API_KEY) {
                try {
                    const res = await fetch("https://api.resend.com/emails", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${RESEND_API_KEY}`,
                        },
                        body: JSON.stringify({
                            from: RESEND_FROM_EMAIL,
                            to: [record.email],
                            subject: `🎟️ Tus Tickets para: ${raffle.title}`,
                            html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                          <h1 style="color: #2563eb;">¡Compra Aprobada!</h1>
                          <p>Hola <strong>${record.full_name}</strong>,</p>
                          <p>Tu pago ha sido verificado con éxito. Aquí tienes tus números de la suerte para el sorteo de <strong>${raffle.title}</strong>:</p>
                          
                          <div style="background: #f8fafc; padding: 20px; border-radius: 10px; font-size: 24px; font-weight: bold; letter-spacing: 2px; text-align: center; color: #1e293b; border: 2px dashed #cbd5e1; margin: 20px 0;">
                            ${ticketNumbersString || 'Pendiente'}
                          </div>
      
                          <div style="text-align: center; margin: 30px 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 15px; color: white;">
                            <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">Filipenses 4:19</p>
                            <p style="margin: 0; font-size: 18px; font-weight: bold; line-height: 1.6;">Muchos pueden tener más cosas que tú, pero tú tienes a Dios y él es el proveedor de todas las cosas.</p>
                            <p style="margin: 15px 0 0 0; font-size: 16px; font-style: italic;">Los sueños sí se cumplen</p>
                          </div>
                        </div>
                      `,
                        }),
                    });
                    results.email = await res.json();
                } catch (e) { results.email = { error: e.message }; }
            }

            // 4. Enviar TELEGRAM
            if (TELEGRAM_BOT_TOKEN && record.telegram_chat_id) {
                const telegramMsg = `
🎟️ *¡Tus Tickets para: ${raffle.title}!*

Hola *${record.full_name}*, tu pago ha sido aprobado.

Tus números de la suerte son:
\`${ticketNumbersString || 'Pendiente'}\`

📖 *Filipenses 4:19*
"Muchos pueden tener más cosas que tú, pero tú tienes a Dios y él es el proveedor de todas las cosas."

✨ *Los sueños sí se cumplen*

_Si no tienes Telegram no te preocupes, tus tickets también llegaron a tu correo electrónico. Si tienes dudas, puedes hablarle a nuestro soporte por WhatsApp._
                `.trim();

                const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: record.telegram_chat_id,
                        text: telegramMsg,
                        parse_mode: "Markdown",
                    }),
                });
                results.telegram = await tgRes.json();
            }
        }

        // --- LÓGICA PARA COMPRA RECHAZADA ---
        if (record.status === "rejected") {
            // 1. Enviar EMAIL de rechazo
            if (RESEND_API_KEY) {
                const whatsappLink = "https://api.whatsapp.com/send/?phone=5804140170156&text=Hola, mi reporte de pago fue rechazado. ID: " + record.id;
                try {
                    const res = await fetch("https://api.resend.com/emails", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${RESEND_API_KEY}`,
                        },
                        body: JSON.stringify({
                            from: RESEND_FROM_EMAIL,
                            to: [record.email],
                            subject: `❌ Reporte de Pago Rechazado - ID: ${record.id}`,
                            html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                          <h1 style="color: #dc2626;">Reporte de Pago Rechazado</h1>
                          <p>Hola <strong>${record.full_name}</strong>,</p>
                          <p>Lo sentimos, pero tu reporte de pago no ha podido ser validado por el administrador.</p>
                          
                          <p>Para conocer el motivo o resolver cualquier inconveniente, por favor contacta a nuestro soporte vía WhatsApp haciendo clic en el siguiente botón:</p>
                          
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="${whatsappLink}" style="background-color: #25d366; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">Contactar Soporte por WhatsApp</a>
                          </div>

                          <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 15px; color: #64748b;">
                            <p style="margin: 0; font-size: 14px;">Estamos aquí para ayudarte a completar tu participación.</p>
                          </div>
                        </div>
                      `,
                        }),
                    });
                    results.email = await res.json();
                } catch (e) { results.email = { error: e.message }; }
            }

            // 2. Enviar TELEGRAM de rechazo
            if (TELEGRAM_BOT_TOKEN && record.telegram_chat_id) {
                const whatsappLink = "https://api.whatsapp.com/send/?phone=5804140170156&text=Hola, mi reporte de pago fue rechazado. ID: " + record.id;
                const rejectionMsg = `
❌ *Reporte de Pago Rechazado*

Hola *${record.full_name}*, lo sentimos pero tu reporte de pago no ha podido ser validado por el administrador.

Para conocer el motivo o resolver cualquier inconveniente, por favor contacta a nuestro soporte vía WhatsApp:

👉 [Contactar Soporte por WhatsApp](${whatsappLink})

Estamos aquí para ayudarte.
                `.trim();

                const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: record.telegram_chat_id,
                        text: rejectionMsg,
                        parse_mode: "Markdown",
                        disable_web_page_preview: true
                    }),
                });
                results.telegram = await tgRes.json();
            }
        }

        return new Response(JSON.stringify(results), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
