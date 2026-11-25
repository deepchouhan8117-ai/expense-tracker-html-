# Expense Tracker

The app is served by an Express backend. The frontend calls the same-origin API for transactions and budgets; data is stored in `data/expense-data.json`.

## Run locally

1. Install Node.js 18 or newer.
2. From the project folder run `npm install`.
3. Run `npm start` and open <http://localhost:3000>.
4. To run the API tests, use `npm test`.

## Deploy

GitHub Pages only serves static files and cannot run this backend. Deploy the whole repository as a Node web service on a host such as Render, with build command `npm install` and start command `npm start`. The host must provide a persistent disk; set `DATA_DIR` to its mount path or saved transactions and budgets can be lost when the service restarts.

The API currently has no user authentication, and all clients of one deployed service share its data. Do not expose it publicly with real financial data until authentication and per-user data isolation are added. Keep this app local or on a trusted private network in the meantime.

Existing data saved by the old browser-only page is not automatically imported; the backend starts with an empty data file.
