import "./config/env";
import express from "express";
import cors from "cors";
import chatRoutes from "./routes/chat";
import { pool } from "./db";
import uploadRoutes from "./routes/upload";
import wellsRoutes from "./routes/wells";
import interpretRoutes from "./routes/interpret";

const app = express();
const PORT = process.env.PORT || 5050;

// 🔥 ENABLE CORS (THIS WAS MISSING)
app.use(
  cors({
    origin: "http://localhost:5173"
  })
);

app.use(express.json());

//forAI interpretation 
app.use("/api/wells", interpretRoutes);

// for chat bot
app.use("/api/wells", chatRoutes);

// health check
app.get("/", (_req, res) => {
  res.send("Backend working");
});

// routes
app.use("/api", uploadRoutes);
app.use("/api", wellsRoutes);

// DB connection check
pool.query("SELECT 1")
  .then(() => console.log("PostgreSQL connected"))
  .catch(err => console.error("DB connection failed", err));

// start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});