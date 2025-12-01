export const PRIORITY_LABELS: Record<1 | 2 | 3, string> = {
  1: "Tier-1",
  2: "Tier-2",
  3: "Tier-3"
};

export const toTierNumber = (value: unknown): 1 | 2 | 3 => {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }

  if (typeof value === "number") {
    if (value <= 1) return 1;
    if (value === 2) return 2;
    return 3;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized.includes("tier-1") || normalized.includes("critical")) {
      return 1;
    }
    if (normalized.includes("tier-2") || normalized.includes("priority")) {
      return 2;
    }
    if (normalized.includes("tier-3")) {
      return 3;
    }
  }

  return 3;
};

export const tierToLabel = (tier: number | string | null | undefined): string => {
  if (tier === 1 || tier === "1") return PRIORITY_LABELS[1];
  if (tier === 2 || tier === "2") return PRIORITY_LABELS[2];
  return PRIORITY_LABELS[3];
};
