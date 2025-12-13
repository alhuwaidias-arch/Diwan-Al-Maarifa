// User Controller
const { query } = require('../database/connection');
const bcrypt = require('bcrypt');

/**
 * Get current user profile
 */
async function getProfile(req, res) {
  try {
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get profile'
    });
  }
}

/**
 * Update current user profile
 */
async function updateProfile(req, res) {
  try {
    const { full_name, bio, avatar_url } = req.body;
    const userId = req.user.user_id;
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (full_name !== undefined) {
      updates.push(`full_name = $${paramCount}`);
      values.push(full_name);
      paramCount++;
    }
    
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount}`);
      values.push(bio);
      paramCount++;
    }
    
    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount}`);
      values.push(avatar_url);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }
    
    // Add updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Add user ID as last parameter
    values.push(userId);
    
    const result = await query(
      `UPDATE users 
       SET ${updates.join(', ')}
       WHERE user_id = $${paramCount}
       RETURNING user_id, email, username, full_name, bio, avatar_url, role, status, created_at, updated_at`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to update profile'
    });
  }
}

/**
 * Get all users (admin only)
 */
async function getAllUsers(req, res) {
  try {
    const { page = 1, limit = 20, role, status, search } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build WHERE clause
    const conditions = [];
    const values = [];
    let paramCount = 1;
    
    if (role) {
      conditions.push(`role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }
    
    if (status) {
      conditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }
    
    if (search) {
      conditions.push(`(full_name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR username ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      values
    );
    
    const total = parseInt(countResult.rows[0].count);
    
    // Get users
    values.push(limit, offset);
    const result = await query(
      `SELECT user_id, email, username, full_name, role, status, created_at, last_login
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values
    );
    
    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get users'
    });
  }
}

/**
 * Get user by ID (admin only)
 */
async function getUserById(req, res) {
  try {
    const { user_id } = req.params;
    
    const result = await query(
      `SELECT user_id, email, username, full_name, bio, avatar_url, role, status, 
              email_verified, created_at, updated_at, last_login
       FROM users
       WHERE user_id = $1`,
      [user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Get user statistics
    const statsResult = await query(
      `SELECT 
        (SELECT COUNT(*) FROM content_submissions WHERE author_id = $1) as total_submissions,
        (SELECT COUNT(*) FROM content_submissions WHERE author_id = $1 AND status = 'published') as published_count,
        (SELECT COUNT(*) FROM workflow_history WHERE reviewer_id = $1) as reviews_count
       FROM users WHERE user_id = $1`,
      [user_id]
    );
    
    res.json({
      user: result.rows[0],
      statistics: statsResult.rows[0] || {
        total_submissions: 0,
        published_count: 0,
        reviews_count: 0
      }
    });
    
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get user'
    });
  }
}

/**
 * Update user role (admin only)
 */
async function updateUserRole(req, res) {
  try {
    const { user_id } = req.params;
    const { role } = req.body;
    
    // Validate role
    const validRoles = ['contributor', 'content_auditor', 'technical_auditor', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }
    
    // Prevent self-demotion from admin
    if (req.user.user_id === user_id && req.user.role === 'admin' && role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot change your own admin role'
      });
    }
    
    const result = await query(
      `UPDATE users
       SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING user_id, email, username, full_name, role, status`,
      [role, user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    res.json({
      message: 'User role updated successfully',
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to update user role'
    });
  }
}

/**
 * Delete user (admin only)
 */
async function deleteUser(req, res) {
  try {
    const { user_id } = req.params;
    
    // Prevent self-deletion
    if (req.user.user_id === user_id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot delete your own account'
      });
    }
    
    // Check if user exists
    const userCheck = await query(
      'SELECT user_id, email FROM users WHERE user_id = $1',
      [user_id]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Soft delete by setting status to 'deleted'
    await query(
      `UPDATE users
       SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [user_id]
    );
    
    res.json({
      message: 'User deleted successfully',
      user: {
        user_id: userCheck.rows[0].user_id,
        email: userCheck.rows[0].email
      }
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to delete user'
    });
  }
}

/**
 * Change password
 */
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.user_id;
    
    // Validate input
    if (!current_password || !new_password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Current password and new password are required'
      });
    }
    
    // Get current password hash
    const result = await query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, result.rows[0].password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);
    
    // Update password
    await query(
      `UPDATE users
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [newPasswordHash, userId]
    );
    
    res.json({
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to change password'
    });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  changePassword
};
