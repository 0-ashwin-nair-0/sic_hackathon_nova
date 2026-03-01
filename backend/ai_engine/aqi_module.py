"""
🌫 AIR QUALITY INDEX (AQI) MODULE
AI-powered air quality monitoring with:
- AQI prediction and trend analysis
- Pollution source identification
- Mitigation recommendations
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta
import warnings
import os
warnings.filterwarnings('ignore')


class AQIManagementAI:
    """AI engine for Air Quality Index monitoring and prediction"""
    
    def __init__(self, data_path=None):
        """Initialize the AQI management system"""
        if data_path is None:
            # Get path relative to this file's location
            module_dir = os.path.dirname(os.path.abspath(__file__))
            data_path = os.path.join(module_dir, '..', 'data', 'aqi_data.csv')
        try:
            self.df = pd.read_csv(data_path)
            self.df['date'] = pd.to_datetime(self.df['date'])
            self.zones = self.df['zone'].unique().tolist()
            self.model = LinearRegression()
        except FileNotFoundError:
            print("⚠️  AQI data not found. Run generate_data.py first.")
            self.df = pd.DataFrame()
            self.zones = ['Zone A', 'Zone B', 'Zone C', 'Zone D']
    
    def get_current_status(self):
        """Get current AQI status for all zones"""
        if self.df.empty:
            return self._generate_mock_status()
        
        latest_data = self.df.groupby('zone').tail(1)
        
        status = []
        for _, row in latest_data.iterrows():
            status.append({
                'zone': row['zone'],
                'aqi': round(row['aqi'], 2),
                'pm25': round(row['pm25'], 2),
                'pm10': round(row['pm10'], 2),
                'category': self._get_aqi_category(row['aqi']),
                'health_impact': self._get_health_impact(row['aqi']),
                'color': self._get_aqi_color(row['aqi']),
                'trend': self._calculate_trend(row['zone']),
                'temperature': round(row['temperature_c'], 1),
                'humidity': round(row['humidity_percent'], 1),
                'wind_speed': round(row['wind_speed_kmh'], 1)
            })
        
        return status
    
    def predict_aqi(self, zone, days_ahead=1):
        """Predict future AQI using Linear Regression"""
        if self.df.empty:
            return {'predicted_aqi': 85, 'category': 'Moderate', 'confidence': 80}
        
        zone_data = self.df[self.df['zone'] == zone].copy()
        
        if len(zone_data) < 7:
            return {'predicted_aqi': zone_data['aqi'].mean(), 'category': 'Moderate', 'confidence': 70}
        
        # Feature engineering
        zone_data['day_num'] = range(len(zone_data))
        
        # Prepare training data
        X = zone_data[['day_num', 'temperature_c', 'humidity_percent', 'wind_speed_kmh']].values
        y = zone_data['aqi'].values
        
        # Train model
        self.model.fit(X, y)
        
        # Predict future
        last_day = zone_data['day_num'].iloc[-1]
        future_temp = zone_data['temperature_c'].mean()
        future_humidity = zone_data['humidity_percent'].mean()
        future_wind = zone_data['wind_speed_kmh'].mean()
        
        future_X = np.array([[last_day + days_ahead, future_temp, future_humidity, future_wind]])
        predicted_aqi = self.model.predict(future_X)[0]
        
        # Calculate confidence
        score = self.model.score(X, y)
        confidence = round(max(70, min(95, score * 100)), 2)
        
        return {
            'predicted_aqi': round(predicted_aqi, 2),
            'category': self._get_aqi_category(predicted_aqi),
            'confidence': confidence,
            'trend': 'improving' if predicted_aqi < zone_data['aqi'].mean() else 'worsening'
        }
    
    def identify_pollution_sources(self, zone):
        """Identify major pollution sources for a zone"""
        if self.df.empty:
            return self._generate_mock_sources()
        
        zone_data = self.df[self.df['zone'] == zone].tail(7)  # Last week
        
        avg_traffic = zone_data['traffic_contribution_percent'].mean()
        avg_industry = zone_data['industry_contribution_percent'].mean()
        avg_construction = zone_data['construction_contribution_percent'].mean()
        
        sources = [
            {'source': 'Traffic', 'contribution_percent': round(avg_traffic, 2)},
            {'source': 'Industry', 'contribution_percent': round(avg_industry, 2)},
            {'source': 'Construction', 'contribution_percent': round(avg_construction, 2)},
            {'source': 'Other', 'contribution_percent': round(100 - avg_traffic - avg_industry - avg_construction, 2)}
        ]
        
        # Sort by contribution
        sources = sorted(sources, key=lambda x: x['contribution_percent'], reverse=True)
        
        return {
            'zone': zone,
            'sources': sources,
            'primary_source': sources[0]['source'],
            'recommendations': self._generate_mitigation_recommendations(sources[0]['source'])
        }
    
    def get_mitigation_actions(self, zone):
        """Get recommended mitigation actions based on AQI level"""
        status = self.get_current_status()
        zone_status = next((s for s in status if s['zone'] == zone), None)
        
        if not zone_status:
            return {'actions': [], 'priority': 'low'}
        
        aqi = zone_status['aqi']
        actions = []
        
        if aqi > 150:  # Unhealthy
            actions = [
                {'action': 'Issue public health advisory', 'priority': 'critical', 'impact': 'high'},
                {'action': 'Restrict heavy vehicle movement', 'priority': 'high', 'impact': 'medium'},
                {'action': 'Activate roadside sprinklers', 'priority': 'high', 'impact': 'medium'},
                {'action': 'Enforce odd-even vehicle scheme', 'priority': 'medium', 'impact': 'high'},
                {'action': 'Close construction sites temporarily', 'priority': 'medium', 'impact': 'medium'}
            ]
        elif aqi > 100:  # Moderate to Unhealthy for Sensitive Groups
            actions = [
                {'action': 'Advisory for sensitive groups', 'priority': 'medium', 'impact': 'low'},
                {'action': 'Increase public transport frequency', 'priority': 'medium', 'impact': 'medium'},
                {'action': 'Monitor industrial emissions', 'priority': 'low', 'impact': 'medium'}
            ]
        else:  # Good to Moderate
            actions = [
                {'action': 'Continue regular monitoring', 'priority': 'low', 'impact': 'low'},
                {'action': 'Promote green transportation', 'priority': 'low', 'impact': 'medium'}
            ]
        
        return {
            'zone': zone,
            'current_aqi': aqi,
            'actions': actions,
            'priority': 'critical' if aqi > 150 else 'high' if aqi > 100 else 'low'
        }
    
    def simulate_scenario(self, scenario_type):
        """Simulate different AQI scenarios"""
        status = self.get_current_status()
        
        scenarios = {
            'heatwave': {'aqi_increase': 30, 'duration': 5},
            'rain': {'aqi_decrease': 40, 'duration': 1},
            'festival': {'aqi_increase': 50, 'duration': 3},
            'normal': {'aqi_change': 0}
        }
        
        scenario = scenarios.get(scenario_type, scenarios['normal'])
        
        for zone_status in status:
            if 'aqi_increase' in scenario:
                zone_status['predicted_aqi'] = zone_status['aqi'] + scenario['aqi_increase']
            elif 'aqi_decrease' in scenario:
                zone_status['predicted_aqi'] = max(0, zone_status['aqi'] - scenario['aqi_decrease'])
            else:
                zone_status['predicted_aqi'] = zone_status['aqi']
            
            zone_status['predicted_category'] = self._get_aqi_category(zone_status['predicted_aqi'])
        
        return {
            'scenario': scenario_type,
            'impact': scenario,
            'zones': status
        }
    
    def _calculate_trend(self, zone):
        """Calculate AQI trend for a zone"""
        if self.df.empty:
            return 'stable'
        
        zone_data = self.df[self.df['zone'] == zone].tail(7)
        
        if len(zone_data) < 2:
            return 'stable'
        
        first_half = zone_data.head(len(zone_data) // 2)['aqi'].mean()
        second_half = zone_data.tail(len(zone_data) // 2)['aqi'].mean()
        
        diff = second_half - first_half
        
        if diff > 10:
            return 'worsening'
        elif diff < -10:
            return 'improving'
        else:
            return 'stable'
    
    def _get_aqi_category(self, aqi):
        """Get AQI category"""
        if aqi <= 50:
            return 'Good'
        elif aqi <= 100:
            return 'Moderate'
        elif aqi <= 150:
            return 'Unhealthy for Sensitive Groups'
        elif aqi <= 200:
            return 'Unhealthy'
        elif aqi <= 300:
            return 'Very Unhealthy'
        else:
            return 'Hazardous'
    
    def _get_health_impact(self, aqi):
        """Get health impact description"""
        if aqi <= 50:
            return 'Air quality is satisfactory'
        elif aqi <= 100:
            return 'Acceptable for most people'
        elif aqi <= 150:
            return 'Sensitive groups may experience effects'
        elif aqi <= 200:
            return 'Everyone may begin to experience health effects'
        elif aqi <= 300:
            return 'Health alert: everyone may experience serious effects'
        else:
            return 'Health emergency: entire population affected'
    
    def _get_aqi_color(self, aqi):
        """Get color code for AQI"""
        if aqi <= 50:
            return '#00E400'  # Green
        elif aqi <= 100:
            return '#FFFF00'  # Yellow
        elif aqi <= 150:
            return '#FF7E00'  # Orange
        elif aqi <= 200:
            return '#FF0000'  # Red
        elif aqi <= 300:
            return '#8F3F97'  # Purple
        else:
            return '#7E0023'  # Maroon
    
    def _generate_mitigation_recommendations(self, primary_source):
        """Generate mitigation recommendations based on primary source"""
        recommendations = {
            'Traffic': [
                'Promote public transportation',
                'Implement carpool lanes',
                'Encourage electric vehicles',
                'Create pedestrian zones'
            ],
            'Industry': [
                'Enforce emission standards',
                'Install air filtration systems',
                'Regular emission audits',
                'Promote cleaner technologies'
            ],
            'Construction': [
                'Enforce dust control measures',
                'Use water sprinklers',
                'Cover construction materials',
                'Limit construction hours'
            ]
        }
        
        return recommendations.get(primary_source, ['General monitoring and enforcement'])
    
    def _generate_mock_sources(self):
        """Generate mock pollution sources"""
        return {
            'zone': 'Zone A',
            'sources': [
                {'source': 'Traffic', 'contribution_percent': 42},
                {'source': 'Industry', 'contribution_percent': 28},
                {'source': 'Construction', 'contribution_percent': 18},
                {'source': 'Other', 'contribution_percent': 12}
            ],
            'primary_source': 'Traffic',
            'recommendations': self._generate_mitigation_recommendations('Traffic')
        }
    
    def _generate_mock_status(self):
        """Generate mock status when no data available"""
        return [
            {'zone': 'Zone A', 'aqi': 85, 'pm25': 45, 'pm10': 62, 'category': 'Moderate', 'health_impact': 'Acceptable for most people', 'color': '#FFFF00', 'trend': 'stable', 'temperature': 28, 'humidity': 65, 'wind_speed': 12},
            {'zone': 'Zone B', 'aqi': 128, 'pm25': 68, 'pm10': 88, 'category': 'Unhealthy for Sensitive Groups', 'health_impact': 'Sensitive groups may experience effects', 'color': '#FF7E00', 'trend': 'worsening', 'temperature': 30, 'humidity': 58, 'wind_speed': 8},
            {'zone': 'Zone C', 'aqi': 45, 'pm25': 22, 'pm10': 38, 'category': 'Good', 'health_impact': 'Air quality is satisfactory', 'color': '#00E400', 'trend': 'improving', 'temperature': 26, 'humidity': 72, 'wind_speed': 18},
            {'zone': 'Zone D', 'aqi': 95, 'pm25': 52, 'pm10': 72, 'category': 'Moderate', 'health_impact': 'Acceptable for most people', 'color': '#FFFF00', 'trend': 'stable', 'temperature': 29, 'humidity': 60, 'wind_speed': 10}
        ]
    
    def get_analytics_summary(self):
        """Get comprehensive analytics summary"""
        status = self.get_current_status()
        
        avg_aqi = sum(s['aqi'] for s in status) / len(status) if status else 0
        unhealthy_zones = [s['zone'] for s in status if s['aqi'] > 100]
        
        return {
            'average_aqi': round(avg_aqi, 2),
            'overall_category': self._get_aqi_category(avg_aqi),
            'unhealthy_zones': unhealthy_zones,
            'zones_count': len(status),
            'overall_trend': self._get_overall_trend(status),
            'overall_status': 'critical' if avg_aqi > 150 else 'moderate' if avg_aqi > 100 else 'healthy'
        }
    
    def _get_overall_trend(self, status):
        """Get overall trend across all zones"""
        improving = len([s for s in status if s['trend'] == 'improving'])
        worsening = len([s for s in status if s['trend'] == 'worsening'])
        
        if worsening > improving:
            return 'worsening'
        elif improving > worsening:
            return 'improving'
        else:
            return 'stable'


if __name__ == "__main__":
    # Test the module
    aqi_ai = AQIManagementAI()
    print("\n🌫 AQI MANAGEMENT AI TEST")
    print("=" * 50)
    
    # Current status
    status = aqi_ai.get_current_status()
    print("\n📊 Current Status:")
    for s in status:
        print(f"  {s['zone']}: AQI {s['aqi']} - {s['category']}")
    
    # Pollution sources
    sources = aqi_ai.identify_pollution_sources('Zone A')
    print(f"\n🏭 Primary Source: {sources['primary_source']}")
    
    print("=" * 50)
