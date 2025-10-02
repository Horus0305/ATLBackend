import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { validateEnv } from "./config/env.js";
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

// Validate environment variables
validateEnv();

// Add this near the top after dotenv.config()
if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
  console.warn("⚠️ Email credentials not found in environment variables");
  console.log("Available env vars:", Object.keys(process.env));
} else {
  console.log("📧 Email configuration found:", {
    user: process.env.EMAIL_USER,
    hasPassword: !!process.env.EMAIL_APP_PASSWORD,
    passwordLength: process.env.EMAIL_APP_PASSWORD.length,
  });
}

// Log Novu key for debugging
console.log('NOVU_SECRET_KEY in server.js:', process.env.NOVU_SECRET_KEY ? 'Key exists' : 'Key missing');

// Set default frontend URL if not provided
if (!process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL = 'https://atl-frontend-ashy.vercel.app';
  console.log('FRONTEND_URL not found in environment, using default:', process.env.FRONTEND_URL);
} else {
  console.log('Using FRONTEND_URL from environment:', process.env.FRONTEND_URL);
}

const PORT = process.env.PORT || 5000;

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3000',  // Alternative local frontend
  process.env.FRONTEND_URL, // Production frontend URL (set this in Vercel)
];

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
  res.send("hello");
});

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    ok: false,
    error: err.message || "Something broke!",
  });
});

// Connect to MongoDB
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("Connected to MongoDB successfully");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API endpoint: http://localhost:${PORT}/api`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });
