-- POLICY: Access for Admins to Purchase Requests

create policy "Admins can view all requests"
on public.purchase_requests for select
using (
  exists (select 1 from public.admins where user_id = auth.uid())
);

create policy "Admins can update requests"
on public.purchase_requests for update
using (
  exists (select 1 from public.admins where user_id = auth.uid())
);
