/**
 * Collective remembrance days. Only solar-term based days with reliable
 * published dates are included (lunar festivals would need a conversion
 * table and a wrong date damages trust more than a missing banner).
 * Dates are evaluated in Asia/Shanghai.
 */

export type FestivalKey = "qingming" | "dongzhi";

const FESTIVALS: Record<FestivalKey, string[]> = {
  // 清明 (Tomb-Sweeping Day)
  qingming: [
    "2026-04-05",
    "2027-04-05",
    "2028-04-04",
    "2029-04-04",
    "2030-04-05",
    "2031-04-05",
    "2032-04-04",
    "2033-04-04",
    "2034-04-05",
    "2035-04-05",
    "2036-04-04",
  ],
  // 冬至 (Winter Solstice)
  dongzhi: [
    "2026-12-22",
    "2027-12-22",
    "2028-12-21",
    "2029-12-21",
    "2030-12-22",
    "2031-12-22",
    "2032-12-21",
    "2033-12-21",
    "2034-12-22",
    "2035-12-22",
    "2036-12-21",
  ],
};

export function getTodayFestival(now = new Date()): FestivalKey | null {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  for (const key of Object.keys(FESTIVALS) as FestivalKey[]) {
    if (FESTIVALS[key].includes(today)) return key;
  }
  return null;
}
