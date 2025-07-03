import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates directory structure for report storage based on year and month
 * @param {string} year - Year in YY format
 * @param {string} month - Month in MM format
 * @returns {string} - The created directory path
 */
export const createReportDirectory = async (year, month) => {
  try {
    // Create directory structure: uploads/reports/YY/MM/
    const baseDir = path.join(__dirname, '..', 'uploads', 'reports');
    const yearDir = path.join(baseDir, year);
    const monthDir = path.join(yearDir, month);
    
    console.log("Creating directory structure:");
    console.log("- Base directory:", baseDir);
    console.log("- Year directory:", yearDir);
    console.log("- Month directory:", monthDir);
    
    // Ensure directories exist
    await fs.ensureDir(baseDir);
    await fs.ensureDir(yearDir);
    await fs.ensureDir(monthDir);
    
    // Verify directories were created
    const baseExists = await fs.pathExists(baseDir);
    const yearExists = await fs.pathExists(yearDir);
    const monthExists = await fs.pathExists(monthDir);
    
    console.log("Directory verification:");
    console.log("- Base directory exists:", baseExists);
    console.log("- Year directory exists:", yearExists);
    console.log("- Month directory exists:", monthExists);
    
    if (!monthExists) {
      throw new Error(`Failed to create directory: ${monthDir}`);
    }
    
    return monthDir;
  } catch (error) {
    console.error('Error creating report directory:', error);
    throw error;
  }
};

/**
 * Saves a PDF file to the appropriate directory
 * @param {Buffer} pdfBuffer - PDF buffer to save
 * @param {string} year - Year in YY format
 * @param {string} month - Month in MM format
 * @param {string} fileName - Name of the file to save
 * @returns {string} - The path to the saved PDF file
 */
export const saveReportPDF = async (pdfBuffer, year, month, fileName) => {
  try {
    const dirPath = await createReportDirectory(year, month);
    const filePath = path.join(dirPath, fileName);
    
    console.log("Saving PDF file:");
    console.log("- Directory path:", dirPath);
    console.log("- File path:", filePath);
    console.log("- PDF buffer size:", pdfBuffer.length, "bytes");
    
    await fs.writeFile(filePath, pdfBuffer);
    
    // Verify file was created
    const fileExists = await fs.pathExists(filePath);
    console.log("- File created successfully:", fileExists);
    
    if (!fileExists) {
      throw new Error(`Failed to create file: ${filePath}`);
    }
    
    const stats = await fs.stat(filePath);
    console.log("- File size:", stats.size, "bytes");
    
    return filePath;
  } catch (error) {
    console.error('Error saving report PDF:', error);
    throw error;
  }
};

/**
 * Generates a public URL for accessing the report
 * @param {string} year - Year in YY format
 * @param {string} month - Month in MM format
 * @param {string} fileName - Name of the file
 * @returns {string} - Public URL for accessing the report
 */
export const getReportPublicUrl = (year, month, fileName) => {
  // Get the backend URL from environment variable or use default
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  
  // Return the API endpoint URL that serves the PDF
  return `${backendUrl}/api/reports/${year}/${month}/${fileName}`;
};

/**
 * Extracts year and month from ATL ID
 * @param {string} atlId - ATL ID in format ATL/YY/MM/count
 * @returns {Object} - Object containing year and month
 */
export const extractYearMonthFromAtlId = (atlId) => {
  try {
    const parts = atlId.split('/');
    if (parts.length !== 4) {
      throw new Error('Invalid ATL ID format');
    }
    
    return {
      year: parts[1],
      month: parts[2]
    };
  } catch (error) {
    console.error('Error extracting year and month from ATL ID:', error);
    throw error;
  }
}; 