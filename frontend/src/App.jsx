// ============================================================================
// SIH26165: React Vite Frontend - User Authentication & Role-Based Portals
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// ============================================================================
// Main App Component with Auth Session Guard
// ============================================================================

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('sih_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState('new-report');
  const [selectedReportForReview, setSelectedReportForReview] = useState(null);

  // Sync default tab when user logs in
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sih_user', JSON.stringify(currentUser));
      if (currentUser.role === 'admin') {
        setActiveTab('dashboard');
      } else {
        setActiveTab('new-report');
      }
    } else {
      localStorage.removeItem('sih_user');
    }
  }, [currentUser]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sih_user');
  };

  // 1. Unauthenticated Gateway: Show Login / Register Screen
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={setCurrentUser} />;
  }

  // 2. Authenticated Portals: Field Staff vs HSSE Admin
  return (
    <div className="app">
      <Header currentUser={currentUser} onLogout={handleLogout} />
      
      <Navigation role={currentUser.role} activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="main-content">
        {/* STAFF PORTAL VIEWS */}
        {currentUser.role === 'staff' && (
          <>
            {activeTab === 'new-report' && <StaffSubmitReport currentUser={currentUser} />}
            {activeTab === 'my-reports' && <StaffReportsView currentUser={currentUser} />}
            {activeTab === 'lsr-rules' && <LifeSavingRulesView />}
          </>
        )}

        {/* ADMIN PORTAL VIEWS */}
        {currentUser.role === 'admin' && (
          <>
            {activeTab === 'dashboard' && <AdminDashboard />}
            {activeTab === 'triage-queue' && <AdminTriageQueue onReviewReport={setSelectedReportForReview} />}
            {activeTab === 'precursor-map' && <AnalysisView />}
            {activeTab === 'lsr-rules' && <LifeSavingRulesView />}
          </>
        )}
      </main>

      {/* ADMIN REVIEW MODAL */}
      {selectedReportForReview && (
        <AdminReviewModal
          report={selectedReportForReview}
          currentUser={currentUser}
          onClose={() => setSelectedReportForReview(null)}
          onReportUpdated={() => {
            setSelectedReportForReview(null);
            window.dispatchEvent(new Event('reports-updated'));
          }}
        />
      )}
      
      <Footer currentUser={currentUser} />
    </div>
  );
}

// ============================================================================
// Auth Screen Component (Login / Register Tabs & Password Toggle)
// ============================================================================

