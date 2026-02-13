import express from "express";
import multer from "multer";
import { uploadToS3 } from "../services/s3Service";
import { pool } from "../db";
import { v4 as uuidv4 } from "uuid";
import { parseLAS } from "../services/lasParser";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/upload-las",
  upload.single("lasFile"),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No LAS file uploaded" });
      }

      const fileBuffer = req.file.buffer;
      const fileName = `${Date.now()}-${req.file.originalname}`;

      const { key, url } = await uploadToS3(fileName, fileBuffer);

      const content = fileBuffer.toString("utf-8");

      const parsed = parseLAS(content);

      const wellId = uuidv4();

      await pool.query(
        `INSERT INTO wells (id, name, start_depth, stop_depth, step, file_url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          wellId,
          parsed.well.WELL,
          parsed.well.STRT,
          parsed.well.STOP,
          parsed.well.STEP,
          url
        ]
      );

      for (const curve of parsed.curves) {
        await pool.query(
          `INSERT INTO curves (well_id, name, unit)
           VALUES ($1, $2, $3)`,
          [wellId, curve.name, curve.unit]
        );
      }

      for (const row of parsed.data) {
        const { Depth, ...values } = row;

        await pool.query(
          `INSERT INTO well_logs (well_id, depth, log_values)
           VALUES ($1, $2, $3)`,
          [wellId, Depth, values]
        );
      }

      res.json({
        message: "LAS file uploaded and stored successfully",
        wellId
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to process LAS file" });
    }
  }
);

export default router;