# R.K. Tailors — Gents Specialist

Angular 22 standalone application for the R.K. Tailors public website and authenticated shop workspace. Customer, measurement, order and payment data is read from and written to Supabase; the application does not ship sample business records.

## Requirements

- Node.js 24 or another version supported by the installed Angular CLI
- npm
- A Supabase project with email/password authentication enabled

## Install and run

```powershell
npm.cmd install
npm.cmd start
```

Open `http://localhost:4200`. To create the production bundle:

```powershell
npm.cmd run build
```

The management routes are unavailable until Supabase is configured and an authenticated user has an active admin profile. The public homepage and login remain available.

## Required shop banner

Copy the original, unmodified R.K. Tailors banner image to:

```text
src/assets/images/rk-tailors-banner.png
```

The homepage references that exact path and does not substitute another banner. The workspace did not include the image.

## Supabase setup

1. Create a Supabase project. In **Project Settings → API**, copy the project URL and the **publishable** key (or legacy anon/public key).
2. Set `supabaseUrl` and `supabasePublishableKey` in `src/environments/environment.ts` (or use Supabase's legacy anon/public key). These are browser-visible project configuration values. Never put a service-role/secret key in this Angular application.
3. In the Supabase SQL Editor, run `supabase/migrations/20261030000000_initial_schema.sql`. The migration creates the schema, indexes, RLS policies and transactional RPCs. All application data policies require a signed-in active shop admin; order and payment writes go through database functions.
4. In **Authentication → Settings**, disable public sign-ups. In **Authentication → Users**, create the proprietor/admin account. Public sign-up is not implemented. Copy that user's UUID and authorize it from the SQL Editor:

   ```sql
   insert into public.profiles (user_id, full_name, role, is_active)
   values ('AUTH_USER_UUID'::uuid, 'Shop administrator', 'admin', true);
   ```

   Do not insert a password into `profiles`; Supabase Auth manages credentials. To disable access, set `is_active = false`.
5. In **Authentication → URL Configuration**, set the local site URL to `http://localhost:4200` and add the production origin and redirect URLs when deploying.
6. Restart the dev server after changing the environment file, then sign in at `/login`.

The SQL editor runs with database administrator privileges. Do not expose a database password, service-role key, or secret key in source control, browser code, or build output.

## Implemented workspace

- Public responsive shop homepage, navigation, contact details, and admin sign-in.
- Guarded dashboard with live customer/order/payment totals, delivery reminders, recent orders and an order-status chart.
- Customer search, create/edit, duplicate-mobile protection, archive, and order/measurement history.
- Garment measurements in inches or centimeters, custom numeric fields, copied/edited-as-new versions, immutable version history and numeric measurement values.
- Multi-item orders, optional quick customer creation, generated order numbers, measurement snapshots, status history and upcoming/overdue filters.
- Payment transactions with server-side balance locking and overpayment prevention.
- Date-filtered order/payment/delivery/customer-history reports with CSV export.
- Branded print receipt; use the browser's **Print → Save as PDF**.

## Verify

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

After applying the migration and authorizing an admin, verify a customer, a measurement version, a multi-item order, an advance and follow-up payment, a status change, dashboard/report totals, CSV export and receipt printing in the browser.
