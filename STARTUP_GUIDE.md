# 🏙️ Smart City ICCC - Startup Guide

## Quick Start Steps

Follow these steps **IN ORDER** to get your Smart City dashboard running:

---

### Step 1: Install Python Dependencies

Open a terminal in the project directory and run:

```bash
pip install -r requirements.txt
```

**What this installs:**
- Flask (Web framework)
- Flask-CORS (Cross-origin resource sharing)
- Pandas (Data processing)
- NumPy (Numerical computing)
- Scikit-learn (Machine learning)

---

### Step 2: Generate Required Data Files

Navigate to the backend/data directory and run the data generation script:

```bash
cd backend/data
python generate_data.py
cd ../..
```

**What this does:**
- Creates sample data for all 4 modules (Water, Electricity, Waste, AQI)
- Generates CSV files with realistic patterns
- Sets up initial conditions for the AI models

**Expected files created:**
- `water_data.csv`
- `electricity_data.csv`
- `waste_data.csv`
- `aqi_data.csv`

---

### Step 3: Start the Backend Server

From the project root directory, start the Flask backend:

```bash
cd backend
python app.py
```

**Expected output:**
```
 * Running on http://127.0.0.1:5000
 * Debug mode: on
```

**Important:** Keep this terminal window open! The backend must run continuously.

---

### Step 4: Open the Landing Page

Open the frontend in your web browser:

1. Navigate to the `frontend` folder
2. Open `index.html` in your browser:
  - **Option A:** Double-click `index.html`
   - **Option B:** Right-click → Open with → Your browser
   - **Option C:** Use a local web server (recommended):
     ```bash
     cd frontend
     python -m http.server 8000
     ```
     Then open: http://localhost:8000

3. On the landing page, click **Admin** to open the ICCC dashboard.

---

## 🎯 What You Should See

### Main Dashboard Features:

1. **KPI Cards (Top)** - Real-time metrics for:
   - Air Quality Index
   - Water Availability
   - Power Load
   - Waste Status

2. **Digital Twin (Center Left)** - Interactive city map showing:
   - Zone A, B, C, D with live statistics
   - Toggle between Water/Electricity/Combined modes
   - Color-coded status indicators

3. **AI Recommendations (Center Right)**:
   - Critical alerts
   - Optimization suggestions
   - Quick action buttons

4. **Module Tabs (Bottom)** - Detailed views:
   - **Water Management:**
     - ✅ Zone Status (tank levels)
     - ✅ Demand Prediction (AI forecasts)
     - ✅ Leak Detection (anomaly analysis)
   
   - **Electricity:**
     - Zone load status
     - Load predictions
     - Renewable generation stats
   
   - **Waste:**
     - Bin status grid
     - Waste-to-energy impact
   
   - **Air Quality:**
     - Zone AQI levels
     - Pollution sources
     - Mitigation actions
   
   - **Solutions:**
     - Compare different solutions
     - Cost-benefit analysis

---

## ✅ Verification Checklist

After starting the application, verify these items:

- [ ] Backend server is running on http://127.0.0.1:5000
- [ ] Dashboard loads without errors
- [ ] KPI cards show numeric values (not "--")
- [ ] City zones display colored status
- [ ] **Zone Status section shows data** for all zones
- [ ] **Demand Prediction shows predicted values**
- [ ] **Leak Detection shows analysis results**
- [ ] You can switch between tabs
- [ ] Digital twin changes when clicking Water/Electricity/Combined modes

---

## 🔧 Troubleshooting

### Problem: Zone Status shows "Loading..." forever

**Solution:**
1. Check if backend is running (Step 3)
2. Open browser console (F12)
3. Look for error messages
4. Verify the API endpoint: http://127.0.0.1:5000/api/water/status
5. Refresh the page (Ctrl+F5)

### Problem: "Failed to load dashboard data"

**Solution:**
1. Ensure Flask backend is running
2. Check CORS is enabled in `app.py`
3. Verify the API base URL in `main.js` matches your backend: `http://127.0.0.1:5000/api`

### Problem: No data files exist

**Solution:**
1. Run data generation script: `python backend/data/generate_data.py`
2. Verify CSV files are created in `backend/data/`

### Problem: Module errors (ImportError, ModuleNotFoundError)

**Solution:**
```bash
pip install --upgrade -r requirements.txt
```

### Problem: Zone Status and other panels are empty/blank

**Solution:** 
This was the original issue - now fixed! The frontend wasn't calling the API endpoints to populate the detailed sections. The updated `main.js` now:
- Loads water predictions for each zone
- Loads leak detection analysis
- Populates all module-specific data sections

---

## 🚀 API Endpoints Available

Test these endpoints directly in your browser while the backend is running:

- **Dashboard:** http://127.0.0.1:5000/api/dashboard
- **Water Status:** http://127.0.0.1:5000/api/water/status
- **Electricity Status:** http://127.0.0.1:5000/api/electricity/status
- **Waste Status:** http://127.0.0.1:5000/api/waste/status
- **AQI Status:** http://127.0.0.1:5000/api/aqi/status

---

## 📊 Interactive Features

### Quick Actions You Can Try:

1. **Optimize Water** - Reallocates water from surplus to deficit zones
2. **Balance Load** - Optimizes electricity distribution
3. **Waste Impact** - Shows environmental benefits of waste-to-energy
4. **Emergency Mode** - Creates emergency vehicle corridors

### Tab Navigation:

Click on any tab button to switch modules:
- Water Management
- Electricity
- Waste
- Air Quality
- Solutions

### Digital Twin Modes:

- **Water Mode:** Shows tank levels and water flow
- **Electricity Mode:** Shows power load distribution
- **Combined Mode:** Shows both water and electricity status

---

## 📝 Notes

- **Auto-refresh:** Dashboard refreshes every 10 seconds
- **Data persistence:** Data is read from CSV files
- **AI Models:** Linear regression for predictions, anomaly detection for leaks
- **Simulation Mode:** Can simulate scenarios (button in header)

---

## 🎉 Success!

If you see data in all sections, congratulations! Your Smart City ICCC dashboard is fully operational.

**Key Signs of Success:**
✅ Zone Status shows percentages
✅ Demand Prediction shows forecasted values with confidence levels
✅ Leak Detection shows analysis (No Leaks or Leak Detected)
✅ All KPI cards show values
✅ Digital twin zones are color-coded
✅ AI recommendations appear

---

## Need Help?

If issues persist after following this guide:
1. Check the browser console for errors (F12)
2. Check the Flask terminal for error messages
3. Verify all CSV files exist in `backend/data/`
4. Ensure port 5000 is not in use by another application

**Happy Monitoring!** 🏙️✨
