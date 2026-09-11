-- ============================================================================
-- SIH26165 Database Schema
-- SQL Database for SIF Detection System
-- ============================================================================

-- Create database
CREATE DATABASE IF NOT EXISTS sih26165_db;
USE sih26165_db;

-- ============================================================================
-- Table 1: Reports (Main table for safety reports)
-- ============================================================================

CREATE TABLE reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description LONGTEXT NOT NULL,
    original_text LONGTEXT,
    site_name VARCHAR(100),
    location VARCHAR(100),
    activity_type VARCHAR(100),
    date_submitted DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_incident DATETIME,
    
    -- Classification results
    sif_classification VARCHAR(20),  -- 'CRITICAL', 'MEDIUM', 'LOW'
    sif_score FLOAT DEFAULT 0.0,  -- 0-1 confidence score
    sif_confidence FLOAT DEFAULT 0.0,
    
    -- Life-Saving Rule tagging
    life_saving_rule VARCHAR(50),  -- Energy Isolation, Hot Work, Confined Space, etc.
    secondary_rules VARCHAR(255),  -- Comma-separated multiple rules
    
    -- Precursor information
    precursors VARCHAR(255),  -- Extracted precursor types
    keywords VARCHAR(255),  -- Key risk indicators
    
    -- Metadata
    status VARCHAR(20) DEFAULT 'pending',  -- pending, classified, resolved
    reviewed_by VARCHAR(100),
    date_reviewed DATETIME,
    notes LONGTEXT,
    
    -- Indexing
    INDEX idx_site (site_name),
    INDEX idx_activity (activity_type),
    INDEX idx_classification (sif_classification),
    INDEX idx_rule (life_saving_rule),
    INDEX idx_date (date_submitted)
);

-- ============================================================================
-- Table 2: Life-Saving Rules (Reference table)
-- ============================================================================

CREATE TABLE life_saving_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_code VARCHAR(50) UNIQUE NOT NULL,  -- ES01, HW01, CS01, etc.
    rule_name VARCHAR(100) NOT NULL,  -- Energy Isolation, Hot Work, etc.
    description LONGTEXT,
    keywords VARCHAR(500),  -- Keywords to trigger this rule
    precursor_indicators VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_rule_code (rule_code),
    INDEX idx_rule_name (rule_name)
);

-- ============================================================================
-- Table 3: Precursor Patterns (Recurring patterns detected)
-- ============================================================================

CREATE TABLE precursor_patterns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pattern_id VARCHAR(50) UNIQUE NOT NULL,
    precursor_type VARCHAR(100),  -- Equipment_Degradation, Lack_Supervision, etc.
    activity VARCHAR(100),
    site_name VARCHAR(100),
    location VARCHAR(100),
    frequency INT DEFAULT 1,  -- How many times this pattern has occurred
    
    -- Risk assessment
    sif_precursor_count INT DEFAULT 0,  -- Times this led to CRITICAL/SIF
    non_sif_count INT DEFAULT 0,  -- Times this was LOW/MEDIUM
    
    -- Metrics
    sif_probability FLOAT DEFAULT 0.0,  -- P(SIF | this precursor)
    severity_index FLOAT DEFAULT 0.0,
    
    last_occurrence DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_precursor_type (precursor_type),
    INDEX idx_activity (activity),
    INDEX idx_site (site_name),
    INDEX idx_probability (sif_probability)
);

-- ============================================================================
-- Table 4: Site Risk Summary (Aggregate data by site)
-- ============================================================================

CREATE TABLE site_risk_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_name VARCHAR(100) UNIQUE NOT NULL,
    location VARCHAR(100),
    
    -- Report counts
    total_reports INT DEFAULT 0,
    critical_reports INT DEFAULT 0,
    medium_reports INT DEFAULT 0,
    low_reports INT DEFAULT 0,
    
    -- Risk metrics
    sif_percentage FLOAT DEFAULT 0.0,  -- % of CRITICAL reports
    precursor_density FLOAT DEFAULT 0.0,  -- Number of precursors per report
    risk_score FLOAT DEFAULT 0.0,  -- Overall risk score (0-100)
    
    -- Trending
    reports_last_7_days INT DEFAULT 0,
    reports_last_30_days INT DEFAULT 0,
    
    -- Most common rules
    primary_rule VARCHAR(50),
    secondary_rules VARCHAR(255),
    
    -- Most dangerous activities
    highest_risk_activity VARCHAR(100),
    
    last_report_date DATETIME,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_site_name (site_name),
    INDEX idx_risk_score (risk_score),
    INDEX idx_sif_percentage (sif_percentage)
);

-- ============================================================================
-- Table 5: Activity Risk Summary (Aggregate data by activity)
-- ============================================================================

CREATE TABLE activity_risk_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activity_type VARCHAR(100) UNIQUE NOT NULL,
    
    -- Report counts
    total_reports INT DEFAULT 0,
    critical_reports INT DEFAULT 0,
    medium_reports INT DEFAULT 0,
    low_reports INT DEFAULT 0,
    
    -- Risk metrics
    sif_percentage FLOAT DEFAULT 0.0,
    precursor_density FLOAT DEFAULT 0.0,
    risk_score FLOAT DEFAULT 0.0,
    
    -- Associated Life-Saving Rules
    primary_rule VARCHAR(50),
    secondary_rules VARCHAR(255),
    
    -- Most affected sites
    highest_risk_site VARCHAR(100),
    
    last_report_date DATETIME,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_activity (activity_type),
    INDEX idx_risk_score (risk_score)
);

