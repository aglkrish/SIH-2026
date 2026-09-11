# ============================================================================
# SIH26165: Flask Backend - Complete Backend Application
# ============================================================================

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, and_, or_
import torch
from transformers import T5Tokenizer, T5ForConditionalGeneration
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, VotingClassifier
import hashlib
import os
from datetime import datetime, timedelta
import json
from dotenv import load_dotenv
import uuid
from functools import wraps
import logging
from urllib.parse import quote_plus

load_dotenv()


app = Flask(__name__)
CORS(app)

# Configure database. DATABASE_URL takes precedence for deployed environments.
# Use SQLite for local development
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    # Use SQLite database file in the current directory
    db_path = os.path.join(os.path.dirname(__file__), 'sih26165_db.sqlite')
    DATABASE_URL = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JSON_SORT_KEYS'] = False

db = SQLAlchemy(app)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load device
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
logger.info(f"Using device: {device}")

# ============================================================================
# Load T5 Model
# ============================================================================

logger.info("Loading T5 model...")
try:
    tokenizer = T5Tokenizer.from_pretrained('sif_detection_model')
    model = T5ForConditionalGeneration.from_pretrained('sif_detection_model')
    model.to(device)
    model.eval()
    logger.info("✅ T5 model loaded successfully!")
except Exception as e:
    logger.error(f"❌ Error loading model: {e}")
    tokenizer = None
    model = None

# Train a high-accuracy ensemble classifier from labeled examples when T5 is unavailable.
local_vectorizer = None
local_classifier = None
try:
    training_data_path = os.getenv(
        'SIF_TRAINING_DATA_PATH',
        os.path.join(os.path.dirname(__file__), 'sif_training_data.json')
    )
    with open(training_data_path, encoding='utf-8') as training_file:
        training_records = json.load(training_file)

    training_texts = [
        record.get('text') or record.get('original_text', '')
        for record in training_records
    ]
    training_labels = [record.get('label', '').upper() for record in training_records]
    valid_records = [
        (text, label) for text, label in zip(training_texts, training_labels)
        if text and label
    ]

    if len({label for _, label in valid_records}) > 1:
        # Dual Feature Extractor: Word n-grams + Character n-grams for sub-word patterns
        local_vectorizer = FeatureUnion([
            ('word_tfidf', TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words='english', min_df=2)),
            ('char_tfidf', TfidfVectorizer(ngram_range=(3, 5), analyzer='char', sublinear_tf=True, min_df=3))
        ])
        
        train_texts = [text for text, _ in valid_records]
        train_labels = [label for _, label in valid_records]
        
        local_features = local_vectorizer.fit_transform(train_texts)

        # Multi-model Voting Ensemble (Random Forest + Extra Trees + Class-Balanced Logistic Regression)
        rf = RandomForestClassifier(n_estimators=300, class_weight='balanced', random_state=42, n_jobs=-1)
        et = ExtraTreesClassifier(n_estimators=300, class_weight='balanced', random_state=42, n_jobs=-1)
        lr = LogisticRegression(max_iter=1000, class_weight='balanced', C=2.5, random_state=42)

        local_classifier = VotingClassifier(
            estimators=[('rf', rf), ('et', et), ('lr', lr)],
            voting='soft'
        )
        local_classifier.fit(local_features, train_labels)
        logger.info(
            "✅ High-accuracy Voting Ensemble model trained from %d labeled safety records!",
            len(valid_records)
        )
except Exception as e:
    logger.error(f"Error loading local training data: {e}")

# ============================================================================
# Database Models & User Auth
# ============================================================================

