"""
🧠 SOLUTION COMPARISON ENGINE (STAGE 2)
Multi-criteria decision analysis for comparing different solutions
Provides weighted scoring and smart recommendations
"""

import numpy as np
from typing import List, Dict


class SolutionComparator:
    """Engine for comparing multiple solutions across various criteria"""
    
    def __init__(self):
        """Initialize the solution comparator"""
        # Default weights for different criteria (can be customized)
        self.default_weights = {
            'production_cost': 0.20,
            'maintenance_cost': 0.15,
            'implementation_time': 0.15,
            'environmental_impact': 0.20,
            'risk_reduction': 0.20,
            'scalability': 0.10
        }
    
    def compare_water_solutions(self):
        """Compare different water management solutions"""
        solutions = [
            {
                'name': 'Smart Valve Automation',
                'description': 'IoT-enabled automatic valve control system',
                'production_cost': 85,  # Score out of 100 (lower is better)
                'maintenance_cost': 30,
                'implementation_time': 40,  # months
                'environmental_impact': 20,  # negative impact (lower is better)
                'risk_reduction': 90,  # percentage
                'scalability': 95
            },
            {
                'name': 'Manual Reallocation',
                'description': 'Human-operated water distribution control',
                'production_cost': 20,
                'maintenance_cost': 60,
                'implementation_time': 10,
                'environmental_impact': 10,
                'risk_reduction': 60,
                'scalability': 40
            },
            {
                'name': 'AI-Driven Predictive System',
                'description': 'Machine learning-based demand forecasting and allocation',
                'production_cost': 70,
                'maintenance_cost': 25,
                'implementation_time': 30,
                'environmental_impact': 15,
                'risk_reduction': 95,
                'scalability': 90
            },
            {
                'name': 'Pressure-Based Distribution',
                'description': 'Automatic pressure regulation without smart sensors',
                'production_cost': 45,
                'maintenance_cost': 40,
                'implementation_time': 20,
                'environmental_impact': 12,
                'risk_reduction': 70,
                'scalability': 60
            }
        ]
        
        return self._evaluate_solutions(solutions, 'Water Management')
    
    def compare_electricity_solutions(self):
        """Compare different electricity management solutions"""
        solutions = [
            {
                'name': 'Smart Grid with IoT',
                'description': 'Advanced smart grid with real-time monitoring',
                'production_cost': 90,
                'maintenance_cost': 35,
                'implementation_time': 50,
                'environmental_impact': 10,
                'risk_reduction': 95,
                'scalability': 100
            },
            {
                'name': 'Load Shedding Schedule',
                'description': 'Planned power cuts during peak hours',
                'production_cost': 10,
                'maintenance_cost': 15,
                'implementation_time': 5,
                'environmental_impact': 30,
                'risk_reduction': 50,
                'scalability': 30
            },
            {
                'name': 'Battery Storage System',
                'description': 'Large-scale battery backup with solar integration',
                'production_cost': 85,
                'maintenance_cost': 45,
                'implementation_time': 40,
                'environmental_impact': 5,
                'risk_reduction': 85,
                'scalability': 75
            },
            {
                'name': 'Demand Response Program',
                'description': 'Consumer incentives for reducing peak-hour usage',
                'production_cost': 30,
                'maintenance_cost': 20,
                'implementation_time': 15,
                'environmental_impact': 8,
                'risk_reduction': 70,
                'scalability': 80
            }
        ]
        
        return self._evaluate_solutions(solutions, 'Electricity Management')
    
    def compare_waste_solutions(self):
        """Compare different waste management solutions"""
        solutions = [
            {
                'name': 'Smart Bin Network',
                'description': 'IoT-enabled bins with fill-level sensors',
                'production_cost': 65,
                'maintenance_cost': 30,
                'implementation_time': 25,
                'environmental_impact': 15,
                'risk_reduction': 85,
                'scalability': 90
            },
            {
                'name': 'Traditional Collection',
                'description': 'Fixed schedule waste collection',
                'production_cost': 15,
                'maintenance_cost': 40,
                'implementation_time': 5,
                'environmental_impact': 40,
                'risk_reduction': 40,
                'scalability': 50
            },
            {
                'name': 'Waste-to-Energy Plant',
                'description': 'Large-scale waste incineration for energy',
                'production_cost': 95,
                'maintenance_cost': 50,
                'implementation_time': 60,
                'environmental_impact': 20,
                'risk_reduction': 90,
                'scalability': 85
            },
            {
                'name': 'Community Composting',
                'description': 'Decentralized organic waste composting',
                'production_cost': 25,
                'maintenance_cost': 35,
                'implementation_time': 10,
                'environmental_impact': 5,
                'risk_reduction': 60,
                'scalability': 65
            }
        ]
        
        return self._evaluate_solutions(solutions, 'Waste Management')
    
    def _evaluate_solutions(self, solutions: List[Dict], category: str):
        """Evaluate and rank solutions based on weighted scoring"""
        evaluated = []
        
        for solution in solutions:
            # Calculate weighted score
            # For costs and negative impacts: lower is better (invert score)
            # For benefits: higher is better
            
            cost_score = (100 - solution['production_cost']) * self.default_weights['production_cost']
            maintenance_score = (100 - solution['maintenance_cost']) * self.default_weights['maintenance_cost']
            time_score = (100 - min(solution['implementation_time'], 60) * 100 / 60) * self.default_weights['implementation_time']
            env_score = (100 - solution['environmental_impact']) * self.default_weights['environmental_impact']
            risk_score = solution['risk_reduction'] * self.default_weights['risk_reduction']
            scale_score = solution['scalability'] * self.default_weights['scalability']
            
            total_score = cost_score + maintenance_score + time_score + env_score + risk_score + scale_score
            
            evaluated.append({
                'name': solution['name'],
                'description': solution['description'],
                'metrics': {
                    'production_cost_score': round(solution['production_cost'], 1),
                    'maintenance_cost_score': round(solution['maintenance_cost'], 1),
                    'implementation_time_months': solution['implementation_time'],
                    'environmental_impact_score': round(solution['environmental_impact'], 1),
                    'risk_reduction_percent': round(solution['risk_reduction'], 1),
                    'scalability_score': round(solution['scalability'], 1)
                },
                'total_score': round(total_score, 2),
                'rank': 0  # Will be assigned after sorting
            })
        
        # Sort by total score (descending)
        evaluated = sorted(evaluated, key=lambda x: x['total_score'], reverse=True)
        
        # Assign ranks
        for idx, sol in enumerate(evaluated):
            sol['rank'] = idx + 1
            sol['recommended'] = idx == 0  # Top solution is recommended
        
        return {
            'category': category,
            'solutions': evaluated,
            'best_solution': evaluated[0],
            'evaluation_criteria': self.default_weights,
            'comparison_summary': self._generate_comparison_summary(evaluated)
        }
    
    def _generate_comparison_summary(self, evaluated: List[Dict]):
        """Generate a summary comparing all solutions"""
        best = evaluated[0]
        worst = evaluated[-1]
        
        score_diff = best['total_score'] - worst['total_score']
        
        return {
            'best_solution': best['name'],
            'best_score': best['total_score'],
            'worst_solution': worst['name'],
            'worst_score': worst['total_score'],
            'score_difference': round(score_diff, 2),
            'recommendation': f"{best['name']} is recommended with a score of {best['total_score']:.1f}/100",
            'key_advantage': self._identify_key_advantage(best)
        }
    
    def _identify_key_advantage(self, solution: Dict):
        """Identify the key advantage of a solution"""
        metrics = solution['metrics']
        
        if metrics['risk_reduction_percent'] >= 90:
            return 'Highest risk reduction capability'
        elif metrics['scalability_score'] >= 90:
            return 'Excellent scalability for city-wide deployment'
        elif metrics['environmental_impact_score'] <= 15:
            return 'Minimal environmental impact'
        elif metrics['production_cost_score'] <= 30:
            return 'Most cost-effective solution'
        else:
            return 'Balanced performance across all criteria'
    
    def get_all_comparisons(self):
        """Get comparisons for all modules"""
        return {
            'water': self.compare_water_solutions(),
            'electricity': self.compare_electricity_solutions(),
            'waste': self.compare_waste_solutions()
        }


if __name__ == "__main__":
    # Test the solution comparator
    comparator = SolutionComparator()
    print("\n🧠 SOLUTION COMPARISON ENGINE TEST")
    print("=" * 50)
    
    # Water solutions
    water_comp = comparator.compare_water_solutions()
    print(f"\n💧 Best Water Solution: {water_comp['best_solution']['name']}")
    print(f"   Score: {water_comp['best_solution']['total_score']:.2f}")
    
    # Electricity solutions
    elec_comp = comparator.compare_electricity_solutions()
    print(f"\n⚡ Best Electricity Solution: {elec_comp['best_solution']['name']}")
    print(f"   Score: {elec_comp['best_solution']['total_score']:.2f}")
    
    print("=" * 50)
