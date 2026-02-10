# Beta Deployment Guide

This guide outlines the steps required to deploy the first beta of the raffle application to a production environment.

## 1. Supabase Backend Preparation

### SQL Migrations
Ensure all SQL scripts provided in the `supabase/migrations` folder have been executed in the Supabase SQL Editor. Critical items:
-   `setup_complete.sql` (Schema, RLS, and logic basics)
-   `production_optimization.sql` (Indexes and RPC fixes)
-   `switch_to_5digit_random.sql` (Final ticket generation logic)

### Edge Function Configuration
The `send-tickets` function requires secrets to be set in Supabase to send emails via Resend.
Run these commands in your terminal (using Supabase CLI):

```bash
supabase secrets set RESEND_API_KEY=tu_clave_de_resend
supabase secrets set RESEND_FROM_EMAIL=notificaciones@tu_dominio.com
```

Then deploy the function:
```bash
supabase functions deploy send-tickets
```

## 2. Frontend Deployment

### Environment Variables
Configure the following environment variables in your deployment platform (Vercel, Netlify, etc.):
-   `VITE_SUPABASE_URL`: Your Supabase Project URL.
-   `VITE_SUPABASE_ANON_KEY`: Your Supabase Anonymous Key.

### Build Command
Use the following settings:
-   **Build Command:** `npm run build`
-   **Output Directory:** `dist`

## 3. Handling Secret Exposure (CRITICAL)

> [!CAUTION]
> If your secrets (Supabase keys, Resend API key) were accidentally committed to Git:
> 1. **Rotate Keys**: Immediately generate new keys in the [Supabase Dashboard](https://supabase.com/dashboard/project/_/settings/api).
> 2. **Update environment variables**: Put the new keys in your `.env.local` and update the site settings in Netlify.
> 3. **Purge History**: Use `git filter-repo` or `bfg-repo-cleaner` to scrub the old keys from all previous commits.

## 4. Post-Deployment Checks
-   **Auth Redirects**: In Supabase Dashboard > Authentication > URL Configuration, set the "Site URL" to your production domain.
-   **CORS**: Ensure your production domain is allowed in Supabase CORS settings (usually allowed by default).
-   **Beta Database**: Remember that approval of a ticket will trigger a real email if the Resend API key is valid.
