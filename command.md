Command	What it does
npm run build:booking	Builds the booking app only
npm run build:admin	Builds the admin app only
npm run build	Builds both (this script was already there)
npm run start	The new concurrently command: runs both production builds (admin :3001, booking :3002) behind the router on :3000
npm run start:booking	Runs only the booking production server
npm run start:admin	Runs only the admin production server
npm run dev	Runs both dev servers (already there)
stripe-listen.cmd	Forwards Stripe webhooks to both apps

npm run build -w @leadgen/booking
npm run build -w @leadgen/admin

concurrently -k -n booking,admin -c blue,magenta "npm run start -w @leadgen/booking" "npm run start -w @leadgen/admin"
