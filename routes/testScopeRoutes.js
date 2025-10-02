import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { TestNablScope } from '../models/TestNablScope.js';

const router = express.Router();

// Get all test scopes
router.get('/', verifyToken, async (req, res) => {
  try {
    const testScopes = await TestNablScope.find({}).sort({ s_no: 1 });
    res.json({ 
      data: testScopes,
      ok: true 
    });
  } catch (error) {
    console.error('Error fetching test scopes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch test scopes',
      ok: false 
    });
  }
});

// Get a single test scope by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const testScope = await TestNablScope.findById(req.params.id);
    if (!testScope) {
      return res.status(404).json({ 
        error: 'Test scope not found',
        ok: false 
      });
    }
    res.json({ 
      data: testScope,
      ok: true 
    });
  } catch (error) {
    console.error('Error fetching test scope:', error);
    res.status(500).json({ 
      error: 'Failed to fetch test scope',
      ok: false 
    });
  }
});

// Create a new test scope
router.post('/', verifyToken, async (req, res) => {
  try {
    const { s_no, group, main_group, sub_group, material_tested, parameters, test_method } = req.body;
    
    // Basic validation
    if (!s_no || !material_tested) {
      return res.status(400).json({
        error: 'Serial number and material tested are required',
        ok: false
      });
    }

    const newTestScope = new TestNablScope({
      s_no,
      group,
      main_group,
      sub_group,
      material_tested,
      parameters,
      test_method
    });

    await newTestScope.save();
    
    res.json({
      message: 'Test scope created successfully',
      data: newTestScope,
      ok: true
    });
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'A test scope with this serial number already exists',
        ok: false
      });
    }

    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(422).json({
        error: messages.join(', '),
        ok: false
      });
    }

    console.error('Error creating test scope:', error);
    res.status(500).json({
      error: 'Failed to create test scope',
      ok: false
    });
  }
});

// Update a test scope
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const testScope = await TestNablScope.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!testScope) {
      return res.status(404).json({ 
        error: 'Test scope not found',
        ok: false 
      });
    }
    
    res.json({ 
      message: 'Test scope updated successfully',
      data: testScope,
      ok: true 
    });
  } catch (error) {
    console.error('Error updating test scope:', error);
    res.status(500).json({ 
      error: 'Failed to update test scope',
      ok: false 
    });
  }
});

// Delete a test scope
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const testScope = await TestNablScope.findByIdAndDelete(req.params.id);
    
    if (!testScope) {
      return res.status(404).json({ 
        error: 'Test scope not found',
        ok: false 
      });
    }
    
    res.json({ 
      message: 'Test scope deleted successfully',
      ok: true 
    });
  } catch (error) {
    console.error('Error deleting test scope:', error);
    res.status(500).json({ 
      error: 'Failed to delete test scope',
      ok: false 
    });
  }
});

export default router;
