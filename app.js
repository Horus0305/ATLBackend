// import materialTestRoutes from './routes/materialTest.js';

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { connectToDatabase } from "./utils/db.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import testerRoutes from "./routes/testerRoutes.js";
import receptionistRoutes from "./routes/receptionistRoutes.js";
import sheadRoutes from "./routes/sheadRoutes.js";
import equipmentRoutes from "./routes/equipmentRoutes.js";
import materialTestRoutes from "./routes/materialTest.js";
import rorRoutes from "./routes/ror.js";
import proformaRoutes from './routes/proforma.js';
import reportRoutes from './routes/reportRoutes.js';
import testScopeRoutes from './routes/testScopeRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure MongoDB connection before handling any requests
await connectToDatabase();

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://atl-frontend-ashy.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Static file serving for reports
app.use('/uploads/reports', express.static(path.join(__dirname, 'uploads', 'reports')));

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/tester", testerRoutes);
app.use("/api/receptionist", receptionistRoutes);
app.use("/api/sectionhead", sheadRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/material-test", materialTestRoutes);
app.use("/api/ror", rorRoutes);
app.use('/api/proforma', proformaRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/test-scope', testScopeRoutes);

// Basic home route
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>ATL Backend Status</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .status { padding: 20px; background: #e7f3ff; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="status">
          <h1>✅ ATL Backend is Running</h1>
          <p>API endpoints are ready at /api/*</p>
        </div>
      </body>
    </html>
  `);
});

// Test route
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    ok: false,
    error: err.message || "Something broke!",
  });
});

export default app;
