export interface AqiBreakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
  category: string;
}

export const EPA_PM25_BREAKPOINTS_2024: AqiBreakpoint[] = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50, category: "good" },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100, category: "moderate" },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150, category: "unhealthy for sensitive groups" },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200, category: "unhealthy" },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300, category: "very unhealthy" },
  { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 400, category: "hazardous" },
  { cLow: 325.5, cHigh: 500.4, iLow: 401, iHigh: 500, category: "hazardous" },
];

export const EPA_PM25_BREAKPOINTS_PRE_2024: AqiBreakpoint[] = [
  { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50, category: "good" },
  { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100, category: "moderate" },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150, category: "unhealthy for sensitive groups" },
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200, category: "unhealthy" },
  { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300, category: "very unhealthy" },
  { cLow: 250.5, cHigh: 350.4, iLow: 301, iHigh: 400, category: "hazardous" },
  { cLow: 350.5, cHigh: 500.4, iLow: 401, iHigh: 500, category: "hazardous" },
];
