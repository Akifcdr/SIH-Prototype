const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed!'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Initialize SQLite database
const db = new sqlite3.Database('civic_issues.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  const createIssuesTable = `
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'reported',
      priority TEXT DEFAULT 'medium',
      latitude REAL,
      longitude REAL,
      address TEXT,
      image_path TEXT,
      reporter_name TEXT,
      reporter_email TEXT,
      reporter_phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      admin_notes TEXT
    )
  `;
  
  db.run(createIssuesTable, (err) => {
    if (err) {
      console.error('Error creating issues table:', err);
    } else {
      console.log('Issues table ready');
    }
  });
}

// API Routes

// Get all issues (for admin dashboard)
app.get('/api/issues', (req, res) => {
  const { status, category, page = 1, limit = 10 } = req.query;
  let query = 'SELECT * FROM issues WHERE 1=1';
  let params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY created_at DESC';
  
  // Add pagination
  const offset = (page - 1) * limit;
  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM issues WHERE 1=1';
    let countParams = [];
    
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    if (category) {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }
    
    db.get(countQuery, countParams, (err, countRow) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        issues: rows,
        total: countRow.total,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    });
  });
});

// Get single issue by ID
app.get('/api/issues/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM issues WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }
    res.json(row);
  });
});

// Submit new issue
app.post('/api/issues', upload.single('image'), (req, res) => {
  const {
    title,
    description,
    category,
    latitude,
    longitude,
    address,
    reporter_name,
    reporter_email,
    reporter_phone
  } = req.body;
  
  const image_path = req.file ? req.file.filename : null;
  
  const query = `
    INSERT INTO issues (
      title, description, category, latitude, longitude, address, 
      image_path, reporter_name, reporter_email, reporter_phone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [
    title, description, category, latitude, longitude, address,
    image_path, reporter_name, reporter_email, reporter_phone
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    res.json({
      id: this.lastID,
      message: 'Issue reported successfully',
      status: 'reported'
    });
  });
});

// Update issue status (for admin)
app.put('/api/issues/:id/status', (req, res) => {
  const id = req.params.id;
  const { status, admin_notes } = req.body;
  
  const query = `
    UPDATE issues 
    SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `;
  
  db.run(query, [status, admin_notes, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }
    
    res.json({ message: 'Issue status updated successfully' });
  });
});

// Get statistics for dashboard
app.get('/api/stats', (req, res) => {
  const queries = {
    total: 'SELECT COUNT(*) as count FROM issues',
    reported: 'SELECT COUNT(*) as count FROM issues WHERE status = "reported"',
    inProgress: 'SELECT COUNT(*) as count FROM issues WHERE status = "in_progress"',
    resolved: 'SELECT COUNT(*) as count FROM issues WHERE status = "resolved"',
    categories: `
      SELECT category, COUNT(*) as count 
      FROM issues 
      GROUP BY category 
      ORDER BY count DESC
    `
  };
  
  const stats = {};
  
  Promise.all([
    new Promise((resolve, reject) => {
      db.get(queries.total, [], (err, row) => {
        if (err) reject(err);
        else resolve(['total', row.count]);
      });
    }),
    new Promise((resolve, reject) => {
      db.get(queries.reported, [], (err, row) => {
        if (err) reject(err);
        else resolve(['reported', row.count]);
      });
    }),
    new Promise((resolve, reject) => {
      db.get(queries.inProgress, [], (err, row) => {
        if (err) reject(err);
        else resolve(['inProgress', row.count]);
      });
    }),
    new Promise((resolve, reject) => {
      db.get(queries.resolved, [], (err, row) => {
        if (err) reject(err);
        else resolve(['resolved', row.count]);
      });
    }),
    new Promise((resolve, reject) => {
      db.all(queries.categories, [], (err, rows) => {
        if (err) reject(err);
        else resolve(['categories', rows]);
      });
    })
  ]).then(results => {
    results.forEach(([key, value]) => {
      stats[key] = value;
    });
    res.json(stats);
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

// Routes for serving HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Civic Issue Reporter server running on port ${PORT}`);
  console.log(`Citizen portal: http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});
