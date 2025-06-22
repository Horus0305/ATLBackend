import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { validateEnv } from "../config/env.js";
import authRoutes from "../routes/authRoutes.js";
import adminRoutes from "../routes/adminRoutes.js";
import testerRoutes from "../routes/testerRoutes.js";
import receptionistRoutes from "../routes/receptionistRoutes.js";
import sheadRoutes from "../routes/sheadRoutes.js";
import equipmentRoutes from "../routes/equipmentRoutes.js";
import materialTestRoutes from "../routes/materialTest.js";
import rorRoutes from "../routes/ror.js";
import proformaRoutes from '../routes/proforma.js';

// Validate environment variables
validateEnv();

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3000',  // Alternative local frontend
  process.env.FRONTEND_URL, // Production frontend URL
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

// Database connection handling
let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected) {
    return Promise.resolve();
  }

  try {
    // For Vercel, we want to set some additional options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false,
    };

    await mongoose.connect(process.env.DATABASE_URL, options);
    isConnected = true;
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection error:', error);
    isConnected = false;
    throw error;
  }
};

// Connect to database before handling requests - this should be BEFORE routes
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

// Basic home route
app.get("/api", (req, res) => {
  res.json({ message: "API is working!" });
});

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

// Error handling middleware should be last
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Close database connection on error in serverless environment
  if (process.env.VERCEL_ENV === 'production') {
    try {
      mongoose.connection.close();
      isConnected = false;
    } catch (closeError) {
      console.error('Error closing MongoDB connection:', closeError);
    }
  }
  
  res.status(500).json({
    ok: false,
    error: err.message || "Something broke!",
  });
});

// Handle serverless function cleanup
if (process.env.VERCEL_ENV === 'production') {
  process.on('SIGTERM', async () => {
    try {
      await mongoose.connection.close();
      isConnected = false;
      console.log('MongoDB connection closed through SIGTERM signal');
    } catch (err) {
      console.error('Error closing MongoDB connection:', err);
    } finally {
      process.exit(0);
    }
  });
}

export default app; 