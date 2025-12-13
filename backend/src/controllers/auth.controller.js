// Authentication Controller
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate JWT token
 */
function generateToken(userId, email, role) {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

/**
 * Register new user
 */
async function register(req, res) {
  try {
    const { email, password, full_name, username, role = 'contributor' } = req.body;
    
    // Generate username from email if not provided
    const finalUsername = username || email.split('@')[0];
    
    // Check if user already exists
    const existingUser = await query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists'
      });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Insert new user
    const result = await query(
      `INSERT INTO users (email, username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, email, username, full_name, role, created_at`,
      [email, finalUsername, passwordHash, full_name, role]
    );
    
    const user = result.rows[0];
    
    // Generate token
    const token = generateToken(user.user_id, user.email, user.role);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        created_at: user.created_at
      },
      token
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register user'
    });
  }
}

/**
 * Login user
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    
    // Get user from database
    const result = await query(
      `SELECT user_id, email, password_hash, full_name, role, status
       FROM users
       WHERE email = $1`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }
    
    const user = result.rows[0];
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Account is deactivated'
      });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }
    
    // Update last login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );
    
    // Generate token
    const token = generateToken(user.user_id, user.email, user.role);
    
    res.json({
      message: 'Login successful',
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to login'
    });
  }
}

/**
 * Refresh JWT token
 */
async function refreshToken(req, res) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }
    
    const token = authHeader.substring(7);
    
    // Verify old token (allow expired)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    
    // Get user from database
    const result = await query(
      'SELECT user_id, email, role, status FROM users WHERE user_id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found or inactive'
      });
    }
    
    const user = result.rows[0];
    
    // Generate new token
    const newToken = generateToken(user.id, user.email, user.role);
    
    res.json({
      message: 'Token refreshed successfully',
      token: newToken
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
}

/**
 * Logout user
 */
async function logout(req, res) {
  // In a stateless JWT system, logout is handled client-side
  // by removing the token. This endpoint is for future token blacklisting
  res.json({
    message: 'Logout successful'
  });
}

/**
 * Request password reset
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    
    // Check if user exists
    const result = await query(
      'SELECT user_id, email, full_name FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      // Don't reveal if email exists
      return res.json({
        message: 'If the email exists, a password reset link has been sent'
      });
    }
    
    const user = result.rows[0];
    
    // Generate reset token
    const resetToken = uuidv4();
    const resetExpiry = new Date(Date.now() + 3600000); // 1 hour
    
    // Store reset token
    await query(
      `UPDATE users 
       SET password_reset_token = $1, password_reset_expires = $2
       WHERE user_id = $3`,
      [resetToken, resetExpiry, user.user_id]
    );
    
    // TODO: Send email with reset link
    // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    // await sendEmail(user.email, 'Password Reset', resetLink);
    
    res.json({
      message: 'If the email exists, a password reset link has been sent'
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process password reset request'
    });
  }
}

/**
 * Reset password with token
 */
async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    
    // Find user with valid reset token
    const result = await query(
      `SELECT user_id FROM users
       WHERE password_reset_token = $1
       AND password_reset_expires > CURRENT_TIMESTAMP`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid or expired reset token'
      });
    }
    
    const user = result.rows[0];
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password and clear reset token
    await query(
      `UPDATE users
       SET password_hash = $1,
           password_reset_token = NULL,
           password_reset_expires = NULL
       WHERE user_id = $2`,
      [passwordHash, user.user_id]
    );
    
    res.json({
      message: 'Password reset successful'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reset password'
    });
  }
}

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword
};
