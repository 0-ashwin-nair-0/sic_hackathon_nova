# Smart City Resource Optimization System

![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![Flask](https://img.shields.io/badge/flask-2.3+-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

AI-powered smart city platform with an Admin ICCC dashboard and a Citizen portal for monitoring, prediction, optimization, simulation, and civic issue reporting.

## What is implemented right now

### Core modules
- Water management (status, demand prediction, leak detection, optimization, simulation)
- Electricity management (status, overload prediction, optimization, simulation)
- Waste management (status, surge prediction, conversion impact, collection priority, simulation)
- Air Quality (real-time AQI status, prediction, pollution source analysis, mitigation, simulation)
- Solution comparison engine (module-wise and combined recommendations)

### Admin dashboard functionality
- Role-based admin access (via `frontend/auth.html?role=admin`)
- Live KPI cards for AQI, Water, Electricity, Waste
- Digital Twin city view (Zone A-D) with mode switching: Water / Electricity / Combined
- AI recommendations panel
- Citizen reports management tab (view, resolve, delete)
- Detailed module tabs (water, electricity, waste, AQI, solutions)
- Simulation mode support
- CSV-driven detailed reports for Water, Electricity, and Waste
- PDF download for generated detailed reports

### Citizen portal functionality
- Role-based citizen access (via `frontend/auth.html?role=citizen`)
- Citizen issue reporting form (with optional image upload)
- Dustbin finder (based on waste status API)
- Zone cleanliness score display
- Basic citizen statistics display

### Authentication currently implemented
- `POST /api/auth/signup` for citizen account creation
- `POST /api/auth/login` for admin and citizen login
- Admin login uses environment credentials (`ADMIN_USERNAME`, `ADMIN_PASSWORD`)
- Citizen users are stored in `backend/data/users.json`

## Architecture

- **Backend:** Flask REST API (`backend/app.py`)
- **Frontend:** Static HTML/CSS/JavaScript (`frontend/`)
- **AI Engine:** Python modules under `backend/ai_engine/`
- **Realtime AQI:** WAQI/OpenWeather fallback logic in `backend/realtime_aqi.py`
- **PDF Reports:** ReportLab-based generation in `backend/pdf_report.py`

## Project structure

```text
sic/
├── backend/
│   ├── ai_engine/
│   │   ├── water_module.py
│   │   ├── electricity_module.py
│   │   ├── waste_module.py
│   │   ├── aqi_module.py
│   │   └── solution_comparator.py
│   ├── data/
│   │   ├── generate_data.py
│   │   ├── users.json
│   │   └── *.csv
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

## Setup

### 1) Install dependencies

```bash
pip install -r requirements.txt
```

### 2) Configure environment file

**Windows PowerShell**
```powershell
Copy-Item .env.example backend/.env
```

**macOS/Linux**
```bash
cp .env.example backend/.env
```

Edit `backend/.env` and set:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `WAQI_TOKEN` (optional but recommended)
- `OPENWEATHER_KEY` (optional fallback)
- `MOCK_AQI` (optional testing override)

### 3) Generate sample data

```bash
python backend/data/generate_data.py
```

### 4) Run backend

```bash
python backend/app.py
```

Backend runs at:
- `http://127.0.0.1:5000`

### 5) Open frontend

Open in browser:
- `frontend/index.html` (landing)
- Admin login flow: `frontend/auth.html?role=admin`
- Citizen login/signup flow: `frontend/auth.html?role=citizen`

## Key API groups

- Health & system
  - `GET /api/health`
  - `GET /api/dashboard`
  - `GET /api/zones`

- Authentication
  - `POST /api/auth/signup`
  - `POST /api/auth/login`

- Water
  - `GET /api/water/status`
  - `GET /api/water/predict/<zone>`
  - `GET /api/water/leak-detection/<zone>`
  - `POST /api/water/optimize`
  - `GET /api/water/simulate/<scenario>`
  - `POST /api/water/detailed-report`

- Electricity
  - `GET /api/electricity/status`
  - `GET /api/electricity/predict/<zone>`
  - `POST /api/electricity/optimize`
  - `GET /api/electricity/simulate/<scenario>`
  - `POST /api/electricity/detailed-report`

- Waste
  - `GET /api/waste/status`
  - `GET /api/waste/predict-surge/<zone>`
  - `GET /api/waste/conversion`
  - `GET /api/waste/collection-priority`
  - `GET /api/waste/simulate/<scenario>`
  - `POST /api/waste/detailed-report`

- AQI
  - `GET /api/aqi/status`
  - `GET /api/aqi/predict/<zone>`
  - `GET /api/aqi/pollution-sources/<zone>`
  - `GET /api/aqi/mitigation/<zone>`
  - `GET /api/aqi/simulate/<scenario>`

- Citizen reports
  - `POST /api/citizen/report`
  - `GET /api/citizen/reports`
  - `PUT /api/citizen/report/<report_id>/resolve`
  - `DELETE /api/citizen/report/<report_id>`

- Solutions & reports
  - `GET /api/solutions/compare/<module>`
  - `GET /api/solutions/all`
  - `GET /api/reports/<module_name>/<report_id>/pdf`

## Important current behavior

- Citizen reports are stored in memory during runtime.
- Generated detailed report payloads are also stored in memory (for PDF download links).
- User accounts are persisted in `backend/data/users.json`.
- AQI endpoint tries real APIs first and falls back to generated/mock values if needed.

## License

MIT License. See [LICENSE](LICENSE).
