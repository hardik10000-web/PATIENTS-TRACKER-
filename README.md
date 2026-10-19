# Patient Registration + Doctor Dashboard

A starter project using HTML, CSS, JavaScript, Supabase Auth, PostgreSQL, and Supabase Realtime.

## Project files
- `index.html` — public patient registration form
- `doctor.html` — password-protected dashboard
- `styles.css` — responsive styling
- `app.js` — registration and printable receipt
- `doctor.js` — sign-in, patient queue, search, status updates, live refresh
- `config.js` — Supabase project URL and publishable/anon key
- `schema.sql` — database schema, access policies, token-generation RPC

## Setup in VS Code

1. Create a Supabase project at https://supabase.com/ and keep the project region appropriate for your clinic.
2. In Supabase, open **SQL Editor**, create a query, paste all of `schema.sql`, and run it.
3. In Supabase **Project Settings / API** (the labels may vary), copy the Project URL and the publishable key (or legacy anon key). Paste these into `config.js`.
   - Never paste a `service_role` key or any secret key into browser code.
4. In Supabase **Authentication > Providers / Sign-in**, keep public email sign-ups disabled.
5. In **Authentication > Users**, create the doctor's account with a strong password. Use only authorized staff accounts. If email confirmation is enabled, confirm the account.
6. In Supabase **Database > Publications**, verify that `patients` is enabled for `supabase_realtime` if live updates do not appear.
7. In VS Code, open this folder and run it with the **Live Server** extension, or from a terminal run a local static server. Do not open `index.html` as a `file://` URL.
8. Visit the local URL for `index.html`. Submit a test registration, then sign in at `doctor.html` using the doctor account. Verify the queue and status changes.
9. For hosting, deploy these static files to a host such as Netlify or GitHub Pages. Configure the same Supabase URL/key in `config.js` before deployment. Both pages should be hosted on the same site.

## Security and real-world use

This is a starter implementation, not a certified electronic medical record system. Patient data is sensitive:
- Do not collect detailed medical history or documents through this starter form.
- Use a unique strong password, MFA where available, private devices, screen locking, and restricted staff accounts.
- Keep the Supabase project private to authorized administrators. Never share database credentials.
- The public registration RPC can be abused by bots; add CAPTCHA/rate limiting using a trusted server or edge function before opening the form publicly.
- Review applicable Indian privacy, healthcare, and record-retention requirements with a qualified professional before using it with real patients.
- The dashboard currently grants any authenticated Supabase user read/update access to patient rows. Therefore, public sign-up must remain disabled and only trusted staff accounts may exist. For a multi-staff clinic, implement role-based authorization before adding more accounts.
- Daily token numbering is generated atomically in the database using India-local date. Token sequence resets daily; numbers may have gaps if a database transaction fails after allocation.
- Back up your database and test restore procedures before real use.

## Common troubleshooting
- **Setup warning:** check `config.js` URL and key, and ensure the Supabase CDN script loads.
- **Login fails:** create the doctor account in Supabase Auth; do not try public sign-up.
- **Registration fails:** re-run `schema.sql`, check SQL Editor errors, and inspect browser developer console.
- **No live refresh:** ensure `patients` is added to the `supabase_realtime` publication and that the dashboard is signed in.
