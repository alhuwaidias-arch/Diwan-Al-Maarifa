const express = require('express');
const router = express.Router();
const pool = require('../database/connection');
const fs = require('fs');
const path = require('path');

// Force migration endpoint - drops and recreates all tables
router.post('/force-migrate', async (req, res) => {
  try {
    console.log('🔄 Force migration requested via API endpoint');
    
    // Drop all tables
    console.log('🗑️  Dropping all existing tables...');
    await pool.query(`
      DROP TABLE IF EXISTS user_sessions CASCADE;
      DROP TABLE IF EXISTS comments CASCADE;
      DROP TABLE IF EXISTS analytics_events CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS workflow_history CASCADE;
      DROP TABLE IF EXISTS published_content CASCADE;
      DROP TABLE IF EXISTS content_submissions CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
    `);
    console.log('✅ All tables dropped');

    // Read and execute schema
    console.log('📦 Creating new schema...');
    const schemaPath = path.join(__dirname, '../../database/schema/01_create_tables.sql');
    
    let schemaSQL;
    if (fs.existsSync(schemaPath)) {
      schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    } else {
      schemaSQL = getEmbeddedSchema();
    }

    await pool.query(schemaSQL);
    console.log('✅ Schema created successfully');

    // Verify tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    const tables = result.rows.map(r => r.table_name);
    console.log('📋 Created tables:', tables.join(', '));

    res.json({
      success: true,
      message: 'Database migration completed successfully',
      tables: tables
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  }
});

// Check database status
router.get('/db-status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_schema = 'public' AND columns.table_name = tables.table_name) as column_count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    res.json({
      success: true,
      tables: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function getEmbeddedSchema() {
  return `
-- ديوان المعرفة (Diwan Al-Maarifa) Database Schema
-- Arabic Knowledge Platform Database Structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'content_auditor', 'technical_auditor', 'contributor', 'reader')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    profile_image_url TEXT,
    bio TEXT
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    slug VARCHAR(100) UNIQUE NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    parent_category_id UUID REFERENCES categories(category_id),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content Submissions Table
CREATE TABLE IF NOT EXISTS content_submissions (
    submission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contributor_id UUID NOT NULL REFERENCES users(user_id),
    category_id UUID REFERENCES categories(category_id),
    title_ar VARCHAR(500) NOT NULL,
    title_en VARCHAR(500),
    content_ar TEXT NOT NULL,
    content_en TEXT,
    submission_status VARCHAR(20) DEFAULT 'draft' CHECK (submission_status IN ('draft', 'submitted', 'under_content_review', 'under_technical_review', 'approved', 'rejected', 'published')),
    ai_review_score DECIMAL(3,2),
    ai_review_notes TEXT,
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Published Content Table
CREATE TABLE IF NOT EXISTS published_content (
    content_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID UNIQUE REFERENCES content_submissions(submission_id),
    category_id UUID REFERENCES categories(category_id),
    title_ar VARCHAR(500) NOT NULL,
    title_en VARCHAR(500),
    slug VARCHAR(500) UNIQUE NOT NULL,
    content_ar TEXT NOT NULL,
    content_en TEXT,
    author_id UUID REFERENCES users(user_id),
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    featured BOOLEAN DEFAULT FALSE,
    meta_description_ar TEXT,
    meta_description_en TEXT,
    tags TEXT[]
);

-- Workflow History Table
CREATE TABLE IF NOT EXISTS workflow_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES content_submissions(submission_id),
    reviewer_id UUID REFERENCES users(user_id),
    action VARCHAR(50) NOT NULL,
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(user_id),
    content_id UUID REFERENCES published_content(content_id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments Table (optional, for future use)
CREATE TABLE IF NOT EXISTS comments (
    comment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES published_content(content_id),
    user_id UUID REFERENCES users(user_id),
    parent_comment_id UUID REFERENCES comments(comment_id),
    comment_text TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_content_submissions_contributor ON content_submissions(contributor_id);
CREATE INDEX IF NOT EXISTS idx_content_submissions_status ON content_submissions(submission_status);
CREATE INDEX IF NOT EXISTS idx_published_content_slug ON published_content(slug);
CREATE INDEX IF NOT EXISTS idx_published_content_category ON published_content(category_id);
CREATE INDEX IF NOT EXISTS idx_published_content_author ON published_content(author_id);
CREATE INDEX IF NOT EXISTS idx_published_content_published_at ON published_content(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_history_submission ON workflow_history(submission_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_content ON analytics_events(content_id);
CREATE INDEX IF NOT EXISTS idx_comments_content ON comments(content_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token);

-- Full-text search indexes for Arabic content
CREATE INDEX IF NOT EXISTS idx_published_content_title_ar_fts ON published_content USING gin(to_tsvector('arabic', title_ar));
CREATE INDEX IF NOT EXISTS idx_published_content_content_ar_fts ON published_content USING gin(to_tsvector('arabic', content_ar));

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_submissions_updated_at BEFORE UPDATE ON content_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_published_content_updated_at BEFORE UPDATE ON published_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert Default Categories
INSERT INTO categories (name_ar, name_en, slug, description_ar, description_en, display_order) VALUES
('الفيزياء', 'Physics', 'physics', 'علم دراسة المادة والطاقة والقوى', 'The study of matter, energy, and forces', 1),
('الكيمياء', 'Chemistry', 'chemistry', 'علم دراسة المواد وخصائصها وتفاعلاتها', 'The study of substances, their properties and reactions', 2),
('الأحياء', 'Biology', 'biology', 'علم دراسة الكائنات الحية', 'The study of living organisms', 3),
('الطاقة', 'Energy', 'energy', 'دراسة مصادر الطاقة وتطبيقاتها', 'Study of energy sources and applications', 4),
('الهندسة', 'Engineering', 'engineering', 'تطبيق العلوم في التصميم والبناء', 'Application of science in design and construction', 5),
('الطبيعة', 'Nature', 'nature', 'دراسة العالم الطبيعي والبيئة', 'Study of the natural world and environment', 6)
ON CONFLICT (slug) DO NOTHING;
  `;
}

module.exports = router;
