
# 🌍 Real-Time AQI Integration Guide for Pune

This guide will help you set up real-time air quality data for the Smart City system.

---

## 📋 Overview

The system now fetches **REAL-TIME** air quality data for **8 Pune locations**:
- ✅ Pune City Center (Central zone)
- ✅ Hinjewadi (IT Park zone)
- ✅ Katraj (South zone) 
- ✅ Pimpri-Chinchwad (Industrial zone)
- ✅ Aundh (North zone)
- ✅ Kondhwa (East zone)
- ✅ Baner (West zone)
- ✅ Viman Nagar (Airport area)

Data is updated **every 3 hours** and shows real-time measurements including:
- **AQI** (Air Quality Index)
- **PM2.5** (Fine particulate matter)
- **PM10** (Coarse particulate matter)
- **O₃** (Ozone)
- **NO₂** (Nitrogen Dioxide)
- **SO₂** (Sulfur Dioxide) 
- **CO** (Carbon Monoxide)

---

## ⚙️ Setup Instructions

### **Option 1: Use WAQI API (Recommended)**

**Step 1: Get WAQI API Key**
1. Visit: https://aqicn.org/data-platform/register/
2. Click "Sign Up" and create a FREE account
3. Go to: https://aqicn.org/data-platform/token
4. Copy your token (looks like: `xxxxxxxxxxxxxxxxxxxxx`)

**Step 2: Set Environment Variable**

**Windows (PowerShell):**
```powershell
# In PowerShell:
$env:WAQI_TOKEN = "your_token_here"

# Verify it works:
$env:WAQI_TOKEN
```

**Windows (Command Prompt):**
```cmd
set WAQI_TOKEN=your_token_here
```

**Linux/Mac:**
```bash
export WAQI_TOKEN="your_token_here"
```

**Step 3: Verify Setup**
```bash
# Navigate to backend directory:
cd backend

# Test the module:
python realtime_aqi.py
```

You should see:
```
🌍 PUNE AQI STATUS:
Overall AQI: XX.XX
Status: [Category]
Health Message: [Message]
...
```

---

### **Option 2: Use OpenWeatherMap API (Fallback)**

**Step 1: Get OpenWeatherMap API Key**
1. Visit: https://openweathermap.org/api
2. Click "Sign Up" and create FREE account
3. Go to: https://home.openweathermap.org/api_keys
4. Copy your "API Key" (32 characters alphanumeric)

**Step 2: Set Environment Variable**

**Windows (PowerShell):**
```powershell
$env:OPENWEATHER_KEY = "your_api_key_here"
```

**Windows (Command Prompt):**
```cmd
set OPENWEATHER_KEY=your_api_key_here
```

**Linux/Mac:**
```bash
export OPENWEATHER_KEY="your_api_key_here"
```

---

## 🚀 Starting the Server

### **Method 1: With Environment Variables (Windows PowerShell)**
```powershell
# Set both API keys:
$env:WAQI_TOKEN = "your_waqi_token"
$env:OPENWEATHER_KEY = "your_openweather_key"

# Navigate to backend:
cd backend

# Start server:
python app.py

# Server runs at: http://localhost:5000
```

### **Method 2: With Environment Variables (Linux/Mac)**
```bash
# Set both API keys:
export WAQI_TOKEN="your_waqi_token"
export OPENWEATHER_KEY="your_openweather_key"

# Navigate to backend:
cd backend

# Start server:
python app.py
```

### **Method 3: Direct in Python (Testing)**
```bash
cd backend
python
```

```python
from realtime_aqi import RealtimeAQI

# Get real-time AQI for Pune
aqi_data = RealtimeAQI.get_aqi_for_pune()
print(aqi_data)
```

---

## 📡 API Endpoints

### **1. Get Real-Time AQI Status**
```
GET http://localhost:5000/api/aqi/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "city": "Pune",
    "country": "India",
    "overall_aqi": 125.5,
    "overall_status": "Moderately Polluted",
    "overall_health_message": "⚠️ Air quality is poor...",
    "average_pm25": 45.2,
    "average_pm10": 78.9,
    "zones": [
      {
        "location": "Pune City Center",
        "zone": "Central",
        "aqi": 125.5,
        "pm25": 45.2,
        "pm10": 78.9,
        "o3": 35.4,
        "no2": 28.9,
        "so2": 12.3,
        "co": 0.8,
        "timestamp": "2026-03-01T14:30:00",
        "status": "Moderately Polluted",
        "health_message": "⚠️ Air quality is poor..."
      },
      ...
    ],
    "critical_zones": [],
    "data_source": "WAQI",
    "next_update": "Every 3 hours"
  }
}
```

---

## 🔄 Automatic Updates

The system automatically:
- ✅ Fetches new data from APIs every **3 hours**
- ✅ Falls back to OpenWeatherMap if WAQI is unavailable
- ✅ Falls back to cached local data if both APIs are down

---

## 🎯 Frontend Display

The frontend automatically displays:
1. **Current AQI** for entire Pune
2. **Health advisory** based on AQI level
3. **Zone-wise breakdown** (8 locations)
4. **Pollutant concentrations** (PM2.5, PM10, O₃, NO₂, SO₂, CO)
5. **Trend analysis** (improving/worsening)
6. **Critical zones** (if any)

---

## 🧪 Testing

### **Test Real-Time AQI Module:**
```bash
cd backend
python realtime_aqi.py
```

### **Test API Endpoint:**
```bash
# Using curl:
curl http://localhost:5000/api/aqi/status

# Using Python:
import requests
response = requests.get('http://localhost:5000/api/aqi/status')
print(response.json())
```

---

## ❌ Troubleshooting

### **Issue: "WAQI_TOKEN environment variable not set"**
**Solution:** Make sure to set the environment variable BEFORE starting the server.

### **Issue: API says "Invalid token"**
**Solution:** Double-check your token at https://aqicn.org/data-platform/token

### **Issue: "Connection timeout" errors**
**Solution:** The API might be down. Check your internet connection and try again in a few minutes.

### **Issue: No data is being displayed**
**Solution:** 
1. Check console for errors
2. Verify API keys are set correctly
3. Test with: `python realtime_aqi.py`

---

## 📊 AQI Scale Reference

| AQI Range | Category | Health Impact |
|-----------|----------|---------------|
| 0-50 | **Good** | Air quality is satisfactory |
| 51-100 | **Satisfactory** | Acceptable; sensitive groups should limit exposure |
| 101-200 | **Moderately Polluted** | Members of sensitive groups may experience problems |
| 201-300 | **Poor** | Everyone may begin to experience problems |
| 301-400 | **Very Poor** | Everyone may experience serious health effects |
| 401-500 | **Hazardous** | Emergency measures advised |

---

## 📚 Additional Resources

- **WAQI Documentation:** https://aqicn.org/faq/
- **OpenWeatherMap Docs:** https://openweathermap.org/api/air-pollution
- **India Air Quality Index:** https://www.aqi.in/

---

## ✅ Verification Checklist

- [ ] WAQI account created
- [ ] WAQI token copied
- [ ] WAQI_TOKEN environment variable set
- [ ] Server started successfully
- [ ] `/api/aqi/status` endpoint responding with data
- [ ] Frontend showing real-time AQI values
- [ ] Zone-wise data displayed
- [ ] Health messages showing correctly

---

## 📝 Next Steps

1. **Get API keys** (WAQI recommended)
2. **Set environment variables**
3. **Start the server**
4. **Open frontend** at `http://localhost:5000`
5. **View real-time AQI** in the Air Quality tab

**The system is now live with real-time Pune air quality data!** 🌍✨

