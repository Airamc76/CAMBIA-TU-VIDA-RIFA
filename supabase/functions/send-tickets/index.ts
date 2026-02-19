import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const body = await req.json();
        console.log("Received Webhook Body:", JSON.stringify(body, null, 2));

        const record = body.record;

        if (!record) {
            console.error("No record found in the request body.");
            return new Response(JSON.stringify({ error: "No record found" }), { status: 400 });
        }

        console.log(`Processing Purchase ID: ${record.id}, Status: ${record.status}`);

        if (record.status !== "approved") {
            console.log("Status is not 'approved', ignoring.");
            return new Response(JSON.stringify({ msg: "Not approved status" }), { status: 200 });
        }

        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

        // 1. Obtener los números comprados (Fallback al payload del webhook si la DB falla)
        let finalNumbers = [];
        const { data: tickets, error: tErr } = await supabase
            .from("raffle_numbers")
            .select("number")
            .eq("purchase_id", record.id);

        if (!tErr && tickets && tickets.length > 0) {
            finalNumbers = tickets.map(t => t.number);
            console.log("Numbers retrieved from database.");
        } else {
            finalNumbers = record.assigned_numbers || [];
            console.log("Numbers retrieved from webhook payload (fallback).");
        }

        // 2. Obtener info de la rifa
        const { data: raffle, error: rErr } = await supabase
            .from("raffles")
            .select("title, total_tickets")
            .eq("id", record.raffle_id)
            .single();

        if (rErr) throw new Error(`Error fetching raffle: ${rErr.message}`);

        // Calcular padding dinámico basado en el total de tickets (ej: 1000 -> 3 dígitos)
        const digits = (raffle.total_tickets - 1).toString().length;
        const ticketNumbersString = finalNumbers.map((n: any) => n.toString().padStart(digits, '0')).join(', ');

        if (!ticketNumbersString) {
            console.warn("No numbers found to send.");
        }

        // 3. Enviar con Resend
        console.log(`Sending email to ${record.email} from ${RESEND_FROM_EMAIL}`);
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
              ${ticketNumbersString || 'Pendiente de asignación'}
            </div>

            <div style="text-align: center; margin: 30px 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 15px; color: white;">
              <p style="margin: 0; font-size: 18px; font-weight: bold; line-height: 1.6;">
                Muchos pueden tener más cosas que tú, pero tú tienes a Dios y él es el proveedor de todas las cosas.
              </p>
              <p style="margin: 15px 0 0 0; font-size: 16px; font-style: italic;">
                Los sueños sí se cumplen
              </p>
            </div>

            <p style="font-size: 12px; color: #64748b;">
              Si tienes alguna duda, contáctanos por WhatsApp. ¡Mucha suerte!
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="text-align: center; font-size: 10px; color: #94a3b8;">CambiatuvidaConDavid &copy; 2024</p>
          </div>
        `,
            }),
        });

        const resData = await res.json();
        console.log("Resend API Result:", JSON.stringify(resData, null, 2));

        return new Response(JSON.stringify(resData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
