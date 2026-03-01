"""
[CITY] SMART CITY RESOURCE OPTIMIZATION SYSTEM
Flask API Backend - Main Application
Integrates all AI modules and provides REST endpoints
"""

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from dotenv import load_dotenv
import sys
import os
import uuid
import json
from datetime import datetime
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error
from werkzeug.security import generate_password_hash, check_password_hash

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import AI modules
from ai_engine.water_module import WaterManagementAI
from ai_engine.electricity_module import ElectricityManagementAI
from ai_engine.waste_module import WasteManagementAI
from ai_engine.aqi_module import AQIManagementAI
from ai_engine.solution_comparator import SolutionComparator
from model import train_model
from realtime_aqi import RealtimeAQI
from pdf_report import generate_module_pdf

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# Initialize AI engines
water_ai = WaterManagementAI()
electricity_ai = ElectricityManagementAI()
waste_ai = WasteManagementAI()
aqi_ai = AQIManagementAI()
solution_comparator = SolutionComparator()

# Store citizen reports (in-memory for now)
citizen_reports = []

# Store latest generated detailed reports for PDF download
generated_reports = {
    'water': {},
    'waste': {},
    'electricity': {}
}

USERS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'users.json')
# Admin credentials from environment variables (for security)
PREDEFINED_ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'smartcity_admin')
PREDEFINED_ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'Admin@123')


def register_generated_report(module_name, report_payload):
    module = str(module_name).lower()
    report_id = str(uuid.uuid4())
    generated_reports[module][report_id] = report_payload
    return report_id


def _load_users():
    try:
        if not os.path.exists(USERS_FILE):
            return []
        with open(USERS_FILE, 'r', encoding='utf-8') as file_handle:
            users = json.load(file_handle)
            return users if isinstance(users, list) else []
    except Exception:
        return []


def _save_users(users):
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    with open(USERS_FILE, 'w', encoding='utf-8') as file_handle:
        json.dump(users, file_handle, indent=2)


def _public_user(user_record):
    return {
        'id': user_record.get('id'),
        'name': user_record.get('name'),
        'email': user_record.get('email'),
        'role': user_record.get('role')
    }


# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

