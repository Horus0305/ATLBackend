import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug route to check if the file exists
router.get('/check/:year/:month/:fileName', async (req, res) => {
  try {
    const { year, month, fileName } = req.params;
    
    // Construct the file path
    const filePath = path.join(__dirname, '..', 'uploads', 'reports', year, month, fileName);
    
    // Check if file exists
    const exists = await fs.pathExists(filePath);
    
    if (exists) {
      const stats = await fs.stat(filePath);
      res.json({
        ok: true,
        exists: true,
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      });
    } else {
      res.status(404).json({
        ok: false,
        exists: false,
        path: filePath,
        error: 'File not found'
      });
    }
  } catch (error) {
    console.error('Error checking file:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Serve report PDFs
router.get('/:year/:month/:fileName', async (req, res) => {
  try {
    const { year, month, fileName } = req.params;
    
    // Construct the file path
    const filePath = path.join(__dirname, '..', 'uploads', 'reports', year, month, fileName);
    
    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      console.error(`File not found: ${filePath}`);
      return res.status(404).json({ 
        error: 'Report not found',
        ok: false
      });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${fileName}`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving report PDF:', error);
    res.status(500).json({
      error: 'Failed to serve report',
      ok: false
    });
  }
});

export default router; 