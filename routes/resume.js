const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const Resume = require('../models/Resume');
const resumeParser = require('../utils/resumeParser');
const excelExporter = require('../utils/excelExporter');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB per file limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOCX files are allowed.'));
    }
  }
});

// @route   POST /api/resume/upload
// @desc    Upload and parse resumes (up to 500 files)
// @access  Private
router.post('/upload', auth, upload.array('resumes', 500), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please upload at least one file' });
    }

    const results = [];
    const errors = [];

    // Process each file
    for (const file of req.files) {
      try {
        // Parse the resume
        const extractedData = await resumeParser.parseFile(
          file.buffer,
          file.mimetype
        );

        // Save to database
        const resume = new Resume({
          userId: req.userId,
          fileName: file.originalname,
          fileData: file.buffer,
          fileType: file.mimetype,
          extractedData
        });

        await resume.save();

        results.push({
          fileName: file.originalname,
          resumeId: resume._id,
          extractedData: resume.extractedData,
          success: true
        });
      } catch (error) {
        errors.push({
          fileName: file.originalname,
          error: error.message,
          success: false
        });
      }
    }

    res.json({
      message: `Processed ${results.length} of ${req.files.length} files successfully`,
      totalFiles: req.files.length,
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Error processing resumes' });
  }
});

// @route   GET /api/resume/list
// @desc    Get all resumes for current user
// @access  Private
router.get('/list', auth, async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.userId })
      .select('-fileData')
      .sort({ uploadedAt: -1 });

    res.json({ resumes });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Error fetching resumes' });
  }
});

// @route   GET /api/resume/:id
// @desc    Get single resume
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.userId
    }).select('-fileData');

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    res.json({ resume });
  } catch (error) {
    console.error('Get resume error:', error);
    res.status(500).json({ error: 'Error fetching resume' });
  }
});

// @route   GET /api/resume/download/:id
// @desc    Download original resume file
// @access  Private
router.get('/download/:id', auth, async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    res.set({
      'Content-Type': resume.fileType,
      'Content-Disposition': `attachment; filename="${resume.fileName}"`
    });

    res.send(resume.fileData);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Error downloading resume' });
  }
});

// @route   GET /api/resume/export/excel
// @desc    Export all resumes to Excel
// @access  Private
router.get('/export/excel', auth, async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.userId })
      .select('-fileData')
      .sort({ uploadedAt: -1 });

    if (resumes.length === 0) {
      return res.status(404).json({ error: 'No resumes found to export' });
    }

    const excelBuffer = await excelExporter.exportToExcel(resumes);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="resumes_export_${Date.now()}.xlsx"`
    });

    res.send(excelBuffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Error exporting to Excel' });
  }
});

// @route   GET /api/resume/export/excel/:id
// @desc    Export single resume to Excel
// @access  Private
router.get('/export/excel/:id', auth, async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.userId
    }).select('-fileData');

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    const excelBuffer = await excelExporter.exportToExcel(resume);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${resume.fileName}_export.xlsx"`
    });

    res.send(excelBuffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Error exporting to Excel' });
  }
});

// @route   DELETE /api/resume/:id
// @desc    Delete resume
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const resume = await Resume.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Error deleting resume' });
  }
});

// @route   DELETE /api/resume/all/clear
// @desc    Delete all resumes for current user
// @access  Private
router.delete('/all/clear', auth, async (req, res) => {
  try {
    const result = await Resume.deleteMany({ userId: req.userId });

    res.json({ 
      message: `Successfully deleted ${result.deletedCount} resume(s)`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete all error:', error);
    res.status(500).json({ error: 'Error deleting resumes' });
  }
});

module.exports = router;
