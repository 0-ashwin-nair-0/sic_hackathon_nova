"""
SMART CITY RESOURCE OPTIMIZATION SYSTEM
Data Generation Module
Generates realistic datasets for all city modules
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os

np.random.seed(42)
random.seed(42)

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

class SmartCityDataGenerator:
    """Generate realistic city data for all modules"""
    
    def __init__(self):
        self.zones = ['Zone A', 'Zone B', 'Zone C', 'Zone D']
        self.days = 90  # 3 months of historical data
        
    def generate_water_data(self):
        """Generate water management data"""
        data = []
        base_date = datetime.now() - timedelta(days=self.days)
        
        for zone_idx, zone in enumerate(self.zones):
            # Each zone has different characteristics
            base_capacity = random.randint(8000, 12000)
            base_usage = random.randint(5000, 8000)
            pipeline_age = random.randint(5, 30)
            
            for day in range(self.days):
                current_date = base_date + timedelta(days=day)
                
                # Seasonal variation
                season_factor = 1 + 0.3 * np.sin(2 * np.pi * day / 365)
                
                # Weekend reduction
                is_weekend = current_date.weekday() >= 5
                weekend_factor = 0.85 if is_weekend else 1.0
                
                # Daily usage with variation
                daily_usage = base_usage * season_factor * weekend_factor * random.uniform(0.9, 1.1)
                weekly_usage = daily_usage * 7 * random.uniform(0.95, 1.05)
                
                # Tank level (decreases with usage)
                tank_level = random.uniform(60, 95) if day % 3 == 0 else random.uniform(45, 75)
                
                # Pipeline metrics
                input_flow = daily_usage * random.uniform(1.0, 1.15)
                output_flow = daily_usage * random.uniform(0.95, 1.0)
                pressure = random.uniform(2.5, 4.5)  # bar
                
                # Weather impact
                temp = random.uniform(20, 40)
                humidity = random.uniform(30, 90)
                
                data.append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'zone': zone,
                    'tank_level_percent': round(tank_level, 2),
                    'capacity_liters': base_capacity,
                    'daily_usage_liters': round(daily_usage, 2),
                    'weekly_usage_liters': round(weekly_usage, 2),
                    'input_flow': round(input_flow, 2),
                    'output_flow': round(output_flow, 2),
                    'pipeline_pressure_bar': round(pressure, 2),
                    'pipeline_age_years': pipeline_age,
                    'temperature_c': round(temp, 1),
                    'humidity_percent': round(humidity, 1),
                    'is_weekend': is_weekend
                })
        
        df = pd.DataFrame(data)
        df.to_csv(os.path.join(SCRIPT_DIR, 'water_data.csv'), index=False)
        print(f"✅ Generated {len(df)} water data records")
        return df
    
    def generate_electricity_data(self):
        """Generate electricity management data"""
        data = []
        base_date = datetime.now() - timedelta(days=self.days)
        
        for zone_idx, zone in enumerate(self.zones):
            base_capacity = random.randint(5000, 8000)  # kWh
            base_usage = random.randint(3000, 6000)
            essential_load_percent = random.randint(40, 70)
            
            for day in range(self.days):
                current_date = base_date + timedelta(days=day)
                
                # Peak hours simulation
                for hour in range(24):
                    # Peak hours: 8-10 AM and 6-9 PM
                    if hour in [8, 9, 18, 19, 20]:
                        peak_factor = random.uniform(1.4, 1.8)
                    elif hour in [10, 11, 17, 21]:
                        peak_factor = random.uniform(1.1, 1.3)
                    elif hour in [0, 1, 2, 3, 4, 5]:
                        peak_factor = random.uniform(0.4, 0.6)
                    else:
                        peak_factor = random.uniform(0.8, 1.0)
                    
                    usage = base_usage * peak_factor * random.uniform(0.95, 1.05)
                    
                    # Solar generation during day
                    solar_generation = 0
                    if 6 <= hour <= 18:
                        solar_factor = np.sin(np.pi * (hour - 6) / 12)
                        solar_generation = random.uniform(500, 1200) * solar_factor
                    
                    data.append({
                        'date': current_date.strftime('%Y-%m-%d'),
                        'hour': hour,
                        'zone': zone,
                        'usage_kwh': round(usage, 2),
                        'capacity_kwh': base_capacity,
                        'usage_percent': round((usage / base_capacity) * 100, 2),
                        'essential_load_percent': essential_load_percent,
                        'solar_generation_kwh': round(solar_generation, 2),
                        'battery_backup_kwh': random.randint(1000, 2000),
                        'grid_available': random.choice([True, True, True, True, False])
                    })
        
        df = pd.DataFrame(data)
        df.to_csv(os.path.join(SCRIPT_DIR, 'electricity_data.csv'), index=False)
        print(f"✅ Generated {len(df)} electricity data records")
        return df
    
    def generate_waste_data(self):
        """Generate waste management data"""
        data = []
        base_date = datetime.now() - timedelta(days=self.days)
        
        bin_types = ['Organic', 'Plastic', 'Mixed', 'E-Waste']
        
        for zone in self.zones:
            for day in range(self.days):
                current_date = base_date + timedelta(days=day)
                
                # Festival surge simulation
                is_festival = random.random() < 0.05  # 5% days are festivals
                festival_factor = random.uniform(1.5, 2.5) if is_festival else 1.0
                
                for bin_type in bin_types:
                    bin_id = f"{zone}_{bin_type}_{random.randint(1, 3)}"
                    
                    # Base fill rate
                    if bin_type == 'Organic':
                        base_fill = random.uniform(40, 80)
                    elif bin_type == 'Plastic':
                        base_fill = random.uniform(30, 70)
                    elif bin_type == 'Mixed':
                        base_fill = random.uniform(35, 75)
                    else:  # E-Waste
                        base_fill = random.uniform(10, 40)
                    
                    fill_percent = min(base_fill * festival_factor, 100)
                    
                    # Weight estimation
                    weight_kg = fill_percent * random.uniform(0.8, 1.5)
                    
                    data.append({
                        'date': current_date.strftime('%Y-%m-%d'),
                        'zone': zone,
                        'bin_id': bin_id,
                        'bin_type': bin_type,
                        'fill_percent': round(fill_percent, 2),
                        'weight_kg': round(weight_kg, 2),
                        'is_festival': is_festival,
                        'last_collected': (current_date - timedelta(days=random.randint(0, 5))).strftime('%Y-%m-%d'),
                        'gps_lat': round(random.uniform(12.9, 13.1), 6),
                        'gps_lon': round(random.uniform(77.5, 77.7), 6)
                    })
        
        df = pd.DataFrame(data)
        df.to_csv(os.path.join(SCRIPT_DIR, 'waste_data.csv'), index=False)
        print(f"✅ Generated {len(df)} waste data records")
        return df
    
    def generate_aqi_data(self):
        """Generate Air Quality Index data"""
        data = []
        base_date = datetime.now() - timedelta(days=self.days)
        
        for zone in self.zones:
            # Each zone has different pollution characteristics
            base_pm25 = random.uniform(30, 80)
            base_pm10 = random.uniform(40, 100)
            
            for day in range(self.days):
                current_date = base_date + timedelta(days=day)
                
                # Weather impact
                wind_speed = random.uniform(5, 25)
                humidity = random.uniform(30, 90)
                temp = random.uniform(20, 40)
                
                # Pollution levels (worse in winter, better with wind)
                season_factor = 1.3 if day % 365 < 90 or day % 365 > 330 else 0.8
                wind_factor = max(0.5, 1 - (wind_speed / 50))
                
                pm25 = base_pm25 * season_factor * wind_factor * random.uniform(0.9, 1.2)
                pm10 = base_pm10 * season_factor * wind_factor * random.uniform(0.9, 1.2)
                
                # Calculate AQI (simplified)
                aqi = max(pm25 * 2, pm10 * 1.5)
                
                # Pollution sources
                traffic_contribution = random.uniform(30, 50)
                industry_contribution = random.uniform(20, 40)
                construction_contribution = random.uniform(10, 25)
                
                data.append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'zone': zone,
                    'aqi': round(aqi, 2),
                    'pm25': round(pm25, 2),
                    'pm10': round(pm10, 2),
                    'co': round(random.uniform(0.5, 2.5), 2),
                    'no2': round(random.uniform(20, 60), 2),
                    'so2': round(random.uniform(5, 25), 2),
                    'o3': round(random.uniform(30, 80), 2),
                    'wind_speed_kmh': round(wind_speed, 1),
                    'temperature_c': round(temp, 1),
                    'humidity_percent': round(humidity, 1),
                    'traffic_contribution_percent': round(traffic_contribution, 1),
                    'industry_contribution_percent': round(industry_contribution, 1),
                    'construction_contribution_percent': round(construction_contribution, 1)
                })
        
        df = pd.DataFrame(data)
        df.to_csv(os.path.join(SCRIPT_DIR, 'aqi_data.csv'), index=False)
        print(f"✅ Generated {len(df)} AQI data records")
        return df
    
    def generate_all(self):
        """Generate all datasets"""
        print("\n🏙️  SMART CITY DATA GENERATION")
        print("=" * 50)
        self.generate_water_data()
        self.generate_electricity_data()
        self.generate_waste_data()
        self.generate_aqi_data()
        print("=" * 50)
        print("✅ All datasets generated successfully!\n")


if __name__ == "__main__":
    generator = SmartCityDataGenerator()
    generator.generate_all()
