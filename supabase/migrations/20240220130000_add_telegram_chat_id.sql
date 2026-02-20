-- 🎟️ TELEGRAM INTEGRATION: SCHEMA UPDATE 🎟️
-- Adds telegram_chat_id to track bot subscriptions for automated ticket delivery.

ALTER TABLE public.purchase_requests 
ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- Add index for faster lookups by chat_id
CREATE INDEX IF NOT EXISTS idx_purchase_telegram_chat ON public.purchase_requests(telegram_chat_id);
