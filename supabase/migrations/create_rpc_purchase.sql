-- RPC: Secure function to create purchase requests
-- This avoids RLS issues by running as 'Security Definer' (System Level)

create or replace function public.create_purchase_request(
  p_raffle_id uuid,
  p_full_name text,
  p_national_id text,
  p_email text,
  p_whatsapp text,
  p_ticket_qty int,
  p_amount numeric,
  p_payment_method text,
  p_reference text,
  p_receipt_path text
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into public.purchase_requests (
    raffle_id, 
    full_name, 
    national_id, 
    email, 
    whatsapp, 
    ticket_qty, 
    amount, 
    payment_method, 
    reference, 
    receipt_path,
    status,
    user_id -- Explicitly null for checks
  ) values (
    p_raffle_id, 
    p_full_name, 
    p_national_id, 
    p_email, 
    p_whatsapp,
    p_ticket_qty, 
    p_amount, 
    p_payment_method, 
    p_reference, 
    p_receipt_path,
    'pending',
    auth.uid() -- Will be null for anon, or user_id if logged in
  ) returning id into v_id;
  
  return v_id;
end;
$$;

-- Grant access to everyone
grant execute on function public.create_purchase_request to anon, authenticated, service_role;
