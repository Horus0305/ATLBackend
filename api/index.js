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
import testScopeRoutes from '../routes/testScopeRoutes.js';

// Validate environment variables
validateEnv();

const app = express();

// CORS configuration with more flexible origin handling for Vercel
const allowedOrigins = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3000',  // Alternative local frontend
  'https://atl-frontend-ashy.vercel.app', // Production frontend URL
  process.env.FRONTEND_URL, // Production frontend URL from env
];

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    console.log('Request origin:', origin); // Debug log
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('No origin provided');
      return callback(null, true);
    }
    
    // Check if the origin matches any allowed origins
    const isAllowed = allowedOrigins.includes(origin);
    console.log('Is origin allowed:', isAllowed); // Debug log
    
    if (!isAllowed) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      console.log('CORS blocked origin:', origin); // Debug log
      return callback(new Error(msg), false);
    }
    
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Request logging middleware with more details
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// MongoDB connection with serverless optimization
let cachedDb = null;

const connectToDatabase = async () => {
  if (cachedDb) {
    console.log('Using cached database connection');
    return;
  }

  try {
    const db = await mongoose.connect(process.env.DATABASE_URL, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    cachedDb = db;
    console.log('New database connection established');
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

// Connect to database before handling requests
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

// Root endpoint for easy verification - handle both root and /api paths
app.get(["/", "/api"], (req, res) => {
  res.send(`
    <html>
      <head>
        <title>ATL Backend API Status</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            line-height: 1.6;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
          }
          .status {
            padding: 20px;
            background-color: #e7f3ff;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .endpoints {
            background-color: #f5f5f5;
            padding: 20px;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="status">
            <h1>✅ ATL Backend API is Running</h1>
            <p>Server is operational and ready to accept requests.</p>
          </div>
          <div class="endpoints">
            <h2>Available Test Endpoints:</h2>
            <ul>
              <li><strong>Health Check:</strong> <a href="/api/health">/api/health</a></li>
              <li><strong>API Base:</strong> /api/...</li>
            </ul>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Basic health check route with more details
app.get(["/health", "/api/health"], (req, res) => {
  res.json({ 
    status: "healthy",
    service: "ATL Backend API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: cachedDb ? "connected" : "disconnected"
  });
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
app.use('/api/test-scope', testScopeRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    ok: false,
    error: err.message || "Something broke!",
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Export the Express app
export default app; 