def hash_password(password):
    """Hash password securely using SHA256"""
    return hashlib.sha256(str(password).encode('utf-8')).hexdigest()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), unique=True, nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='staff')  # 'staff' | 'admin'
    site_name = db.Column(db.String(100), default='Mumbai Offshore Platform')
    department = db.Column(db.String(100), default='Operations')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'full_name': self.full_name,
            'email': self.email,
            'role': self.role,
            'site_name': self.site_name,
            'department': self.department,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Report(db.Model):
    __tablename__ = 'reports'
    
    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.String(50), unique=True, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    original_text = db.Column(db.Text)
    site_name = db.Column(db.String(100))
    location = db.Column(db.String(100))
    activity_type = db.Column(db.String(100))
    date_submitted = db.Column(db.DateTime, default=datetime.utcnow)
    date_incident = db.Column(db.DateTime)
    
    # Classification
    sif_classification = db.Column(db.String(20))
    sif_score = db.Column(db.Float, default=0.0)
    sif_confidence = db.Column(db.Float, default=0.0)
    
    # Life-Saving Rules
    life_saving_rule = db.Column(db.String(50))
    secondary_rules = db.Column(db.String(255))
    
    # Precursors
    precursors = db.Column(db.String(255))
    keywords = db.Column(db.String(255))
    
    # Metadata
    status = db.Column(db.String(20), default='pending')
    reviewed_by = db.Column(db.String(100))
    date_reviewed = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    action_taken = db.Column(db.Text)
    assigned_to = db.Column(db.String(100))
    submitted_by = db.Column(db.String(100), default='Field Staff')
    
    def to_dict(self):
        return {
            'id': self.id,
            'report_id': self.report_id,
            'title': self.title,
            'description': self.description,
            'site_name': self.site_name,
            'location': self.location,
            'activity_type': self.activity_type,
            'date_submitted': self.date_submitted.isoformat() if self.date_submitted else None,
            'sif_classification': self.sif_classification,
            'sif_confidence': round(self.sif_confidence, 4) if self.sif_confidence else 0.0,
            'life_saving_rule': self.life_saving_rule,
            'secondary_rules': self.secondary_rules,
            'precursors': self.precursors,
            'status': self.status,
            'reviewed_by': self.reviewed_by,
            'date_reviewed': self.date_reviewed.isoformat() if self.date_reviewed else None,
            'notes': self.notes,
            'action_taken': self.action_taken,
            'assigned_to': self.assigned_to,
            'submitted_by': self.submitted_by
        }

class LifeSavingRule(db.Model):
    __tablename__ = 'life_saving_rules'
    
    id = db.Column(db.Integer, primary_key=True)
    rule_code = db.Column(db.String(50), unique=True, nullable=False)
    rule_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    keywords = db.Column(db.String(500))
    precursor_indicators = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'rule_code': self.rule_code,
            'rule_name': self.rule_name,
            'description': self.description,
            'keywords': self.keywords.split(',') if self.keywords else []
        }

class PrecursorPattern(db.Model):
    __tablename__ = 'precursor_patterns'
    
    id = db.Column(db.Integer, primary_key=True)
    pattern_id = db.Column(db.String(50), unique=True, nullable=False)
    precursor_type = db.Column(db.String(100), nullable=False)
    activity = db.Column(db.String(100))
    site_name = db.Column(db.String(100))
    location = db.Column(db.String(100))
    frequency = db.Column(db.Integer, default=1)
    sif_precursor_count = db.Column(db.Integer, default=0)
    non_sif_count = db.Column(db.Integer, default=0)
    sif_probability = db.Column(db.Float, default=0.0)
    severity_index = db.Column(db.Float, default=0.0)
    last_occurrence = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'pattern_id': self.pattern_id,
            'precursor_type': self.precursor_type,
            'activity': self.activity,
            'site_name': self.site_name,
            'frequency': self.frequency,
            'sif_probability': round(self.sif_probability, 4),
            'severity_index': round(self.severity_index, 4)
        }

class SiteRiskSummary(db.Model):
    __tablename__ = 'site_risk_summary'
    
    id = db.Column(db.Integer, primary_key=True)
    site_name = db.Column(db.String(100), unique=True, nullable=False)
    location = db.Column(db.String(100))
    total_reports = db.Column(db.Integer, default=0)
    critical_reports = db.Column(db.Integer, default=0)
    medium_reports = db.Column(db.Integer, default=0)
    low_reports = db.Column(db.Integer, default=0)
    sif_percentage = db.Column(db.Float, default=0.0)
    precursor_density = db.Column(db.Float, default=0.0)
    risk_score = db.Column(db.Float, default=0.0)
    reports_last_7_days = db.Column(db.Integer, default=0)
    reports_last_30_days = db.Column(db.Integer, default=0)
    primary_rule = db.Column(db.String(50))
    secondary_rules = db.Column(db.String(255))
    highest_risk_activity = db.Column(db.String(100))
    last_report_date = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'site_name': self.site_name,
            'location': self.location,
            'total_reports': self.total_reports,
            'critical_reports': self.critical_reports,
            'medium_reports': self.medium_reports,
            'low_reports': self.low_reports,
            'sif_percentage': round(self.sif_percentage, 2),
            'precursor_density': round(self.precursor_density, 2),
            'risk_score': round(self.risk_score, 2),
            'primary_rule': self.primary_rule,
            'highest_risk_activity': self.highest_risk_activity
        }

