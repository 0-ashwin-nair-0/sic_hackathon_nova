"""
♻ WASTE MANAGEMENT MODULE
AI-powered waste management optimization with:
- Waste surge prediction
- Waste-to-resource conversion
- Smart collection routing
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
import os
warnings.filterwarnings('ignore')


class WasteManagementAI:
    """AI engine for smart waste management and optimization"""
    
    def __init__(self, data_path=None):
        """Initialize the waste management system"""
        if data_path is None:
            # Get path relative to this file's location
            module_dir = os.path.dirname(os.path.abspath(__file__))
            data_path = os.path.join(module_dir, '..', 'data', 'waste_data.csv')
        try:
            self.df = pd.read_csv(data_path)
            self.df['date'] = pd.to_datetime(self.df['date'])
            self.zones = self.df['zone'].unique().tolist()
        except FileNotFoundError:
            print("⚠️  Waste data not found. Run generate_data.py first.")
            self.df = pd.DataFrame()
            self.zones = ['Zone A', 'Zone B', 'Zone C', 'Zone D']
    
    def get_current_status(self):
        """Get current waste status for all zones"""
        if self.df.empty:
            return self._generate_mock_status()
        
        latest_data = self.df.groupby(['zone', 'bin_type']).tail(1)
        
        bins = []
        for _, row in latest_data.iterrows():
            bins.append({
                'zone': row['zone'],
                'bin_id': row['bin_id'],
                'bin_type': row['bin_type'],
                'fill_percent': round(row['fill_percent'], 2),
                'weight_kg': round(row['weight_kg'], 2),
                'status': self._get_bin_status(row['fill_percent']),
                'needs_collection': row['fill_percent'] > 80,
                'gps': {'lat': row['gps_lat'], 'lon': row['gps_lon']}
            })
        
        return bins
    
    def predict_waste_surge(self, zone, event_type='festival'):
        """Predict waste surge during special events"""
        if self.df.empty:
            return {'predicted_increase': 85, 'alert_level': 'high'}
        
        zone_data = self.df[self.df['zone'] == zone]
        
        # Calculate normal average
        normal_avg = zone_data[zone_data['is_festival'] == False]['fill_percent'].mean()
        festival_avg = zone_data[zone_data['is_festival'] == True]['fill_percent'].mean()
        
        if pd.isna(festival_avg):
            festival_avg = normal_avg * 1.8
        
        increase_percent = ((festival_avg - normal_avg) / normal_avg) * 100
        
        return {
            'predicted_increase': round(increase_percent, 2),
            'normal_fill': round(normal_avg, 2),
            'predicted_fill': round(festival_avg, 2),
            'alert_level': 'high' if increase_percent > 70 else 'medium' if increase_percent > 40 else 'low',
            'recommendation': 'Increase collection frequency and add temporary bins'
        }
    
    def calculate_waste_to_energy(self):
        """Calculate waste-to-resource conversion impact"""
        if self.df.empty:
            return self._generate_mock_conversion()
        
        latest_data = self.df.groupby(['zone', 'bin_type']).tail(1)
        
        # Conversion rates
        organic_to_biogas_rate = 0.6  # 1 kg organic -> 0.6 kWh
        plastic_recycling_rate = 0.85  # 85% recyclable
        mixed_waste_to_energy_rate = 0.4  # 1 kg mixed -> 0.4 kWh
        
        total_electricity = 0
        total_recycled = 0
        total_co2_reduced = 0
        landfill_reduction = 0
        
        organic_waste = latest_data[latest_data['bin_type'] == 'Organic']['weight_kg'].sum()
        plastic_waste = latest_data[latest_data['bin_type'] == 'Plastic']['weight_kg'].sum()
        mixed_waste = latest_data[latest_data['bin_type'] == 'Mixed']['weight_kg'].sum()
        
        # Organic to Biogas to Electricity
        electricity_from_organic = organic_waste * organic_to_biogas_rate
        total_electricity += electricity_from_organic
        total_co2_reduced += organic_waste * 0.3  # 0.3 kg CO2 per kg organic waste
        
        # Plastic Recycling
        recycled_plastic = plastic_waste * plastic_recycling_rate
        total_recycled += recycled_plastic
        total_co2_reduced += recycled_plastic * 2.5  # 2.5 kg CO2 per kg plastic recycled
        
        # Mixed Waste to Energy
        electricity_from_mixed = mixed_waste * mixed_waste_to_energy_rate
        total_electricity += electricity_from_mixed
        
        # Landfill reduction
        landfill_reduction = organic_waste + recycled_plastic + mixed_waste
        
        # Calculate cleanliness score
        avg_fill = latest_data['fill_percent'].mean()
        cleanliness_score = max(0, 100 - avg_fill)
        
        return {
            'total_electricity_generated_kwh': round(total_electricity, 2),
            'electricity_from_organic_kwh': round(electricity_from_organic, 2),
            'electricity_from_mixed_kwh': round(electricity_from_mixed, 2),
            'total_plastic_recycled_kg': round(recycled_plastic, 2),
            'total_co2_reduced_kg': round(total_co2_reduced, 2),
            'landfill_reduction_kg': round(landfill_reduction, 2),
            'cleanliness_score': round(cleanliness_score, 2),
            'waste_breakdown': {
                'organic_kg': round(organic_waste, 2),
                'plastic_kg': round(plastic_waste, 2),
                'mixed_kg': round(mixed_waste, 2)
            }
        }
    
    def get_collection_priority(self):
        """Get priority list for waste collection"""
        bins = self.get_current_status()
        
        # Priority based on fill percentage
        priority_bins = sorted(
            [b for b in bins if b['fill_percent'] > 70],
            key=lambda x: x['fill_percent'],
            reverse=True
        )
        
        # Group by zone for efficient routing
        by_zone = {}
        for bin_item in priority_bins:
            zone = bin_item['zone']
            if zone not in by_zone:
                by_zone[zone] = []
            by_zone[zone].append(bin_item)
        
        return {
            'priority_bins': priority_bins[:10],  # Top 10 priority
            'total_priority_bins': len(priority_bins),
            'collection_by_zone': by_zone,
            'urgent_count': len([b for b in bins if b['fill_percent'] > 90])
        }
    
    def simulate_scenario(self, scenario_type):
        """Simulate different waste scenarios"""
        bins = self.get_current_status()
        
        scenarios = {
            'festival': {'fill_increase': 80, 'duration_days': 3},
            'normal': {'fill_increase': 0, 'duration_days': 1}
        }
        
        scenario = scenarios.get(scenario_type, scenarios['normal'])
        
        for bin_item in bins:
            increase = scenario['fill_increase']
            bin_item['predicted_fill'] = min(100, bin_item['fill_percent'] + increase)
            bin_item['status'] = self._get_bin_status(bin_item['predicted_fill'])
        
        return {
            'scenario': scenario_type,
            'impact': scenario,
            'bins': bins,
            'overflow_risk': len([b for b in bins if b.get('predicted_fill', 0) > 95])
        }
    
    def _get_bin_status(self, fill_percent):
        """Get bin status label"""
        if fill_percent >= 90:
            return 'critical'
        elif fill_percent >= 80:
            return 'high'
        elif fill_percent >= 60:
            return 'moderate'
        else:
            return 'normal'
    
    def _generate_mock_status(self):
        """Generate mock status when no data available"""
        bins = []
        bin_types = ['Organic', 'Plastic', 'Mixed', 'E-Waste']
        
        for zone in self.zones:
            for bin_type in bin_types:
                fill = np.random.uniform(30, 90)
                bins.append({
                    'zone': zone,
                    'bin_id': f"{zone}_{bin_type}_1",
                    'bin_type': bin_type,
                    'fill_percent': round(fill, 2),
                    'weight_kg': round(fill * 1.2, 2),
                    'status': self._get_bin_status(fill),
                    'needs_collection': fill > 80,
                    'gps': {'lat': round(np.random.uniform(12.9, 13.1), 6), 'lon': round(np.random.uniform(77.5, 77.7), 6)}
                })
        
        return bins
    
    def _generate_mock_conversion(self):
        """Generate mock conversion data"""
        return {
            'total_electricity_generated_kwh': 2450,
            'electricity_from_organic_kwh': 1600,
            'electricity_from_mixed_kwh': 850,
            'total_plastic_recycled_kg': 3200,
            'total_co2_reduced_kg': 9500,
            'landfill_reduction_kg': 11500,
            'cleanliness_score': 78,
            'waste_breakdown': {
                'organic_kg': 2700,
                'plastic_kg': 3800,
                'mixed_kg': 2100
            }
        }
    
    def get_analytics_summary(self):
        """Get comprehensive analytics summary"""
        bins = self.get_current_status()
        conversion = self.calculate_waste_to_energy()
        
        total_bins = len(bins)
        full_bins = len([b for b in bins if b['fill_percent'] > 80])
        avg_fill = sum(b['fill_percent'] for b in bins) / total_bins if total_bins > 0 else 0
        
        return {
            'total_bins': total_bins,
            'full_bins': full_bins,
            'average_fill_percent': round(avg_fill, 2),
            'cleanliness_score': conversion['cleanliness_score'],
            'electricity_generated': conversion['total_electricity_generated_kwh'],
            'co2_reduced': conversion['total_co2_reduced_kg'],
            'overall_status': 'critical' if full_bins > total_bins * 0.5 else 'moderate' if full_bins > total_bins * 0.3 else 'healthy'
        }


if __name__ == "__main__":
    # Test the module
    waste_ai = WasteManagementAI()
    print("\n♻ WASTE MANAGEMENT AI TEST")
    print("=" * 50)
    
    # Current status
    bins = waste_ai.get_current_status()
    print(f"\n📊 Total Bins: {len(bins)}")
    
    # Waste to Energy
    conversion = waste_ai.calculate_waste_to_energy()
    print(f"\n⚡ Electricity Generated: {conversion['total_electricity_generated_kwh']} kWh")
    print(f"♻️  CO2 Reduced: {conversion['total_co2_reduced_kg']} kg")
    
    print("=" * 50)
