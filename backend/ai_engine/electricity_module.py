"""
⚡ ELECTRICITY MANAGEMENT MODULE
AI-powered electricity load optimization with:
- Linear Regression for load forecasting
- Smart load balancing algorithm
- Peak hour management
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta
import warnings
import os
warnings.filterwarnings('ignore')


class ElectricityManagementAI:
    """AI engine for electricity load management and optimization"""
    
    def __init__(self, data_path=None):
        """Initialize the electricity management system"""
        if data_path is None:
            # Get path relative to this file's location
            module_dir = os.path.dirname(os.path.abspath(__file__))
            data_path = os.path.join(module_dir, '..', 'data', 'electricity_data.csv')
        try:
            self.df = pd.read_csv(data_path)
            self.df['date'] = pd.to_datetime(self.df['date'])
            self.zones = self.df['zone'].unique().tolist()
            self.model = LinearRegression()
        except FileNotFoundError:
            print("⚠️  Electricity data not found. Run generate_data.py first.")
            self.df = pd.DataFrame()
            self.zones = ['Zone A', 'Zone B', 'Zone C', 'Zone D']
    
    def get_current_status(self):
        """Get current electricity status for all zones"""
        if self.df.empty:
            return self._generate_mock_status()
        
        latest_data = self.df.groupby('zone').tail(1)
        
        status = []
        for _, row in latest_data.iterrows():
            usage_percent = (row['usage_kwh'] / row['capacity_kwh']) * 100
            
            status.append({
                'zone': row['zone'],
                'usage_kwh': round(row['usage_kwh'], 2),
                'capacity_kwh': row['capacity_kwh'],
                'usage_percent': round(usage_percent, 2),
                'essential_load_percent': row['essential_load_percent'],
                'solar_generation': round(row['solar_generation_kwh'], 2),
                'battery_backup': row['battery_backup_kwh'],
                'grid_available': row['grid_available'],
                'risk_level': self._calculate_risk_level(usage_percent),
                'status': self._get_status_label(usage_percent)
            })
        
        return status
    
    def predict_load(self, zone, hours_ahead=1):
        """Predict future electricity load using Linear Regression"""
        if self.df.empty:
            return {'predicted_load': 4500, 'peak_hour': 19, 'confidence': 85}
        
        zone_data = self.df[self.df['zone'] == zone].copy()
        
        if len(zone_data) < 24:
            return {'predicted_load': zone_data['usage_kwh'].mean(), 'peak_hour': 19, 'confidence': 70}
        
        # Feature engineering
        X = zone_data[['hour']].values
        y = zone_data['usage_kwh'].values
        
        # Train model
        self.model.fit(X, y)
        
        # Predict future hour
        current_hour = zone_data['hour'].iloc[-1]
        future_hour = (current_hour + hours_ahead) % 24
        
        predicted_load = self.model.predict([[future_hour]])[0]
        
        # Find peak hour
        hourly_avg = zone_data.groupby('hour')['usage_kwh'].mean()
        peak_hour = hourly_avg.idxmax()
        
        # Calculate confidence
        score = self.model.score(X, y)
        confidence = round(max(70, min(95, score * 100)), 2)
        
        return {
            'predicted_load': round(predicted_load, 2),
            'peak_hour': int(peak_hour),
            'confidence': confidence,
            'is_peak': future_hour in [8, 9, 18, 19, 20]
        }
    
    def optimize_load_balancing(self):
        """Optimize electricity distribution using smart load balancing"""
        status = self.get_current_status()
        
        # Identify overloaded and underloaded zones
        overloaded = [z for z in status if z['usage_percent'] > 85]
        underloaded = [z for z in status if z['usage_percent'] < 60]
        
        actions = []
        blackout_prevented = len(overloaded) > 0
        total_saved = 0
        
        for overload_zone in overloaded:
            excess_load = (overload_zone['usage_percent'] - 75) / 100 * overload_zone['capacity_kwh']
            
            # Strategy 1: Reduce non-essential load
            non_essential_load = overload_zone['capacity_kwh'] * (100 - overload_zone['essential_load_percent']) / 100
            reducible_load = non_essential_load * 0.3  # Reduce 30% of non-essential
            
            actions.append({
                'zone': overload_zone['zone'],
                'action': 'reduce_non_essential',
                'amount_kwh': round(reducible_load, 2),
                'description': 'Reduce decorative lighting, delay EV charging'
            })
            
            total_saved += reducible_load
            excess_load -= reducible_load
            
            # Strategy 2: Activate backup sources
            if overload_zone['solar_generation'] > 0:
                actions.append({
                    'zone': overload_zone['zone'],
                    'action': 'activate_solar',
                    'amount_kwh': round(overload_zone['solar_generation'], 2),
                    'description': 'Maximize solar generation'
                })
                total_saved += overload_zone['solar_generation']
                excess_load -= overload_zone['solar_generation']
            
            # Strategy 3: Transfer from underloaded zones
            for underload_zone in underloaded:
                if excess_load <= 0:
                    break
                
                available = (70 - underload_zone['usage_percent']) / 100 * underload_zone['capacity_kwh']
                transfer_amount = min(excess_load, available * 0.5)
                
                if transfer_amount > 0:
                    actions.append({
                        'from_zone': underload_zone['zone'],
                        'to_zone': overload_zone['zone'],
                        'action': 'transfer_load',
                        'amount_kwh': round(transfer_amount, 2),
                        'description': 'Grid reallocation'
                    })
                    
                    total_saved += transfer_amount
                    excess_load -= transfer_amount
                    underload_zone['usage_percent'] += (transfer_amount / underload_zone['capacity_kwh']) * 100
            
            # Update overload zone status
            overload_zone['usage_percent'] = max(0, overload_zone['usage_percent'] - (total_saved / overload_zone['capacity_kwh']) * 100)
        
        return {
            'actions': actions,
            'total_saved_kwh': round(total_saved, 2),
            'blackout_prevented': blackout_prevented,
            'overloaded_zones': len(overloaded),
            'updated_status': status
        }
    
    def simulate_scenario(self, scenario_type):
        """Simulate different electricity scenarios"""
        scenarios = {
            'heatwave': {'demand_increase': 40, 'solar_boost': 20},
            'power_spike': {'demand_increase': 50},
            'normal': {'demand_increase': 0}
        }
        
        scenario = scenarios.get(scenario_type, scenarios['normal'])
        status = self.get_current_status()
        
        for zone_status in status:
            increase = scenario.get('demand_increase', 0)
            zone_status['predicted_usage'] = zone_status['usage_kwh'] * (1 + increase / 100)
            zone_status['predicted_percent'] = min(100, zone_status['usage_percent'] + increase)
            zone_status['risk_level'] = self._calculate_risk_level(zone_status['predicted_percent'])
        
        return {
            'scenario': scenario_type,
            'impact': scenario,
            'zones': status
        }
    
    def _calculate_risk_level(self, usage_percent):
        """Calculate risk level based on usage percentage"""
        if usage_percent >= 100:
            return 'critical'
        elif usage_percent >= 85:
            return 'high'
        elif usage_percent >= 70:
            return 'medium'
        else:
            return 'low'
    
    def _get_status_label(self, usage_percent):
        """Get status label"""
        if usage_percent >= 85:
            return 'overload'
        elif usage_percent >= 70:
            return 'high_load'
        else:
            return 'normal'
    
    def _generate_mock_status(self):
        """Generate mock status when no data available"""
        return [
            {'zone': 'Zone A', 'usage_kwh': 4200, 'capacity_kwh': 6000, 'usage_percent': 70, 'essential_load_percent': 60, 'solar_generation': 800, 'battery_backup': 1500, 'grid_available': True, 'risk_level': 'medium', 'status': 'high_load'},
            {'zone': 'Zone B', 'usage_kwh': 5400, 'capacity_kwh': 6000, 'usage_percent': 90, 'essential_load_percent': 55, 'solar_generation': 950, 'battery_backup': 1800, 'grid_available': True, 'risk_level': 'high', 'status': 'overload'},
            {'zone': 'Zone C', 'usage_kwh': 3200, 'capacity_kwh': 6500, 'usage_percent': 49, 'essential_load_percent': 50, 'solar_generation': 1100, 'battery_backup': 2000, 'grid_available': True, 'risk_level': 'low', 'status': 'normal'},
            {'zone': 'Zone D', 'usage_kwh': 4800, 'capacity_kwh': 6200, 'usage_percent': 77, 'essential_load_percent': 58, 'solar_generation': 900, 'battery_backup': 1600, 'grid_available': True, 'risk_level': 'medium', 'status': 'high_load'}
        ]
    
    def get_analytics_summary(self):
        """Get comprehensive analytics summary"""
        status = self.get_current_status()
        
        total_capacity = sum(z['capacity_kwh'] for z in status)
        total_usage = sum(z['usage_kwh'] for z in status)
        total_solar = sum(z['solar_generation'] for z in status)
        avg_usage = (total_usage / total_capacity) * 100
        
        critical_zones = [z['zone'] for z in status if z['risk_level'] in ['critical', 'high']]
        
        return {
            'total_capacity_kwh': total_capacity,
            'total_usage_kwh': round(total_usage, 2),
            'usage_percent': round(avg_usage, 2),
            'total_solar_generation': round(total_solar, 2),
            'renewable_percent': round((total_solar / total_usage) * 100, 2) if total_usage > 0 else 0,
            'critical_zones': critical_zones,
            'zones_count': len(status),
            'overall_status': 'critical' if avg_usage >= 85 else 'warning' if avg_usage >= 70 else 'healthy'
        }


if __name__ == "__main__":
    # Test the module
    electricity_ai = ElectricityManagementAI()
    print("\n⚡ ELECTRICITY MANAGEMENT AI TEST")
    print("=" * 50)
    
    # Current status
    status = electricity_ai.get_current_status()
    print("\n📊 Current Status:")
    for s in status:
        print(f"  {s['zone']}: {s['usage_percent']}% - {s['status']}")
    
    # Prediction
    prediction = electricity_ai.predict_load('Zone A')
    print(f"\n🔮 Prediction for Zone A: {prediction['predicted_load']} kWh")
    
    # Optimization
    optimization = electricity_ai.optimize_load_balancing()
    print(f"\n⚙️  Optimization: {len(optimization['actions'])} actions planned")
    
    print("=" * 50)
