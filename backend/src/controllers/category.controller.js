// Category Controller
const { query } = require('../database/connection');

/**
 * Get all categories (public)
 */
async function getAllCategories(req, res) {
  try {
    const result = await query(
      `SELECT c.category_id, c.name_ar, c.name_en, c.slug, c.description_ar, c.description_en, c.display_order,
              COUNT(cs.submission_id) as content_count
       FROM categories c
       LEFT JOIN content_submissions cs ON c.category_id = cs.category_id AND cs.submission_status = 'published'
       GROUP BY c.category_id
       ORDER BY c.display_order ASC, c.name_ar ASC`
    );
    
    res.json({
      categories: result.rows
    });
    
  } catch (error) {
    console.error('Get all categories error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get categories'
    });
  }
}

/**
 * Get category by slug (public)
 */
async function getCategoryBySlug(req, res) {
  try {
    const { slug } = req.params;
    
    const result = await query(
      `SELECT c.category_id, c.name_ar, c.name_en, c.slug, c.description_ar, c.description_en,
              COUNT(cs.submission_id) as content_count
       FROM categories c
       LEFT JOIN content_submissions cs ON c.category_id = cs.category_id AND cs.submission_status = 'published'
       WHERE c.slug = $1
       GROUP BY c.category_id`,
      [slug]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Category not found'
      });
    }
    
    // Get recent content in this category
    const contentResult = await query(
      `SELECT id, title, slug, content_type, published_at, view_count
       FROM content_submissions
       WHERE category_id = $1 AND status = 'published'
       ORDER BY published_at DESC
       LIMIT 10`,
      [result.rows[0].id]
    );
    
    res.json({
      category: result.rows[0],
      recent_content: contentResult.rows
    });
    
  } catch (error) {
    console.error('Get category by slug error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get category'
    });
  }
}

/**
 * Create category (admin only)
 */
async function createCategory(req, res) {
  try {
    const { name_ar, name_en, slug, description, icon, color, display_order } = req.body;
    
    // Check if slug already exists
    const existingCategory = await query(
      'SELECT id FROM categories WHERE slug = $1',
      [slug]
    );
    
    if (existingCategory.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Category with this slug already exists'
      });
    }
    
    const result = await query(
      `INSERT INTO categories (name_ar, name_en, slug, description, icon, color, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name_ar, name_en, slug, description, icon, color, display_order, created_at`,
      [name_ar, name_en, slug, description, icon, color, display_order || 0]
    );
    
    res.status(201).json({
      message: 'Category created successfully',
      category: result.rows[0]
    });
    
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to create category'
    });
  }
}

/**
 * Update category (admin only)
 */
async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name_ar, name_en, slug, description, icon, color, display_order } = req.body;
    
    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name_ar !== undefined) {
      updates.push(`name_ar = $${paramCount}`);
      values.push(name_ar);
      paramCount++;
    }
    
    if (name_en !== undefined) {
      updates.push(`name_en = $${paramCount}`);
      values.push(name_en);
      paramCount++;
    }
    
    if (slug !== undefined) {
      // Check if new slug already exists (excluding current category)
      const existingCategory = await query(
        'SELECT id FROM categories WHERE slug = $1 AND id != $2',
        [slug, id]
      );
      
      if (existingCategory.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Category with this slug already exists'
        });
      }
      
      updates.push(`slug = $${paramCount}`);
      values.push(slug);
      paramCount++;
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }
    
    if (icon !== undefined) {
      updates.push(`icon = $${paramCount}`);
      values.push(icon);
      paramCount++;
    }
    
    if (color !== undefined) {
      updates.push(`color = $${paramCount}`);
      values.push(color);
      paramCount++;
    }
    
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramCount}`);
      values.push(display_order);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const result = await query(
      `UPDATE categories
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, name_ar, name_en, slug, description, icon, color, display_order, updated_at`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Category not found'
      });
    }
    
    res.json({
      message: 'Category updated successfully',
      category: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to update category'
    });
  }
}

/**
 * Delete category (admin only)
 */
async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    
    // Check if category has content
    const contentCheck = await query(
      'SELECT COUNT(*) FROM content_submissions WHERE category_id = $1',
      [id]
    );
    
    if (parseInt(contentCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Cannot delete category with existing content. Please reassign or delete the content first.'
      });
    }
    
    const result = await query(
      'DELETE FROM categories WHERE id = $1 RETURNING id, name_ar, name_en',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Category not found'
      });
    }
    
    res.json({
      message: 'Category deleted successfully',
      category: result.rows[0]
    });
    
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to delete category'
    });
  }
}

module.exports = {
  getAllCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory
};
