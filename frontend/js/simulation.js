/**
 * SMART CITY ICCC - Simulation JavaScript
 * Scenario simulation functionality
 */

// ============================================
// SIMULATION MODAL
// ============================================

function initializeSimulation() {
    const simulationBtn = document.getElementById('simulationBtn');
    simulationBtn.addEventListener('click', openSimulation);
}

function openSimulation() {
    document.getElementById('simulationModal').classList.add('active');
}

function closeSimulation() {
    document.getElementById('simulationModal').classList.remove('active');
}

// ============================================
// RUN SIMULATIONS
// ============================================

async function runSimulation(scenarioType) {
    closeSimulation();
    showNotification(`Running ${scenarioType} simulation...`, 'info');
    
    try {
        // Run simulations for all modules
        const waterSim = await simulateWater(scenarioType);
        const electricitySim = await simulateElectricity(scenarioType);
        const wasteSim = await simulateWaste(scenarioType);
        const aqiSim = await simulateAQI(scenarioType);
        
        // Show simulation results
        displaySimulationResults({
            scenario: scenarioType,
            water: waterSim,
            electricity: electricitySim,
            waste: wasteSim,
            aqi: aqiSim
        });
        
        showNotification(`${scenarioType} simulation complete!`, 'success');
    } catch (error) {
        console.error('Simulation error:', error);
        showErrorNotification('Simulation failed');
    }
}

// ============================================
// MODULE-SPECIFIC SIMULATIONS
// ============================================

async function simulateWater(scenario) {
    try {
        const response = await fetch(`${API_BASE}/water/simulate/${scenario}`);
        const data = await response.json();
        return data.success ? data.simulation : null;
    } catch (error) {
        console.error('Water simulation error:', error);
        return null;
    }
}

async function simulateElectricity(scenario) {
    try {
        // Map scenario names
        const scenarioMap = {
            'heatwave': 'heatwave',
            'power_spike': 'power_spike',
            'festival': 'power_spike',
            'emergency': 'normal'
        };
        
        const elecScenario = scenarioMap[scenario] || 'normal';
        const response = await fetch(`${API_BASE}/electricity/simulate/${elecScenario}`);
        const data = await response.json();
        return data.success ? data.simulation : null;
    } catch (error) {
        console.error('Electricity simulation error:', error);
        return null;
    }
}

async function simulateWaste(scenario) {
    try {
        const wasteScenario = scenario === 'festival' ? 'festival' : 'normal';
        const response = await fetch(`${API_BASE}/waste/simulate/${wasteScenario}`);
        const data = await response.json();
        return data.success ? data.simulation : null;
    } catch (error) {
        console.error('Waste simulation error:', error);
        return null;
    }
}

async function simulateAQI(scenario) {
    try {
        const aqiScenario = scenario === 'heatwave' ? 'heatwave' : scenario === 'festival' ? 'festival' : 'normal';
        const response = await fetch(`${API_BASE}/aqi/simulate/${aqiScenario}`);
        const data = await response.json();
        return data.success ? data.simulation : null;
    } catch (error) {
        console.error('AQI simulation error:', error);
        return null;
    }
}

// ============================================
// DISPLAY SIMULATION RESULTS
// ============================================