class ActivityRiskSummary(db.Model):
    __tablename__ = 'activity_risk_summary'
    
    id = db.Column(db.Integer, primary_key=True)
    activity_type = db.Column(db.String(100), unique=True, nullable=False)
    total_reports = db.Column(db.Integer, default=0)
    critical_reports = db.Column(db.Integer, default=0)
    medium_reports = db.Column(db.Integer, default=0)
    low_reports = db.Column(db.Integer, default=0)
    sif_percentage = db.Column(db.Float, default=0.0)
    precursor_density = db.Column(db.Float, default=0.0)
    risk_score = db.Column(db.Float, default=0.0)
    primary_rule = db.Column(db.String(50))
    secondary_rules = db.Column(db.String(255))
    highest_risk_site = db.Column(db.String(100))
    last_report_date = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'activity_type': self.activity_type,
            'total_reports': self.total_reports,
            'critical_reports': self.critical_reports,
            'sif_percentage': round(self.sif_percentage, 2),
            'risk_score': round(self.risk_score, 2),
            'primary_rule': self.primary_rule,
            'highest_risk_site': self.highest_risk_site
        }

# ============================================================================
# Classification and Tagging Functions
# ============================================================================

def classify_report(text):
    """Classify report using ML model (T5 / TF-IDF Logistic Regression) with domain guardrails"""
    if not text:
        return 'LOW', 0.0

    text_str = str(text)
    text_lower = text_str.lower()

    predicted_label = None
    confidence = 0.70

    # 1. Try T5 Model if available
    if model is not None and tokenizer is not None:
        try:
            inputs = tokenizer(text_str, return_tensors="pt", max_length=512, truncation=True).to(device)
            outputs = model.generate(**inputs, max_length=20)
            t5_output = tokenizer.decode(outputs[0], skip_special_tokens=True).strip().upper()
            if t5_output in ['CRITICAL', 'MEDIUM', 'LOW']:
                predicted_label = t5_output
                confidence = 0.88
        except Exception as e:
            logger.error(f"Error during T5 model classification: {e}")

    # 2. Use trained TF-IDF + Logistic Regression Classifier
    if predicted_label is None and local_classifier is not None and local_vectorizer is not None:
        try:
            features = local_vectorizer.transform([text_str])
            raw_pred = local_classifier.predict(features)[0].upper()
            probs = local_classifier.predict_proba(features)[0]
            
            # Map predicted label and confidence
            if raw_pred in local_classifier.classes_:
                cls_idx = list(local_classifier.classes_).index(raw_pred)
                confidence = float(probs[cls_idx])
            
            predicted_label = raw_pred
            logger.info(f"ML Classifier prediction: {predicted_label} (Confidence: {confidence:.4f})")
        except Exception as e:
            logger.error(f"Error during ML classifier prediction: {e}")

    # Fallback default if ML was unavailable
    if predicted_label not in ['CRITICAL', 'MEDIUM', 'LOW']:
        predicted_label = 'LOW'

    # 3. Domain Safeguards (Keyword overrides for extreme safety events)
    # Check for negative/no-hazard context
    negated_phrases = ['no hazard', 'no safety hazard', 'no issue', 'no defect', 'no damage', 'no leak', 'no risk', 'no injuries']
    is_negated = any(phrase in text_lower for phrase in negated_phrases)

    if not is_negated:
        critical_keywords = [
            'fatality', 'fatal', 'death', 'died', 'killed',
            'explosion', 'blowout', 'uncontrolled release',
            'toxic release', 'severe injury', 'evacuation',
            'could lead to fatality', 'life threatening'
        ]
        
        critical_count = sum(1 for kw in critical_keywords if kw in text_lower)

        # Domain override: ensure explicit critical life-safety hazards are flagged as CRITICAL
        if critical_count >= 1 and predicted_label != 'CRITICAL':
            logger.info("Safety guardrail: Overriding ML prediction to CRITICAL based on high-severity domain keywords.")
            predicted_label = 'CRITICAL'
            confidence = max(confidence, 0.90)

    return predicted_label, round(float(confidence), 4)
 

def tag_life_saving_rules(text):
    """Tag relevant Life-Saving Rules"""
    text_lower = text.lower()
    
    rules = {
        'ES01': ['energy', 'isolation', 'lockout', 'tagout', 'pressure release', 'electrical'],
        'HW01': ['hot work', 'welding', 'cutting', 'torch', 'permit', 'fire watch'],
        'CS01': ['confined space', 'entry', 'rescue', 'ventilation', 'monitoring', 'safe entry'],
        'LOF01': ['line of fire', 'struck by', 'moving equipment', 'crane', 'lifting', 'mobile'],
        'WH01': ['height', 'fall', 'ladder', 'scaffold', 'harness', 'working at height'],
        'MVS01': ['moving equipment', 'vibration', 'machinery', 'guard', 'mobile'],
        'HPE01': ['high pressure', 'pressure', 'relief valve', 'rupture', 'leak'],
        'CT01': ['critical lift', 'heavy lift', 'crane', 'load calculation', 'rigging']
    }
    
    matched_rules = []
    for rule_code, keywords in rules.items():
        if any(keyword in text_lower for keyword in keywords):
            matched_rules.append(rule_code)
    
    primary_rule = matched_rules[0] if matched_rules else None
    secondary_rules = ','.join(matched_rules[1:]) if len(matched_rules) > 1 else None
    
    return primary_rule, secondary_rules

