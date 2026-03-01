[![Typing SVG](https://readme-typing-svg.demolab.com?font=Montserrat&weight=700&size=32&duration=3000&pause=1200&color=00C6FF&center=true&vCenter=true&width=1000&lines=Smart+City+Resource+Optimization;AI-Powered+Predictive+Analytics;Real-Time+Monitoring+%26+Simulation;Data-Driven+Urban+Intelligence)](https://git.io/typing-svg)

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.8+-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Flask-2.3+-green?style=for-the-badge" />
  <img src="https://img.shields.io/badge/AI-Enabled-orange?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Architecture-Modular-success?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />
</p>

---

# 🌆 Smart City Resource Optimization & Predictive Intelligence Platform

An AI-driven Smart City infrastructure platform designed for **Intelligent Command & Control Centers (ICCC)** and citizen engagement systems.

This system enables:

- Real-time infrastructure monitoring  
- Predictive analytics using AI logic  
- Dynamic resource optimization  
- Scenario-based simulation  
- Citizen issue reporting  
- Data-driven policy recommendations  

---

# 📌 Problem Statement

Modern cities rely on static allocation strategies for:

- Water distribution  
- Electricity management  
- Waste collection  
- Air quality monitoring  

These traditional systems fail under:

- Sudden demand spikes  
- Seasonal fluctuations  
- Urban population growth  
- Infrastructure inefficiencies  

There is a need for an **adaptive, AI-based, predictive decision-support system**.

---

# 🧠 System Intelligence Architecture

The platform operates in three analytical layers:

## 1️⃣ Monitoring Layer
- Zone-wise KPI tracking
- Infrastructure health monitoring
- Real-time AQI integration
- Leak and overload detection

## 2️⃣ Predictive Layer
- Water demand forecasting
- Electricity overload prediction
- Waste surge detection
- AQI forecasting engine

## 3️⃣ Optimization & Simulation Layer
- AI-based resource allocation
- Scenario-based modeling
- Solution comparison engine
- Policy recommendation system

---

# 🏙️ Core Modules

## 💧 Water Intelligence
- Zone status monitoring
- Demand prediction
- Leak detection
- Optimization engine
- Simulation support
- Detailed CSV-based reporting
- PDF export

## ⚡ Electricity Intelligence
- Load monitoring
- Overload risk prediction
- Dynamic optimization
- Simulation modeling
- Detailed reporting

## ♻️ Waste Intelligence
- Waste surge forecasting
- Waste-to-energy impact analysis
- Collection priority engine
- Smart dustbin logic
- Simulation support

## 🌫️ Air Quality Intelligence
- Real-time AQI integration (WAQI / OpenWeather fallback)
- Pollution source analytics
- Mitigation recommendation engine
- AQI prediction
- Scenario simulation

## 🧩 Solution Comparison Engine
- Module-wise comparison
- Combined optimization strategy
- Decision-support recommendations

---

# 🖥️ Admin ICCC Dashboard

Access:
frontend/auth.html?role=admin


### Key Features
- Live KPI dashboard
- Digital Twin City View (Zone A–D)
- Water / Electricity / Combined mode switching
- AI recommendation panel
- Citizen report management
- Simulation mode
- Detailed report generation (PDF)

---

# 👥 Citizen Portal

Access: 
frontend/auth.html?role=citizen


### Features
- Civic issue reporting (with image upload)
- Dustbin locator
- Zone cleanliness score
- Basic statistics view
- Secure authentication

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Montserrat&weight=700&size=32&duration=3000&pause=1200&color=00C6FF&center=true&vCenter=true&width=1000&lines=Smart+City+Resource+Optimization;AI-Powered+Predictive+Analytics;Real-Time+Monitoring+%26+Simulation;Data-Driven+Urban+Intelligence)](https://git.io/typing-svg)


# 🔐 Authentication

### Endpoints

```http
POST /api/auth/signup
POST /api/auth/login
```

### Current Implementation
- Admin credentials managed via environment variables
- Citizen accounts stored in backend/data/users.json
- Lightweight JSON-based persistence model

# 🔌 API Overview
### 🖥 System

```http
GET /api/health
GET /api/dashboard
GET /api/zones
```

### 💧 Water Module
```http
GET    /api/water/status
GET    /api/water/predict/<zone>
GET    /api/water/leak-detection/<zone>
POST   /api/water/optimize
GET    /api/water/simulate/<scenario>
POST   /api/water/detailed-report
```

### ⚡ Electricity Module
```http
GET    /api/electricity/status
GET    /api/electricity/predict/<zone>
POST   /api/electricity/optimize
GET    /api/electricity/simulate/<scenario>
POST   /api/electricity/detailed-report
```

### ♻️ Waste Module
```http
GET    /api/waste/status
GET    /api/waste/predict-surge/<zone>
GET    /api/waste/conversion
GET    /api/waste/collection-priority
GET    /api/waste/simulate/<scenario>
POST   /api/waste/detailed-report
```

### 🌫 AQI Module
```http
GET    /api/aqi/status
GET    /api/aqi/predict/<zone>
GET    /api/aqi/pollution-sources/<zone>
GET    /api/aqi/mitigation/<zone>
GET    /api/aqi/simulate/<scenario>
```

### 👥 Citizen Reports
```http
POST   /api/citizen/report
GET    /api/citizen/reports
PUT    /api/citizen/report/<id>/resolve
DELETE /api/citizen/report/<id>
```


# 🏗️ Technology Stack

| Layer      | Technology                      |
| ---------- | ------------------------------- |
| Backend    | Flask REST API                  |
| AI Engine  | Python Modular Architecture     |
| Frontend   | HTML, CSS, JavaScript           |
| Reporting  | ReportLab (PDF Generation)      |
| Data Layer | CSV + JSON                      |
| AQI Source | WAQI API + OpenWeather Fallback |


# 📂 Project Structure
```
sic/
├── backend/
│   ├── ai_engine/
│   ├── data/
│   ├── models/
│   ├── uploads/
│   ├── app.py
│   ├── realtime_aqi.py
│   └── pdf_report.py
├── frontend/
│   ├── index.html
│   ├── auth.html
│   ├── admin.html
│   ├── citizen.html
│   ├── css/
│   └── js/
├── .env.example
├── requirements.txt
└── README.md
```
# ⚙️ Setup Instructions

### 1️⃣ Install Dependencies
```http
pip install -r requirements.txt
```

### 2️⃣ Configure Environment
 - Copy .env.example into backend:
```http
cp .env.example backend/.env
```

<b>Set the following variables:</b>
- ADMIN_USERNAME
- ADMIN_PASSWORD
- WAQI_TOKEN (optional)
- OPENWEATHER_KEY (optional)
- MOCK_AQI (optional)

### 3️⃣ Generate Sample Data
```http
python backend/data/generate_data.py
```

### 4️⃣ Run Backend
```http
python backend/app.py
```
<b>Server will run at:</b>
```http://127.0.0.1:5000```

# ⚠️ Current Behavior
- Citizen reports stored in memory (runtime only)
- Detailed report payloads temporarily stored
- Users persisted in JSON
- AQI endpoint uses API fallback logic
- Designed primarily for prototype / hackathon deployment

# 🚀 Future Roadmap
- PostgreSQL database integration
- Docker containerization
- Cloud deployment (AWS / Azure)
- Real machine learning training pipeline
- GIS-based smart city map integration
- Multi-role hierarchy (Super Admin / Analyst)

# 📊 Impact & Use Case
This system can be deployed in:
 - Smart City ICCC Command Centers
 - Municipal governance systems
 - Urban infrastructure research labs
 - Sustainability-focused city planning
 - It transforms reactive governance into predictive, optimized, and proactive management.

---

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Montserrat&weight=600&size=24&duration=3000&pause=1000&color=00C6FF&center=true&vCenter=true&width=800&lines=Building+Predictive+Cities;Optimizing+Urban+Infrastructure;AI+Driven+Smart+Governance)](https://git.io/typing-svg)
