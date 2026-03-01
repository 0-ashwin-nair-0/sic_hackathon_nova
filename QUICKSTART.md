
# 🚀 QUICK START - REAL-TIME AIR QUALITY FOR PUNE

## 📌 What You Need to Do (5 Steps)

### **Step 1: Get WAQI API Key (2 minutes)**
1. Go to: https://aqicn.org/data-platform/register/
2. Sign up (FREE)
3. Go to: https://aqicn.org/data-platform/token
4. Copy your token (32 characters)

### **Step 2: Set Environment Variable in Windows PowerShell**
```powershell
# Open PowerShell and paste this:
$env:WAQI_TOKEN = "paste_your_token_here"

# Verify it works:
$env:WAQI_TOKEN

# Output should show your token
```

### **Step 3: Navigate to Backend Directory**
```powershell
cd "C:\Users\YourUsername\Downloads\sic\sic\backend"
```

### **Step 4: Start the Server**
```powershell
python app.py
```

### **Step 5: Open in Browser**
- **Admin Dashboard**: http://localhost:5000/admin.html
- **Citizen Portal**: http://localhost:5000/citizen.html
- **AQI API**: http://localhost:5000/api/aqi/status

---

## 📊 What Real-Time Data Shows

✅ **Overall AQI** for Pune  
✅ **Health Advisory** (Good, Satisfactory, Poor, etc.)  
✅ **PM2.5 & PM10** concentrations  
✅ **Hourly Updates** from real sensors  
✅ **8 Pune Locations**:
- Pune City Center
- Hinjewadi (IT Park)
- Katraj (South)
- Pimpri-Chinchwad (Industrial)
- Aundh (North)
- Kondhwa (East)
- Baner (West)
- Viman Nagar (Airport)

---

## 🔧 If Something Goes Wrong

### **Problem: "WAQI_TOKEN not set"**
- Make sure to run the `$env:WAQI_TOKEN = "..."` command
- Run it in the SAME PowerShell window before starting the server

### **Problem: "Connection refused"**
- Server might not be running
- Make sure you did `python app.py`
- Wait 2-3 seconds for server to start

### **Problem: "API returned 401"**
- Your WAQI token might be invalid
- Get a new one from https://aqicn.org/data-platform/token
- Make sure there are no extra spaces

### **Problem: No data showing in UI**
- Open browser DevTools (F12)
- Check Console tab for errors
- Try http://localhost:5000/api/aqi/status directly

---

## 📝 Alternative: Use .env File (Optional)

Instead of setting environment variables each time, create a `.env` file:

**File**: `backend/.env`
```
WAQI_TOKEN=your_token_here
OPENWEATHER_KEY=optional_key
```

Then in PowerShell:
```powershell
cd backend
python app.py
```

---

## ✨ Key Files Added/Modified

| File | Purpose |
|------|---------|
| `backend/realtime_aqi.py` | **NEW** - Fetches real-time AQI data |
| `backend/app.py` | **MODIFIED** - Added real-time AQI endpoint |
| `REALTIME_AQI_SETUP.md` | **NEW** - Detailed setup guide |
| `.env.example` | **NEW** - Reference for environment variables |

---

## 🎯 Expected Output

When you visit http://localhost:5000/api/aqi/status, you'll see:

```json
{
  "data": {
    "overall_aqi": 125.5,
    "overall_status": "Moderately Polluted",
    "average_pm25": 45.2,
    "average_pm10": 78.9,
    "zones": [
      {
        "location": "Pune City Center",
        "aqi": 125.5,
        "pm25": 45.2,
        "pm10": 78.9,
        "status": "Moderately Polluted"
      },
      ...
    ]
  }
}
```

---

## 💡 Pro Tips

1. **WAQI is better** - Gets data from 10,000+ air quality monitors worldwide
2. **Updates every 3 hours** - Not real-time but latest available  
3. **Free forever** - WAQI free tier is unlimited
4. **No credit card needed** - Just email signup
5. **Works globally** - Can monitor any city, not just Pune

---

## 📞 Support Resources

- **WAQI Docs**: https://aqicn.org/faq/
- **Our Setup Guide**: See `REALTIME_AQI_SETUP.md` in project root
- **Test Module**: Run `python backend/realtime_aqi.py`

---

## ✅ Checklist Before You Start

- [ ] Downloaded WAQI token
- [ ] Set WAQI_TOKEN environment variable
- [ ] Python installed (python --version)
- [ ] Flask installed (pip install flask)
- [ ] Backend folder accessible
- [ ] Ports 5000 free (not in use)

**Once you see real AQI data on the dashboard - YOU'RE DONE!** 🎉