def extract_precursors(text):
    """Extract safety precursors from text"""
    text_lower = text.lower()
    precursors = []
    
    precursor_map = {
        'Equipment_Degradation': ['equipment', 'valve', 'pressure', 'fail', 'worn', 'corrosion', 'damage'],
        'Lack_Supervision': ['alone', 'no supervision', 'untrained', 'no ppe', 'without', 'unsupervised'],
        'Gas_Release': ['gas', 'leak', 'leaking', 'release', 'uncontrolled', 'volatile', 'vapor'],
        'Environmental_Factor': ['fire', 'ignition', 'heat', 'temperature', 'weather', 'wind'],
        'Procedural_Violation': ['failure', 'ignored', 'did not', 'not followed', 'skipped', 'bypass']
    }
    
    for precursor_type, keywords in precursor_map.items():
        if any(kw in text_lower for kw in keywords):
            precursors.append(precursor_type)
    
    return precursors

def update_risk_summaries(report):
    """Update site and activity risk summaries"""
    # Update Site Risk Summary
    site_summary = SiteRiskSummary.query.filter_by(site_name=report.site_name).first()
    
    if not site_summary:
        site_summary = SiteRiskSummary(site_name=report.site_name, location=report.location)
        db.session.add(site_summary)
    
    site_summary.total_reports = site_summary.total_reports or 0
    site_summary.critical_reports = site_summary.critical_reports or 0
    site_summary.medium_reports = site_summary.medium_reports or 0
    site_summary.low_reports = site_summary.low_reports or 0
    site_summary.total_reports += 1
    
    if report.sif_classification == 'CRITICAL':
        site_summary.critical_reports += 1
    elif report.sif_classification == 'MEDIUM':
        site_summary.medium_reports += 1
    else:
        site_summary.low_reports += 1
    
    site_summary.sif_percentage = (site_summary.critical_reports / site_summary.total_reports * 100) if site_summary.total_reports > 0 else 0
    site_summary.risk_score = (site_summary.critical_reports * 30 + site_summary.medium_reports * 15 + site_summary.low_reports * 5) / site_summary.total_reports if site_summary.total_reports > 0 else 0
    site_summary.last_report_date = report.date_submitted
    site_summary.primary_rule = report.life_saving_rule
    
    # Update Activity Risk Summary
    activity_summary = ActivityRiskSummary.query.filter_by(activity_type=report.activity_type).first()
    
    if not activity_summary:
        activity_summary = ActivityRiskSummary(activity_type=report.activity_type)
        db.session.add(activity_summary)
    
    activity_summary.total_reports = activity_summary.total_reports or 0
    activity_summary.critical_reports = activity_summary.critical_reports or 0
    activity_summary.medium_reports = activity_summary.medium_reports or 0
    activity_summary.low_reports = activity_summary.low_reports or 0
    activity_summary.total_reports += 1
    
    if report.sif_classification == 'CRITICAL':
        activity_summary.critical_reports += 1
    elif report.sif_classification == 'MEDIUM':
        activity_summary.medium_reports += 1
    else:
        activity_summary.low_reports += 1
    
    activity_summary.sif_percentage = (activity_summary.critical_reports / activity_summary.total_reports * 100) if activity_summary.total_reports > 0 else 0
    activity_summary.risk_score = (activity_summary.critical_reports * 30 + activity_summary.medium_reports * 15 + activity_summary.low_reports * 5) / activity_summary.total_reports if activity_summary.total_reports > 0 else 0
    activity_summary.last_report_date = report.date_submitted
    activity_summary.primary_rule = report.life_saving_rule
    
    db.session.commit()

# ============================================================================
# User Authentication API Endpoints
# ============================================================================

