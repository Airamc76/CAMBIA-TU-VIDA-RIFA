-- 🎟️ FIX: USER NAME IN CONSULTATION 🎟️
-- Updates get_my_tickets to return full_name.

DROP FUNCTION IF EXISTS public.get_my_tickets(text, text);

CREATE OR REPLACE FUNCTION public.get_my_tickets(p_dni text, p_email text)
RETURNS TABLE (
  id uuid,
  full_name text,
  raffle_title text,
  raffle_total_tickets integer,
  ticket_qty integer,
  amount numeric,
  status text,
  reference text,
  receipt_path text,
  assigned_numbers jsonb,
  created_at timestamp with time zone
) LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.full_name,
    r.title AS raffle_title,
    r.total_tickets AS raffle_total_tickets,
    pr.ticket_qty,
    pr.amount,
    pr.status,
    pr.reference,
    pr.receipt_path,
    pr.assigned_numbers,
    pr.created_at
  FROM public.purchase_requests pr
  JOIN public.raffles r ON pr.raffle_id = r.id
  WHERE pr.national_id = p_dni AND LOWER(pr.email) = LOWER(p_email);
END;
$$;
