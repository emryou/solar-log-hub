const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// JWT Secret - Production'da environment variable kullanın!
const JWT_SECRET = process.env.JWT_SECRET || 'solar-monitoring-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

// ============================================
// PASSWORD HASHING
// ============================================

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

// ============================================
// JWT TOKENS
// ============================================

function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    organization_id: user.organization_id
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// ============================================
// MIDDLEWARE
// ============================================

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Attach user info to request
  req.user = decoded;
  next();
}

function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

// ============================================
// VALIDATION
// ============================================

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  // Minimum 8 characters, at least one letter and one number
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain letters and numbers' };
  }
  
  return { valid: true };
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  authMiddleware,
  adminMiddleware,
  validateEmail,
  validatePassword
};