@app.route('/api/auth/register', methods=['POST'])
def register_user():
    """Register a new Staff or Admin user account"""
    try:
        data = request.get_json() or {}
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        full_name = data.get('full_name', '').strip()
        role = data.get('role', 'staff').strip().lower()
        site_name = data.get('site_name', 'Mumbai Offshore Platform').strip()
        user_id = data.get('user_id', '').strip() or f"EMP-{uuid.uuid4().hex[:6].upper()}"

        if not email or not password or not full_name:
            return jsonify({'error': 'Email, password, and full name are required'}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'An account with this email address already exists.'}), 400

        user = User(
            user_id=user_id,
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            role=role if role in ['staff', 'admin'] else 'staff',
            site_name=site_name
        )

        db.session.add(user)
        db.session.commit()

        logger.info(f"✅ User registered: {user.email} (Role: {user.role})")

        return jsonify({
            'success': True,
            'message': 'Account registered successfully',
            'user': user.to_dict(),
            'token': f"session-{user.user_id}"
        }), 201
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login_user():
    """Authenticate user login credentials"""
    try:
        data = request.get_json() or {}
        login_input = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        expected_role = data.get('role', None)

        if not login_input or not password:
            return jsonify({'error': 'Email / Employee ID and password are required'}), 400

        user = User.query.filter(
            or_(func.lower(User.email) == login_input, func.lower(User.user_id) == login_input)
        ).first()

        if not user or user.password_hash != hash_password(password):
            return jsonify({'error': 'Invalid email/employee ID or password. Please try again.'}), 401

        # Check role match if role tab was selected
        if expected_role and user.role != expected_role:
            return jsonify({
                'error': f"This account is registered as '{user.role.upper()}'. Please switch to the '{user.role.upper()}' login tab."
            }), 403

        logger.info(f"✅ User logged in: {user.email} (Role: {user.role})")

        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': user.to_dict(),
            'token': f"session-{user.user_id}"
        }), 200
    except Exception as e:
        logger.error(f"Error logging in user: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# General API Routes
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'model_loaded': model is not None or local_classifier is not None,
        'model_type': 't5' if model is not None else 'tfidf_training_data',
        'device': str(device)
    }), 200

# ============================================================================
# Report Submission Endpoints
# ============================================================================

