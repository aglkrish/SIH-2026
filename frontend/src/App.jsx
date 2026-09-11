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
            {activeTab === 'lsr-rules' && <LifeSavingRulesView currentUser={currentUser} />}
          </>
        )}

        {/* ADMIN PORTAL VIEWS */}
        {currentUser.role === 'admin' && (
          <>
            {activeTab === 'dashboard' && <AdminDashboard />}
            {activeTab === 'triage-queue' && <AdminTriageQueue onReviewReport={setSelectedReportForReview} />}
            {activeTab === 'precursor-map' && <AnalysisView />}
            {activeTab === 'lsr-rules' && <LifeSavingRulesView currentUser={currentUser} />}
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

// Auth Screen Component (IndianOil Welcome Back Safety Portal)
// ============================================================================

function AuthScreen({ onLoginSuccess }) {
  const [selectedRole, setSelectedRole] = useState('staff'); // 'staff' | 'admin'
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form inputs
  const [email, setEmail] = useState('staff@oil.com');
  const [password, setPassword] = useState('staff123');

  // Modals state
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showNoticesModal, setShowNoticesModal] = useState(false);

  // Emergency Form State
  const [emergencyData, setEmergencyData] = useState({
    title: '',
    description: '',
    location: 'Refinery Main Processing Unit',
    submitted_by: 'Field Staff'
  });
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyResult, setEmergencyResult] = useState(null);

  // Register Form State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('staff');
  const [regSite, setRegSite] = useState('Greater Noida HSE Hub');
  const [regEmpId, setRegEmpId] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState(null);

  // Safety Slogans list for rotation
  const slogans = [
    "Safety First, Success Follows",
    "Zero Harm to People, Zero Harm to Environment",
    "Identify Hazards Before They Cause Accidents",
    "Compliance with Life-Saving Rules is Mandatory",
    "Report Near-Misses Immediately to Prevent SIF"
  ];
  const [sloganIndex, setSloganIndex] = useState(0);

  const rotateSlogan = () => {
    setSloganIndex((prev) => (prev + 1) % slogans.length);
  };

  // Quick Demo Login Fill
  const fillDemoStaff = () => {
    setSelectedRole('staff');
    setEmail('staff@oil.com');
    setPassword('staff123');
    setError(null);
  };

  const fillDemoAdmin = () => {
    setSelectedRole('admin');
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
    setRegLoading(true);
    setRegError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        full_name: regFullName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        site_name: regSite,
        user_id: regEmpId
      });

      if (response.data.success) {
        setShowRegisterModal(false);
        onLoginSuccess(response.data.user);
      }
    } catch (err) {
      setRegError(err.response?.data?.error || err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleEmergencySubmit = async (e) => {
    e.preventDefault();
    setEmergencyLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/reports/submit`, {
        title: `🚨 EMERGENCY: ${emergencyData.title}`,
        description: emergencyData.description,
        site_name: 'Greater Noida HSE Refinery',
        location: emergencyData.location,
        activity_type: 'Emergency Action',
        submitted_by: emergencyData.submitted_by || 'Emergency Reporter'
      });
      setEmergencyResult(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setEmergencyLoading(false);
    }
  };

  return (
    <div className="iocl-auth-page">
      {/* Top Header Bar */}
      <header className="iocl-top-header">
        <div className="iocl-header-left">
          <img src="/indianoil_logo.png" alt="IndianOil Emblem" className="iocl-header-emblem" />
          <div className="iocl-header-title-box">
            <h1>INDIANOIL (IOCL) - SAFETY & HSE PORTAL</h1>
            <span className="iocl-header-sub">Greater Noida, Uttar Pradesh, India</span>
          </div>
        </div>
      </header>

      {/* Main Content Layout Grid */}
      <div className="iocl-portal-container">
        {/* Left Side: IndianOil Brand Logo */}
        <div className="iocl-left-branding">
          <img src="/indianoil_logo.png" alt="IndianOil Logo" className="iocl-main-brand-logo" />
          <h2 className="iocl-brand-text">IndianOil</h2>
        </div>

        {/* Center: Main Login Card ("SAFETY & HSE PORTAL") */}
        <div className="iocl-center-card">
          <div className="iocl-card-navy-header">
            <div className="iocl-navy-logo-badge">
              <img src="/indianoil_logo.png" alt="IOCL" />
            </div>
            <h2>SAFETY & HSE PORTAL</h2>
          </div>

          <div className="iocl-card-body">
            {/* Role Switcher Pill Bar */}
            <div className="iocl-role-pills">
              <button
                type="button"
                className={`iocl-role-pill ${selectedRole === 'staff' ? 'active' : ''}`}
                onClick={() => { setSelectedRole('staff'); setError(null); }}
              >
                👷 Field Staff
              </button>
              <button
                type="button"
                className={`iocl-role-pill ${selectedRole === 'admin' ? 'active' : ''}`}
                onClick={() => { setSelectedRole('admin'); setError(null); }}
              >
                🛡️ HSSE Admin
              </button>
            </div>

            {/* 1-Click Demo Shortcut Bar */}
            <div className="iocl-demo-shortcuts">
              <span>⚡ Quick Demo Login:</span>
              <button type="button" onClick={fillDemoStaff} className="iocl-demo-btn">Staff Demo</button>
              <button type="button" onClick={fillDemoAdmin} className="iocl-demo-btn">Admin Demo</button>
            </div>

            {error && <div className="iocl-alert error">❌ {error}</div>}

            <form onSubmit={handleLoginSubmit} className="iocl-form">
              <div className="iocl-input-group">
                <label>EMPLOYEE ID / USER ID</label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={selectedRole === 'staff' ? 'A1234567 or staff@oil.com' : 'ADM001 or admin@oil.com'}
                  required
                />
              </div>

              <div className="iocl-input-group">
                <label>PASSWORD</label>
                <div className="iocl-password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="iocl-eye-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>

              <div className="iocl-form-options">
                <label className="iocl-checkbox">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember Me</span>
                </label>
                <button
                  type="button"
                  className="iocl-link-text"
                  onClick={() => setShowForgotModal(true)}
                >
                  Forgot Password?
                </button>
              </div>

              <button type="submit" className="iocl-submit-btn" disabled={loading}>
                {loading ? 'AUTHENTICATING...' : 'SIGN IN TO PORTAL'}
              </button>

              <div className="iocl-register-prompt">
                Don't have an account?{' '}
                <button
                  type="button"
                  className="iocl-link-text bold"
                  onClick={() => setShowRegisterModal(true)}
                >
                  Sign up here
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Side: Safety Widgets Panel */}
        <div className="iocl-right-widgets">
          {/* Widget 1: Emergency Safety Reporting */}
          <div className="iocl-widget-section">
            <div className="iocl-widget-header">
              <span className="iocl-widget-icon red-icon">⚠️</span>
              <div className="iocl-widget-titles">
                <h3>EMERGENCY SAFETY REPORTING</h3>
              </div>
            </div>
            <button
              type="button"
              className="iocl-btn-emergency"
              onClick={() => {
                setEmergencyResult(null);
                setShowEmergencyModal(true);
              }}
            >
              REPORT INCIDENT
            </button>
          </div>

          {/* Widget 2: Today's Safety Slogan */}
          <div className="iocl-widget-section">
            <div className="iocl-widget-header">
              <span className="iocl-widget-icon orange-icon">👷</span>
              <div className="iocl-widget-titles">
                <h3>TODAY'S SAFETY SLOGAN</h3>
                <p className="iocl-slogan-text">"{slogans[sloganIndex]}"</p>
              </div>
            </div>
            <button type="button" className="iocl-slogan-rotate" onClick={rotateSlogan}>
              🔄 Next Slogan
            </button>
          </div>

          {/* Widget 3: Important Safety Notices */}
          <div className="iocl-widget-section">
            <div className="iocl-widget-header">
              <span className="iocl-widget-icon blue-icon">📋</span>
              <div className="iocl-widget-titles">
                <h3>IMPORTANT SAFETY NOTICES</h3>
              </div>
            </div>
            <button
              type="button"
              className="iocl-btn-notices"
              onClick={() => setShowNoticesModal(true)}
            >
              VIEW NOTICES
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Reporting Modal */}
      {showEmergencyModal && (
        <div className="modal-backdrop">
          <div className="modal-content iocl-modal">
            <div className="modal-header emergency-header">
              <h2>🚨 Immediate Emergency Incident Report</h2>
              <button className="close-btn" onClick={() => setShowEmergencyModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {emergencyResult ? (
                <div className="alert alert-success">
                  <h3>✅ Emergency Alert Logged & Dispatched to HSSE Triage!</h3>
                  <p><strong>Report Reference ID:</strong> {emergencyResult.report_id}</p>
                  <p><strong>Triage Priority:</strong> <span className={`label ${emergencyResult.classification?.toLowerCase()}`}>{emergencyResult.classification}</span></p>
                  <button className="btn-primary" onClick={() => setShowEmergencyModal(false)}>Close Window</button>
                </div>
              ) : (
                <form onSubmit={handleEmergencySubmit} className="report-form">
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                    Use this form for urgent, immediate field hazard reporting. No prior login required.
                  </p>
                  <div className="form-group">
                    <label>Emergency Hazard Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Uncontrolled blow-off or gas leak near Unit 3"
                      value={emergencyData.title}
                      onChange={(e) => setEmergencyData({ ...emergencyData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Incident Details *</label>
                    <textarea
                      rows="4"
                      placeholder="Describe what is occurring, exact location, and personnel involved..."
                      value={emergencyData.description}
                      onChange={(e) => setEmergencyData({ ...emergencyData, description: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Site Location / Area</label>
                      <input
                        type="text"
                        value={emergencyData.location}
                        onChange={(e) => setEmergencyData({ ...emergencyData, location: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Reporter Name / Phone</label>
                      <input
                        type="text"
                        placeholder="e.g. Duty Shift Operator"
                        value={emergencyData.submitted_by}
                        onChange={(e) => setEmergencyData({ ...emergencyData, submitted_by: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={() => setShowEmergencyModal(false)}>Cancel</button>
                    <button type="submit" className="btn-primary" style={{ background: '#dc2626' }} disabled={emergencyLoading}>
                      {emergencyLoading ? 'Logging Alert...' : '🚨 Submit Emergency Alert'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Registration Modal */}
      {showRegisterModal && (
        <div className="modal-backdrop">
          <div className="modal-content iocl-modal">
            <div className="modal-header">
              <h2>📝 Create New IndianOil Safety Account</h2>
              <button className="close-btn" onClick={() => setShowRegisterModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {regError && <div className="alert alert-error">❌ {regError}</div>}
              <form onSubmit={handleRegisterSubmit} className="report-form">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g., Rajesh Sharma"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Official Email Address *</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g., rajesh@oil.com"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Employee / User ID</label>
                    <input
                      type="text"
                      value={regEmpId}
                      onChange={(e) => setRegEmpId(e.target.value)}
                      placeholder="e.g., EMP-502"
                    />
                  </div>
                  <div className="form-group">
                    <label>Account Role *</label>
                    <select value={regRole} onChange={(e) => setRegRole(e.target.value)}>
                      <option value="staff">Field Staff</option>
                      <option value="admin">HSSE Admin / Executive</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Operating Refinery / Hub Location</label>
                  <input
                    type="text"
                    value={regSite}
                    onChange={(e) => setRegSite(e.target.value)}
                    placeholder="e.g. Greater Noida HSE Hub"
                  />
                </div>
                <div className="form-group">
                  <label>Create Password *</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowRegisterModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ background: '#ea580c' }} disabled={regLoading}>
                    {regLoading ? 'Creating Account...' : 'Create Account & Sign In'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="modal-backdrop">
          <div className="modal-content iocl-modal">
            <div className="modal-header">
              <h2>🔒 Account Support & Password Reset</h2>
              <button className="close-btn" onClick={() => setShowForgotModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ color: '#cbd5e1', fontSize: '13px' }}>
              <p>For security compliance in IndianOil plant operations, passwords can be reset via your corporate Single Sign-On (SSO) or by contacting the HSSE Lead Administrator.</p>
              <div style={{ background: '#0b141c', padding: '12px', borderRadius: '6px', margin: '12px 0', border: '1px solid #1e293b' }}>
                <p style={{ margin: '0 0 6px', color: '#fff', fontWeight: 'bold' }}>⚡ Demo Credentials:</p>
                <p style={{ margin: '0 0 4px' }}>• Field Staff: <code>staff@oil.com</code> / Password: <code>staff123</code></p>
                <p style={{ margin: 0 }}>• HSSE Admin: <code>admin@oil.com</code> / Password: <code>admin123</code></p>
              </div>
              <div className="modal-footer">
                <button className="btn-primary" onClick={() => setShowForgotModal(false)}>Understood</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safety Notices Modal */}
      {showNoticesModal && (
        <div className="modal-backdrop">
          <div className="modal-content iocl-modal">
            <div className="modal-header">
              <h2>📋 Active Site Safety Bulletins & Notices</h2>
              <button className="close-btn" onClick={() => setShowNoticesModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ color: '#cbd5e1', fontSize: '13px', display: 'grid', gap: '12px' }}>
              <div className="action-box success">
                <strong style={{ display: 'block', marginBottom: '4px' }}>📌 Notice #1: Mandatory Pre-Work Gas Detector Checks</strong>
                All hot work permits in Block B must be accompanied by dual gas level verification prior to torch ignition.
              </div>
              <div className="action-box">
                <strong style={{ display: 'block', marginBottom: '4px' }}>📌 Notice #2: Zero-Tolerance for LOTO Violations</strong>
                Energy isolation lockout/tagout must be verified with physical zero-energy testing before line break operations.
              </div>
              <div className="action-box">
                <strong style={{ display: 'block', marginBottom: '4px' }}>📌 Notice #3: Monsoon Slip & Fall Advisory</strong>
                Elevated scaffolding walkways are treated with non-slip coating. Safety harness latching is mandatory above 2 meters.
              </div>
              <div className="modal-footer">
                <button className="btn-primary" onClick={() => setShowNoticesModal(false)}>Acknowledge Notices</button>
              </div>
            </div>
          </div>
        </div>
      )}
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
             Scaffold Hazard
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

function LifeSavingRulesView({ currentUser }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add Rule Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/dashboard/life-saving-rules`);
      setRules(res.data.rules);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleAddRuleSubmit = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/dashboard/life-saving-rules`, {
        rule_code: newCode,
        rule_name: newName,
        description: newDesc,
        keywords: newKeywords
      });

      if (response.data.success) {
        setShowAddModal(false);
        setNewCode('');
        setNewName('');
        setNewDesc('');
        setNewKeywords('');
        fetchRules();
      }
    } catch (err) {
      setAddError(err.response?.data?.error || err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const filteredRules = rules.filter(r => {
    const term = searchTerm.toLowerCase();
    const keywordsStr = Array.isArray(r.keywords) ? r.keywords.join(' ') : (r.keywords || '');
    return (
      r.rule_code.toLowerCase().includes(term) ||
      r.rule_name.toLowerCase().includes(term) ||
      r.description.toLowerCase().includes(term) ||
      keywordsStr.toLowerCase().includes(term)
    );
  });

  const getRuleIcon = (code) => {
    if (code.startsWith('ES')) return '⚡';
    if (code.startsWith('HW')) return '🔥';
    if (code.startsWith('CS')) return '🚪';
    if (code.startsWith('LOF')) return '🎯';
    if (code.startsWith('WH')) return '🪜';
    if (code.startsWith('MVS')) return '🚜';
    if (code.startsWith('HPE')) return '💥';
    if (code.startsWith('CT')) return '🏗️';
    if (code.startsWith('BSC')) return '🛑';
    if (code.startsWith('PTW')) return '📝';
    if (code.startsWith('FFD')) return '🩺';
    if (code.startsWith('H2S')) return '☣️';
    return '🛡️';
  };

  if (loading) return <div className="loading">⏳ Loading Life-Saving Rules...</div>;

  return (
    <div className="rules-view">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>⚙️ IOGP & IndianOil Life-Saving Rules Master</h2>
          <p>Mandatory standards & protocols for eliminating Serious Injury & Fatality (SIF) in plant operations.</p>
        </div>

        {currentUser?.role === 'admin' && (
          <button
            type="button"
            className="btn-primary"
            style={{ background: '#ea580c', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => { setAddError(null); setShowAddModal(true); }}
          >
            ➕ Add New Life-Saving Rule
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="filter-bar" style={{ margin: '16px 0 24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Search rule by code, title, or keywords (e.g. LOTO, H2S, Hot Work)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, padding: '12px 16px', background: '#111c24', border: '1px solid #24384a', color: '#fff', borderRadius: '6px', outline: 'none' }}
        />
        <span style={{ font: '11px var(--mono)', color: '#94a3b8' }}>
          {filteredRules.length} of {rules.length} Rules Loaded
        </span>
      </div>

      <div className="rules-grid">
        {filteredRules.map(rule => (
          <div key={rule.id} className="rule-card">
            <div className="rule-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{getRuleIcon(rule.rule_code)}</span>
                <h3>{rule.rule_name}</h3>
              </div>
              <span className="rule-code">{rule.rule_code}</span>
            </div>
            <p>{rule.description}</p>
            {rule.keywords && (
              <div className="tag-cloud" style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(Array.isArray(rule.keywords) ? rule.keywords : rule.keywords.split(',')).map((kw, idx) => (
                  <span key={idx} className="tag">{kw.trim()}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add New Rule Modal (Admin) */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content iocl-modal">
            <div className="modal-header">
              <h2>➕ Add New Life-Saving Rule Master Record</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {addError && <div className="alert alert-error">❌ {addError}</div>}
              <form onSubmit={handleAddRuleSubmit} className="report-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Rule Code (e.g., LOTO02, HAZ01) *</label>
                    <input
                      type="text"
                      placeholder="e.g. LOTO02"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Rule Name / Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Chemical Spill Containment"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Rule Description & Mandatory Safeguards *</label>
                  <textarea
                    rows="4"
                    placeholder="Provide clear operational requirements and safety protocol..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Trigger Keywords (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. chemical, spill, hazmat, containment, acid"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ background: '#ea580c' }} disabled={addLoading}>
                    {addLoading ? 'Saving Rule...' : '✅ Save New Rule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
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
