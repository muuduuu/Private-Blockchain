import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg";

export interface DatabaseClientOptions {
  connectionString?: string;
  poolConfig?: PoolConfig;
  logger?: typeof console;
}

export class DatabaseClient {
  private pool?: Pool;
  private logger: typeof console;
  private readonly connectionString: string;
  private readonly poolConfig?: PoolConfig;

  constructor(options: DatabaseClientOptions = {}) {
    this.logger = options.logger ?? console;
    this.connectionString = options.connectionString ?? process.env.DATABASE_URL ?? "";
    this.poolConfig = options.poolConfig;

    if (!this.connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }
  }

  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    this.pool = new Pool({
      connectionString: this.connectionString,
      ...this.poolConfig
    });

    await this.healthCheck();
    this.logger.info("[Database] Connected to Postgres");
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error("Database client has not been connected");
    }
    return this.pool.query<T>(text, params);
  }

  async close(): Promise<void> {
    if (!this.pool) {
      return;
    }
    await this.pool.end();
    this.pool = undefined;
  }

  private async healthCheck(): Promise<void> {
    if (!this.pool) {
      return;
    }
    await this.pool.query("SELECT 1");
  }
}
