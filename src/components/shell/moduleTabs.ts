import type { TabBarItem } from "@/components/shell/TabBar";

export const qualityRouteTabs: TabBarItem[] = [
  { id: "overview", label: "Overview", to: "/quality" },
  { id: "iqc", label: "IQC", to: "/quality/iqc" },
  { id: "pqc", label: "PQC", to: "/quality/pqc" },
  { id: "oqc", label: "OQC", to: "/quality/oqc" },
  { id: "capa", label: "CAPA", to: "/quality/capa" },
];

export const rndRouteTabs: TabBarItem[] = [
  { id: "overview", label: "Overview", to: "/rnd" },
  { id: "npd", label: "NPD", to: "/rnd/npd" },
  { id: "pre-existing", label: "Pre-Existing", to: "/rnd/pre-existing" },
];
