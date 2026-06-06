export type ScanMode = "general" | "plant_animal" | "food" | "text";

export interface ScanModeConfig {
  id: ScanMode;
  name: string;
  description: string;
  placeholder: string;
  iconName: string;
  color: string;
}

export interface ScannedResult {
  detectedItem: string;
  subtitle: string;
  description: string;
  attributes: {
    label: string;
    value: string;
  }[];
  extraContext: string;
}

export interface ScanHistoryItem {
  id: string;
  timestamp: string;
  mode: ScanMode;
  image: string; // Base64 image
  result: ScannedResult;
}