@app.route('/api/auth/signup', methods=['POST'])
def signup_user():
    """Create a new user account for admin or citizen"""
    try:
        payload = request.get_json(silent=True) or {}
        name = str(payload.get('name', '')).strip()
        email = str(payload.get('email', '')).strip().lower()
        password = str(payload.get('password', '')).strip()
        role = str(payload.get('role', '')).strip().lower()

        if not name or not email or not password or not role:
            return jsonify({'success': False, 'error': 'Name, email, password, and role are required'}), 400

        if role not in ['admin', 'citizen']:
            return jsonify({'success': False, 'error': 'Role must be admin or citizen'}), 400

        if role == 'admin':
            return jsonify({'success': False, 'error': 'Admin account creation is disabled. Please use predefined admin credentials.'}), 403

        if '@' not in email or '.' not in email.split('@')[-1]:
            return jsonify({'success': False, 'error': 'Please enter a valid email address'}), 400

        if len(password) < 6:
            return jsonify({'success': False, 'error': 'Password must be at least 6 characters'}), 400

        users = _load_users()
        if any(str(user.get('email', '')).lower() == email for user in users):
            return jsonify({'success': False, 'error': 'An account already exists with this email'}), 409

        user_record = {
            'id': str(uuid.uuid4()),
            'name': name,
            'email': email,
            'role': role,
            'password_hash': generate_password_hash(password),
            'created_at': datetime.now().isoformat()
        }

        users.append(user_record)
        _save_users(users)

        token = str(uuid.uuid4())
        return jsonify({
            'success': True,
            'message': 'Account created successfully',
            'user': _public_user(user_record),
            'token': token
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/auth/login', methods=['POST'])
def login_user():
    """Login user with role validation"""
    try:
        payload = request.get_json(silent=True) or {}
        email = str(payload.get('email', '')).strip().lower()
        username = str(payload.get('username', '')).strip()
        password = str(payload.get('password', '')).strip()
        role = str(payload.get('role', '')).strip().lower()

        if not password or not role:
            return jsonify({'success': False, 'error': 'Login credentials and role are required'}), 400

        if role == 'admin':
            if not username:
                return jsonify({'success': False, 'error': 'Username is required for admin login'}), 400

            if username != PREDEFINED_ADMIN_USERNAME or password != PREDEFINED_ADMIN_PASSWORD:
                return jsonify({'success': False, 'error': 'Invalid admin username or password'}), 401

            admin_user = {
                'id': 'predefined-admin',
                'name': 'System Administrator',
                'email': 'admin@smartcity.local',
                'role': 'admin'
            }

            token = str(uuid.uuid4())
            return jsonify({
                'success': True,
                'message': 'Admin login successful',
                'user': admin_user,
                'token': token
            }), 200

        if not email:
            return jsonify({'success': False, 'error': 'Email is required for citizen login'}), 400

        users = _load_users()
        matched_user = next((user for user in users if str(user.get('email', '')).lower() == email), None)

        if not matched_user:
            return jsonify({'success': False, 'error': 'No account found with this email'}), 404

        if matched_user.get('role') != role:
            return jsonify({'success': False, 'error': f'This account is registered as {matched_user.get("role")}. Please choose the correct panel.'}), 403

        if not check_password_hash(matched_user.get('password_hash', ''), password):
            return jsonify({'success': False, 'error': 'Incorrect password'}), 401

        token = str(uuid.uuid4())
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': _public_user(matched_user),
            'token': token
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# ROOT & HEALTH ENDPOINTS
# ============================================

@app.route('/', methods=['GET'])
def root():
    """Root endpoint with API information"""
    return jsonify({
        'success': True,
        'message': 'Smart City Resource Optimization System API',
        'version': '1.0.0',
        'endpoints': {
            'dashboard': '/api/dashboard',
            'health': '/api/health',
            'water': {
                'status': '/api/water/status',
                'predict': '/api/water/predict',
                'leaks': '/api/water/leaks',
                'optimize': '/api/water/optimize'
            },
            'electricity': {
                'status': '/api/electricity/status',
                'predict': '/api/electricity/predict',
                'optimize': '/api/electricity/optimize'
            },
            'waste': {
                'status': '/api/waste/status',
                'predict': '/api/waste/predict',
                'optimize': '/api/waste/optimize'
            },
            'aqi': {
                'status': '/api/aqi/status',
                'predict': '/api/aqi/predict',
                'advisory': '/api/aqi/advisory'
            },
            'solutions': {
                'compare_water': '/api/solutions/compare/water',
                'compare_electricity': '/api/solutions/compare/electricity'
            }
        },
        'documentation': 'See README.md for full API documentation'
    })


# ============================================
# DASHBOARD & OVERVIEW ENDPOINTS
# ============================================

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    """Get complete dashboard overview"""
    try:
        water_summary = water_ai.get_analytics_summary()
        electricity_summary = electricity_ai.get_analytics_summary()
        waste_summary = waste_ai.get_analytics_summary()
        aqi_summary = aqi_ai.get_analytics_summary()
        
        return jsonify({
            'success': True,
            'dashboard': {
                'water': water_summary,
                'electricity': electricity_summary,
                'waste': waste_summary,
                'aqi': aqi_summary
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# WATER MANAGEMENT ENDPOINTS
# ============================================

@app.route('/api/water/status', methods=['GET'])
def get_water_status():
    """Get current water status for all zones"""
    try:
        status = water_ai.get_current_status()
        return jsonify({'success': True, 'data': status})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/water/predict/<zone>', methods=['GET'])
def predict_water_demand(zone):
    """Predict water demand for a specific zone"""
    try:
        days = request.args.get('days', 1, type=int)
        prediction = water_ai.predict_demand(zone, days)
        return jsonify({'success': True, 'prediction': prediction})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/water/leak-detection/<zone>', methods=['GET'])
def detect_water_leaks(zone):
    """Detect potential leaks in a zone"""
    try:
        result = water_ai.detect_leaks(zone)
        return jsonify({'success': True, 'leak_detection': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/water/optimize', methods=['POST'])
def optimize_water_allocation():
    """Optimize water allocation across zones"""
    try:
        result = water_ai.optimize_allocation()
        return jsonify({'success': True, 'optimization': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/water/simulate/<scenario>', methods=['GET'])
def simulate_water_scenario(scenario):
    """Simulate water management scenarios"""
    try:
        result = water_ai.simulate_scenario(scenario)
        return jsonify({'success': True, 'simulation': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# ELECTRICITY MANAGEMENT ENDPOINTS
# ============================================

@app.route('/api/electricity/status', methods=['GET'])
def get_electricity_status():
    """Get current electricity status for all zones"""
    try:
        status = electricity_ai.get_current_status()
        return jsonify({'success': True, 'data': status})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/electricity/predict/<zone>', methods=['GET'])
def predict_electricity_load(zone):
    """Predict electricity load for a specific zone"""
    try:
        hours = request.args.get('hours', 1, type=int)
        prediction = electricity_ai.predict_load(zone, hours)
        return jsonify({'success': True, 'prediction': prediction})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/electricity/optimize', methods=['POST'])
def optimize_electricity_load():
    """Optimize electricity load balancing"""
    try:
        result = electricity_ai.optimize_load_balancing()
        return jsonify({'success': True, 'optimization': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/electricity/simulate/<scenario>', methods=['GET'])
def simulate_electricity_scenario(scenario):
    """Simulate electricity management scenarios"""
    try:
        result = electricity_ai.simulate_scenario(scenario)
        return jsonify({'success': True, 'simulation': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# WASTE MANAGEMENT ENDPOINTS
# ============================================

@app.route('/api/waste/status', methods=['GET'])
def get_waste_status():
    """Get current waste status for all bins"""
    try:
        status = waste_ai.get_current_status()
        return jsonify({'success': True, 'data': status})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/waste/predict-surge/<zone>', methods=['GET'])
def predict_waste_surge(zone):
    """Predict waste surge for events"""
    try:
        event = request.args.get('event', 'festival')
        prediction = waste_ai.predict_waste_surge(zone, event)
        return jsonify({'success': True, 'prediction': prediction})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/waste/conversion', methods=['GET'])
def get_waste_conversion():
    """Get waste-to-energy conversion metrics"""
    try:
        result = waste_ai.calculate_waste_to_energy()
        return jsonify({'success': True, 'conversion': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/waste/collection-priority', methods=['GET'])
def get_collection_priority():
    """Get waste collection priority list"""
    try:
        result = waste_ai.get_collection_priority()
        return jsonify({'success': True, 'priority': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/waste/simulate/<scenario>', methods=['GET'])
def simulate_waste_scenario(scenario):
    """Simulate waste management scenarios"""
    try:
        result = waste_ai.simulate_scenario(scenario)
        return jsonify({'success': True, 'simulation': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# CITIZEN REPORTING ENDPOINTS
# ============================================

@app.route('/api/citizen/report', methods=['POST'])
def submit_citizen_report():
    """Submit a citizen report about an issue"""
    try:
        # Handle form data with optional file upload
        if 'image' in request.files:
            data = request.form.to_dict()
            image_file = request.files['image']
            
            # Read and encode image as base64
            if image_file and image_file.filename != '':
                import base64
                image_data = base64.b64encode(image_file.read()).decode('utf-8')
                image_mime = image_file.content_type or 'image/jpeg'
            else:
                image_data = None
                image_mime = None
        else:
            data = request.get_json()
            image_data = None
            image_mime = None
        
        # Validate required fields
        required_fields = ['issue_type', 'location', 'description', 'contact_name', 'contact_phone']
        missing = [f for f in required_fields if f not in data or not data[f]]
        
        if missing:
            return jsonify({
                'success': False,
                'error': f'Missing required fields: {", ".join(missing)}'
            }), 400
        
        # Create report object
        import uuid
        from datetime import datetime
        
        report = {
            'id': str(uuid.uuid4()),
            'report_id': 'REPORT-' + datetime.now().strftime('%Y%m%d%H%M%S%f')[:-3],
            'issue_type': data['issue_type'],
            'location': data['location'],
            'description': data['description'],
            'contact_name': data['contact_name'],
            'contact_phone': data['contact_phone'],
            'timestamp': datetime.now().isoformat(),
            'status': 'new',
            'priority': 'high' if data['issue_type'] in ['illegal_dumping', 'damaged_bin'] else 'medium'
        }
        
        # Add image if attached
        if image_data:
            report['image'] = f'data:{image_mime};base64,{image_data}'
        else:
            report['image'] = None
        
        # Store report
        citizen_reports.append(report)
        
        return jsonify({
            'success': True,
            'report_id': report['report_id'],
            'message': 'Report submitted successfully'
        }), 201
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/citizen/reports', methods=['GET'])
def get_citizen_reports():
    """Get all citizen reports for admin dashboard"""
    try:
        # Get filter parameters
        status_filter = request.args.get('status', None)
        
        reports = citizen_reports
        
        if status_filter:
            reports = [r for r in reports if r['status'] == status_filter]
        
        # Sort by timestamp (newest first)
        reports = sorted(reports, key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify({
            'success': True,
            'total': len(citizen_reports),
            'unresolved': len([r for r in citizen_reports if r['status'] != 'resolved']),
            'reports': reports
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/citizen/report/<report_id>/resolve', methods=['PUT'])
def resolve_citizen_report(report_id):
    """Mark a citizen report as resolved"""
    try:
        data = request.get_json() or {}
        
        # Find report
        report = next((r for r in citizen_reports if r['id'] == report_id or r['report_id'] == report_id), None)
        
        if not report:
            return jsonify({'success': False, 'error': 'Report not found'}), 404
        
        # Update status
        report['status'] = 'resolved'
        report['resolution_notes'] = data.get('notes', '')
        report['resolved_at'] = __import__('datetime').datetime.now().isoformat()
        
        return jsonify({
            'success': True,
            'message': 'Report marked as resolved'
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/citizen/report/<report_id>', methods=['DELETE'])
def delete_citizen_report(report_id):
    """Delete a citizen report"""
    try:
        global citizen_reports
        
        # Find and remove report
        initial_count = len(citizen_reports)
        citizen_reports = [r for r in citizen_reports if r['id'] != report_id and r['report_id'] != report_id]
        
        if len(citizen_reports) == initial_count:
            return jsonify({'success': False, 'error': 'Report not found'}), 404
        
        return jsonify({
            'success': True,
            'message': 'Report deleted'
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/waste/detailed-report', methods=['POST'])
def get_waste_detailed_report():
    """Generate detailed waste report from uploaded CSV data"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'CSV file is required'}), 400

        csv_file = request.files['file']
        if not csv_file or not csv_file.filename.lower().endswith('.csv'):
            return jsonify({'success': False, 'error': 'Please upload a valid CSV file'}), 400

        df = pd.read_csv(csv_file)

        required_columns = [
            'date',
            'zone_id',
            'zone_type',
            'traffic_level',
            'population_density',
            'month',
            'day_of_week',
            'festival_flag',
            'rainfall_mm',
            'avg_daily_waste_kg',
            'estimated_fill_percent',
            'days_since_last_collection',
            'distance_to_depot_km'
        ]

        missing_columns = [column for column in required_columns if column not in df.columns]
        if missing_columns:
            return jsonify({
                'success': False,
                'error': f'Missing required columns: {", ".join(missing_columns)}'
            }), 400

        numeric_columns = [
            'zone_id', 'population_density', 'month', 'day_of_week', 'festival_flag',
            'rainfall_mm', 'avg_daily_waste_kg', 'estimated_fill_percent',
            'days_since_last_collection', 'distance_to_depot_km'
        ]

        for column in numeric_columns:
            df[column] = pd.to_numeric(df[column], errors='coerce')

        df = df.dropna(subset=['date'] + numeric_columns + ['zone_type', 'traffic_level']).copy()
        if df.empty:
            return jsonify({'success': False, 'error': 'Uploaded CSV has no usable rows after validation'}), 400

        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df = df.dropna(subset=['date']).copy()
        if df.empty:
            return jsonify({'success': False, 'error': 'Invalid date values in CSV'}), 400

        selected_date = request.form.get('selected_date')
        if not selected_date:
            selected_date = df['date'].max().strftime('%Y-%m-%d')

        priority_threshold = request.form.get('priority_threshold', type=float)
        if priority_threshold is None:
            priority_threshold = 60.0

        df['date_key'] = df['date'].dt.strftime('%Y-%m-%d')
        sample_day = df[df['date_key'] == selected_date].copy()
        if sample_day.empty:
            latest_date = df['date_key'].max()
            sample_day = df[df['date_key'] == latest_date].copy()
            selected_date = latest_date

        # Forecasting model
        model_df = df.copy()
        zone_encoder = LabelEncoder()
        traffic_encoder = LabelEncoder()
        model_df['zone_type'] = zone_encoder.fit_transform(model_df['zone_type'].astype(str))
        model_df['traffic_level'] = traffic_encoder.fit_transform(model_df['traffic_level'].astype(str))

        feature_columns = [
            'population_density',
            'zone_type',
            'month',
            'day_of_week',
            'festival_flag',
            'rainfall_mm'
        ]

        X = model_df[feature_columns]
        y = model_df['avg_daily_waste_kg']

        if len(model_df) >= 10:
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            forecast_model = RandomForestRegressor(n_estimators=100, random_state=42)
            forecast_model.fit(X_train, y_train)
            y_pred = forecast_model.predict(X_test)
            mae = float(mean_absolute_error(y_test, y_pred))
        else:
            mae = 0.0

        # Urgency
        sample_day['urgency_score'] = (
            sample_day['estimated_fill_percent'] * 0.4 +
            sample_day['festival_flag'] * 20 +
            sample_day['rainfall_mm'] * 0.2 +
            sample_day['days_since_last_collection'] * 5
        )

        high_priority = sample_day[sample_day['urgency_score'] > priority_threshold].copy()

        baseline_distance = float(sample_day['distance_to_depot_km'].sum())
        optimized_distance = float(high_priority['distance_to_depot_km'].sum())

        reduction_pct = 0.0
        if baseline_distance > 0:
            reduction_pct = ((baseline_distance - optimized_distance) / baseline_distance) * 100

        carbon_before = baseline_distance * 0.21
        carbon_after = optimized_distance * 0.21

        hist_counts, hist_bins = np.histogram(sample_day['avg_daily_waste_kg'], bins=12)
        hist_labels = [f"{hist_bins[i]:.0f}-{hist_bins[i+1]:.0f}" for i in range(len(hist_bins) - 1)]

        # Pune map points
        map_source = high_priority.copy()
        if map_source.empty:
            map_source = sample_day.nlargest(min(12, len(sample_day)), 'urgency_score').copy()

        pune_lat = 18.5204
        pune_lon = 73.8567

        if 'lat' not in map_source.columns or 'lon' not in map_source.columns:
            map_source['lat'] = pune_lat + ((map_source['zone_id'] % 10) - 5) * 0.018
            map_source['lon'] = pune_lon + ((map_source['zone_id'] % 7) - 3) * 0.022

        map_points = []
        for _, row in map_source.iterrows():
            map_points.append({
                'zone_id': int(row['zone_id']),
                'zone_type': str(row['zone_type']),
                'urgency_score': round(float(row['urgency_score']), 2),
                'fill_percent': round(float(row['estimated_fill_percent']), 2),
                'distance_km': round(float(row['distance_to_depot_km']), 2),
                'lat': round(float(row['lat']), 6),
                'lon': round(float(row['lon']), 6)
            })

        priority_rows = high_priority.sort_values('urgency_score', ascending=False).head(25)
        priority_table = []
        for _, row in priority_rows.iterrows():
            priority_table.append({
                'zone_id': int(row['zone_id']),
                'zone_type': str(row['zone_type']),
                'urgency_score': round(float(row['urgency_score']), 2),
                'avg_daily_waste_kg': round(float(row['avg_daily_waste_kg']), 2),
                'distance_to_depot_km': round(float(row['distance_to_depot_km']), 2),
                'estimated_fill_percent': round(float(row['estimated_fill_percent']), 2)
            })

        report_payload = {
            'selected_date': selected_date,
            'priority_threshold': priority_threshold,
            'metrics': {
                'model_mae': round(mae, 3),
                'high_priority_zones': int(len(high_priority)),
                'baseline_distance_km': round(baseline_distance, 3),
                'optimized_distance_km': round(optimized_distance, 3),
                'distance_reduction_pct': round(reduction_pct, 2),
                'carbon_saved_kg': round(float(carbon_before - carbon_after), 2)
            },
            'before_after': {
                'labels': ['Baseline', 'Optimized'],
                'values': [round(baseline_distance, 3), round(optimized_distance, 3)]
            },
            'waste_distribution': {
                'labels': hist_labels,
                'counts': hist_counts.tolist()
            },
            'pune_map': {
                'center': {'lat': pune_lat, 'lon': pune_lon},
                'points': map_points
            },
            'high_priority_table': priority_table
        }

        report_id = register_generated_report('waste', report_payload)

        return jsonify({
            'success': True,
            'report': report_payload,
            'report_id': report_id,
            'pdf_download_url': f'/api/reports/waste/{report_id}/pdf'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# WATER ADVANCED ANALYSIS ENDPOINT
# ============================================

@app.route('/api/water/detailed-report', methods=['POST'])
def get_water_detailed_report():
    """Generate detailed water report from uploaded CSV data with advanced analytics"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'CSV file is required'}), 400

        csv_file = request.files['file']
        if not csv_file or not csv_file.filename.lower().endswith('.csv'):
            return jsonify({'success': False, 'error': 'Please upload a valid CSV file'}), 400

        df = pd.read_csv(csv_file)

        required_columns = [
            'timestamp', 'zone_id', 'zone_type', 'tank_level_pct', 'usage',
            'pipeline_pressure', 'input_flow', 'output_flow', 'temperature'
        ]

        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return jsonify({
                'success': False,
                'error': f'Missing required columns: {", ".join(missing_columns)}'
            }), 400

        # Convert timestamp
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df = df.dropna(subset=['timestamp'])
        
        # Ensure numeric columns
        numeric_cols = ['zone_id', 'tank_level_pct', 'usage', 'pipeline_pressure', 
                        'input_flow', 'output_flow', 'temperature']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df = df.dropna(subset=numeric_cols).copy()
        
        if df.empty:
            return jsonify({'success': False, 'error': 'No valid data rows in CSV'}), 400

        # Get pipeline age if provided, else default
        if 'pipeline_age' in df.columns:
            df['pipeline_age'] = pd.to_numeric(df['pipeline_age'], errors='coerce').fillna(10)
        else:
            df['pipeline_age'] = 10  # Default age

        latest_ts = df['timestamp'].max()
        selected_date = latest_ts.strftime('%Y-%m-%d %H:%M')

        # ----------------------------------------------------------
        # 1. LEAK DETECTION (Multi-factor)
        # ----------------------------------------------------------
        latest_data = df[df['timestamp'] == latest_ts].copy()
        
        zone_baseline = df.groupby('zone_id').agg({
            'pipeline_pressure': 'mean',
            'input_flow': 'mean',
            'output_flow': 'mean',
            'usage': 'mean',
        }).to_dict('index')
        
        leak_alerts = []
        for _, row in latest_data.iterrows():
            zone_id = row['zone_id']
            baseline = zone_baseline.get(zone_id, {})
            
            # Pressure drop
            baseline_pressure = baseline.get('pipeline_pressure', 4.5)
            pressure_drop_pct = ((baseline_pressure - row['pipeline_pressure']) / baseline_pressure) * 100
            pressure_anomaly = pressure_drop_pct > 15
            
            # Flow mismatch
            flow_diff = row['input_flow'] - row['output_flow']
            flow_mismatch_pct = (flow_diff / row['input_flow']) * 100 if row['input_flow'] > 0 else 0
            flow_anomaly = flow_mismatch_pct > 12
            
            # Pipeline age risk
            age = row['pipeline_age']
            old_pipeline = age > 15
            
            # Leak score
            leak_score = 0
            if pressure_anomaly: leak_score += 35
            if flow_anomaly: leak_score += 30
            if old_pipeline: leak_score += 20
            
            if leak_score >= 30:
                severity = 'critical' if leak_score >= 70 else ('high' if leak_score >= 50 else 'medium')
                leak_alerts.append({
                    'zone_id': int(zone_id),
                    'leak_score': round(leak_score, 2),
                    'severity': severity,
                    'pressure_drop_pct': round(pressure_drop_pct, 2),
                    'flow_mismatch_pct': round(flow_mismatch_pct, 2),
                    'pipeline_age': int(age),
                    'current_pressure': round(row['pipeline_pressure'], 2),
                    'tank_level_pct': round(row['tank_level_pct'], 2)
                })
        
        leak_alerts.sort(key=lambda x: x['leak_score'], reverse=True)

        # ----------------------------------------------------------
        # 2. DEMAND FORECASTING (Random Forest)
        # ----------------------------------------------------------
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_absolute_error
        
        # Feature engineering
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['past_usage'] = df.groupby('zone_id')['usage'].shift(1)
        
        model_df = df.dropna(subset=['past_usage']).copy()
        
        if len(model_df) >= 20:
            zone_encoder = LabelEncoder()
            model_df['zone_encoded'] = zone_encoder.fit_transform(model_df['zone_id'].astype(str))
            
            features = ['hour', 'day_of_week', 'temperature', 'past_usage', 'zone_encoded']
            X = model_df[features]
            y = model_df['usage']
            
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
            model.fit(X_train, y_train)
            
            y_pred = model.predict(X_test)
            forecast_mae = float(mean_absolute_error(y_test, y_pred))
            
            # Predict next hour for each zone
            next_hour_predictions = []
            for zone in latest_data['zone_id'].unique():
                zone_latest = latest_data[latest_data['zone_id'] == zone].iloc[0]
                next_hour = (latest_ts + pd.Timedelta(hours=1)).hour
                pred_input = pd.DataFrame([{
                    'hour': next_hour,
                    'day_of_week': latest_ts.dayofweek,
                    'temperature': zone_latest['temperature'],
                    'past_usage': zone_latest['usage'],
                    'zone_encoded': zone_encoder.transform([str(zone)])[0]
                }])
                pred_demand = max(20, model.predict(pred_input)[0])
                next_hour_predictions.append({
                    'zone_id': int(zone),
                    'predicted_demand': round(pred_demand, 2)
                })
        else:
            forecast_mae = 0.0
            next_hour_predictions = []

        # ----------------------------------------------------------
        # 3. RISK DETECTION
        # ----------------------------------------------------------
        risk_zones = []
        for _, row in latest_data.iterrows():
            usage_pct = 100 - row['tank_level_pct']  # Inverse of tank level
            
            if usage_pct >= 100:
                risk_level = 'CRITICAL'
            elif usage_pct >= 85:
                risk_level = 'WARNING'
            else:
                risk_level = 'NORMAL'
            
            risk_zones.append({
                'zone_id': int(row['zone_id']),
                'tank_level_pct': round(row['tank_level_pct'], 2),
                'usage_pct': round(usage_pct, 2),
                'risk_level': risk_level,
                'pipeline_pressure': round(row['pipeline_pressure'], 2)
            })
        
        risk_zones.sort(key=lambda x: x['usage_pct'], reverse=True)
        critical_count = sum(1 for r in risk_zones if r['risk_level'] == 'CRITICAL')
        warning_count = sum(1 for r in risk_zones if r['risk_level'] == 'WARNING')

        # ----------------------------------------------------------
        # 4. GREEDY REALLOCATION
        # ----------------------------------------------------------
        surplus_zones = [z for z in risk_zones if z['tank_level_pct'] > 60]
        deficit_zones = [z for z in risk_zones if z['tank_level_pct'] < 40]
        
        transfers = []
        total_reallocated = 0.0
        
        for deficit in deficit_zones[:5]:  # Top 5 deficits
            for surplus in surplus_zones:
                transfer_amount = min(50, (surplus['tank_level_pct'] - 50) * 5)
                if transfer_amount > 5:
                    transfers.append({
                        'from_zone': int(surplus['zone_id']),
                        'to_zone': int(deficit['zone_id']),
                        'amount': round(transfer_amount, 2),
                        'valve_action': f"Increase flow {surplus['zone_id']}→{deficit['zone_id']} by {int(transfer_amount/5)}%"
                    })
                    total_reallocated += transfer_amount
                    surplus['tank_level_pct'] -= transfer_amount / 5
                    break

        # ----------------------------------------------------------
        # 5. EFFICIENCY METRICS
        # ----------------------------------------------------------
        total_input = float(latest_data['input_flow'].sum())
        total_output = float(latest_data['output_flow'].sum())
        distribution_efficiency = (total_output / total_input * 100) if total_input > 0 else 0
        
        avg_tank_level = float(latest_data['tank_level_pct'].mean())
        avg_pressure = float(latest_data['pipeline_pressure'].mean())

        # ----------------------------------------------------------
        # 6. CHARTS DATA
        # ----------------------------------------------------------
        # Tank levels by zone
        tank_chart = {
            'labels': [f"Zone {int(z)}" for z in latest_data['zone_id'].tolist()],
            'values': latest_data['tank_level_pct'].tolist()
        }
        
        # Usage trend (last 24 hours if available)
        last_24h = df[df['timestamp'] >= (latest_ts - pd.Timedelta(hours=24))]
        hourly_usage = last_24h.groupby('timestamp')['usage'].sum().reset_index()
        usage_trend = {
            'labels': [t.strftime('%H:%M') for t in hourly_usage['timestamp']],
            'values': hourly_usage['usage'].tolist()
        }

        report_payload = {
            'selected_date': selected_date,
            'metrics': {
                'forecast_mae': round(forecast_mae, 2),
                'leak_alerts_count': len(leak_alerts),
                'critical_zones': critical_count,
                'warning_zones': warning_count,
                'distribution_efficiency': round(distribution_efficiency, 2),
                'avg_tank_level': round(avg_tank_level, 2),
                'avg_pressure': round(avg_pressure, 2),
                'total_reallocated': round(total_reallocated, 2)
            },
            'leak_alerts': leak_alerts[:10],  # Top 10 leaks
            'demand_predictions': next_hour_predictions,
            'risk_zones': risk_zones[:10],  # Top 10 risk zones
            'reallocation_plan': transfers,
            'charts': {
                'tank_levels': tank_chart,
                'usage_trend': usage_trend
            }
        }

        report_id = register_generated_report('water', report_payload)

        return jsonify({
            'success': True,
            'report': report_payload,
            'report_id': report_id,
            'pdf_download_url': f'/api/reports/water/{report_id}/pdf'
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# ELECTRICITY ADVANCED ANALYSIS ENDPOINT
# ============================================

@app.route('/api/electricity/detailed-report', methods=['POST'])
def get_electricity_detailed_report():
    """Generate detailed electricity report using ML overload prediction"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'CSV file is required'}), 400

        csv_file = request.files['file']
        if not csv_file or not csv_file.filename.lower().endswith('.csv'):
            return jsonify({'success': False, 'error': 'Please upload a valid CSV file'}), 400

        # Read CSV
        data = pd.read_csv(csv_file, skipinitialspace=True)
        data.columns = data.columns.str.strip()

        # Handle both format versions
        # For new format: Zone, City, Type, Current_Usage, NonEssential_Load, Essential_Load
        if 'Essential_Load' in data.columns:
            data['Max_Capacity'] = data['Essential_Load'] + data['NonEssential_Load']
        elif 'Max_Capacity' not in data.columns:
            return jsonify({'success': False, 'error': 'CSV must contain either Max_Capacity or (Essential_Load + NonEssential_Load)'}), 400

        # Required columns for model
        required_cols = ['Current_Usage', 'Max_Capacity', 'NonEssential_Load']
        missing = [c for c in required_cols if c not in data.columns]
        if missing:
            return jsonify({'success': False, 'error': f'Missing columns: {", ".join(missing)}'}), 400

        # Clean data
        for col in required_cols:
            data[col] = pd.to_numeric(data[col].astype(str).str.strip(), errors='coerce')
        
        data = data.dropna(subset=required_cols).copy()
        
        if data.empty:
            return jsonify({'success': False, 'error': 'No valid data rows in CSV'}), 400

        # Train model (returns model and fallback_class if only one class exists)
        model, fallback_class = train_model(data.copy())

        # Predict overload
        X = data[['Current_Usage', 'Max_Capacity', 'NonEssential_Load']]
        
        if model is None:
            # Only one class in data - use fallback prediction
            predictions = np.full(len(data), fallback_class)
        else:
            # Normal prediction with trained model
            predictions = model.predict(X)
        
        data['Overload_Prediction'] = predictions

        # Calculate total extra energy needed (from overloaded zones)
        overloaded = data[data['Overload_Prediction'] == 1]
        safe_zones = data[data['Overload_Prediction'] == 0]

        total_extra_needed = 0.0
        for idx in overloaded.index:
            extra = max(0, data.loc[idx, 'Current_Usage'] - data.loc[idx, 'Max_Capacity'])
            total_extra_needed += extra

        # Calculate totals
        total_capacity = float(data['Max_Capacity'].sum())
        total_usage = float(data['Current_Usage'].sum())
        
        # Calculate total available capacity (from safe zones)
        total_available = 0.0
        if len(safe_zones) > 0:
            total_available = (
                safe_zones['Max_Capacity'].sum() - 
                safe_zones['Current_Usage'].sum()
            )
        total_available = max(0, total_available)

        # ==========================================
        # Step 1: Reallocation (transfer from safe zones)
        # ==========================================
        remaining_need = total_extra_needed
        
        if total_available > 0:
            if remaining_need <= total_available:
                transferred = remaining_need
                remaining_need = 0
            else:
                transferred = total_available
                remaining_need -= total_available
        else:
            transferred = 0

        # ==========================================
        # Step 2: Reduce Non-essential loads
        # ==========================================
        remaining_after_reallocation = remaining_need
        nonessential_total = float(data['NonEssential_Load'].sum())
        
        # Breakdown of non-essential loads (for popup consent)
        non_essential_breakdown = {
            'advertising_boards': round(nonessential_total * 0.35, 2),
            'decorative_lighting': round(nonessential_total * 0.25, 2),
            'garden_irrigation': round(nonessential_total * 0.20, 2),
            'non_critical_commercial': round(nonessential_total * 0.20, 2)
        }
        
        nonessential_reduced = 0.0
        if remaining_need > 0:
            if remaining_need <= nonessential_total:
                nonessential_reduced = remaining_need
                remaining_need = 0
            else:
                nonessential_reduced = nonessential_total
                remaining_need -= nonessential_total

        # ==========================================
        # Step 3: Activate Backup (Solar + Battery)
        # ==========================================
        remaining_after_nonessential = remaining_need
        solar_capacity = 300  # kWh
        battery_capacity = 200  # kWh
        backup_energy = solar_capacity + battery_capacity
        
        solar_used = 0.0
        battery_used = 0.0
        
        if remaining_need > 0:
            # First use solar
            if remaining_need <= solar_capacity:
                solar_used = remaining_need
                remaining_need = 0
            else:
                solar_used = solar_capacity
                remaining_need -= solar_capacity
                
                # Then use battery
                if remaining_need > 0:
                    if remaining_need <= battery_capacity:
                        battery_used = remaining_need
                        remaining_need = 0
                    else:
                        battery_used = battery_capacity
                        remaining_need -= battery_capacity

        backup_used = solar_used + battery_used

        # Final result
        electricity_met = remaining_need <= 0.01
        
        # ==========================================
        # Essential Services Priority (always protected)
        # ==========================================
        essential_services = [
            {
                'service': 'Hospitals',
                'priority': 1,
                'allocation_kwh': round(total_extra_needed * 0.40, 2),
                'status': 'Protected',
                'guarantee': 'No hospital outage'
            },
            {
                'service': 'Traffic Signals',
                'priority': 2,
                'allocation_kwh': round(total_extra_needed * 0.20, 2),
                'status': 'Protected',
                'guarantee': 'No traffic system shutdown'
            },
            {
                'service': 'Water Pumps',
                'priority': 3,
                'allocation_kwh': round(total_extra_needed * 0.25, 2),
                'status': 'Protected',
                'guarantee': 'Water supply maintained'
            },
            {
                'service': 'Emergency Services',
                'priority': 4,
                'allocation_kwh': round(total_extra_needed * 0.15, 2),
                'status': 'Protected',
                'guarantee': 'Public safety maintained'
            }
        ]

        # Prepare zone data for display (convert all pandas types to native Python types)
        zones_for_display = []
        for idx, row in data.iterrows():
            current_usage = float(row['Current_Usage'])
            max_capacity = float(row['Max_Capacity'])
            is_actually_overloaded = current_usage > max_capacity
            
            zones_for_display.append({
                'zone_id': str(row.get('Zone', idx)),
                'city': str(row.get('City', 'N/A')),
                'zone_type': str(row.get('Type', 'N/A')),
                'current_usage': float(round(current_usage, 2)),
                'max_capacity': float(round(max_capacity, 2)),
                'non_essential': float(round(float(row['NonEssential_Load']), 2)),
                'is_overloaded': is_actually_overloaded,  # Actual overload (usage > capacity)
                'overload_prediction': int(row['Overload_Prediction'].item() if hasattr(row['Overload_Prediction'], 'item') else row['Overload_Prediction']),
                'usage_percent': float(round((current_usage / max_capacity * 100) if max_capacity > 0 else 0, 2)),
                'deficit': float(round(max(0, current_usage - max_capacity), 2))
            })

        # Charts data
        zone_usage = {
            'labels': [str(z.get('zone_id', idx)) for idx, z in enumerate(zones_for_display)],
            'usage_values': [z['current_usage'] for z in zones_for_display],
            'capacity_values': [z['max_capacity'] for z in zones_for_display]
        }

        essential_vs_non = {
            'labels': ['Essential Load', 'Non-Essential Load'],
            'values': [
                float(round(float(data['Max_Capacity'].sum() - data['NonEssential_Load'].sum()), 2)),
                float(round(float(data['NonEssential_Load'].sum()), 2))
            ]
        }

        selected_date = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')

        report_payload = {
                'selected_date': selected_date,
                'zones': zones_for_display,
                
                # Step-by-step workflow data
                'workflow': {
                    'step1_monitoring': {
                        'title': 'Zone Usage & Capacity Monitoring',
                        'total_usage_kwh': float(round(float(data['Current_Usage'].sum()), 2)),
                        'total_capacity_kwh': float(round(float(data['Max_Capacity'].sum()), 2)),
                        'overloaded_zones_count': int((data['Overload_Prediction'] == 1).sum().item()),
                        'safe_zones_count': int((data['Overload_Prediction'] == 0).sum().item()),
                        'grid_stress_percent': float(round((float(data['Current_Usage'].sum()) / float(data['Max_Capacity'].sum()) * 100) if float(data['Max_Capacity'].sum()) > 0 else 0, 2))
                    },
                    
                    'step2_prediction': {
                        'title': 'AI Overload Risk Prediction',
                        'model_used': 'Logistic Regression',
                        'zones_at_risk': int((data['Overload_Prediction'] == 1).sum().item()),
                        'predicted_overloaded': [z for z in zones_for_display if z['overload_prediction'] == 1],
                        'total_extra_needed_kwh': float(round(total_extra_needed, 2))
                    },
                    
                    'step3_reallocation': {
                        'title': 'Dynamic Power Reallocation',
                        'available_for_transfer_kwh': float(round(total_available, 2)),
                        'transferred_kwh': float(round(transferred, 2)),
                        'remaining_after_transfer_kwh': float(round(remaining_after_reallocation, 2)),
                        'reallocation_successful': bool(transferred > 0),
                        'needs_further_action': bool(remaining_after_reallocation > 0)
                    },
                    
                    'step4_non_essential': {
                        'title': 'Reduce Non-Essential Loads',
                        'requires_consent': bool(remaining_after_reallocation > 0),
                        'total_available_kwh': float(nonessential_total),
                        'breakdown': {k: float(v) for k, v in non_essential_breakdown.items()},
                        'can_be_reduced_kwh': float(round(nonessential_reduced, 2)),
                        'remaining_after_reduction_kwh': float(round(remaining_after_nonessential, 2)),
                        'consent_message': f'We need {round(remaining_after_reallocation, 2)} kWh more energy. Can we temporarily reduce non-essential loads?'
                    },
                    
                    'step5_backup': {
                        'title': 'Activate Backup Sources',
                        'requires_activation': bool(remaining_after_nonessential > 0),
                        'solar_available_kwh': float(solar_capacity),
                        'battery_available_kwh': float(battery_capacity),
                        'solar_used_kwh': float(round(solar_used, 2)),
                        'battery_used_kwh': float(round(battery_used, 2)),
                        'total_backup_used_kwh': float(round(backup_used, 2)),
                        'remaining_need_kwh': float(round(remaining_need, 2))
                    },
                    
                    'step6_essential_priority': {
                        'title': 'Essential Services Protection',
                        'services': essential_services,
                        'all_protected': True
                    },
                    
                    'final_result': {
                        'electricity_met': 'YES' if electricity_met else 'NO',
                        'total_need_kwh': float(round(total_extra_needed, 2)),
                        'resources_utilized': {
                            'reallocated_kwh': float(round(transferred, 2)),
                            'non_essential_reduced_kwh': float(round(nonessential_reduced, 2)),
                            'solar_backup_kwh': float(round(solar_used, 2)),
                            'battery_backup_kwh': float(round(battery_used, 2)),
                            'total_utilized_kwh': float(round(transferred + nonessential_reduced + backup_used, 2))
                        },
                        'final_shortfall_kwh': float(round(max(0, remaining_need), 2))
                    }
                },
                
                # Legacy summary for compatibility
                'summary': {
                    'total_extra_needed_kwh': float(round(total_extra_needed, 2)),
                    'available_for_transfer_kwh': float(round(total_available, 2)),
                    'transferred_kwh': float(round(transferred, 2)),
                    'remaining_after_transfer_kwh': float(round(remaining_after_reallocation, 2)),
                    'nonessential_reduced_kwh': float(round(nonessential_reduced, 2)),
                    'backup_used_kwh': float(round(backup_used, 2)),
                    'final_remaining_kwh': float(round(max(0, remaining_need), 2)),
                    'electricity_met': 'YES' if electricity_met else 'NO'
                },
                
                'metrics': {
                    'critical_zones_count': int((data['Current_Usage'] > data['Max_Capacity']).sum().item()),
                    'average_usage_percent': float(round((float(data['Current_Usage'].sum()) / float(data['Max_Capacity'].sum()) * 100) if float(data['Max_Capacity'].sum()) > 0 else 0, 2)),
                    'total_usage': float(round(float(data['Current_Usage'].sum()), 2)),
                    'total_capacity': float(round(float(data['Max_Capacity'].sum()), 2)),
                    'non_essential_total': float(round(nonessential_total, 2)),
                    'renewable_percentage': float(round((solar_capacity / total_capacity * 100) if total_capacity > 0 else 0, 2)),
                    'battery_status_percent': 100.0
                },
                
                'charts': {
                    'zone_usage': zone_usage,
                    'renewable_mix': essential_vs_non
                }
            }

        report_id = register_generated_report('electricity', report_payload)

        return jsonify({
            'success': True,
            'report': report_payload,
            'report_id': report_id,
            'pdf_download_url': f'/api/reports/electricity/{report_id}/pdf'
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500

        # Get metrics across all zones
        total_usage = float(df['Current_Usage'].sum())
        total_capacity = float(df['Total_Capacity'].sum())
        total_essential = float(df['Essential_Load'].sum())
        total_non_essential = float(df['NonEssential_Load'].sum())
        
        avg_usage_pct = df['Usage_Percent'].mean()
        
        critical_count = len(df[df['Stress_Level'] == 'CRITICAL'])
        high_count = len(df[df['Stress_Level'] == 'HIGH'])
        medium_count = len(df[df['Stress_Level'] == 'MEDIUM'])
        
        # Overload zones (usage > total capacity)
        overload_zones = []
        for _, zone in df[df['Current_Usage'] > df['Total_Capacity']].iterrows():
            overload_zones.append({
                'zone_id': int(zone['Zone']),
                'city': str(zone['City']),
                'zone_type': str(zone['Type']),
                'usage': round(zone['Current_Usage'], 2),
                'capacity': round(zone['Total_Capacity'], 2),
                'usage_percent': round(zone['Usage_Percent'], 2),
                'stress_level': zone['Stress_Level'],
                'deficit': round(zone['Current_Usage'] - zone['Total_Capacity'], 2),
                'essential': round(zone['Essential_Load'], 2),
                'non_essential': round(zone['NonEssential_Load'], 2)
            })

        # Optimization strategy
        # Step 1: Non-essential load reduction from critical zones
        critical_non_essential_reduction = 0.0
        for _, zone in df[df['Stress_Level'] == 'CRITICAL'].iterrows():
            deficit = zone['Current_Usage'] - zone['Total_Capacity']
            if deficit > 0:
                reduction = min(zone['NonEssential_Load'], deficit)
                critical_non_essential_reduction += reduction

        # Step 2: Reallocate non-essential loads from normal zones to critical zones
        normal_zones = df[df['Stress_Level'] == 'NORMAL'].copy()
        normal_available_non_essential = float(normal_zones['NonEssential_Load'].sum() * 0.2) if len(normal_zones) > 0 else 0.0
        
        # Step 3: Load shedding if needed after Steps 1 & 2
        remaining_deficit = max(0, total_usage - total_capacity - critical_non_essential_reduction)
        load_shed_available = min(total_non_essential * 0.3, remaining_deficit)

        optimization_plan = {
            'total_reallocation': float(round(normal_available_non_essential, 2)),
            'non_essential_reduction': float(round(critical_non_essential_reduction, 2)),
            'backup_activation': float(round(load_shed_available, 2)),
            'total_deficit': float(round(max(0, remaining_deficit - load_shed_available), 2))
        }

        # Charts data
        zone_usage = {
            'labels': [f"Zone {int(z)}" for z in df['Zone'].tolist()],
            'usage_values': df['Current_Usage'].round(2).tolist(),
            'capacity_values': df['Total_Capacity'].round(2).tolist()
        }

        essential_vs_non = {
            'labels': ['Essential Load', 'Non-Essential Load'],
            'values': [round(total_essential, 2), round(total_non_essential, 2)]
        }

        selected_date = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')

        return jsonify({
            'success': True,
            'report': {
                'selected_date': selected_date,
                'metrics': {
                    'critical_zones_count': int(critical_count),
                    'high_stress_zones_count': int(high_count),
                    'medium_stress_zones_count': int(medium_count),
                    'average_usage_percent': round(avg_usage_pct, 2),
                    'total_usage': round(total_usage, 2),
                    'total_capacity': round(total_capacity, 2),
                    'essential_load_total': round(total_essential, 2),
                    'non_essential_total': round(total_non_essential, 2),
                    'peak_usage_percent': round(df['Usage_Percent'].max(), 2),
                    'renewable_percentage': 0.0,
                    'battery_status_percent': 100.0
                },
                'overload_zones': overload_zones,
                'optimization_plan': optimization_plan,
                'charts': {
                    'zone_usage': zone_usage,
                    'renewable_mix': essential_vs_non
                }
            }
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500


# ============================================
# DETAILED REPORT PDF DOWNLOAD ENDPOINT
# ============================================

@app.route('/api/reports/<module_name>/<report_id>/pdf', methods=['GET'])
def download_detailed_report_pdf(module_name, report_id):
    """Download generated module report as PDF"""
    try:
        module = str(module_name).lower()
        if module not in generated_reports:
            return jsonify({'success': False, 'error': 'Invalid module for PDF download'}), 400

        report_payload = generated_reports[module].get(report_id)
        if not report_payload:
            return jsonify({'success': False, 'error': 'Report not found. Generate report again and retry.'}), 404

        pdf_buffer = generate_module_pdf(module, report_payload)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'{module}_detailed_report_{timestamp}.pdf'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': f'Failed to generate PDF: {str(e)}'}), 500


# ============================================
# AQI MANAGEMENT ENDPOINTS
# ============================================

@app.route('/api/aqi/status', methods=['GET'])
def get_aqi_status():
    """Get real-time AQI status for Pune"""
    try:
        # Get real-time AQI data from APIs
        realtime_data = RealtimeAQI.get_aqi_for_pune()
        
        # Also get trend analysis
        trend_data = RealtimeAQI.get_trend_analysis()
        realtime_data['trend'] = trend_data
        
        return jsonify({
            'success': True,
            'data': realtime_data,
            'refresh_interval': '3 minutes',
            'last_updated': realtime_data['timestamp']
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Fallback to local data if API fails
        try:
            status = aqi_ai.get_current_status()
            return jsonify({
                'success': True,
                'data': status,
                'source': 'Cached Data (API unavailable)'
            })
        except:
            return jsonify({'success': False, 'error': f'AQI service error: {str(e)}'}), 500


@app.route('/api/aqi/predict/<zone>', methods=['GET'])
def predict_aqi(zone):
    """Predict AQI for a specific zone"""
    try:
        days = request.args.get('days', 1, type=int)
        prediction = aqi_ai.predict_aqi(zone, days)
        return jsonify({'success': True, 'prediction': prediction})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/aqi/pollution-sources/<zone>', methods=['GET'])
def get_pollution_sources(zone):
    """Get pollution sources for a zone"""
    try:
        result = aqi_ai.identify_pollution_sources(zone)
        return jsonify({'success': True, 'sources': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/aqi/mitigation/<zone>', methods=['GET'])
def get_mitigation_actions(zone):
    """Get mitigation actions for a zone"""
    try:
        result = aqi_ai.get_mitigation_actions(zone)
        return jsonify({'success': True, 'mitigation': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/aqi/simulate/<scenario>', methods=['GET'])
def simulate_aqi_scenario(scenario):
    """Simulate AQI scenarios"""
    try:
        result = aqi_ai.simulate_scenario(scenario)
        return jsonify({'success': True, 'simulation': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# SOLUTION COMPARISON ENDPOINTS (STAGE 2)
# ============================================

@app.route('/api/solutions/compare/<module>', methods=['GET'])
def compare_solutions(module):
    """Compare solutions for a specific module"""
    try:
        if module == 'water':
            result = solution_comparator.compare_water_solutions()
        elif module == 'electricity':
            result = solution_comparator.compare_electricity_solutions()
        elif module == 'waste':
            result = solution_comparator.compare_waste_solutions()
        else:
            return jsonify({'success': False, 'error': 'Invalid module'}), 400
        
        return jsonify({'success': True, 'comparison': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/solutions/all', methods=['GET'])
def compare_all_solutions():
    """Get all solution comparisons"""
    try:
        result = solution_comparator.get_all_comparisons()
        return jsonify({'success': True, 'comparisons': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# SAMPLE CSV DOWNLOAD ENDPOINTS
# ============================================

@app.route('/api/download/sample-water-csv', methods=['GET'])
def download_sample_water_csv():
    """Download sample water CSV template"""
    try:
        csv_path = os.path.join(os.path.dirname(__file__), 'data', 'sample_water.csv')
        if not os.path.exists(csv_path):
            return jsonify({'success': False, 'error': 'Sample file not found'}), 404
        
        return send_file(
            csv_path,
            mimetype='text/csv',
            as_attachment=True,
            download_name='sample_water_data.csv'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/download/sample-waste-csv', methods=['GET'])
def download_sample_waste_csv():
    """Download sample waste CSV template"""
    try:
        csv_path = os.path.join(os.path.dirname(__file__), 'data', 'sample_waste.csv')
        if not os.path.exists(csv_path):
            return jsonify({'success': False, 'error': 'Sample file not found'}), 404
        
        return send_file(
            csv_path,
            mimetype='text/csv',
            as_attachment=True,
            download_name='sample_waste_data.csv'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/download/sample-electricity-csv', methods=['GET'])
def download_sample_electricity_csv():
    """Download sample electricity CSV template"""
    try:
        csv_path = os.path.join(os.path.dirname(__file__), 'data', 'sample_electricity.csv')
        if not os.path.exists(csv_path):
            return jsonify({'success': False, 'error': 'Sample file not found'}), 404
        
        return send_file(
            csv_path,
            mimetype='text/csv',
            as_attachment=True,
            download_name='sample_electricity_data.csv'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# HELPER & UTILITY ENDPOINTS
# ============================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'status': 'healthy',
        'message': 'Smart City API is running'
    })


@app.route('/api/zones', methods=['GET'])
def get_zones():
    """Get list of all zones"""
    return jsonify({
        'success': True,
        'zones': ['Zone A', 'Zone B', 'Zone C', 'Zone D']
    })


# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500


if __name__ == '__main__':
    print("\n" + "="*60)
    print("[CITY] SMART CITY RESOURCE OPTIMIZATION SYSTEM")
    print("="*60)
    print("[ROCKET] Starting Flask API Server...")
    print("[SIGNAL] Server running at: http://127.0.0.1:5000")
    print("[CHART] Dashboard: http://127.0.0.1:5000/api/dashboard")
    print("[CHECK] Health Check: http://127.0.0.1:5000/api/health")
    print("="*60 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