@app.route('/api/reports/submit', methods=['POST'])
def submit_report():
    """Submit a new safety report"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('title') or not data.get('description'):
            return jsonify({'error': 'Title and description are required'}), 400
        
        # Create new report
        report = Report(
            report_id=str(uuid.uuid4()),
            title=data.get('title'),
            description=data.get('description'),
            original_text=data.get('description'),
            site_name=data.get('site_name', 'Unknown'),
            location=data.get('location', 'Unknown'),
            activity_type=data.get('activity_type', 'Other'),
            date_incident=datetime.fromisoformat(data.get('date_incident')) if data.get('date_incident') else None,
            submitted_by=data.get('submitted_by', 'Field Staff')
        )
        
        # Combine title and description for comprehensive NLP context
        full_text = f"{report.title}. {report.description}"
        
        # Classify report
        report.sif_classification, report.sif_confidence = classify_report(full_text)
        
        # Tag Life-Saving Rules
        report.life_saving_rule, report.secondary_rules = tag_life_saving_rules(full_text)
        
        # Extract precursors
        precursors = extract_precursors(full_text)
        report.precursors = ','.join(precursors) if precursors else None
        
        # Set status
        report.status = 'classified'
        
        # Add to database
        db.session.add(report)
        db.session.commit()
        
        # Update summaries
        update_risk_summaries(report)
        
        logger.info(f"Report submitted: {report.report_id}")
        
        return jsonify({
            'success': True,
            'report_id': report.report_id,
            'classification': report.sif_classification,
            'confidence': round(report.sif_confidence, 4),
            'life_saving_rule': report.life_saving_rule,
            'precursors': report.precursors
        }), 201
    
    except Exception as e:
        logger.error(f"Error submitting report: {e}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/classify-preview', methods=['POST'])
def classify_preview():
    """Instant live AI preview for Staff submission form"""
    try:
        data = request.get_json() or {}
        title = data.get('title', '')
        description = data.get('description', '')
        text = f"{title}. {description}".strip()

        if not text or len(text) < 3:
            return jsonify({
                'classification': 'LOW',
                'confidence': 0.0,
                'life_saving_rule': None,
                'precursors': []
            }), 200

        label, conf = classify_report(text)
        primary_rule, secondary = tag_life_saving_rules(text)
        precursors = extract_precursors(text)

        return jsonify({
            'classification': label,
            'confidence': round(conf, 4),
            'life_saving_rule': primary_rule,
            'secondary_rules': secondary,
            'precursors': precursors
        }), 200
    except Exception as e:
        logger.error(f"Error generating classification preview: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/<report_id>/review', methods=['PUT'])
def review_report(report_id):
    """Admin endpoint to review, override classification, assign officer, and add resolution notes"""
    try:
        report = Report.query.filter_by(report_id=report_id).first()
        if not report:
            return jsonify({'error': 'Report not found'}), 404

        data = request.get_json() or {}
        
        if 'sif_classification' in data:
            report.sif_classification = data['sif_classification']
        if 'status' in data:
            report.status = data['status']
        if 'assigned_to' in data:
            report.assigned_to = data['assigned_to']
        if 'action_taken' in data:
            report.action_taken = data['action_taken']
        if 'notes' in data:
            report.notes = data['notes']
        
        report.reviewed_by = data.get('reviewed_by', 'HSSE Admin')
        report.date_reviewed = datetime.utcnow()

        db.session.commit()
        
        # Recalculate site and activity summaries
        update_risk_summaries(report)
        
        return jsonify({
            'success': True,
            'message': 'Report updated successfully',
            'report': report.to_dict()
        }), 200
    except Exception as e:
        logger.error(f"Error reviewing report: {e}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports', methods=['GET'])
def get_reports():
    """Get reports with optional filtering by submitted_by (Staff), classification, or status"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        submitted_by = request.args.get('submitted_by', None)
        classification = request.args.get('classification', None)
        status = request.args.get('status', None)

        query = Report.query

        if submitted_by and str(submitted_by).strip():
            target_user = str(submitted_by).strip()
            query = query.filter(
                or_(
                    Report.submitted_by == target_user,
                    func.lower(Report.submitted_by) == target_user.lower()
                )
            )

        if classification and str(classification).strip():
            query = query.filter_by(sif_classification=classification.strip())

        if status and str(status).strip():
            query = query.filter_by(status=status.strip())

        reports = query.order_by(Report.date_submitted.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return jsonify({
            'total': reports.total,
            'pages': reports.pages,
            'current_page': page,
            'reports': [r.to_dict() for r in reports.items]
        }), 200

    except Exception as e:
        logger.error(f"Error fetching reports: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/<report_id>', methods=['GET'])
def get_report(report_id):
    """Get a specific report"""
    try:
        report = Report.query.filter_by(report_id=report_id).first()
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        return jsonify(report.to_dict()), 200
    
    except Exception as e:
        logger.error(f"Error fetching report: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# Dashboard Endpoints
# ============================================================================

@app.route('/api/dashboard/overview', methods=['GET'])
def dashboard_overview():
    """Get dashboard overview data"""
    try:
        total_reports = Report.query.count()
        critical_reports = Report.query.filter_by(sif_classification='CRITICAL').count()
        medium_reports = Report.query.filter_by(sif_classification='MEDIUM').count()
        low_reports = Report.query.filter_by(sif_classification='LOW').count()
        
        # Calculate percentages
        critical_pct = (critical_reports / total_reports * 100) if total_reports > 0 else 0
        medium_pct = (medium_reports / total_reports * 100) if total_reports > 0 else 0
        low_pct = (low_reports / total_reports * 100) if total_reports > 0 else 0
        
        # Recent 7 days
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        reports_7d = Report.query.filter(Report.date_submitted >= seven_days_ago).count()
        critical_7d = Report.query.filter(
            and_(Report.date_submitted >= seven_days_ago, Report.sif_classification == 'CRITICAL')
        ).count()
        
        return jsonify({
            'total_reports': total_reports,
            'critical_reports': critical_reports,
            'medium_reports': medium_reports,
            'low_reports': low_reports,
            'critical_percentage': round(critical_pct, 2),
            'medium_percentage': round(medium_pct, 2),
            'low_percentage': round(low_pct, 2),
            'reports_last_7_days': reports_7d,
            'critical_last_7_days': critical_7d
        }), 200
    
    except Exception as e:
        logger.error(f"Error fetching overview: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/top-sites', methods=['GET'])
def top_sites():
    """Get top risk sites"""
    try:
        sites = SiteRiskSummary.query.order_by(SiteRiskSummary.risk_score.desc()).limit(10).all()
        
        return jsonify({
            'sites': [s.to_dict() for s in sites]
        }), 200
    
    except Exception as e:
        logger.error(f"Error fetching top sites: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/top-activities', methods=['GET'])
def top_activities():
    """Get top risk activities"""
    try:
        activities = ActivityRiskSummary.query.order_by(ActivityRiskSummary.risk_score.desc()).limit(10).all()
        
        return jsonify({
            'activities': [a.to_dict() for a in activities]
        }), 200
    
    except Exception as e:
        logger.error(f"Error fetching top activities: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/precursors', methods=['GET'])
def precursor_patterns():
    """Get precursor patterns"""
    try:
        precursors = PrecursorPattern.query.order_by(
            PrecursorPattern.sif_probability.desc()
        ).limit(20).all()
        
        return jsonify({
            'precursors': [p.to_dict() for p in precursors]
        }), 200
    
    except Exception as e:
        logger.error(f"Error fetching precursors: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/life-saving-rules', methods=['GET'])
def life_saving_rules():
    """Get all Life-Saving Rules"""
    try:
        rules = LifeSavingRule.query.all()
        
        return jsonify({
            'rules': [r.to_dict() for r in rules]
        }), 200
    
    except Exception as e:
        logger.error(f"Error fetching rules: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/life-saving-rules', methods=['POST'])
def add_life_saving_rule():
    """Add a new Life-Saving Rule (Admin)"""
    try:
        data = request.get_json() or {}
        rule_code = data.get('rule_code', '').strip().upper()
        rule_name = data.get('rule_name', '').strip()
        description = data.get('description', '').strip()
        keywords = data.get('keywords', '').strip()

        if not rule_code or not rule_name or not description:
            return jsonify({'error': 'Rule code, rule name, and description are required'}), 400

        if LifeSavingRule.query.filter_by(rule_code=rule_code).first():
            return jsonify({'error': f"A rule with code '{rule_code}' already exists"}), 400

        rule = LifeSavingRule(
            rule_code=rule_code,
            rule_name=rule_name,
            description=description,
            keywords=keywords
        )
        db.session.add(rule)
        db.session.commit()

        logger.info(f"✅ New Life-Saving Rule added: {rule.rule_code} - {rule.rule_name}")

        return jsonify({
            'success': True,
            'message': 'Rule added successfully',
            'rule': rule.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding Life-Saving Rule: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/dashboard/recent-critical', methods=['GET'])
def recent_critical():
    """Get recent critical reports"""
    try:
        reports = Report.query.filter_by(
            sif_classification='CRITICAL'
        ).order_by(Report.date_submitted.desc()).limit(10).all()
        
        return jsonify({
            'reports': [r.to_dict() for r in reports]
        }), 200
    
    except Exception as e:
        logger.error(f"Error fetching critical reports: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# Statistics Endpoints
# ============================================================================

@app.route('/api/stats/classification-distribution', methods=['GET'])
def classification_stats():
    """Get classification distribution"""
    try:
        stats = db.session.query(
            Report.sif_classification,
            func.count(Report.id).label('count')
        ).group_by(Report.sif_classification).all()
        
        return jsonify({
            'distribution': {s[0]: s[1] for s in stats}
        }), 200
    
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats/site-comparison', methods=['GET'])
def site_comparison():
    """Compare risk across sites"""
    try:
        sites = SiteRiskSummary.query.order_by(SiteRiskSummary.risk_score.desc()).all()
        
        data = {
            'sites': [s.site_name for s in sites],
            'risk_scores': [round(s.risk_score, 2) for s in sites],
            'sif_percentages': [round(s.sif_percentage, 2) for s in sites],
            'total_reports': [s.total_reports for s in sites]
        }
        
        return jsonify(data), 200
    
    except Exception as e:
        logger.error(f"Error fetching comparison: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# ============================================================================
# Run Application
# ============================================================================

def seed_life_saving_rules():
    """Ensure default Life-Saving Rules exist in database"""
    default_rules = [
        {
            'rule_code': 'ES01',
            'rule_name': 'Energy Isolation (LOTO)',
            'description': 'Verify isolation and zero energy state before starting work. Apply Lockout/Tagout (LOTO) tags to all electrical, pneumatic, and hydraulic systems.',
            'keywords': 'energy,isolation,lockout,tagout,pressure release,electrical,de-energize'
        },
        {
            'rule_code': 'HW01',
            'rule_name': 'Hot Work & Spark Protection',
            'description': 'Obtain authorized hot work permit, verify continuous gas monitoring, clear combustible materials within 15 meters, and assign a dedicated fire watch.',
            'keywords': 'hot work,welding,cutting,torch,permit,fire watch,sparks'
        },
        {
            'rule_code': 'CS01',
            'rule_name': 'Confined Space Entry',
            'description': 'Test atmosphere for toxic gases and oxygen levels before entry, secure entry permit, ensure continuous forced ventilation, and position a trained standby attendant.',
            'keywords': 'confined space,entry,rescue,ventilation,monitoring,safe entry,attendant'
        },
        {
            'rule_code': 'LOF01',
            'rule_name': 'Line of Fire Protection',
            'description': 'Position yourself and team clear of suspended loads, rotating equipment zones, high pressure lines, and heavy machinery maneuvering areas.',
            'keywords': 'line of fire,struck by,moving equipment,crane,lifting,mobile'
        },
        {
            'rule_code': 'WH01',
            'rule_name': 'Working at Heights (>2m)',
            'description': 'Inspect harness, lanyards, and anchor points before ascending. Ensure 100% tie-off when working above 2 meters or on scaffolding.',
            'keywords': 'height,fall,ladder,scaffold,harness,working at height,anchor'
        },
        {
            'rule_code': 'MVS01',
            'rule_name': 'Mobile Equipment & Driving',
            'description': 'Wear seatbelts, adhere to site speed limits, perform pre-trip vehicle inspections, and strictly prohibit mobile phone usage while driving.',
            'keywords': 'moving equipment,vibration,machinery,mobile,driving,seatbelt,speed'
        },
        {
            'rule_code': 'HPE01',
            'rule_name': 'High Pressure System Safety',
            'description': 'Inspect pressure relief valves, depressurize systems before line breaking, and establish clear safety barriers during pressure testing.',
            'keywords': 'high pressure,pressure,relief valve,rupture,leak,depressurize'
        },
        {
            'rule_code': 'CT01',
            'rule_name': 'Critical Lifts & Crane Safety',
            'description': 'Perform lift plan calculations, inspect rigging gear, ensure outriggers are fully deployed on firm ground, and use tag lines for load control.',
            'keywords': 'critical lift,heavy lift,crane,load calculation,rigging,tag line'
        },
        {
            'rule_code': 'BSC01',
            'rule_name': 'Bypassing Safety Controls',
            'description': 'Obtain formal authorization before overriding safety interlocks, disabling gas detectors, or bypassing safety-critical equipment.',
            'keywords': 'bypass,override,interlock,gas detector,disable,safety critical'
        },
        {
            'rule_code': 'PTW01',
            'rule_name': 'Permit to Work (PTW) Compliance',
            'description': 'Work with a valid permit to work, verify all control measures on site before starting, and stop work immediately if conditions change.',
            'keywords': 'permit,ptw,permit to work,controls,authorization,stop work'
        },
        {
            'rule_code': 'FFD01',
            'rule_name': 'Fit for Duty & Fatigue Management',
            'description': 'Report for duty well-rested, unimpaired by fatigue, alcohol or drugs, and immediately notify supervisor of any medical limitations.',
            'keywords': 'fit for duty,fatigue,unimpaired,medical,rest,alert'
        },
        {
            'rule_code': 'H2S01',
            'rule_name': 'Toxic Gas & H2S Protection',
            'description': 'Always carry a calibrated personal H2S monitor in process units, know emergency escape routes upwind, and wear SCBA when required.',
            'keywords': 'h2s,toxic gas,detector,scba,upwind,escape route,gas release'
        }
    ]

    try:
        for r in default_rules:
            existing = LifeSavingRule.query.filter_by(rule_code=r['rule_code']).first()
            if not existing:
                rule = LifeSavingRule(
                    rule_code=r['rule_code'],
                    rule_name=r['rule_name'],
                    description=r['description'],
                    keywords=r['keywords']
                )
                db.session.add(rule)
        db.session.commit()
        logger.info("✅ Life-Saving Rules verified/seeded into database.")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error seeding Life-Saving Rules: {e}")

def seed_demo_users():
    """Ensure default Staff and Admin demo accounts exist"""
    try:
        if not User.query.filter_by(email='staff@oil.com').first():
            staff = User(
                user_id='EMP-101',
                full_name='Abhishek',
                email='staff@oil.com',
                password_hash=hash_password('staff123'),
                role='staff',
                site_name='Mumbai Offshore Platform',
                department='Field Maintenance'
            )
            db.session.add(staff)

        if not User.query.filter_by(email='admin@oil.com').first():
            admin = User(
                user_id='ADM-001',
                full_name='Rajesh Sharma',
                email='admin@oil.com',
                password_hash=hash_password('admin123'),
                role='admin',
                site_name='Corporate HSSE HQ',
                department='HSSE Risk Management'
            )
            db.session.add(admin)
            
        db.session.commit()
        logger.info("✅ Demo user accounts verified: staff@oil.com / admin@oil.com")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error seeding demo users: {e}")

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # Auto-migrate SQLite schema if new columns are missing
        try:
            with db.engine.connect() as conn:
                from sqlalchemy import text
                try:
                    conn.execute(text("ALTER TABLE reports ADD COLUMN action_taken TEXT;"))
                except Exception:
                    pass
                try:
                    conn.execute(text("ALTER TABLE reports ADD COLUMN assigned_to VARCHAR(100);"))
                except Exception:
                    pass
                try:
                    conn.execute(text("ALTER TABLE reports ADD COLUMN submitted_by VARCHAR(100) DEFAULT 'Field Staff';"))
                except Exception:
                    pass
                conn.commit()
        except Exception as ex:
            logger.warning(f"Schema migration note: {ex}")

        seed_demo_users()
        seed_life_saving_rules()
        logger.info("Database tables created/verified")
    
    app.run(
        debug=True,
        host='0.0.0.0',
        port=int(os.getenv('PORT', '8000'))
    )
