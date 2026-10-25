@echo off
rem Forwards Stripe test events to the local apps. Run from the repo root:  stripe-listen.cmd
rem Uses the app's own sandbox key from .env.local (not the CLI's login, which is a different account).
rem   subscriptions (what businesses pay you)  -> admin   localhost:3000/api/webhooks/stripe-billing
rem   deposits on detailers' connected accounts -> booking localhost:3000/api/webhooks/stripe
rem Both go through the dev router on :3000 (npm run dev), which sends each to its app.
cd /d "%~dp0"
set KEY=
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b "STRIPE_SECRET_KEY=" .env.local`) do set KEY=%%b
if not defined KEY (
  echo Couldn't find STRIPE_SECRET_KEY in .env.local
  exit /b 1
)
rem %%KEY%% is passed through literally and expanded by each child shell, so concurrently's logs don't print the key.
npx concurrently -k -n connect,billing -c cyan,yellow ".\stripe.exe listen --api-key %%KEY%% --forward-connect-to localhost:3000/api/webhooks/stripe" ".\stripe.exe listen --api-key %%KEY%% --forward-to localhost:3000/api/webhooks/stripe-billing"
