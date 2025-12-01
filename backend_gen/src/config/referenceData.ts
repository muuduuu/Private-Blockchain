export interface ProviderRecord {
  id: string;
  name: string;
  specialty: string;
  contact?: string;
}

export interface PatientRecord {
  id: string;
  fullName: string;
  dateOfBirth: string;
  primaryProviderId?: string;
}

export interface ValidatorRecord {
  id: string;
  tier: "Tier-1" | "Tier-2" | "Tier-3";
  reputation: number;
  blocksProposed: number;
  uptime: number;
  lastSeen: string;
}

export interface ReferenceDirectoryData {
  providers: ProviderRecord[];
  patients: PatientRecord[];
  validators: ValidatorRecord[];
}

const now = new Date();
const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString();

export const DEFAULT_REFERENCE_DATA: ReferenceDirectoryData = {
  providers: [
    { id: "prov-01", name: "Dr. Elena Martinez", specialty: "Emergency" },
    { id: "prov-02", name: "Dr. Amir Hassan", specialty: "Cardiology" },
    { id: "prov-03", name: "Dr. Priya Patel", specialty: "Neurology" },
    { id: "prov-04", name: "Dr. Hannah Lewis", specialty: "Pharmacy" },
    { id: "prov-05", name: "PA Marcus Li", specialty: "Emergency" },
    { id: "prov-06", name: "NP Sophia Cruz", specialty: "Primary Care" },
    { id: "prov-07", name: "Dr. Ethan Kim", specialty: "Radiology" },
    { id: "prov-08", name: "Dr. Nia Abebe", specialty: "Critical Care" }
  ],
  patients: Array.from({ length: 12 }, (_, idx) => {
    const id = `CAMTC-${1000 + idx}`;
    return {
      id,
      fullName: `Patient ${idx + 1}`,
      dateOfBirth: `198${idx % 10}-0${(idx % 9) + 1}-15`,
      primaryProviderId: idx % 2 === 0 ? "prov-01" : "prov-04"
    } satisfies PatientRecord;
  }),
  validators: Array.from({ length: 10 }, (_, idx) => {
    const tier = idx < 5 ? "Tier-1" : idx < 8 ? "Tier-2" : "Tier-3";
    return {
      id: `VAL-${idx + 1}`,
      tier,
      reputation: Number((0.65 - idx * 0.02).toFixed(2)),
      blocksProposed: 900 + idx * 45,
      uptime: Number((94 - idx * 0.4).toFixed(2)),
      lastSeen: iso(idx * 5)
    } satisfies ValidatorRecord;
  })
};
