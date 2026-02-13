import { Router } from "express";
import { pool } from "../db";

const router = Router();

router.post("/:id/chat", async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message required" });
  }

  try {
    // 1️⃣ Extract depth range
    const depthMatch = message.match(/(\d+)\s*[-–to]+\s*(\d+)/i);
    let fromDepth: number | null = null;
    let toDepth: number | null = null;

    if (depthMatch) {
      fromDepth = Number(depthMatch[1]);
      toDepth = Number(depthMatch[2]);
    }

    // 2️⃣ Extract curve name
    const curveMatch = message.match(/[A-Za-z0-9_]+/g);
    let curve: string | null = null;

    if (curveMatch) {
      // Try matching with actual curve names in DB
      const curvesRes = await pool.query(
        "SELECT name FROM curves WHERE well_id = $1",
        [id]
      );

      const availableCurves = curvesRes.rows.map(r => r.name);

      curve = availableCurves.find(c =>
        message.toLowerCase().includes(c.toLowerCase())
      ) || null;
    }

    if (!curve) {
      return res.json({
        reply: "Please specify a valid curve name."
      });
    }

    // 3️⃣ Default depth if not provided
    if (!fromDepth || !toDepth) {
      const rangeRes = await pool.query(
        "SELECT MIN(depth) as min, MAX(depth) as max FROM well_logs WHERE well_id = $1",
        [id]
      );

      fromDepth = rangeRes.rows[0].min;
      toDepth = rangeRes.rows[0].max;
    }

    // 4️⃣ Fetch data
    const dataRes = await pool.query(
      `
      SELECT depth, log_values->>$4 AS value
      FROM well_logs
      WHERE well_id = $1
      AND depth BETWEEN $2 AND $3
      ORDER BY depth
      `,
      [id, fromDepth, toDepth, curve]
    );

    const values = dataRes.rows
      .map(r => Number(r.value))
      .filter(v => !isNaN(v) && v !== -9999);

    if (values.length === 0) {
      return res.json({
        reply: "No valid data found in selected depth range."
      });
    }

    // 5️⃣ Intent Detection
    const lowerMsg = message.toLowerCase();

    const mean =
      values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (lowerMsg.includes("mean") || lowerMsg.includes("average")) {
      return res.json({
        reply: `The average ${curve} between ${fromDepth}-${toDepth} ft is ${mean.toFixed(
          2
        )}.`
      });
    }

    if (lowerMsg.includes("max") || lowerMsg.includes("highest")) {
      return res.json({
        reply: `The maximum ${curve} value in that range is ${max.toFixed(
          2
        )}.`
      });
    }

    if (lowerMsg.includes("min") || lowerMsg.includes("lowest")) {
      return res.json({
        reply: `The minimum ${curve} value in that range is ${min.toFixed(
          2
        )}.`
      });
    }

    if (lowerMsg.includes("spike") || lowerMsg.includes("anomaly")) {
      const spikeThreshold = mean + 2 * (max - mean) / 2;
      const spikes = values.filter(v => v > spikeThreshold);

      return res.json({
        reply:
          spikes.length > 0
            ? `Potential anomalies detected in ${curve} within ${fromDepth}-${toDepth} ft.`
            : `No significant anomalies detected in ${curve}.`
      });
    }

    return res.json({
      reply: `Between ${fromDepth}-${toDepth} ft, ${curve} ranges from ${min.toFixed(
        2
      )} to ${max.toFixed(2)} with average ${mean.toFixed(2)}.`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Chat processing failed" });
  }
});

export default router;