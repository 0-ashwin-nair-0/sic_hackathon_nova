/**
 * SMART CITY ICCC - Charts JavaScript
 * Chart.js visualizations for data analytics
 */

// Chart instances
let waterChart = null;
let electricityChart = null;
let aqiChart = null;

// ============================================
// WATER CHART
// ============================================

async function createWaterChart() {
    const ctx = document.getElementById('waterChart');
    if (!ctx) return;
    
    try {
        const response = await fetch(`${API_BASE}/water/status`);
        const data = await response.json();
        
        if (data.success) {
            const zones = data.data;
            
            if (waterChart) {
                waterChart.destroy();
            }
            
            waterChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: zones.map(z => z.zone),
                    datasets: [
                        {
                            label: 'Before Optimization',
                            data: zones.map(z => z.tank_level_percent),
                            backgroundColor: 'rgba(255, 76, 76, 0.5)',
                            borderColor: 'rgba(255, 76, 76, 1)',
                            borderWidth: 2
                        },
                        {
                            label: 'After Optimization',
                            data: zones.map(z => Math.min(100, z.tank_level_percent + 15)),
                            backgroundColor: 'rgba(0, 255, 157, 0.5)',
                            borderColor: 'rgba(0, 255, 157, 1)',
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#FFFFFF'
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                color: '#94A3B8',
                                callback: function(value) {
                                    return value + '%';
                                }
                            },
                            grid: {
                                color: 'rgba(0, 229, 255, 0.1)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#94A3B8'
                            },
                            grid: {
                                color: 'rgba(0, 229, 255, 0.1)'
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error creating water chart:', error);
    }
}

// ============================================
// ELECTRICITY CHART
// ============================================

async function createElectricityChart() {
    const ctx = document.getElementById('electricityChart');
    if (!ctx) return;
    
    try {
        const response = await fetch(`${API_BASE}/electricity/status`);
        const data = await response.json();
        
        if (data.success) {
            const zones = data.data;
            
            if (electricityChart) {
                electricityChart.destroy();
            }
            
            electricityChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: zones.map(z => z.zone),
                    datasets: [{
                        label: 'Power Usage',
                        data: zones.map(z => z.usage_kwh),
                        backgroundColor: [
                            'rgba(0, 229, 255, 0.7)',
                            'rgba(255, 193, 7, 0.7)',
                            'rgba(0, 255, 157, 0.7)',
                            'rgba(255, 76, 76, 0.7)'
                        ],
                        borderColor: [
                            'rgba(0, 229, 255, 1)',
                            'rgba(255, 193, 7, 1)',
                            'rgba(0, 255, 157, 1)',
                            'rgba(255, 76, 76, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#FFFFFF',
                                padding: 15
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.label + ': ' + context.parsed + ' kWh';
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error creating electricity chart:', error);
    }
}

// ============================================
// AQI CHART
// ============================================

async function createAQIChart() {
    const ctx = document.getElementById('aqiChart');
    if (!ctx) return;
    
    try {
        const response = await fetch(`${API_BASE}/aqi/status`);
        const data = await response.json();
        
        if (data.success) {
            const zones = data.data;
            
            if (aqiChart) {
                aqiChart.destroy();
            }
            
            aqiChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: zones.map(z => z.zone),
                    datasets: [
                        {
                            label: 'AQI',
                            data: zones.map(z => z.aqi),
                            borderColor: 'rgba(0, 229, 255, 1)',
                            backgroundColor: 'rgba(0, 229, 255, 0.2)',
                            tension: 0.4,
                            fill: true,
                            pointRadius: 6,
                            pointHoverRadius: 8
                        },
                        {
                            label: 'PM2.5',
                            data: zones.map(z => z.pm25),
                            borderColor: 'rgba(255, 193, 7, 1)',
                            backgroundColor: 'rgba(255, 193, 7, 0.2)',
                            tension: 0.4,
                            fill: true,
                            pointRadius: 6,
                            pointHoverRadius: 8
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#FFFFFF'
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                color: '#94A3B8'
                            },
                            grid: {
                                color: 'rgba(0, 229, 255, 0.1)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#94A3B8'
                            },
                            grid: {
                                color: 'rgba(0, 229, 255, 0.1)'
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error creating AQI chart:', error);
    }
}

// ============================================
// INITIALIZE CHARTS ON TAB SWITCH
// ============================================

// Override the loadModuleData function to include chart creation
const originalLoadModuleData = loadModuleData;
loadModuleData = async function(module) {
    await originalLoadModuleData(module);
    
    // Create charts based on active module
    setTimeout(() => {
        switch(module) {
            case 'water':
                createWaterChart();
                break;
            case 'electricity':
                createElectricityChart();
                break;
            case 'aqi':
                createAQIChart();
                break;
        }
    }, 100);
};
