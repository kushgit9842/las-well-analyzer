import { Pool } from "pg";

export const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "las_analyzer",
  user: process.env.DB_USER || process.env.USER,
  password: process.env.DB_PASSWORD || "",
});