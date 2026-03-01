"""
💧 WATER MANAGEMENT MODULE
AI-powered water resource optimization with:
- Linear Regression for demand forecasting
- Greedy Algorithm for resource allocation
- Anomaly Detection for leak detection
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
import warnings
import os
warnings.filterwarnings('ignore')


class WaterManagementAI:
    """AI engine for water resource optimization"""
    
    def __init__(self, data_path=None):
        """Initialize the water management system"""
        if data_path is None:
            # Get path relative to this file's location
            module_dir = os.path.dirname(os.path.abspath(__file__))
            data_path = os.path.join(module_dir, '..', 'data', 'water_data.csv')
        try:
            self.df = pd.read_csv(data_path)
            self.df['date'] = pd.to_datetime(self.df['date'])
            self.zones = self.df['zone'].unique().tolist()
            self.model = LinearRegression()
            self.scaler = StandardScaler()
        except FileNotFoundError:
            print("⚠️  Water data not found. Run generate_data.py first.")
            self.df = pd.DataFrame()
            self.zones = ['Zone A', 'Zone B', 'Zone C', 'Zone D']
    
    def get_current_status(self):
        """Get current water status for all zones"""
        if self.df.empty:
            return self._generate_mock_status()
        
        latest_data = self.df.groupby('zone').tail(1)
        
        status = []
        for _, row in latest_data.iterrows():
            status.append({
                'zone': row['zone'],
                'tank_level_percent': round(row['tank_level_percent'], 2),
                'daily_usage': round(row['daily_usage_liters'], 2),
                'capacity': row['capacity_liters'],
                'pressure': round(row['pipeline_pressure_bar'], 2),
                'pipeline_age': row['pipeline_age_years'],
                'risk_level': self._calculate_risk_level(row['tank_level_percent']),
                'status': self._get_status_label(row['tank_level_percent'])
            })
        
        return status
    
    def predict_demand(self, zone, days_ahead=1):
        """Predict future water demand using Linear Regression"""
        if self.df.empty:
            return {'predicted_demand': 7500, 'confidence': 85}
        
        zone_data = self.df[self.df['zone'] == zone].copy()
        
        if len(zone_data) < 7:
            return {'predicted_demand': zone_data['daily_usage_liters'].mean(), 'confidence': 70}
        
        # Feature engineering
        zone_data['day_num'] = range(len(zone_data))
        zone_data['is_weekend_num'] = zone_data['is_weekend'].astype(int)
        
        # Prepare training data
        X = zone_data[['day_num', 'temperature_c', 'humidity_percent', 'is_weekend_num']].values
        y = zone_data['daily_usage_liters'].values
        
        # Train model
        self.model.fit(X, y)
        
        # Predict future
        last_day = zone_data['day_num'].iloc[-1]
        future_temp = zone_data['temperature_c'].mean()
        future_humidity = zone_data['humidity_percent'].mean()
        is_weekend = 0  # Assume weekday
        
        future_X = np.array([[last_day + days_ahead, future_temp, future_humidity, is_weekend]])
        predicted_demand = self.model.predict(future_X)[0]
        
        # Calculate confidence based on R² score
        score = self.model.score(X, y)
        confidence = round(max(70, min(95, score * 100)), 2)
        
        return {
            'predicted_demand': round(predicted_demand, 2),
            'confidence': confidence,
            'trend': 'increasing' if predicted_demand > zone_data['daily_usage_liters'].mean() else 'decreasing'
        }
    
    def detect_leaks(self, zone):
        """Detect potential leaks using anomaly detection"""
        if self.df.empty:
            return {
                'leak_detected': False, 
                'severity': 'none',
                'current_pressure': 3.5,
                'average_pressure': 3.5,
                'pressure_status': 'normal',
                'anomalies': [],
                'pipeline_age': 15
            }
        
        zone_data = self.df[self.df['zone'] == zone].tail(30)
        
        # If zone has no data, return default response
        if zone_data.empty:
            return {
                'leak_detected': False,
                'severity': 'none',
                'current_pressure': 3.5,
                'average_pressure': 3.5,
                'pressure_status': 'normal',
                'anomalies': ['No recent data available'],
                'pipeline_age': 15
            }
        
        # Check for anomalies
        anomalies = []
        
        # 1. Pressure drop detection
        avg_pressure = zone_data['pipeline_pressure_bar'].mean()
        recent_pressure = zone_data.tail(5)['pipeline_pressure_bar'].mean()
        
        if recent_pressure < avg_pressure * 0.75:
            anomalies.append('Significant pressure drop detected')
        
        # 2. Flow mismatch detection
        zone_data_copy = zone_data.copy()
        zone_data_copy['flow_diff'] = zone_data_copy['input_flow'] - zone_data_copy['output_flow']
        avg_diff = zone_data_copy['flow_diff'].mean()
        
        if avg_diff > zone_data['daily_usage_liters'].mean() * 0.15:
            anomalies.append('High flow discrepancy detected')
        
        # 3. Old pipeline risk
        try:
            pipeline_age = zone_data['pipeline_age_years'].iloc[0]
        except (IndexError, KeyError):
            pipeline_age = 15  # Default age
            
        if pipeline_age > 20:
            anomalies.append('Pipeline age exceeds recommended threshold')
        
        leak_detected = len(anomalies) > 0
        
        return {
            'leak_detected': leak_detected,
            'severity': 'high' if len(anomalies) >= 2 else 'medium' if len(anomalies) == 1 else 'none',
            'anomalies': anomalies,
            'pipeline_age': pipeline_age,
            'current_pressure': round(recent_pressure, 2),
            'average_pressure': round(avg_pressure, 2),
            'pressure_status': 'abnormal' if recent_pressure < avg_pressure * 0.75 else 'normal'
        }
    
    def optimize_allocation(self):
        """Optimize water allocation using Greedy Algorithm"""
        status = self.get_current_status()
        
        # Greedy approach: prioritize zones with lowest levels
        zones_sorted = sorted(status, key=lambda x: x['tank_level_percent'])
        
        deficit_zones = [z for z in zones_sorted if z['tank_level_percent'] < 60]
        surplus_zones = [z for z in zones_sorted if z['tank_level_percent'] > 80]
        
        allocations = []
        water_saved = 0
        shortage_prevented = False
        
        for deficit in deficit_zones:
            shortage_prevented = True
            shortage_amount = (60 - deficit['tank_level_percent']) / 100 * deficit['capacity']
            
            for surplus in surplus_zones:
                available = (surplus['tank_level_percent'] - 70) / 100 * surplus['capacity']
                
                if available > 0:
                    transfer_amount = min(shortage_amount, available)
                    
                    allocations.append({
                        'from_zone': surplus['zone'],
                        'to_zone': deficit['zone'],
                        'amount_liters': round(transfer_amount, 2),
                        'action': 'transfer'
                    })
                    
                    water_saved += transfer_amount
                    shortage_amount -= transfer_amount
                    surplus['tank_level_percent'] -= (transfer_amount / surplus['capacity']) * 100
                    deficit['tank_level_percent'] += (transfer_amount / deficit['capacity']) * 100
                    
                    if shortage_amount <= 0:
                        break
        
        return {
            'allocations': allocations,
            'water_saved_liters': round(water_saved, 2),
            'shortage_prevented': shortage_prevented,
            'deficit_zones': len(deficit_zones),
            'surplus_zones': len(surplus_zones),
            'updated_status': status
        }
    
    def simulate_scenario(self, scenario_type):
        """Simulate different scenarios"""
        scenarios = {
            'heatwave': {'temp_increase': 10, 'demand_increase': 30},
            'festival': {'demand_increase': 40},
            'normal': {'demand_increase': 0}
        }
        
        scenario = scenarios.get(scenario_type, scenarios['normal'])
        status = self.get_current_status()
        
        for zone_status in status:
            increase = scenario.get('demand_increase', 0)
            zone_status['predicted_usage'] = zone_status['daily_usage'] * (1 + increase / 100)
            zone_status['predicted_level'] = max(0, zone_status['tank_level_percent'] - increase * 0.5)
            zone_status['risk_level'] = self._calculate_risk_level(zone_status['predicted_level'])
        
        return {
            'scenario': scenario_type,
            'impact': scenario,
            'zones': status
        }
    
    def _calculate_risk_level(self, tank_level):
        """Calculate risk level based on tank level"""
        if tank_level >= 70:
            return 'low'
        elif tank_level >= 50:
            return 'medium'
        else:
            return 'high'
    
    def _get_status_label(self, tank_level):
        """Get status label"""
        if tank_level >= 70:
            return 'healthy'
        elif tank_level >= 50:
            return 'moderate'
        else:
            return 'critical'
    
    def _generate_mock_status(self):
        """Generate mock status when no data available"""
        return [
            {'zone': 'Zone A', 'tank_level_percent': 75, 'daily_usage': 6500, 'capacity': 10000, 'pressure': 3.5, 'pipeline_age': 12, 'risk_level': 'low', 'status': 'healthy'},
            {'zone': 'Zone B', 'tank_level_percent': 45, 'daily_usage': 7200, 'capacity': 9500, 'pressure': 3.2, 'pipeline_age': 18, 'risk_level': 'high', 'status': 'critical'},
            {'zone': 'Zone C', 'tank_level_percent': 88, 'daily_usage': 5800, 'capacity': 11000, 'pressure': 4.0, 'pipeline_age': 8, 'risk_level': 'low', 'status': 'healthy'},
            {'zone': 'Zone D', 'tank_level_percent': 62, 'daily_usage': 6800, 'capacity': 10500, 'pressure': 3.7, 'pipeline_age': 15, 'risk_level': 'medium', 'status': 'moderate'}
        ]
    
    def get_analytics_summary(self):
        """Get comprehensive analytics summary"""
        status = self.get_current_status()
        
        total_capacity = sum(z['capacity'] for z in status)
        total_usage = sum(z['daily_usage'] for z in status)
        avg_level = sum(z['tank_level_percent'] for z in status) / len(status)
        
        critical_zones = [z['zone'] for z in status if z['risk_level'] == 'high']
        
        return {
            'total_capacity_liters': total_capacity,
            'total_daily_usage_liters': round(total_usage, 2),
            'usage_percent': round((total_usage / total_capacity) * 100, 2),
            'average_tank_level': round(avg_level, 2),
            'critical_zones': critical_zones,
            'zones_count': len(status),
            'overall_status': 'critical' if len(critical_zones) > 0 else 'moderate' if avg_level < 70 else 'healthy'
        }


if __name__ == "__main__":
    # Test the module
    water_ai = WaterManagementAI()
    print("\n💧 WATER MANAGEMENT AI TEST")
    print("=" * 50)
    
    # Current status
    status = water_ai.get_current_status()
    print("\n📊 Current Status:")
    for s in status:
        print(f"  {s['zone']}: {s['tank_level_percent']}% - {s['status']}")
    
    # Prediction
    prediction = water_ai.predict_demand('Zone A')
    print(f"\n🔮 Prediction for Zone A: {prediction['predicted_demand']} liters")
    
    # Optimization
    optimization = water_ai.optimize_allocation()
    print(f"\n⚙️  Optimization: {len(optimization['allocations'])} transfers planned")
    
    print("=" * 50)
