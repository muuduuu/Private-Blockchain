# CAMTC Backend Setup

## Database initialization

1. Ensure you have a PostgreSQL instance running (local Docker container or managed service).
2. Copy `.env.example` to `.env` and update the `DATABASE_URL` with your connection string. Example:
   ```env
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/camtc
   ```
3. From `backend_gen/`, run:
   ```bash
   npm install
   npm run db:setup
   ```
   The `db:setup` script uses `sql/schema.sql` and `sql/seed.sql` to provision tables and insert the starter provider/patient/transaction data.

The seed script is idempotent, so you can rerun `npm run db:setup` without duplicating records. Adjust `sql/seed.sql` if you want to change the dummy data set.
