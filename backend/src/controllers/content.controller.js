// Content Controller
const { query, getClient } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

/**
 * Helper function to generate slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, '') // Keep Arabic, English, numbers, spaces, hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .substring(0, 200); // Limit length
}

/**
 * Get published content (public)
 */
async function getPublishedContent(req, res) {
  try {
    const { page = 1, limit = 20, category, content_type, search } = req.query;
    const offset = (page - 1) * limit;
    
    const conditions = ["status = 'published'"];
    const values = [];
    let paramCount = 1;
    
    if (category) {
      conditions.push(`category_id = $${paramCount}`);
      values.push(category);
      paramCount++;
    }
    
    if (content_type) {
      conditions.push(`content_type = $${paramCount}`);
      values.push(content_type);
      paramCount++;
    }
    
    if (search) {
      conditions.push(`(title ILIKE $${paramCount} OR content ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM content_submissions WHERE ${whereClause}`,
      values
    );
    
    const total = parseInt(countResult.rows[0].count);
    
    // Get content
    values.push(limit, offset);
    const result = await query(
      `SELECT cs.submission_id, cs.title, cs.slug, cs.content, cs.content_type, cs.tags,
              cs.published_at, cs.view_count,
              c.name_ar as category_name_ar, c.name_en as category_name_en,
              u.full_name as author_name, u.username as author_username
       FROM content_submissions cs
       LEFT JOIN categories c ON cs.category_id = c.submission_id
       LEFT JOIN users u ON cs.author_id = u.submission_id
       WHERE ${whereClause}
       ORDER BY cs.published_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values
    );
    
    res.json({
      content: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get published content error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get published content'
    });
  }
}

/**
 * Get published content by slug (public)
 */
async function getPublishedBySlug(req, res) {
  try {
    const { slug } = req.params;
    
    const result = await query(
      `SELECT cs.submission_id, cs.title, cs.slug, cs.content, cs.content_type, cs.tags,
              cs.published_at, cs.view_count,
              c.submission_id as category_id, c.name_ar as category_name_ar, c.name_en as category_name_en, c.slug as category_slug,
              u.submission_id as author_id, u.full_name as author_name, u.username as author_username, u.bio as author_bio
       FROM content_submissions cs
       LEFT JOIN categories c ON cs.category_id = c.submission_id
       LEFT JOIN users u ON cs.author_id = u.submission_id
       WHERE cs.slug = $1 AND cs.submission_status = 'published'`,
      [slug]
    );
    
    if (result.rows.length === 0) {
      return res.submission_status(404).json({
        error: 'Not Found',
        message: 'Content not found'
      });
    }
    
    // Increment view count
    await query(
      'UPDATE content_submissions SET view_count = view_count + 1 WHERE submission_id = $1',
      [result.rows[0].submission_id]
    );
    
    res.json({
      content: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get published by slug error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get content'
    });
  }
}

/**
 * Search content (public)
 */
async function searchContent(req, res) {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.submission_status(400).json({
        error: 'Bad Request',
        message: 'Search query must be at least 2 characters'
      });
    }
    
    const offset = (page - 1) * limit;
    
    // Full-text search using PostgreSQL
    const result = await query(
      `SELECT cs.submission_id, cs.title, cs.slug, cs.content_type, cs.published_at,
              c.name_ar as category_name_ar,
              u.full_name as author_name,
              ts_rank(to_tsvector('arabic', cs.title || ' ' || cs.content), plainto_tsquery('arabic', $1)) as rank
       FROM content_submissions cs
       LEFT JOIN categories c ON cs.category_id = c.submission_id
       LEFT JOIN users u ON cs.author_id = u.submission_id
       WHERE cs.submission_status = 'published'
         AND to_tsvector('arabic', cs.title || ' ' || cs.content) @@ plainto_tsquery('arabic', $1)
       ORDER BY rank DESC, cs.published_at DESC
       LIMIT $2 OFFSET $3`,
      [q, limit, offset]
    );
    
    res.json({
      results: result.rows,
      query: q,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Search content error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to search content'
    });
  }
}

/**
 * Submit new content (contributor)
 */
async function submitContent(req, res) {
  try {
    const { title, content, category_id, content_type, tags } = req.body;
    const authorId = req.user.submission_id;
    
    // Generate slug from title
    const slug = generateSlug(title) + '-' + Date.now();
    
    const result = await query(
      `INSERT INTO content_submissions 
       (title, slug, content, category_id, content_type, tags, author_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
       RETURNING submission_id, title, slug, content_type, status, created_at`,
      [title, slug, content, category_id, content_type, tags || [], authorId]
    );
    
    res.submission_status(201).json({
      message: 'Content submitted successfully',
      submission: result.rows[0]
    });
    
  } catch (error) {
    console.error('Submit content error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to submit content'
    });
  }
}

/**
 * Get user's submissions (contributor)
 */
async function getUserSubmissions(req, res) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const authorId = req.user.submission_id;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE author_id = $1';
    const values = [authorId];
    let paramCount = 2;
    
    if (status) {
      whereClause += ` AND status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM content_submissions ${whereClause}`,
      values
    );
    
    const total = parseInt(countResult.rows[0].count);
    
    // Get submissions
    values.push(limit, offset);
    const result = await query(
      `SELECT cs.submission_id, cs.title, cs.slug, cs.content_type, cs.submission_status, cs.created_at, cs.updated_at,
              c.name_ar as category_name_ar
       FROM content_submissions cs
       LEFT JOIN categories c ON cs.category_id = c.submission_id
       ${whereClause}
       ORDER BY cs.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values
    );
    
    res.json({
      submissions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get user submissions error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get submissions'
    });
  }
}

/**
 * Get submission by ID (contributor - own submissions only)
 */
async function getSubmissionById(req, res) {
  try {
    const { submission_id } = req.params;
    const userId = req.user.submission_id;
    const userRole = req.user.role;
    
    // Contributors can only see their own submissions
    // Auditors and admins can see all
    let whereClause = 'WHERE cs.submission_id = $1';
    const values = [submission_id];
    
    if (userRole === 'contributor') {
      whereClause += ' AND cs.author_id = $2';
      values.push(userId);
    }
    
    const result = await query(
      `SELECT cs.*, 
              c.name_ar as category_name_ar, c.name_en as category_name_en,
              u.full_name as author_name, u.email as author_email
       FROM content_submissions cs
       LEFT JOIN categories c ON cs.category_id = c.submission_id
       LEFT JOIN users u ON cs.author_id = u.submission_id
       ${whereClause}`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.submission_status(404).json({
        error: 'Not Found',
        message: 'Submission not found'
      });
    }
    
    // Get workflow history
    const historyResult = await query(
      `SELECT wh.*, u.full_name as reviewer_name, u.role as reviewer_role
       FROM workflow_history wh
       LEFT JOIN users u ON wh.reviewer_id = u.submission_id
       WHERE wh.submission_id = $1
       ORDER BY wh.created_at DESC`,
      [submission_id]
    );
    
    res.json({
      submission: result.rows[0],
      workflow_history: historyResult.rows
    });
    
  } catch (error) {
    console.error('Get submission by ID error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get submission'
    });
  }
}

/**
 * Update submission (contributor - own submissions only, draft status only)
 */
async function updateSubmission(req, res) {
  try {
    const { submission_id } = req.params;
    const { title, content, category_id, tags } = req.body;
    const authorId = req.user.submission_id;
    
    // Check if submission exists and is owned by user
    const checkResult = await query(
      'SELECT status FROM content_submissions WHERE submission_id = $1 AND author_id = $2',
      [submission_id, authorId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.submission_status(404).json({
        error: 'Not Found',
        message: 'Submission not found'
      });
    }
    
    // Only allow editing draft submissions
    if (checkResult.rows[0].submission_status !== 'draft') {
      return res.submission_status(403).json({
        error: 'Forbidden',
        message: 'Can only edit draft submissions'
      });
    }
    
    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
      
      // Update slug if title changes
      const newSlug = generateSlug(title) + '-' + Date.now();
      updates.push(`slug = $${paramCount}`);
      values.push(newSlug);
      paramCount++;
    }
    
    if (content !== undefined) {
      updates.push(`content = $${paramCount}`);
      values.push(content);
      paramCount++;
    }
    
    if (category_id !== undefined) {
      updates.push(`category_id = $${paramCount}`);
      values.push(category_id);
      paramCount++;
    }
    
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount}`);
      values.push(tags);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.submission_status(400).json({
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(submission_id);
    
    const result = await query(
      `UPDATE content_submissions
       SET ${updates.join(', ')}
       WHERE submission_id = $${paramCount}
       RETURNING submission_id, title, slug, content_type, status, updated_at`,
      values
    );
    
    res.json({
      message: 'Submission updated successfully',
      submission: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update submission error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to update submission'
    });
  }
}

/**
 * Delete submission (contributor - own submissions only, draft status only)
 */
async function deleteSubmission(req, res) {
  try {
    const { submission_id } = req.params;
    const authorId = req.user.submission_id;
    
    // Check if submission exists and is owned by user
    const checkResult = await query(
      'SELECT status FROM content_submissions WHERE submission_id = $1 AND author_id = $2',
      [submission_id, authorId]
    );
    
    if (checkResult.rows.length === 0) {
      return res.submission_status(404).json({
        error: 'Not Found',
        message: 'Submission not found'
      });
    }
    
    // Only allow deleting draft submissions
    if (checkResult.rows[0].submission_status !== 'draft') {
      return res.submission_status(403).json({
        error: 'Forbidden',
        message: 'Can only delete draft submissions'
      });
    }
    
    await query('DELETE FROM content_submissions WHERE submission_id = $1', [submission_id]);
    
    res.json({
      message: 'Submission deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete submission error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to delete submission'
    });
  }
}

/**
 * Get pending reviews (auditors)
 */
async function getPendingReviews(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userRole = req.user.role;
    const offset = (page - 1) * limit;
    
    // Determine which status to show based on role
    let statusCondition;
    if (userRole === 'content_auditor') {
      statusCondition = "status = 'pending_content_review'";
    } else if (userRole === 'technical_auditor') {
      statusCondition = "status = 'pending_technical_review'";
    } else {
      // Admin can see all pending
      statusCondition = "status IN ('pending_content_review', 'pending_technical_review')";
    }
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM content_submissions WHERE ${statusCondition}`
    );
    
    const total = parseInt(countResult.rows[0].count);
    
    // Get submissions
    const result = await query(
      `SELECT cs.submission_id, cs.title, cs.slug, cs.content_type, cs.submission_status, cs.created_at,
              c.name_ar as category_name_ar,
              u.full_name as author_name, u.email as author_email
       FROM content_submissions cs
       LEFT JOIN categories c ON cs.category_id = c.submission_id
       LEFT JOIN users u ON cs.author_id = u.submission_id
       WHERE ${statusCondition}
       ORDER BY cs.created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    res.json({
      submissions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get pending reviews'
    });
  }
}

/**
 * Submit review (auditors)
 */
async function submitReview(req, res) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { submission_id } = req.params;
    const { decision, comments } = req.body;
    const reviewerId = req.user.submission_id;
    const reviewerRole = req.user.role;
    
    // Get submission
    const submissionResult = await client.query(
      'SELECT status, author_id FROM content_submissions WHERE submission_id = $1',
      [submission_id]
    );
    
    if (submissionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.submission_status(404).json({
        error: 'Not Found',
        message: 'Submission not found'
      });
    }
    
    const submission = submissionResult.rows[0];
    
    // Validate reviewer can review this submission
    if (reviewerRole === 'content_auditor' && submission.submission_status !== 'pending_content_review') {
      await client.query('ROLLBACK');
      return res.submission_status(403).json({
        error: 'Forbidden',
        message: 'This submission is not pending content review'
      });
    }
    
    if (reviewerRole === 'technical_auditor' && submission.submission_status !== 'pending_technical_review') {
      await client.query('ROLLBACK');
      return res.submission_status(403).json({
        error: 'Forbidden',
        message: 'This submission is not pending technical review'
      });
    }
    
    // Determine new status based on decision
    let newStatus;
    if (decision === 'approved') {
      if (reviewerRole === 'content_auditor') {
        newStatus = 'pending_technical_review';
      } else if (reviewerRole === 'technical_auditor') {
        newStatus = 'approved';
      }
    } else if (decision === 'rejected') {
      newStatus = 'rejected';
    } else if (decision === 'needs_revision') {
      newStatus = 'needs_revision';
    }
    
    // Update submission status
    await client.query(
      'UPDATE content_submissions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE submission_id = $2',
      [newStatus, submission_id]
    );
    
    // Record in workflow history
    await client.query(
      `INSERT INTO workflow_history (submission_id, reviewer_id, from_status, to_status, decision, comments)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [submission_id, reviewerId, submission.submission_status, newStatus, decision, comments]
    );
    
    await client.query('COMMIT');
    
    res.json({
      message: 'Review submitted successfully',
      new_status: newStatus
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Submit review error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to submit review'
    });
  } finally {
    client.release();
  }
}