-- ============================================================================
-- Table 6: Classification History (Track model predictions)
-- ============================================================================

CREATE TABLE classification_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    model_version VARCHAR(50),
    predicted_label VARCHAR(20),
    confidence_score FLOAT,
    model_name VARCHAR(100),  -- t5-base, etc.
    processing_time_ms INT,  -- Time taken for inference
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (report_id) REFERENCES reports(id),
    INDEX idx_report_id (report_id),
    INDEX idx_model_version (model_version)
);

-- ============================================================================
-- Table 7: User Feedback (For model improvement)
-- ============================================================================

CREATE TABLE user_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    user_id VARCHAR(100),
    feedback_type VARCHAR(50),  -- 'correction', 'agree', 'clarification'
    correct_classification VARCHAR(20),
    correct_rule VARCHAR(50),
    comments LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (report_id) REFERENCES reports(id),
    INDEX idx_report_id (report_id),
    INDEX idx_user_id (user_id)
);

-- ============================================================================
-- Table 8: Dashboard Alerts (For HSE interventions)
-- ============================================================================

CREATE TABLE dashboard_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alert_type VARCHAR(50),  -- 'high_frequency_precursor', 'site_risk_spike', etc.
    severity VARCHAR(20),  -- 'HIGH', 'MEDIUM', 'LOW'
    title VARCHAR(255),
    description LONGTEXT,
    site_name VARCHAR(100),
    activity_type VARCHAR(100),
    related_reports INT,  -- Number of related reports
    recommended_action LONGTEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    
    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_site (site_name),
    INDEX idx_is_resolved (is_resolved)
);

-- ============================================================================
-- Insert Life-Saving Rules (Reference Data)
-- ============================================================================

INSERT INTO life_saving_rules (rule_code, rule_name, description, keywords) VALUES
('ES01', 'Energy Isolation', 'Isolate all energy sources before work', 'energy, isolation, lockout, tagout, pressure, electrical'),
('HW01', 'Hot Work', 'Hot work permit and fire watch procedures', 'hot work, welding, cutting, torch, permit, fire watch'),
('CS01', 'Confined Space', 'Safe entry and rescue procedures for confined spaces', 'confined space, entry, rescue, ventilation, monitoring'),
('LOF01', 'Line of Fire', 'Stay out of line of fire during operations', 'line of fire, struck by, moving equipment, crane, lifting'),
('WH01', 'Working at Heights', 'Fall protection and rescue procedures', 'height, fall, ladder, scaffold, harness, rescue'),
('MVS01', 'Moving & Vibrating', 'Safe operation of mobile and vibrating equipment', 'moving equipment, vibration, machinery, guard'),
('HPE01', 'High Pressure', 'Safe handling of high-pressure systems', 'pressure, high pressure, relief valve, rupture'),
('CT01', 'Critical Lifts', 'Procedures for critical and heavy lifts', 'critical lift, heavy lift, crane, load calculation');

-- ============================================================================
-- Create Views for Dashboard
-- ============================================================================

-- View 1: Top Risk Sites
CREATE VIEW top_risk_sites AS
SELECT 
    site_name,
    total_reports,
    critical_reports,
    sif_percentage,
    risk_score,
    precursor_density,
    last_report_date
FROM site_risk_summary
ORDER BY risk_score DESC
LIMIT 10;

-- View 2: Top Risk Activities
CREATE VIEW top_risk_activities AS
SELECT 
    activity_type,
    total_reports,
    critical_reports,
    sif_percentage,
    risk_score,
    highest_risk_site
FROM activity_risk_summary
ORDER BY risk_score DESC
LIMIT 10;

-- View 3: Recent Critical Reports
CREATE VIEW recent_critical_reports AS
SELECT 
    id,
    report_id,
    title,
    site_name,
    activity_type,
    sif_classification,
    life_saving_rule,
    date_submitted
FROM reports
WHERE sif_classification = 'CRITICAL'
ORDER BY date_submitted DESC
LIMIT 20;

-- View 4: Precursor Trends
CREATE VIEW precursor_trends AS
SELECT 
    precursor_type,
    activity,
    site_name,
    frequency,
    sif_probability,
    severity_index
FROM precursor_patterns
ORDER BY sif_probability DESC, frequency DESC;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX idx_reports_classification ON reports(sif_classification);
CREATE INDEX idx_reports_rule ON reports(life_saving_rule);
CREATE INDEX idx_reports_date ON reports(date_submitted);
CREATE INDEX idx_precursor_type ON precursor_patterns(precursor_type);
CREATE INDEX idx_precursor_prob ON precursor_patterns(sif_probability);

-- ============================================================================
-- Database Created Successfully
-- ============================================================================
-- Run this in MySQL to setup the complete database schema
-- mysql -u root -p < database_schema.sql