function AuthScreen({ onLoginSuccess }) {
  const [selectedRole, setSelectedRole] = useState('staff'); // 'staff' | 'admin'
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [siteName, setSiteName] = useState('Mumbai Offshore Platform');
  const [employeeId, setEmployeeId] = useState('');

  // Quick Demo Login Fill
  const fillDemoStaff = () => {
    setSelectedRole('staff');
    setMode('login');
    setEmail('staff@oil.com');
    setPassword('staff123');
    setError(null);
  };

  const fillDemoAdmin = () => {
    setSelectedRole('admin');
    setMode('login');
    setEmail('admin@oil.com');
    setPassword('admin123');
    setError(null);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: email,
        password: password,
        role: selectedRole
      });

      if (response.data.success) {
        onLoginSuccess(response.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        full_name: fullName,
        email: email,
        password: password,
        role: selectedRole,
        site_name: siteName,
        user_id: employeeId
      });

      if (response.data.success) {
        onLoginSuccess(response.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand Lockup */}
        <div className="auth-brand">
          <span className="brand-mark">OIL<span>/</span>HSSE</span>
          <span className="brand-kicker">SIH 2026 • Safety Portal</span>
        </div>

        <h2>Welcome Back</h2>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Sign in to access your safety dashboard. Select Field Staff or Admin.'
            : 'Create a new user account for field observation reporting or HSSE oversight.'}
        </p>

        {/* Role Tab Switcher */}
        <div className="auth-role-tabs">
          <button
            type="button"
            className={`auth-role-tab ${selectedRole === 'staff' ? 'active staff' : ''}`}
            onClick={() => { setSelectedRole('staff'); setError(null); }}
          >
            👷 Field Staff Login
          </button>
          <button
            type="button"
            className={`auth-role-tab ${selectedRole === 'admin' ? 'active admin' : ''}`}
            onClick={() => { setSelectedRole('admin'); setError(null); }}
          >
            🛡️ HSSE Admin Login
          </button>
        </div>

        {/* Demo Quick Fill Shortcuts */}
        <div className="demo-shortcuts">
          <span className="shortcut-label">⚡ Demo Accounts:</span>
          <button type="button" className="shortcut-btn" onClick={fillDemoStaff}>
            👷 Staff Demo (`staff@oil.com`)
          </button>
          <button type="button" className="shortcut-btn" onClick={fillDemoAdmin}>
            🛡️ Admin Demo (`admin@oil.com`)
          </button>
        </div>

        {error && <div className="alert alert-error">❌ {error}</div>}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="form-group">
              <label>Email Address or Employee ID</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={selectedRole === 'staff' ? 'staff@oil.com or EMP-101' : 'admin@oil.com or ADM-001'}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Authenticating...' : `Sign In as ${selectedRole === 'staff' ? 'Field Staff' : 'HSSE Admin'}`}
            </button>

            <div className="auth-footer-toggle">
              Don't have an account?{' '}
              <button type="button" className="link-btn" onClick={() => { setMode('register'); setError(null); }}>
                Sign up here
              </button>
            </div>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Rajesh Sharma"
                required
              />
            </div>

            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g., rajesh@oil.com"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Employee / User ID (Optional)</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g., EMP-204"
                />
              </div>

              <div className="form-group">
                <label>Account Role *</label>
                <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                  <option value="staff">Field Staff</option>
                  <option value="admin">HSSE Admin / Manager</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Operating Site Name</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="e.g., Mumbai Offshore Platform, Assam Refinery"
              />
            </div>

            <div className="form-group">
              <label>Create Password *</label>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters..."
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account & Sign In'}
            </button>

            <div className="auth-footer-toggle">
              Already have an account?{' '}
              <button type="button" className="link-btn" onClick={() => { setMode('login'); setError(null); }}>
                Sign in here
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Header Component (Authenticated User Profile & Logout)
// ============================================================================