/**
 * Approve content (shortcut for auditors)
 */
async function approveContent(req, res) {
  req.body.decision = 'approved';
  return submitReview(req, res);
}

/**
 * Reject content (shortcut for auditors)
 */
async function rejectContent(req, res) {
  req.body.decision = 'rejected';
  return submitReview(req, res);
}

/**
 * Publish content (admin only)
 */
async function publishContent(req, res) {
  try {
    const { submission_id } = req.params;
    
    // Check if submission is approved
    const checkResult = await query(
      'SELECT status FROM content_submissions WHERE submission_id = $1',
      [submission_id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.submission_status(404).json({
        error: 'Not Found',
        message: 'Submission not found'
      });
    }
    
    if (checkResult.rows[0].submission_status !== 'approved') {
      return res.submission_status(403).json({
        error: 'Forbidden',
        message: 'Can only publish approved submissions'
      });
    }
    
    // Publish
    const result = await query(
      `UPDATE content_submissions
       SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE submission_id = $1
       RETURNING submission_id, title, slug, status, published_at`,
      [submission_id]
    );
    
    res.json({
      message: 'Content published successfully',
      content: result.rows[0]
    });
    
  } catch (error) {
    console.error('Publish content error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to publish content'
    });
  }
}

/**
 * Update published content (admin only)
 */
