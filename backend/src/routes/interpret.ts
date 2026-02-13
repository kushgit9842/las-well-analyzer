import { analyzeData } from "../services/interpretService";
import { Router } from "express";
import { pool } from "../db";

const router = Router();

router.post("/:id/interpret", async (req, res) => {
  const { id } = req.params;
  const { from, to, curves } = req.body;

  const fromDepth = Number(from);
  const toDepth = Number(to);

  if (isNaN(fromDepth) || isNaN(toDepth)) {
    return res.status(400).json({ error: "Invalid depth range" });
  }

  if (!Array.isArray(curves) || curves.length === 0) {
    return res.status(400).json({ error: "No curves selected" });
  }

  try {
    const result = await pool.query(
      `
      SELECT depth, log_values
      FROM well_logs
      WHERE well_id = $1
      AND depth BETWEEN $2 AND $3
      ORDER BY depth
      `,
      [id, fromDepth, toDepth]
    );

    type LogRow = {
      depth: number;
      values: Record<string, number>;
    };

    const structuredRows: LogRow[] = [];

    for (const row of result.rows) {
      const values: Record<string, number> = {};

      for (const curve of curves) {
        const val = row.log_values?.[curve];

        if (
          val !== undefined &&
          val !== null &&
          val !== -9999 &&
          !isNaN(Number(val))
        ) {
          values[curve] = Number(val);
        }
      }

      if (Object.keys(values).length > 0) {
        structuredRows.push({
          depth: row.depth,
          values
        });
      }
    }

    if (structuredRows.length === 0) {
      return res.json({
        stats: {},
        summary: "No valid curve values found (all values may be null or -9999)."
      });
    }

    const interpretation = analyzeData(structuredRows, curves);

    // Build cleaned curve data (remove extreme outliers using IQR)
    const cleanedCurves: Record<
      string,
      { depths: number[]; values: number[] }
    > = {};

    for (const curve of curves) {
      const curveRows = structuredRows
        .filter(r => r.values[curve] !== undefined)
        .map(r => ({
          depth: r.depth,
          value: r.values[curve]
        }));

      if (curveRows.length === 0) continue;

      const sortedValues = curveRows
        .map(r => r.value)
        .sort((a, b) => a - b);

      const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
      const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
      const iqr = q3 - q1;

      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      const cleaned = curveRows.filter(
        r => r.value >= lowerBound && r.value <= upperBound
      );

      cleanedCurves[curve] = {
        depths: cleaned.map(r => r.depth),
        values: cleaned.map(r => r.value)
      };
    }

    res.json({
      ...interpretation,
      cleanedCurves
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Interpretation failed" });
  }
});

export default router;