"""
Train electricity demand prediction model using historical data
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import pickle
import os

def prepare_features(data):
    """Extract and engineer features from the dataset"""
    # Extract time-based features
    data['Timestamp'] = pd.to_datetime(data['Timestamp'], format='%d-%m-%Y %H:%M')
    data['Hour'] = data['Timestamp'].dt.hour
    data['Day'] = data['Timestamp'].dt.day
    data['Month'] = data['Timestamp'].dt.month
    data['DayOfWeek'] = data['Timestamp'].dt.dayofweek
    
    # Encode categorical features
    data['Is_Weekend'] = (data['Day_Type'] == 'Weekend').astype(int)
    
    # Zone encoding
    zone_map = {'Z1': 1, 'Z2': 2, 'Z3': 3}
    data['Zone_Encoded'] = data['Zone_ID'].map(zone_map)
    
    return data

def train_model():
    """Train the electricity demand prediction model"""
    print("Loading historical demand data...")
    data_path = os.path.join('data', 'hourly_demand_prediction_data.csv')
    data = pd.read_csv(data_path)
    
    print(f"Dataset size: {len(data)} records")
    print(f"Date range: {data['Timestamp'].min()} to {data['Timestamp'].max()}")
    
    # Feature engineering
    data = prepare_features(data)
    
    # Select features for training
    feature_cols = [
        'Zone_Encoded', 'Temperature_C', 'Hour', 'Day', 
        'Month', 'DayOfWeek', 'Is_Weekend'
    ]
    
    X = data[feature_cols]
    y = data['Historical_Demand_kW']
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"\nTraining set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    
    # Train Random Forest model (better for non-linear patterns)
    print("\nTraining Random Forest model...")
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=20,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)
    
    train_mae = mean_absolute_error(y_train, y_pred_train)
    test_mae = mean_absolute_error(y_test, y_pred_test)
    train_r2 = r2_score(y_train, y_pred_train)
    test_r2 = r2_score(y_test, y_pred_test)
    
    print("\n" + "="*50)
    print("MODEL PERFORMANCE")
    print("="*50)
    print(f"Training MAE: {train_mae:,.2f} kW")
    print(f"Test MAE: {test_mae:,.2f} kW")
    print(f"Training R²: {train_r2:.4f}")
    print(f"Test R²: {test_r2:.4f}")
    print("="*50)
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\nFeature Importance:")
    print(feature_importance.to_string(index=False))
    
    # Save model
    model_path = os.path.join('models', 'electricity_demand_model.pkl')
    os.makedirs('models', exist_ok=True)
    
    with open(model_path, 'wb') as f:
        pickle.dump({
            'model': model,
            'feature_cols': feature_cols,
            'zone_map': {'Z1': 1, 'Z2': 2, 'Z3': 3},
            'metrics': {
                'test_mae': test_mae,
                'test_r2': test_r2
            }
        }, f)
    
    print(f"\n✓ Model saved to: {model_path}")
    return model

if __name__ == '__main__':
    train_model()
