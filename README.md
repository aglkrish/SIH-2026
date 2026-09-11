# 🛡️ SIH 2026 - AI-Powered Safety Intelligence Platform (SIF Triage)

An end-to-end Machine Learning Safety Platform designed for oil & gas operations. It performs real-time AI triage of safety observations, near-misses, and incidents to detect **Serious Injury & Fatality (SIF) potential** before accidents happen.

---

## 🌟 Key Architecture & Portals

```
                       ┌──────────────────────────────────────────┐
                       │           Authentication Gateway         │
                       │    [Field Staff Login]  │ [Admin Login]  │
                       └────────────────────┬─────────────────────┘
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               │                                                         │
   (Role: Field Staff)                                       (Role: HSSE Admin)
               ▼                                                         ▼
┌─────────────────────────────┐                           ┌─────────────────────────────┐
│    👷 Field Staff Portal    │                           │   🛡️ HSSE Admin Command     │
├─────────────────────────────┤                           ├─────────────────────────────┤
│ • Submit Observations       │                           │ • Executive Risk KPIs       │
│ • Live AI Preview           │                           │ • Incident Triage Queue     │
│ • User Submission Privacy   │                           │ • AI Risk Level Override    │
│ • Life-Saving Rules Guide   │                           │ • Safety Officer Assignment │
│ • User Profile & Session    │                           │ • Global Company Oversight  │
└─────────────────────────────┘                           └─────────────────────────────┘
```

---

## 🤖 Machine Learning Model Architecture

The platform uses a **Soft-Voting Ensemble Model** combined with a **Dual Feature Extractor**:

1. **Dual Feature Extractor (`FeatureUnion`)**:
   - **Word n-grams (1-2)**: Captures domain phrases (*"uncontrolled blowout"*, *"gas release"*, *"pressure testing"*).
   - **Character n-grams (3-5)**: Captures sub-word patterns and technical abbreviations.

2. **Voting Ensemble (`VotingClassifier`)**:
   - **Random Forest Classifier** (`300 trees`, class-balanced)
   - **Extra Trees Classifier** (`300 trees`, class-balanced)
   - **Logistic Regression Classifier** (`C=2.5`, class-balanced)

3. **Performance Metrics**:
   - **5-Fold Cross-Validation Accuracy**: **`87.50%`**
   - **F1 Macro Score**: **`0.8356`**

---

## 🔑 Pre-Seeded Demo Accounts

| Role | Email Address | Password | Account Name & Department |
| :--- | :--- | :--- | :--- |
| **Field Staff** | `staff@oil.com` | `staff123` | Rajesh Sharma (*Field Maintenance*) |
| **HSSE Admin** | `admin@oil.com` | `admin123` | Dr. Anjali Priya (*HSSE Risk Management*) |

Users can also click **"Sign up here"** on the login screen to register new custom accounts.

---

## 🚀 Quick Setup Instructions

### 1. Start Flask Backend API
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
*(Backend runs on `http://localhost:8000`)*

### 2. Start React Frontend Server
```bash
cd frontend
npm install
npm run dev
```
*(Frontend runs on `http://localhost:5173`)*

---

## 📁 Directory Structure

```
SIH_2026_AI_Safety_Platform/
├── backend/
│   ├── app.py                      # Flask API backend & Voting Ensemble model logic
│   ├── sif_training_data.json      # 1,000 labeled safety incident records
│   ├── requirements.txt            # Python dependencies
│   ├── database_schema.sql         # SQL database schema
│   └── .env                        # Environment configuration
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Auth Gateway, Staff & Admin portals
│   │   ├── App.css                 # Dark glassmorphic design system
│   │   └── main.jsx                # React entry point
│   ├── index.html                  # HTML entry point
│   ├── package.json                # Frontend dependencies
│   └── .env.local                  # Frontend API base URL configuration
└── README.md                       # Project documentation
```

