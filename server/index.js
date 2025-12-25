const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Import routes
const searchRoutes = require('./routes/search');
const categoryRoutes = require('./routes/categories');
const exportRoutes = require('./routes/export');
const referenceDocRoutes = require('./routes/referenceDoc');
const templateRoutes = require('./routes/template');
const templateV2Routes = require('./routes/templateV2');
const templateV3Routes = require('./routes/templateV3');
const templateV4Routes = require('./routes/templateV4');
const templateFinalRoutes = require('./routes/templateFinal');
const detailDocumentRoutes = require('./routes/detailDocument');
const shortSummaryRoutes = require('./routes/shortSummaryDoc');
const drugStatsRoutes = require('./routes/drugStats');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Make logger available globally
app.locals.logger = logger;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Routes
app.use('/api/search', searchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/reference-doc', referenceDocRoutes);
app.use('/api/template', templateRoutes);
app.use('/api/template-v2', templateV2Routes);
app.use('/api/template-v3', templateV3Routes);
app.use('/api/template-v4', templateV4Routes);
app.use('/api/template-final', templateFinalRoutes);
app.use('/api', detailDocumentRoutes);
app.use('/api', shortSummaryRoutes);
app.use('/api/drug-stats', drugStatsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve static files from React build (for production)
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const clientBuildPath = path.join(__dirname, '../client/build');
const indexHtmlPath = path.join(clientBuildPath, 'index.html');

// Check if build exists
const buildExists = fs.existsSync(clientBuildPath);
const indexExists = fs.existsSync(indexHtmlPath);

// Log environment info for debugging
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  RENDER: process.env.RENDER,
  isProduction,
  clientBuildPath,
  buildExists,
  indexExists
});

if (isProduction && buildExists && indexExists) {
  // Serve static files
  app.use(express.static(clientBuildPath, {
    maxAge: '1d',
    etag: true
  }));
  
  console.log('✅ Serving static files from:', clientBuildPath);
  
  // API info endpoint for /api root
  app.get('/api', (req, res) => {
    res.json({
      message: 'PubMed Intelligent Article Filtration API',
      version: '1.0.0',
      endpoints: {
        search: '/api/search',
        categories: '/api/categories',
        export: '/api/export',
        health: '/api/health'
      }
    });
  });
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    console.log('Serving React app from:', indexHtmlPath);
    res.sendFile(indexHtmlPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).json({ 
          error: 'Failed to load application',
          details: err.message,
          buildPath: clientBuildPath,
          buildExists,
          indexExists
        });
      }
    });
  });
} else {
  // In development or build not found, show API info at root
  console.log('⚠️ Running in development mode or build not found');
  app.get('/', (req, res) => {
    res.json({
      message: 'PubMed Intelligent Article Filtration API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      buildStatus: {
        buildExists,
        indexExists,
        path: clientBuildPath
      },
      endpoints: {
        search: '/api/search',
        categories: '/api/categories',
        export: '/api/export',
        health: '/api/health'
      },
      note: buildExists ? 'Build found but NODE_ENV not set to production' : 'React build not found. Run: cd client && npm run build'
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      status: 404
    }
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Unhandled Rejection:', reason);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n🚀 PubMed Intelligent Filter API running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health\n`);
}).on('error', (err) => {
  logger.error('Server error:', err);
  console.error('Server error:', err);
  process.exit(1);
});

module.exports = app;
