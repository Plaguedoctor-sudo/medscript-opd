export const STANDARD_WARDS = [
  { name: "General Male Ward", beds: 10, type: "General" },
  { name: "General Female Ward", beds: 10, type: "General" },
  { name: "Intensive Care Unit (ICU)", beds: 6, type: "ICU" },
  { name: "Semi-Private Rooms", beds: 6, type: "Semi-Private" },
  { name: "Deluxe Private Rooms", beds: 4, type: "Private" },
  { name: "Emergency / Day Care", beds: 4, type: "Emergency" },
] as const;

export type StandardWardName = typeof STANDARD_WARDS[number]["name"];
