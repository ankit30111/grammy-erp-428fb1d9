import type { TabBarItem } from "@/components/shell/TabBar";

export const qualityRouteTabs: TabBarItem[] = [
  { id: "overview", label: "Overview", to: "/quality" },
  { id: "iqc", label: "IQC", to: "/quality/iqc" },
  { id: "pqc", label: "PQC", to: "/quality/pqc" },
  { id: "oqc", label: "OQC", to: "/quality/oqc" },
  { id: "capa", label: "CAPA", to: "/quality/capa" },
];
