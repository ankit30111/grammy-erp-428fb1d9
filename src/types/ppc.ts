
export interface Production {
  id: string;
  customer: string;
  product: string;
  quantity: number;
  line: string;
}

export interface RawMaterialShortage {
  partCode: string;
  description: string;
  required: number;
  available: number;
  shortage: number;
}

export interface PlannedDate {
  overbooked?: boolean;
  productions?: Production[];
  materialStatus?: {
    available: boolean;
    shortages: RawMaterialShortage[];
  };
}

export interface PlannedDates {
  [date: string]: PlannedDate;
}

// Mock data for projections
export const projections = [
  { id: "PRJ001", customer: "AudioTech Inc", product: "Speaker A300", quantity: 1000, dueDate: "2025-05-25" },
  { id: "PRJ002", customer: "SoundMaster", product: "Subwoofer S200", quantity: 500, dueDate: "2025-05-27" },
  { id: "PRJ003", customer: "EchoSystems", product: "Tweeter T100", quantity: 300, dueDate: "2025-05-28" },
  { id: "PRJ004", customer: "AudioTech Inc", product: "Speaker A100", quantity: 800, dueDate: "2025-06-02" }
];

// Mock data for production lines
export const productionLines = [
  { id: "L1", name: "Line 1", capacity: 300 },
  { id: "L2", name: "Line 2", capacity: 400 },
  { id: "L3", name: "Line 3", capacity: 250 }
];

// Mock BOM data
export const bom = {
  "Speaker A300": [
    { partCode: "PCB-123", description: "Main PCB", quantity: 1 },
    { partCode: "SPK-A44", description: "Speaker Driver", quantity: 2 },
    { partCode: "CAP-333", description: "Capacitor 10μF", quantity: 5 },
    { partCode: "RES-456", description: "Resistor Pack", quantity: 10 },
  ],
  "Subwoofer S200": [
    { partCode: "PCB-234", description: "Amplifier PCB", quantity: 1 },
    { partCode: "SPK-B66", description: "Woofer Driver", quantity: 1 },
    { partCode: "CAP-444", description: "Capacitor 1000μF", quantity: 3 },
    { partCode: "CON-789", description: "Speaker Connector", quantity: 1 },
  ],
  "Tweeter T100": [
    { partCode: "PCB-111", description: "Tweeter PCB", quantity: 1 },
    { partCode: "SPK-C22", description: "Tweeter Driver", quantity: 1 },
    { partCode: "RES-456", description: "Resistor Pack", quantity: 5 },
  ],
  "Speaker A100": [
    { partCode: "PCB-123", description: "Main PCB", quantity: 1 },
    { partCode: "SPK-A22", description: "Speaker Driver", quantity: 1 },
    { partCode: "CAP-333", description: "Capacitor 10μF", quantity: 3 },
    { partCode: "RES-456", description: "Resistor Pack", quantity: 5 },
  ]
};

// Mock inventory data
export const inventory = {
  "PCB-123": 500,
  "PCB-234": 200,
  "PCB-111": 150,
  "SPK-A44": 800,
  "SPK-B66": 300,
  "SPK-C22": 100,
  "SPK-A22": 400,
  "CAP-333": 2000,
  "CAP-444": 1000,
  "RES-456": 3000,
  "CON-789": 800,
};
