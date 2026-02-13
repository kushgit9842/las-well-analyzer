import express from "express";
import { pool } from "../db";

const router = express.Router();

// GET /api/wells
router.get("/wells", async (_req, res) => {
  const result = await pool.query(
    "SELECT id, name, start_depth, stop_depth FROM wells ORDER BY created_at DESC"
  );
  res.json(result.rows);
});
// GET /api/wells/:id/curves
router.get("/wells/:id/curves", async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    "SELECT name, unit FROM curves WHERE well_id = $1",
    [id]
  );

  res.json(result.rows);
});
// GET /api/wells/:id/data?from=1000&to=1100&curves=GR,RT
// GET /api/wells/:id/data?from=1000&to=1100&curves=GR,RT
router.get("/wells/:id/data", async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const curves = req.query.curves as string | undefined;

    const result = await pool.query(
      `
      SELECT depth, log_values
      FROM well_logs
      WHERE well_id = $1
        AND depth BETWEEN $2 AND $3
      ORDER BY depth
      `,
      [id, Number(from), Number(to)]
    );

    const filtered = result.rows.map(row => {
      let values = row.log_values;

      // If curves are provided, filter them
      if (curves) {
        const curveList = curves.split(",");
        values = Object.fromEntries(
          Object.entries(values).filter(([key]) =>
            curveList.includes(key)
          )
        );
      }

      return {
        depth: row.depth,
        values
      };
    });

    res.json(filtered);
  } catch (err) {
    console.error("DATA API ERROR:", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// DELETE /api/wells/:id
router.delete("/wells/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete dependent records first (foreign key constraint)
    await pool.query("DELETE FROM well_logs WHERE well_id = $1", [id]);
    await pool.query("DELETE FROM curves WHERE well_id = $1", [id]);

    // Delete well
    await pool.query("DELETE FROM wells WHERE id = $1", [id]);

    res.json({ message: "Well deleted successfully" });
  } catch (err) {
    console.error("DELETE WELL ERROR:", err);
    res.status(500).json({ error: "Failed to delete well" });
  }
});

export default router;