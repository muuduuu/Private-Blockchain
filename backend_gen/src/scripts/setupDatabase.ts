import path from "path";
import { readFile } from "fs/promises";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("⚠️ DATABASE_URL is not set. Please add it to your environment or .env file.");
  process.exit(1);
}

const SQL_DIR = path.resolve(__dirname, "../../sql");

async function runSqlFile(client: Client, filename: string) {
  const absolutePath = path.join(SQL_DIR, filename);
  const statement = await readFile(absolutePath, "utf-8");
  console.log(`➡️ Applying ${filename}...`);
  await client.query(statement);
  console.log(`✅ ${filename} applied.`);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  console.log("🔌 Connecting to database...");
  await client.connect();

  try {
    await runSqlFile(client, "schema.sql");
    await runSqlFile(client, "seed.sql");
    console.log("🎉 Database schema and seed data applied successfully.");
  } catch (error) {
    console.error("❌ Failed to initialize database", error);
    process.exitCode = 1;
  } finally {
    await client.end();
    console.log("🔌 Connection closed.");
  }
}

main();
