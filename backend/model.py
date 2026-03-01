"""
Electricity Overload Prediction Model
Uses Logistic Regression to predict zones that will exceed capacity
"""

import pandas as pd
import numpy as np
import pickle
import os
from sklearn.linear_model import LogisticRegression


def load_pretrained_demand_model():
    """
    Load the pre-trained electricity demand prediction model
    
    Returns:
        dict: Model dictionary containing model, feature_cols, zone_map, and metrics
              Returns None if model file doesn't exist
    """
    model_path = os.path.join('models', 'electricity_demand_model.pkl')
    
    if not os.path.exists(model_path):
        print(f"Warning: Pre-trained model not found at {model_path}")
        return None
    
    with open(model_path, 'rb') as f:
        model_dict = pickle.load(f)
    
    return model_dict


def predict_demand(zone_id, temperature, timestamp, day_type='Weekday'):
    """
    Predict electricity demand for a zone using the pre-trained model
    
    Args:
        zone_id: Zone identifier (Z1, Z2, Z3)
        temperature: Temperature in Celsius
        timestamp: datetime object or timestamp string
        day_type: 'Weekday' or 'Weekend'
    
    Returns:
        float: Predicted demand in kW, or None if model not available
    """
    model_dict = load_pretrained_demand_model()
    
    if model_dict is None:
        return None
    
    # Parse timestamp
    if isinstance(timestamp, str):
        timestamp = pd.to_datetime(timestamp)
    
    # Prepare features
    zone_map = model_dict['zone_map']
    features = {
        'Zone_Encoded': zone_map.get(zone_id, 1),
        'Temperature_C': temperature,
        'Hour': timestamp.hour,
        'Day': timestamp.day,
        'Month': timestamp.month,
        'DayOfWeek': timestamp.dayofweek,
        'Is_Weekend': 1 if day_type == 'Weekend' else 0
    }
    
    # Create feature array in correct order
    feature_cols = model_dict['feature_cols']
    X = pd.DataFrame([features])[feature_cols]
    
    # Predict
    model = model_dict['model']
    predicted_demand = model.predict(X)[0]
    
    return predicted_demand


def train_model(data):
    """
    Train a Logistic Regression model to predict electricity overload
    
    Args:
        data: DataFrame with columns Current_Usage, Max_Capacity, NonEssential_Load
    
    Returns:
        tuple: (model, fallback_class) 
               - model: Trained LogisticRegression (or None if only one class)
               - fallback_class: Single class value if only one class exists (or None)
    """
    # Create target column: 1 if overloaded, 0 if safe
    data['Overload'] = (data['Current_Usage'] > data['Max_Capacity']).astype(int)

    # Features for prediction
    X = data[['Current_Usage', 'Max_Capacity', 'NonEssential_Load']]
    y = data['Overload']

    # Check if we have both classes (needed for classification)
    unique_classes = y.unique()
    
    if len(unique_classes) < 2:
        # Only one class exists - return None model with fallback class
        return None, int(unique_classes[0])

    # Train Logistic Regression model if we have both classes
    model = LogisticRegression(max_iter=1000)
    model.fit(X, y)

    return model
