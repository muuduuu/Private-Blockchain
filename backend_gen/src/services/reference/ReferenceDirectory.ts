import { promises as fs } from "fs";
import { FILE_ENCODING, REFERENCE_DATA_FILE, REFERENCE_DIR } from "../../config/constants";
import { DEFAULT_REFERENCE_DATA, ReferenceDirectoryData } from "../../config/referenceData";

export class ReferenceDirectory {
  private logger: typeof console;
  private data: ReferenceDirectoryData = DEFAULT_REFERENCE_DATA;

  constructor(logger: typeof console = console) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
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

  getProviders() {
    return this.data.providers;
  }

  getPatients() {
    return this.data.patients;
  }

  getValidators() {
    return this.data.validators;
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