function Header({ currentUser, onLogout }) {
  return (
    <header className="app-header">
      <div className="header-top">
        <div className="brand-lockup">
          <span className="brand-mark">OIL<span>/</span>HSSE</span>
          <span className="brand-kicker">SIH 2026 • AI Safety Portal</span>
        </div>
        
        {/* Logged In User Profile Badge & Logout */}
        <div className="user-profile-badge">
          <div className="user-avatar">
            {currentUser.role === 'admin' ? '🛡️' : '👷'}
          </div>
          <div className="user-details">
            <strong className="user-name">{currentUser.full_name}</strong>
            <small className="user-role-lbl">
              {currentUser.role.toUpperCase()} • {currentUser.site_name || 'Oil Operations'}
            </small>
          </div>
          <button type="button" className="logout-btn" onClick={onLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      <div className="header-banner">
        <div>
          <h1>
            {currentUser.role === 'staff' 
              ? `Welcome, ${currentUser.full_name}. Report field observations instantly.` 
              : `HSSE Command Center — Oversight & AI Triage.`}
          </h1>
          <p>
            {currentUser.role === 'staff'
              ? 'Real-time Voting Ensemble AI model assists staff in flagging fatality precursors.'
              : 'Executive safety oversight, AI risk verification, officer assignment & resolution tracking.'}
          </p>
        </div>
        <div className="header-stats">
          <HealthCheck />
          <span className="last-sync">Logged in as {currentUser.email}</span>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// Health Check Component
// ============================================================================

function HealthCheck() {
  const [health, setHealth] = useState(null);
  
  useEffect(() => {
    axios.get(`${API_BASE_URL}/health`).then(res => {
      setHealth(res.data);
    }).catch(err => console.error(err));
  }, []);
  
  if (!health) return <div className="health-status unknown">🔄 Connecting AI Engine...</div>;
  
  return (
    <div className={`health-status ${health.status}`}>
      ✅ AI ENGINE ACTIVE | Voting Ensemble (87.5% Acc)
    </div>
  );
}

// ============================================================================
// Navigation Component
// ============================================================================

function Navigation({ role, activeTab, setActiveTab }) {
  const staffTabs = [
    { id: 'new-report', label: 'Submit Safety Report', icon: '📝' },
    { id: 'my-reports', label: 'My Submissions & Status', icon: '📋' },
    { id: 'lsr-rules', label: 'Life-Saving Rules Guide', icon: '⚙️' }
  ];

  const adminTabs = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: '📊' },
    { id: 'triage-queue', label: 'Incident Triage & Review Queue', icon: '🚨' },
    { id: 'precursor-map', label: 'Precursor Pattern Analytics', icon: '🔍' },
    { id: 'lsr-rules', label: 'Life-Saving Rules Master', icon: '⚙️' }
  ];

  const currentTabs = role === 'staff' ? staffTabs : adminTabs;

  return (
    <nav className="navigation">
      <div className="nav-container">
        {currentTabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ============================================================================
// STAFF PORTAL: Submit Safety Report (With Live AI Preview)
// ============================================================================

function StaffSubmitReport({ currentUser }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    site_name: currentUser?.site_name || 'Mumbai Offshore Platform',
    location: 'Central Processing Unit',
    activity_type: 'Hot Work',
    date_incident: new Date().toISOString().slice(0, 16)
  });
  
  const [aiPreview, setAiPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Debounced Live AI Preview
  useEffect(() => {
    if (!formData.title && !formData.description) {
      setAiPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const response = await axios.post(`${API_BASE_URL}/reports/classify-preview`, {
          title: formData.title,
          description: formData.description
        });
        setAiPreview(response.data);
      } catch (err) {
        console.error("Preview error:", err);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.title, formData.description]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const applyTemplate = (title, description, activity) => {
    setFormData(prev => ({
      ...prev,
      title,
      description,
      activity_type: activity
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/reports/submit`, {
        ...formData,
        submitted_by: currentUser?.full_name || 'Field Staff'
      });
      setResult(response.data);
      setFormData({
        title: '',
        description: '',
        site_name: currentUser?.site_name || 'Mumbai Offshore Platform',
        location: 'Central Processing Unit',
        activity_type: 'Hot Work',
        date_incident: new Date().toISOString().slice(0, 16)
      });
      setAiPreview(null);
      window.dispatchEvent(new Event('reports-updated'));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-submit-container">
      <div className="form-main">
        <div className="section-header">
          <h2>👷 Submit Field Observation / Near-Miss</h2>
          <p>Report safety conditions or near-miss incidents. Reporter: <strong>{currentUser?.full_name}</strong></p>
        </div>

        {/* Quick Observation Template Chips */}
        <div className="template-chips">
          <span className="chips-label">⚡ Quick Templates:</span>
          <button type="button" className="chip" onClick={() => applyTemplate("Uncontrolled Gas Leak Observed", "Minor gas leak detected near flange valve #4 during pressure test without gas detector.", "Pressure Testing")}>
            ⛽ Gas Leak
          </button>
          <button type="button" className="chip" onClick={() => applyTemplate("Unsafe Scaffolding Assembly", "Scaffold missing toe-boards and top guardrail at 15m elevation.", "Other")}>
            🏗️ Scaffold Hazard
          </button>
          <button type="button" className="chip" onClick={() => applyTemplate("No Isolation / Lockout Tagout", "Maintenance started on live electrical motor without de-energizing or applying LOTO tag.", "Energy Isolation")}>
            ⚡ No LOTO Tag
          </button>
          <button type="button" className="chip" onClick={() => applyTemplate("Corrosion on High Pressure Line", "Severe wall loss and external corrosion noticed on main diesel transfer pipeline.", "Maintenance")}>
            🔧 Pipe Corrosion
          </button>
        </div>

        <form onSubmit={handleSubmit} className="report-form">
          <div className="form-group">
            <label>Report Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Uncontrolled gas leak detected near CPU manifold"
              required
            />
          </div>

          <div className="form-group">
            <label>Detailed Incident Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe what happened, equipment involved, safety equipment used/missing..."
              rows="5"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Site Name</label>
              <input
                type="text"
                name="site_name"
                value={formData.site_name}
                onChange={handleChange}
                placeholder="e.g., Mumbai Platform, Assam Refinery"
              />
            </div>

            <div className="form-group">
              <label>Location / Section</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., CPU Block 4, Compressor Deck"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Activity Type</label>
              <select
                name="activity_type"
                value={formData.activity_type}
                onChange={handleChange}
              >
                <option value="Hot Work">Hot Work</option>
                <option value="Confined Space Entry">Confined Space Entry</option>
                <option value="Energy Isolation">Energy Isolation</option>
                <option value="Lifting & Rigging">Lifting & Rigging</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Inspection">Inspection</option>
                <option value="Pressure Testing">Pressure Testing</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Date & Time of Incident</label>
              <input
                type="datetime-local"
                name="date_incident"
                value={formData.date_incident}
                onChange={handleChange}
              />
            </div>
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? '⏳ Submitting to Triage Engine...' : '✅ Submit Safety Report'}
          </button>
        </form>

        {error && <div className="alert alert-error">❌ Error: {error}</div>}
        {result && (
          <div className="alert alert-success">
            <h3>✅ Report Submitted & Triaged Successfully!</h3>
            <p><strong>Report ID:</strong> {result.report_id}</p>
            <p><strong>AI Triage Level:</strong> <span className={`label ${result.classification.toLowerCase()}`}>{result.classification}</span> ({(result.confidence * 100).toFixed(1)}% confidence)</p>
          </div>
        )}
      </div>

      {/* Live AI Triage Sidebar */}
      <div className="form-sidebar">
        <div className="ai-preview-card">
          <div className="ai-card-header">
            <span className="sparkle-icon">✨</span>
            <h3>Real-Time AI Triage Preview</h3>
            {previewLoading && <span className="spinner">🔄</span>}
          </div>
          <p className="ai-card-sub">As you type, the Voting Ensemble AI model dynamically analyzes potential fatality risks.</p>

          {aiPreview ? (
            <div className="ai-preview-body">
              <div className="preview-stat">
                <span className="stat-lbl">Predicted Risk Level:</span>
                <span className={`label ${aiPreview.classification.toLowerCase()} large`}>
                  {aiPreview.classification}
                </span>
              </div>

              <div className="preview-stat">
                <span className="stat-lbl">AI Confidence Score:</span>
                <div className="conf-bar-wrap">
                  <div className="conf-bar-fill" style={{ width: `${aiPreview.confidence * 100}%` }} />
                </div>
                <strong>{(aiPreview.confidence * 100).toFixed(1)}%</strong>
              </div>

              <div className="preview-stat">
                <span className="stat-lbl">Tagged Life-Saving Rule:</span>
                <span className="rule-badge">{aiPreview.life_saving_rule || 'None Tagged'}</span>
              </div>

              <div className="preview-stat">
                <span className="stat-lbl">Precursors Detected:</span>
                <div className="tag-cloud">
                  {aiPreview.precursors && aiPreview.precursors.length > 0 ? (
                    aiPreview.precursors.map((p, idx) => (
                      <span key={idx} className="tag precursor">{p}</span>
                    ))
                  ) : (
                    <small className="muted">No precursor triggers found</small>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="ai-preview-placeholder">
              <p>Type a report title or description to see instant AI triage analysis.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STAFF PORTAL: My Submissions & Status History
// ============================================================================

function StaffReportsView({ currentUser }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const userName = currentUser?.full_name || currentUser?.email || 'Field Staff';
      const response = await axios.get(`${API_BASE_URL}/reports`, {
        params: {
          per_page: 50,
          submitted_by: userName
        }
      });
      setReports(response.data.reports);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    window.addEventListener('reports-updated', fetchReports);
    return () => window.removeEventListener('reports-updated', fetchReports);
  }, [currentUser]);

  if (loading) return <div className="loading">⏳ Loading submission history...</div>;

  return (
    <div className="staff-history-view">
      <div className="section-header">
        <h2>📋 My Submitted Field Reports</h2>
        <p>Showing reports filed by: <strong>{currentUser?.full_name}</strong></p>
      </div>

      {reports.length === 0 ? (
        <div className="empty-state-card">
          <span className="empty-icon">📂</span>
          <h3>No Safety Submissions Found</h3>
          <p>You haven't submitted any safety observations yet under this account. Switch to the "Submit Safety Report" tab to file a report.</p>
        </div>
      ) : (
        <div className="reports-grid">
          {reports.map(report => (
            <div key={report.id} className={`report-card risk-${report.sif_classification.toLowerCase()}`}>
              <div className="card-header">
                <h3>{report.title}</h3>
                <span className={`status-pill ${report.status}`}>{report.status.toUpperCase()}</span>
              </div>
              <p className="card-desc">{report.description}</p>
              <div className="card-meta-row">
                <span>📍 {report.site_name}</span>
                <span>🔧 {report.activity_type}</span>
                <span>⏱️ {new Date(report.date_submitted).toLocaleDateString()}</span>
              </div>

              <div className="card-triage-info">
                <span className={`label ${report.sif_classification.toLowerCase()}`}>{report.sif_classification}</span>
                <small>AI Confidence: {(report.sif_confidence * 100).toFixed(1)}%</small>
              </div>

              {report.assigned_to && (
                <div className="action-box">
                  <strong>👨‍🔧 Assigned Officer:</strong> {report.assigned_to}
                </div>
              )}

              {report.action_taken && (
                <div className="action-box success">
                  <strong>✅ Action Taken:</strong> {report.action_taken}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADMIN PORTAL: Executive Dashboard
// ============================================================================

function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [topSites, setTopSites] = useState([]);
  const [topActivities, setTopActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [overviewRes, sitesRes, activitiesRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/dashboard/overview`),
          axios.get(`${API_BASE_URL}/dashboard/top-sites`),
          axios.get(`${API_BASE_URL}/dashboard/top-activities`)
        ]);
        setOverview(overviewRes.data);
        setTopSites(sitesRes.data.sites);
        setTopActivities(activitiesRes.data.activities);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading">⏳ Loading Executive Overview...</div>;
  if (!overview) return <div className="error">No overview data available</div>;

  const chartData = [
    { name: 'CRITICAL (SIF)', value: overview.critical_reports, fill: '#ff4444' },
    { name: 'MEDIUM RISK', value: overview.medium_reports, fill: '#ffaa00' },
    { name: 'LOW RISK', value: overview.low_reports, fill: '#00aa00' }
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-alert-banner">
        <div className="alert-badge">🚨 SIF ALERT</div>
        <div>
          <strong>{overview.critical_reports} Critical Fatal-Potential Incidents</strong> recorded. Focus immediate field audits on highest risk sites.
        </div>
      </div>

      {/* Summary KPI Cards */}
      <section className="summary-cards">
        <SummaryCard title="Total Observations" value={overview.total_reports} icon="📋" color="#3498db" />
        <SummaryCard title="Critical (SIF)" value={overview.critical_reports} percentage={overview.critical_percentage} icon="🚨" color="#e74c3c" />
        <SummaryCard title="Medium Risk" value={overview.medium_reports} percentage={overview.medium_percentage} icon="⚠️" color="#f39c12" />
        <SummaryCard title="Low Risk" value={overview.low_reports} percentage={overview.low_percentage} icon="✅" color="#2ecc71" />
        <SummaryCard title="Last 7 Days" value={overview.reports_last_7_days} subtitle={`${overview.critical_last_7_days} critical`} icon="📈" color="#9b59b6" />
      </section>

      {/* Charts & Risk Tables */}
      <div className="dashboard-grid">
        <div className="chart-box">
          <h3>📊 Fatality Potential Distribution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={(entry) => `${entry.name}: ${entry.value}`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="table-box">
          <h3>🏭 High Risk Operating Sites</h3>
          <table className="risk-table">
            <thead>
              <tr>
                <th>Site Name</th>
                <th>Reports</th>
                <th>Critical</th>
                <th>Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {topSites.slice(0, 5).map((site, idx) => (
                <tr key={idx}>
                  <td><strong>{site.site_name}</strong></td>
                  <td>{site.total_reports}</td>
                  <td className="critical">{site.critical_reports}</td>
                  <td className="score">{site.risk_score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADMIN PORTAL: Incident Triage & Review Queue
// ============================================================================

function AdminTriageQueue({ onReviewReport }) {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/reports`, { params: { per_page: 50 } });
      setReports(res.data.reports);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    window.addEventListener('reports-updated', fetchReports);
    return () => window.removeEventListener('reports-updated', fetchReports);
  }, []);

  const filteredReports = filter === 'all'
    ? reports
    : filter === 'pending'
    ? reports.filter(r => r.status === 'pending' || r.status === 'classified')
    : reports.filter(r => r.sif_classification === filter);

  if (loading) return <div className="loading">⏳ Loading Triage Queue...</div>;

  return (
    <div className="admin-queue-view">
      <div className="section-header">
        <h2>🛡️ HSSE Admin Incident Triage & Review Queue</h2>
        <p>Review AI triage classifications, override risk scores, assign field safety officers, and mark actions resolved.</p>
      </div>

      <div className="filter-bar">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All Reports ({reports.length})
        </button>
        <button className={`filter-btn critical ${filter === 'CRITICAL' ? 'active' : ''}`} onClick={() => setFilter('CRITICAL')}>
          Critical (SIF)
        </button>
        <button className={`filter-btn medium ${filter === 'MEDIUM' ? 'active' : ''}`} onClick={() => setFilter('MEDIUM')}>
          Medium
        </button>
        <button className={`filter-btn low ${filter === 'LOW' ? 'active' : ''}`} onClick={() => setFilter('LOW')}>
          Low
        </button>
      </div>

      <div className="queue-list">
        {filteredReports.map(report => (
          <div key={report.id} className={`queue-card risk-${report.sif_classification.toLowerCase()}`}>
            <div className="queue-card-left">
              <div className="queue-title-row">
                <span className={`label ${report.sif_classification.toLowerCase()}`}>{report.sif_classification}</span>
                <h3>{report.title}</h3>
                <span className={`status-pill ${report.status}`}>{report.status.toUpperCase()}</span>
              </div>

              <p className="queue-desc">{report.description}</p>

              <div className="queue-meta">
                <span>📍 {report.site_name}</span>
                <span>🔧 {report.activity_type}</span>
                <span>⏱️ {new Date(report.date_submitted).toLocaleDateString()}</span>
                {report.assigned_to && <span>👨‍🔧 Assigned: {report.assigned_to}</span>}
              </div>
            </div>

            <div className="queue-card-right">
              <div className="conf-score">
                <small>AI Confidence</small>
                <strong>{(report.sif_confidence * 100).toFixed(1)}%</strong>
              </div>
              <button className="review-action-btn" onClick={() => onReviewReport(report)}>
                ⚡ Review & Action
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ADMIN REVIEW MODAL: Override AI Risk, Assign Officer & Action Taken
// ============================================================================

function AdminReviewModal({ report, currentUser, onClose, onReportUpdated }) {
  const [classification, setClassification] = useState(report.sif_classification || 'CRITICAL');
  const [status, setStatus] = useState(report.status || 'under_review');
  const [assignedTo, setAssignedTo] = useState(report.assigned_to || '');
  const [actionTaken, setActionTaken] = useState(report.action_taken || '');
  const [notes, setNotes] = useState(report.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await axios.put(`${API_BASE_URL}/reports/${report.report_id}/review`, {
        sif_classification: classification,
        status: status,
        assigned_to: assignedTo,
        action_taken: actionTaken,
        notes: notes,
        reviewed_by: currentUser?.full_name || 'HSSE Admin'
      });
      onReportUpdated();
    } catch (err) {
      alert("Error saving review: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h2>🛡️ Admin Review & Action - Report #{report.report_id.slice(0, 8)}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="report-summary-box">
            <h3>{report.title}</h3>
            <p>{report.description}</p>
            <div className="summary-tags">
              <span>📍 {report.site_name}</span>
              <span>🔧 {report.activity_type}</span>
              <span>Rule: {report.life_saving_rule || 'N/A'}</span>
            </div>
          </div>

          <div className="form-group">
            <label>AI Classification Override:</label>
            <div className="override-buttons">
              <button
                type="button"
                className={`override-btn critical ${classification === 'CRITICAL' ? 'selected' : ''}`}
                onClick={() => setClassification('CRITICAL')}
              >
                CRITICAL (SIF)
              </button>
              <button
                type="button"
                className={`override-btn medium ${classification === 'MEDIUM' ? 'selected' : ''}`}
                onClick={() => setClassification('MEDIUM')}
              >
                MEDIUM RISK
              </button>
              <button
                type="button"
                className={`override-btn low ${classification === 'LOW' ? 'selected' : ''}`}
                onClick={() => setClassification('LOW')}
              >
                LOW RISK
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Report Status:</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">Pending Review</option>
                <option value="under_review">Under Investigation</option>
                <option value="assigned">Assigned to Engineer</option>
                <option value="resolved">Resolved & Closed</option>
              </select>
            </div>

            <div className="form-group">
              <label>Assign Safety Officer / Engineer:</label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="e.g., Eng. Rajesh Sharma (Lead Maintenance)"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Corrective Action Taken:</label>
            <textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="Describe corrective safety actions taken on site..."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>HSSE Admin Review Notes:</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal review notes..."
              rows="2"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving Changes...' : '💾 Save Review & Update Database'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// ANALYSIS & PRECURSOR VIEW
// ============================================================================

function AnalysisView() {
  const [precursors, setPrecursors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/dashboard/precursors`)
      .then(res => setPrecursors(res.data.precursors))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">⏳ Loading Precursor Analysis...</div>;

  return (
    <div className="analysis-view">
      <div className="section-header">
        <h2>🔍 Precursor Pattern Analytics</h2>
        <p>Correlate recurring safety degradation patterns with severe incident probability.</p>
      </div>

      <table className="risk-table">
        <thead>
          <tr>
            <th>Precursor Type</th>
            <th>Activity</th>
            <th>Site</th>
            <th>Frequency</th>
            <th>SIF Probability</th>
          </tr>
        </thead>
        <tbody>
          {precursors.map((p, idx) => (
            <tr key={idx}>
              <td><strong>{p.precursor_type}</strong></td>
              <td>{p.activity}</td>
              <td>{p.site_name}</td>
              <td>{p.frequency}</td>
              <td className="score">{(p.sif_probability * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// LIFE-SAVING RULES VIEW
// ============================================================================

function LifeSavingRulesView() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/dashboard/life-saving-rules`)
      .then(res => setRules(res.data.rules))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">⏳ Loading Rules...</div>;

  return (
    <div className="rules-view">
      <div className="section-header">
        <h2>⚙️ IOGP Life-Saving Rules Guide</h2>
        <p>Global standards for eliminating fatalities in oil & gas operations.</p>
      </div>

      <div className="rules-grid">
        {rules.map(rule => (
          <div key={rule.id} className="rule-card">
            <div className="rule-header">
              <h3>{rule.rule_name}</h3>
              <span className="rule-code">{rule.rule_code}</span>
            </div>
            <p>{rule.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SUMMARY CARD COMPONENT
// ============================================================================

function SummaryCard({ title, value, percentage, subtitle, icon, color }) {
  return (
    <div className="summary-card" style={{ borderLeftColor: color }}>
      <div className="card-icon">{icon}</div>
      <div className="card-content">
        <h4>{title}</h4>
        <div className="card-value">{value}</div>
        {percentage && <div className="card-percentage">{percentage.toFixed(1)}%</div>}
        {subtitle && <div className="card-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// FOOTER COMPONENT
// ============================================================================

function Footer({ currentUser }) {
  return (
    <footer className="app-footer">
      <p>© 2026 SIH26165 • Authenticated User: <strong>{currentUser.full_name} ({currentUser.role.toUpperCase()})</strong></p>
    </footer>
  );
}
