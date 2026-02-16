import { Pool } from "pg";

const isProduction = process.env.DATABASE_URL;

export const pool = new Pool(
  isProduction
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        host: "localhost",
        port: 5432,
        database: "las_analyzer",
        user: process.env.DB_USER || process.env.USER,
        password: process.env.DB_PASSWORD || "",
      }
);