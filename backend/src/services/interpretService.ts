type LogRow = {
  depth: number;
  values: Record<string, number>;
};

function getMedian(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

function getIQR(arr: number[]) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  const lowerHalf = sorted.slice(0, mid);
  const upperHalf =
    sorted.length % 2 === 0
      ? sorted.slice(mid)
      : sorted.slice(mid + 1);

  const q1 = getMedian(lowerHalf);
  const q3 = getMedian(upperHalf);
  const iqr = q3 - q1;

  return { q1, q3, iqr };
}
export function analyzeData(rows: LogRow[], curves: string[]) {
  const results: any = {};
  const summaryParts: string[] = [];

  for (const curve of curves) {
    // Extract valid numeric values and remove -9999 placeholders
    const filtered = rows
      .map(r => ({
        depth: r.depth,
        value: r.values?.[curve]
      }))
      .filter(
        r =>
          typeof r.value === "number" &&
          !isNaN(r.value) &&
          r.value !== -9999
      );

    if (filtered.length === 0) continue;

    const values = filtered.map(d => d.value);
    const depths = filtered.map(d => d.depth);

    // --- Robust statistics (Median + IQR first) ---
    const median = getMedian(values);
    const { q1, q3, iqr } = getIQR(values);

    const upperBound = q3 + 1.5 * iqr;
    const lowerBound = q1 - 1.5 * iqr;

    // Remove extreme outliers for stable mean/std calculation
    const cleaned = filtered.filter(
      d => d.value >= lowerBound && d.value <= upperBound
    );

    const cleanedValues = cleaned.map(d => d.value);

    const mean =
      cleanedValues.reduce((a, b) => a + b, 0) / cleanedValues.length;

    const variance =
      cleanedValues.reduce(
        (sum, val) => sum + Math.pow(val - mean, 2),
        0
      ) / cleanedValues.length;

    const stdDev = Math.sqrt(variance);

    const min = Math.min(...cleanedValues);
    const max = Math.max(...cleanedValues);

    // True statistical spikes (IQR based)
    const spikes = filtered.filter(
      d => d.value > upperBound || d.value < lowerBound
    );

    // Gradient detection on cleaned data (stable)
    const gradientSpikes: number[] = [];

    for (let i = 1; i < cleaned.length; i++) {
      const gradient = Math.abs(
        cleaned[i].value - cleaned[i - 1].value
      );

      if (gradient > stdDev) {
        gradientSpikes.push(cleaned[i].depth);
      }
    }

    results[curve] = {
      median,
      mean,
      stdDev,
      min,
      max,
      spikeDepths: spikes.map(s => s.depth),
      gradientChangeDepths: gradientSpikes,
      cleanedCurve: cleaned.map(d => ({
        depth: d.depth,
        value: d.value
      })),
      rawCurve: filtered.map(d => ({
        depth: d.depth,
        value: d.value
      }))
    };

    // Clean professional interpretation
    if (spikes.length > 0) {
      summaryParts.push(
        `Between ${Math.min(...depths)}–${Math.max(...depths)} ft, ${curve} shows statistically significant outlier behavior based on interquartile range analysis.`
      );
    }

    if (gradientSpikes.length > 0) {
      summaryParts.push(
        `Depth-wise variation in ${curve} suggests possible formation transition zones.`
      );
    }

    if (spikes.length === 0 && gradientSpikes.length === 0) {
      summaryParts.push(
        `${curve} appears statistically stable within the selected interval.`
      );
    }
  }

  return {
    stats: results,
    summary: summaryParts.join(" ")
  };
}