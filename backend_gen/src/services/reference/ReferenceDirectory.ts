import { promises as fs } from "fs";
import { FILE_ENCODING, REFERENCE_DATA_FILE, REFERENCE_DIR } from "../../config/constants";
import { DEFAULT_REFERENCE_DATA, PatientRecord, ProviderRecord, ReferenceDirectoryData, ValidatorRecord } from "../../config/referenceData";
import { DatabaseClient } from "../database/DatabaseClient";

export class ReferenceDirectory {
  private logger: typeof console;
  private data: ReferenceDirectoryData = DEFAULT_REFERENCE_DATA;
  private readonly database?: DatabaseClient;

  constructor(database?: DatabaseClient, logger: typeof console = console) {
    this.logger = logger;
    this.database = database;
  }

  async initialize(): Promise<void> {
    if (this.database) {
      try {
        await this.loadFromDatabase();
        return;
      } catch (error) {
        this.logger.error("[ReferenceDirectory] Failed to load from database, falling back to filesystem", error);
      }
    }

    await this.loadFromFilesystem();
  }

  getProviders() {
    return this.data.providers;
  }

  getPatients() {
    return this.data.patients;
  }

  getValidators() {
    return this.data.validators;
  }

  private async loadFromDatabase(): Promise<void> {
    if (!this.database) {
      throw new Error("Database client not available");
    }

    const [providers, patients, validators] = await Promise.all([
      this.fetchProviders(),
      this.fetchPatients(),
      this.fetchValidators()
    ]);

    this.data = { providers, patients, validators };
    this.logger.info(
      `[ReferenceDirectory] Loaded ${providers.length} providers, ${patients.length} patients, ${validators.length} validators from database`
    );
  }

  private async fetchProviders(): Promise<ProviderRecord[]> {
    if (!this.database) return [];
    const result = await this.database.query<{
      id: string;
      name: string;
      specialty: string;
      contact: Record<string, unknown> | null;
    }>("SELECT id, name, specialty, contact FROM providers ORDER BY name ASC");

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      specialty: row.specialty,
      contact: this.extractContact(row.contact)
    }));
  }

  private async fetchPatients(): Promise<PatientRecord[]> {
    if (!this.database) return [];
    const result = await this.database.query<{
      id: string;
      full_name: string;
      date_of_birth: Date | string;
      primary_provider_id: string | null;
    }>(
      "SELECT id, full_name, date_of_birth, primary_provider_id FROM patients ORDER BY created_at DESC LIMIT 500"
    );

    return result.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      dateOfBirth: this.toIsoDate(row.date_of_birth),
      primaryProviderId: row.primary_provider_id ?? undefined
    }));
  }

  private async fetchValidators(): Promise<ValidatorRecord[]> {
    if (!this.database) return [];
    const result = await this.database.query<{
      id: string;
      tier: string;
      reputation: string | number;
      blocks_proposed: number;
      uptime: string | number;
      last_seen: Date | string;
    }>("SELECT id, tier, reputation, blocks_proposed, uptime, last_seen FROM validators ORDER BY tier, id");

    return result.rows.map((row) => ({
      id: row.id,
      tier: (row.tier as ValidatorRecord["tier"]) ?? "Tier-3",
      reputation: Number(row.reputation ?? 0),
      blocksProposed: row.blocks_proposed,
      uptime: Number(row.uptime ?? 0),
      lastSeen: this.toIsoDateTime(row.last_seen)
    }));
  }

  private extractContact(contact: Record<string, unknown> | null | undefined): string | undefined {
    if (!contact || typeof contact !== "object") {
      return undefined;
    }
    const values = Object.values(contact).filter((value): value is string => typeof value === "string");
    if (values.length === 0) {
      return undefined;
    }
    return values[0];
  }

  private toIsoDate(value: Date | string | null | undefined): string {
    const date = this.toDate(value);
    return date.toISOString().split("T")[0];
  }

  private toIsoDateTime(value: Date | string | null | undefined): string {
    return this.toDate(value).toISOString();
  }

  private toDate(value: Date | string | null | undefined): Date {
    if (!value) {
      return new Date(0);
    }
    if (value instanceof Date) {
      return value;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  private async loadFromFilesystem(): Promise<void> {
    await fs.mkdir(REFERENCE_DIR, { recursive: true });
    const exists = await this.exists(REFERENCE_DATA_FILE);
    if (!exists) {
      await fs.writeFile(REFERENCE_DATA_FILE, JSON.stringify(DEFAULT_REFERENCE_DATA, null, 2), FILE_ENCODING);
      this.data = DEFAULT_REFERENCE_DATA;
      this.logger.info("[ReferenceDirectory] Wrote default directory dataset");
      return;
    }

    try {
      const raw = await fs.readFile(REFERENCE_DATA_FILE, FILE_ENCODING);
      this.data = JSON.parse(raw) as ReferenceDirectoryData;
      this.logger.info("[ReferenceDirectory] Loaded custom directory dataset");
    } catch (error) {
      this.logger.error("[ReferenceDirectory] Failed to load directory, falling back to defaults", error);
      this.data = DEFAULT_REFERENCE_DATA;
    }
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
