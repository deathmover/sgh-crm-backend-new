/**
 * A machine's PC numbers as the owner types them: "1-11", "12-17, 20", "VIP1, VIP2".
 * Kept in sync with sgh-crm-frontend/lib/utils/pc-numbers.ts.
 */
export const MAX_PCS = 200;

const byNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function parsePcNumbers(text: string): { numbers: string[]; error?: string } {
  const seen = new Set<string>();
  for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])];
      if (to < from) return { numbers: [], error: `"${token}": the range goes backwards` };
      if (to - from + 1 > MAX_PCS) return { numbers: [], error: `"${token}" is more than ${MAX_PCS} PCs` };
      for (let n = from; n <= to; n++) seen.add(String(n));
    } else if (/^[A-Za-z0-9]{1,10}$/.test(token)) {
      seen.add(/^\d+$/.test(token) ? String(Number(token)) : token);
    } else {
      return { numbers: [], error: `"${token}" isn't a PC number or range like 1-11` };
    }
    if (seen.size > MAX_PCS) return { numbers: [], error: `More than ${MAX_PCS} PCs` };
  }
  return { numbers: [...seen].sort(byNumber) };
}

/** ["1","2","3","7","VIP1"] → "1-3, 7, VIP1" */
export function formatPcNumbers(numbers: string[]): string {
  const parts: string[] = [];
  const sorted = [...new Set(numbers)].sort(byNumber);
  for (let i = 0; i < sorted.length; i++) {
    if (!/^\d+$/.test(sorted[i])) {
      parts.push(sorted[i]);
      continue;
    }
    let j = i;
    while (j + 1 < sorted.length && /^\d+$/.test(sorted[j + 1]) && Number(sorted[j + 1]) === Number(sorted[j]) + 1) j++;
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : sorted[i]);
    i = j;
  }
  return parts.join(', ');
}