async function updatePublishedContent(req, res) {
  try {
    const { submission_id } = req.params;
    const { title, content, category_id, tags } = req.body;
    
    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
    }
    
    if (content !== undefined) {
      updates.push(`content = $${paramCount}`);
      values.push(content);
      paramCount++;
    }
    
    if (category_id !== undefined) {
      updates.push(`category_id = $${paramCount}`);
      values.push(category_id);
      paramCount++;
    }
    
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount}`);
      values.push(tags);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.submission_status(400).json({
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(submission_id);
    
    const result = await query(
      `UPDATE content_submissions
       SET ${updates.join(', ')}
       WHERE submission_id = $${paramCount} AND status = 'published'
       RETURNING submission_id, title, slug, updated_at`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.submission_status(404).json({
        error: 'Not Found',
        message: 'Published content not found'
      });
    }
    
    res.json({
      message: 'Published content updated successfully',
      content: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update published content error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to update published content'
    });
  }
}

/**
 * Unpublish content (admin only)
 */
async function unpublishContent(req, res) {
  try {
    const { submission_id } = req.params;
    
    const result = await query(
      `UPDATE content_submissions
       SET status = 'draft', published_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE submission_id = $1 AND status = 'published'
       RETURNING submission_id, title, status`,
      [submission_id]
    );
    
    if (result.rows.length === 0) {
      return res.submission_status(404).json({
        error: 'Not Found',
        message: 'Published content not found'
      });
    }
    
    res.json({
      message: 'Content unpublished successfully',
      content: result.rows[0]
    });
    
  } catch (error) {
    console.error('Unpublish content error:', error);
    res.submission_status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to unpublish content'
    });
  }
}

module.exports = {
  getPublishedContent,
  getPublishedBySlug,
  searchContent,
  submitContent,
  getUserSubmissions,
  getSubmissionById,
  updateSubmission,
  deleteSubmission,
  getPendingReviews,
  submitReview,
  approveContent,
  rejectContent,
  publishContent,
  updatePublishedContent,
  unpublishContent
};