function displaySimulationResults(results) {
    // Create results modal
    const resultsHTML = `
        <div class="modal active" id="simulationResults" style="z-index: 10001;">
            <div class="modal-content" style="max-width: 1000px;">
                <div class="modal-header">
                    <h2><i class="fas fa-chart-bar"></i> Simulation Results: ${results.scenario.toUpperCase()}</h2>
                    <button class="close-btn" onclick="closeSimulationResults()">&times;</button>
                </div>
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                    ${generateWaterResults(results.water)}
                    ${generateElectricityResults(results.electricity)}
                    ${generateWasteResults(results.waste)}
                    ${generateAQIResults(results.aqi)}
                    
                    <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(0, 229, 255, 0.1); border-radius: 10px; border-left: 4px solid var(--accent-cyan);">
                        <h3 style="color: var(--accent-cyan); margin-bottom: 1rem;">
                            <i class="fas fa-lightbulb"></i> AI Recommendations
                        </h3>
                        <div style="color: var(--text-secondary); line-height: 1.8;">
                            ${generateScenarioRecommendations(results.scenario)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add to page
    const existingResults = document.getElementById('simulationResults');
    if (existingResults) {
        existingResults.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', resultsHTML);
}

function generateWaterResults(waterData) {
    if (!waterData || !waterData.zones) return '';
    
    const criticalZones = waterData.zones.filter(z => z.risk_level === 'high');
    
    return `
        <div class="simulation-result-section">
            <h3><i class="fas fa-tint"></i> Water Management Impact</h3>
            <div class="result-grid">
                <div class="result-item">
                    <div class="result-label">Critical Zones</div>
                    <div class="result-value critical">${criticalZones.length}</div>
                </div>
                <div class="result-item">
                    <div class="result-label">Avg Predicted Level</div>
                    <div class="result-value">
                        ${waterData.zones.reduce((sum, z) => sum + (z.predicted_level || z.tank_level_percent), 0) / waterData.zones.length}%
                    </div>
                </div>
                <div class="result-item">
                    <div class="result-label">Action Required</div>
                    <div class="result-value">${criticalZones.length > 0 ? 'YES' : 'NO'}</div>
                </div>
            </div>
        </div>
    `;
}

function generateElectricityResults(elecData) {
    if (!elecData || !elecData.zones) return '';
    
    const overloadZones = elecData.zones.filter(z => z.risk_level === 'critical' || z.risk_level === 'high');
    
    return `
        <div class="simulation-result-section">
            <h3><i class="fas fa-bolt"></i> Electricity Management Impact</h3>
            <div class="result-grid">
                <div class="result-item">
                    <div class="result-label">Overload Risk Zones</div>
                    <div class="result-value critical">${overloadZones.length}</div>
                </div>
                <div class="result-item">
                    <div class="result-label">Avg Predicted Usage</div>
                    <div class="result-value">
                        ${elecData.zones.reduce((sum, z) => sum + (z.predicted_percent || z.usage_percent), 0) / elecData.zones.length}%
                    </div>
                </div>
                <div class="result-item">
                    <div class="result-label">Load Balancing Needed</div>
                    <div class="result-value">${overloadZones.length > 0 ? 'YES' : 'NO'}</div>
                </div>
            </div>
        </div>
    `;
}

function generateWasteResults(wasteData) {
    if (!wasteData || !wasteData.bins) return '';
    
    const overflowRisk = wasteData.overflow_risk || 0;
    
    return `
        <div class="simulation-result-section">
            <h3><i class="fas fa-recycle"></i> Waste Management Impact</h3>
            <div class="result-grid">
                <div class="result-item">
                    <div class="result-label">Overflow Risk</div>
                    <div class="result-value critical">${overflowRisk} bins</div>
                </div>
                <div class="result-item">
                    <div class="result-label">Scenario Impact</div>
                    <div class="result-value">${wasteData.impact ? wasteData.impact.fill_increase : 0}% increase</div>
                </div>
                <div class="result-item">
                    <div class="result-label">Extra Collection</div>
                    <div class="result-value">${overflowRisk > 5 ? 'REQUIRED' : 'NOT NEEDED'}</div>
                </div>
            </div>
        </div>
    `;
}

function generateAQIResults(aqiData) {
    if (!aqiData || !aqiData.zones) return '';
    
    const unhealthyZones = aqiData.zones.filter(z => z.predicted_aqi > 100 || z.aqi > 100);
    
    return `
        <div class="simulation-result-section">
            <h3><i class="fas fa-wind"></i> Air Quality Impact</h3>
            <div class="result-grid">
                <div class="result-item">
                    <div class="result-label">Unhealthy Zones</div>
                    <div class="result-value critical">${unhealthyZones.length}</div>
                </div>
                <div class="result-item">
                    <div class="result-label">Avg Predicted AQI</div>
                    <div class="result-value">
                        ${(aqiData.zones.reduce((sum, z) => sum + (z.predicted_aqi || z.aqi), 0) / aqiData.zones.length).toFixed(1)}
                    </div>
                </div>
                <div class="result-item">
                    <div class="result-label">Mitigation Needed</div>
                    <div class="result-value">${unhealthyZones.length > 0 ? 'YES' : 'NO'}</div>
                </div>
            </div>
        </div>
    `;
}

function generateScenarioRecommendations(scenario) {
    const recommendations = {
        'heatwave': `
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 0.5rem;">✓ Increase water allocation to residential zones by 20%</li>
                <li style="margin-bottom: 0.5rem;">✓ Activate peak-hour electricity demand management</li>
                <li style="margin-bottom: 0.5rem;">✓ Issue public health advisory for outdoor activities</li>
                <li style="margin-bottom: 0.5rem;">✓ Monitor elderly and vulnerable populations</li>
                <li style="margin-bottom: 0.5rem;">✓ Activate emergency cooling centers</li>
            </ul>
        `,
        'festival': `
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 0.5rem;">✓ Deploy additional waste collection vehicles</li>
                <li style="margin-bottom: 0.5rem;">✓ Install temporary dustbins in high-traffic areas</li>
                <li style="margin-bottom: 0.5rem;">✓ Implement traffic diversions for festival routes</li>
                <li style="margin-bottom: 0.5rem;">✓ Increase power backup capacity</li>
                <li style="margin-bottom: 0.5rem;">✓ Activate real-time crowd monitoring systems</li>
            </ul>
        `,
        'power_spike': `
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 0.5rem;">✓ Immediately activate load balancing protocols</li>
                <li style="margin-bottom: 0.5rem;">✓ Reduce non-essential electricity consumption by 30%</li>
                <li style="margin-bottom: 0.5rem;">✓ Activate all renewable energy sources</li>
                <li style="margin-bottom: 0.5rem;">✓ Deploy battery backup systems</li>
                <li style="margin-bottom: 0.5rem;">✓ Issue power conservation advisory to citizens</li>
            </ul>
        `,
        'emergency': `
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 0.5rem;">✓ Activate emergency green corridors immediately</li>
                <li style="margin-bottom: 0.5rem;">✓ Override traffic signals for emergency route</li>
                <li style="margin-bottom: 0.5rem;">✓ Alert all emergency services and hospitals</li>
                <li style="margin-bottom: 0.5rem;">✓ Deploy traffic police to critical junctions</li>
                <li style="margin-bottom: 0.5rem;">✓ Broadcast emergency route information to citizens</li>
            </ul>
        `
    };
    
    return recommendations[scenario] || 'Continue monitoring all systems.';
}

function closeSimulationResults() {
    const results = document.getElementById('simulationResults');
    if (results) {
        results.remove();
    }
}

// Add simulation result styles
const simulationStyles = document.createElement('style');
simulationStyles.textContent = `
    .simulation-result-section {
        margin-bottom: 2rem;
        padding: 1.5rem;
        background: rgba(30, 41, 59, 0.4);
        border-radius: 10px;
        border: 1px solid rgba(0, 229, 255, 0.2);
    }
    
    .simulation-result-section h3 {
        color: var(--accent-cyan);
        margin-bottom: 1rem;
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .result-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
    }
    
    .result-item {
        background: rgba(0, 229, 255, 0.05);
        padding: 1rem;
        border-radius: 8px;
        text-align: center;
    }
    
    .result-label {
        color: var(--text-secondary);
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .result-value {
        color: var(--accent-cyan);
        font-size: 1.5rem;
        font-weight: 700;
    }
    
    .result-value.critical {
        color: var(--critical-red);
        animation: pulse 2s infinite;
    }
    
    @media (max-width: 768px) {
        .result-grid {
            grid-template-columns: 1fr;
        }
    }
`;
document.head.appendChild(simulationStyles);
