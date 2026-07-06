import { useEffect, useState } from "react";

/**
 * Returns a key that flips once after the first paint.
 *
 * Recharts' <ResponsiveContainer> measures its parent on mount. Inside a CSS
 * grid/flex layout the parent can still report width 0 at that moment, so the
 * chart renders collapsed until the next resize/scroll. Passing this value as
 * `key` remounts the container after layout has settled, forcing a correct
 * measurement.
 */
export function useRemeasureKey(): number {
  const [k, setK] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setK(1));
    return () => cancelAnimationFrame(id);
  }, []);
  return k;
}
