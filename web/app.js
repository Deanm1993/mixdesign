/**
 * Asphalt Mix Design Optimisation Tool
 * TfNSW R116 DGA14 MVP
 * 
 * This file contains the client-side logic for the asphalt mix design optimization tool.
 * It handles material input, LP model construction, solving, and result visualization.
 */

// Global variables
let envelope = null;
let chart = null;

// Constants
const EPSILON = 1e-3; // Tolerance for floating point comparisons
const DEFAULT_BINDER_SG = 1.03;
const DEFAULT_AGG_SG = 2.65;
const VOLUMETRIC_SPECS = {
    Va: { min: 3.0, max: 5.0, unit: '%' },
    VMA: { min: 14.0, max: null, unit: '%' },
    VFA: { min: 65.0, max: 80.0, unit: '%' }
};

/**
 * Utility Functions
 */

// Parse a number from input, return NaN if invalid
function parseNum(value) {
    if (value === null || value === undefined || value === '') return NaN;
    return parseFloat(value);
}

// Check if a number is within tolerance of another
function isEqual(a, b, epsilon = EPSILON) {
    return Math.abs(a - b) < epsilon;
}

// Format a number to a specified number of decimal places
function formatNum(value, decimals = 2) {
    if (isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
}

// Format currency
function formatCurrency(value) {
    if (isNaN(value)) return 'N/A';
    return '$' + value.toFixed(2);
}

// Check if a value is within bounds
function isInRange(value, min, max) {
    if (isNaN(value)) return false;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
}

// Create a status element
function createStatusElement(status) {
    const el = document.createElement('span');
    el.className = 'status';
    
    if (status === 'pass') {
        el.classList.add('status-success');
        el.textContent = 'PASS';
    } else if (status === 'fail') {
        el.classList.add('status-fail');
        el.textContent = 'FAIL';
    } else {
        el.classList.add('status-na');
        el.textContent = 'N/A';
    }
    
    return el;
}

/**
 * DOM Manipulation Functions
 */

// Initialize the sieve columns in the materials table
function initializeSieveColumns() {
    const headerRow = document.querySelector('#materialsTable thead tr');
    const actionsCell = headerRow.querySelector('th:last-child');
    
    // Remove any existing sieve columns
    const sieveHeaders = headerRow.querySelectorAll('.sieve-header');
    sieveHeaders.forEach(header => header.remove());
    
    // Add sieve columns
    envelope.sieves_mm.forEach(sieve => {
        const th = document.createElement('th');
        th.className = 'sieve-header';
        th.textContent = `${sieve} mm`;
        headerRow.insertBefore(th, actionsCell);
    });
}

// Add a new material row
function addMaterialRow(type) {
    const tbody = document.querySelector('#materialsTable tbody');
    const row = document.createElement('tr');
    row.dataset.type = type;
    
    // Type cell
    const typeCell = document.createElement('td');
    const typeSelect = document.createElement('select');
    typeSelect.className = 'material-type';
    
    const types = [
        { value: 'aggregate', text: 'Aggregate' },
        { value: 'rap', text: 'RAP' },
        { value: 'binder', text: 'Binder' }
    ];
    
    types.forEach(t => {
        const option = document.createElement('option');
        option.value = t.value;
        option.textContent = t.text;
        typeSelect.appendChild(option);
    });
    
    typeSelect.value = type;
    typeSelect.addEventListener('change', function() {
        updateRowType(row, this.value);
    });
    
    typeCell.appendChild(typeSelect);
    row.appendChild(typeCell);
    
    // Name cell
    const nameCell = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'material-name';
    nameInput.placeholder = 'Material name';
    nameCell.appendChild(nameInput);
    row.appendChild(nameCell);
    
    // Cost cell
    const costCell = document.createElement('td');
    const costInput = document.createElement('input');
    costInput.type = 'number';
    costInput.className = 'material-cost';
    costInput.min = '0';
    costInput.step = '0.01';
    costInput.placeholder = 'Cost ($/t)';
    costCell.appendChild(costInput);
    row.appendChild(costCell);
    
    // RAP Binder % cell
    const rapBinderCell = document.createElement('td');
    rapBinderCell.className = 'rap-only';
    const rapBinderInput = document.createElement('input');
    rapBinderInput.type = 'number';
    rapBinderInput.className = 'rap-binder-percent';
    rapBinderInput.min = '0';
    rapBinderInput.max = '10';
    rapBinderInput.step = '0.1';
    rapBinderInput.placeholder = 'RAP Binder %';
    rapBinderCell.appendChild(rapBinderInput);
    row.appendChild(rapBinderCell);
    
    // Specific Gravity cell
    const sgCell = document.createElement('td');
    sgCell.className = 'sg-cell';
    const sgInput = document.createElement('input');
    sgInput.type = 'number';
    sgInput.className = 'material-sg';
    sgInput.min = '2.0';
    sgInput.max = '3.0';
    sgInput.step = '0.01';
    sgInput.placeholder = 'Gsb';
    sgCell.appendChild(sgInput);
    row.appendChild(sgCell);
    
    // Sieve cells
    envelope.sieves_mm.forEach(sieve => {
        const sieveCell = document.createElement('td');
        sieveCell.className = 'sieve-cell';
        const sieveInput = document.createElement('input');
        sieveInput.type = 'number';
        sieveInput.className = 'sieve-value';
        sieveInput.dataset.sieve = sieve;
        sieveInput.min = '0';
        sieveInput.max = '100';
        sieveInput.step = '0.1';
        sieveInput.placeholder = '% passing';
        sieveCell.appendChild(sieveInput);
        row.appendChild(sieveCell);
    });
    
    // Actions cell
    const actionsCell = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function() {
        row.remove();
    });
    actionsCell.appendChild(deleteBtn);
    row.appendChild(actionsCell);
    
    // Add the row to the table
    tbody.appendChild(row);
    
    // Update row display based on type
    updateRowType(row, type);
    
    return row;
}

// Update row display based on material type
function updateRowType(row, type) {
    row.dataset.type = type;
    
    // Update the type select
    const typeSelect = row.querySelector('.material-type');
    typeSelect.value = type;
    
    // Show/hide RAP binder cell
    const rapBinderCell = row.querySelector('.rap-only');
    if (type === 'rap') {
        rapBinderCell.style.display = 'table-cell';
    } else {
        rapBinderCell.style.display = 'none';
    }
    
    // Show/hide sieve cells and SG for binder
    const sieveCells = row.querySelectorAll('.sieve-cell');
    const sgCell = row.querySelector('.sg-cell');
    
    if (type === 'binder') {
        sieveCells.forEach(cell => cell.style.display = 'none');
        sgCell.style.display = 'none';
    } else {
        sieveCells.forEach(cell => cell.style.display = 'table-cell');
        sgCell.style.display = 'table-cell';
    }
}

// Load sample scenario
function loadSampleScenario() {
    // Clear existing rows
    const tbody = document.querySelector('#materialsTable tbody');
    tbody.innerHTML = '';
    
    // Set project name and target binder
    document.getElementById('projectName').value = 'Sample DGA14 Project';
    document.getElementById('targetBinder').value = '5.2';
    
    // Set volumetric inputs
    document.getElementById('binderSG').value = '1.03';
    document.getElementById('defaultAggSG').value = '2.65';
    document.getElementById('mixSG').value = '2.38'; // Example value for demonstration
    
    // Define sample materials
    const sampleMaterials = [
        {
            type: 'binder',
            name: 'C320 Bitumen',
            cost: 850,
            sg: null,
            gradation: null
        },
        {
            type: 'aggregate',
            name: '14mm Aggregate',
            cost: 30,
            sg: 2.65,
            gradation: [100, 95, 25, 5, 2, 1, 1, 1, 1, 1]
        },
        {
            type: 'aggregate',
            name: '10mm Aggregate',
            cost: 32,
            sg: 2.65,
            gradation: [100, 100, 95, 30, 5, 2, 1, 1, 1, 1]
        },
        {
            type: 'aggregate',
            name: '7mm Aggregate',
            cost: 34,
            sg: 2.65,
            gradation: [100, 100, 100, 95, 60, 10, 2, 1, 1, 1]
        },
        {
            type: 'aggregate',
            name: 'Manufactured Sand',
            cost: 25,
            sg: 2.65,
            gradation: [100, 100, 100, 100, 98, 85, 55, 35, 20, 12]
        },
        {
            type: 'aggregate',
            name: 'Lime/Filler',
            cost: 90,
            sg: 2.70,
            gradation: [100, 100, 100, 100, 100, 100, 100, 99, 95, 85]
        },
        {
            type: 'rap',
            name: 'RAP General',
            cost: 10,
            sg: 2.60,
            rapBinder: 5.0,
            gradation: [100, 98, 90, 75, 60, 45, 25, 18, 12, 8]
        }
    ];
    
    // Add sample materials
    sampleMaterials.forEach(material => {
        const row = addMaterialRow(material.type);
        
        // Set values
        row.querySelector('.material-name').value = material.name;
        row.querySelector('.material-cost').value = material.cost;
        
        if (material.type === 'rap') {
            row.querySelector('.rap-binder-percent').value = material.rapBinder;
        }
        
        if (material.type !== 'binder') {
            row.querySelector('.material-sg').value = material.sg;
            
            // Set gradation values
            const sieveInputs = row.querySelectorAll('.sieve-value');
            sieveInputs.forEach((input, index) => {
                input.value = material.gradation[index];
            });
        }
    });
}

/**
 * LP Model Construction and Solving
 */

// Build and solve the LP model
function buildAndSolveModel() {
    // Clear any previous status messages
    const statusElement = document.getElementById('constraintStatus');
    statusElement.innerHTML = '';
    statusElement.className = 'status-message';
    
    // Hide results section
    document.getElementById('results-section').classList.add('hidden');
    
    // Get target binder percentage
    const targetBinder = parseNum(document.getElementById('targetBinder').value);
    if (isNaN(targetBinder)) {
        showError('Please enter a valid target binder percentage.');
        return;
    }
    
    // Get materials data
    const materials = [];
    const rows = document.querySelectorAll('#materialsTable tbody tr');
    
    let hasBinder = false;
    let hasValidationError = false;
    
    rows.forEach((row, index) => {
        const type = row.dataset.type;
        const name = row.querySelector('.material-name').value.trim();
        const cost = parseNum(row.querySelector('.material-cost').value);
        
        if (name === '') {
            showError(`Row ${index + 1}: Please enter a material name.`);
            hasValidationError = true;
            return;
        }
        
        if (isNaN(cost)) {
            showError(`Row ${index + 1}: Please enter a valid cost for ${name}.`);
            hasValidationError = true;
            return;
        }
        
        const material = {
            id: `material_${index}`,
            type: type,
            name: name,
            cost: cost
        };
        
        if (type === 'binder') {
            hasBinder = true;
            material.sg = parseNum(document.getElementById('binderSG').value) || DEFAULT_BINDER_SG;
        } else {
            // Get specific gravity
            material.sg = parseNum(row.querySelector('.material-sg').value);
            if (isNaN(material.sg)) {
                material.sg = parseNum(document.getElementById('defaultAggSG').value) || DEFAULT_AGG_SG;
            }
            
            // Get gradation data
            material.gradation = {};
            const sieveInputs = row.querySelectorAll('.sieve-value');
            let hasGradation = false;
            
            sieveInputs.forEach(input => {
                const sieve = parseNum(input.dataset.sieve);
                const value = parseNum(input.value);
                
                if (!isNaN(value)) {
                    material.gradation[sieve] = value;
                    hasGradation = true;
                } else {
                    material.gradation[sieve] = 0; // Default to 0 if not specified
                }
            });
            
            if (!hasGradation && type !== 'binder') {
                showError(`Row ${index + 1}: Please enter at least one gradation value for ${name}.`);
                hasValidationError = true;
                return;
            }
            
            // For RAP, get binder percentage
            if (type === 'rap') {
                material.rapBinder = parseNum(row.querySelector('.rap-binder-percent').value);
                if (isNaN(material.rapBinder)) {
                    showError(`Row ${index + 1}: Please enter a valid RAP binder percentage for ${name}.`);
                    hasValidationError = true;
                    return;
                }
                
                // Calculate aggregate fraction in RAP
                material.aggFraction = (100 - material.rapBinder) / 100;
            } else {
                material.aggFraction = 1.0; // Pure aggregate
            }
        }
        
        materials.push(material);
    });
    
    // Abort if any validation error occurred
    if (hasValidationError) {
        return;
    }
    
    // Check if we have any materials
    if (materials.length === 0) {
        showError('Please add at least one material.');
        return;
    }
    
    // If no binder is provided, create a synthetic one
    if (!hasBinder) {
        showError('Warning: No binder material specified. A synthetic binder with cost $0/t will be used. For accurate costing, add a binder material.');
        materials.push({
            id: 'synthetic_binder',
            type: 'binder',
            name: 'Synthetic Binder',
            cost: 0,
            sg: parseNum(document.getElementById('binderSG').value) || DEFAULT_BINDER_SG
        });
    }
    
    // Build the LP model
    const model = {
        optimize: 'cost',
        opType: 'min',
        constraints: {
            sum_to_100: { equal: 100 } // Sum of all proportions = 100%
        },
        variables: {}
    };
    
    // Add binder constraint
    model.constraints.binder_target = { equal: targetBinder };
    
    // Add gradation constraints for each sieve
    envelope.sieves_mm.forEach((sieve, index) => {
        const lowerLimit = envelope.lower[index];
        const upperLimit = envelope.upper[index];
        
        // Lower bound constraint: sum_i [P_i * aggFrac_i * (Gij - Lj)] >= 0
        model.constraints[`sieve_${sieve}_lower`] = { min: 0 };
        
        // Upper bound constraint: sum_i [P_i * aggFrac_i * (Gij - Uj)] <= 0
        model.constraints[`sieve_${sieve}_upper`] = { max: 0 };
    });
    
    // Add variables for each material
    materials.forEach(material => {
        const variable = {
            cost: material.cost,
            sum_to_100: 1, // Contributes to sum = 100%
            min: 0 // Non-negativity constraint
        };
        
        // Binder contribution
        if (material.type === 'binder') {
            variable.binder_target = 1; // Direct contribution
        } else if (material.type === 'rap') {
            variable.binder_target = material.rapBinder / 100; // RAP binder contribution
        } else {
            variable.binder_target = 0; // No binder contribution
        }
        
        // Gradation contributions for aggregates and RAP
        if (material.type !== 'binder') {
            envelope.sieves_mm.forEach((sieve, index) => {
                const lowerLimit = envelope.lower[index];
                const upperLimit = envelope.upper[index];
                const passing = material.gradation[sieve] || 0;
                
                // For lower bound: P_i * aggFrac_i * (Gij - Lj)
                variable[`sieve_${sieve}_lower`] = material.aggFraction * (passing - lowerLimit);
                
                // For upper bound: P_i * aggFrac_i * (Gij - Uj)
                variable[`sieve_${sieve}_upper`] = material.aggFraction * (passing - upperLimit);
            });
        }
        
        // Add variable to model
        model.variables[material.id] = variable;
    });
    
    // Solve the model
    try {
        const solution = solver.Solve(model);
        
        if (solution.feasible) {
            // Process and display results
            processResults(solution, materials, targetBinder);
        } else {
            showError('No feasible solution found. Try adjusting your materials or constraints.');
        }
    } catch (error) {
        showError(`Error solving model: ${error.message}`);
        console.error(error);
    }
}

// Show error message
function showError(message) {
    const statusElement = document.getElementById('constraintStatus');
    statusElement.textContent = message;
    statusElement.className = 'status-message error';
}

/**
 * Results Processing
 */

// Process optimization results
function processResults(solution, materials, targetBinder) {
    // Show results section
    document.getElementById('results-section').classList.remove('hidden');
    
    // Success message
    const statusElement = document.getElementById('constraintStatus');
    statusElement.textContent = 'Optimisation successful! Results shown below.';
    statusElement.className = 'status-message success';
    
    // Calculate total cost and prepare formula table
    let totalCost = 0;
    const formulaTableBody = document.querySelector('#formulaTable tbody');
    formulaTableBody.innerHTML = '';
    
    // Track aggregate mass for gradation calculations
    let totalAggMass = 0;
    const combinedGradation = {};
    envelope.sieves_mm.forEach(sieve => {
        combinedGradation[sieve] = 0;
    });
    
    // Process each material
    materials.forEach(material => {
        const proportion = solution[material.id] || 0;
        if (proportion < EPSILON) return; // Skip materials with zero proportion
        
        const costContribution = proportion * material.cost / 100;
        totalCost += costContribution;
        
        // Add to formula table
        const row = document.createElement('tr');
        
        const nameCell = document.createElement('td');
        nameCell.textContent = material.name;
        row.appendChild(nameCell);
        
        const typeCell = document.createElement('td');
        typeCell.textContent = material.type.charAt(0).toUpperCase() + material.type.slice(1);
        row.appendChild(typeCell);
        
        const proportionCell = document.createElement('td');
        proportionCell.textContent = formatNum(proportion, 1) + '%';
        row.appendChild(proportionCell);
        
        const costCell = document.createElement('td');
        costCell.textContent = formatCurrency(costContribution);
        row.appendChild(costCell);
        
        formulaTableBody.appendChild(row);
        
        // Calculate aggregate contribution to gradation
        if (material.type !== 'binder') {
            const aggMass = proportion * material.aggFraction;
            totalAggMass += aggMass;
            
            envelope.sieves_mm.forEach(sieve => {
                const passing = material.gradation[sieve] || 0;
                combinedGradation[sieve] += aggMass * passing;
            });
        }
    });
    
    // Update total cost
    document.getElementById('totalCost').textContent = formatCurrency(totalCost);
    
    // Calculate final combined gradation
    const finalGradation = {};
    envelope.sieves_mm.forEach(sieve => {
        finalGradation[sieve] = totalAggMass > 0 ? combinedGradation[sieve] / totalAggMass : 0;
    });
    
    // Update gradation table
    updateGradationTable(finalGradation);
    
    // Update gradation chart
    updateGradationChart(finalGradation);
    
    // Check compliance
    checkCompliance(solution, materials, targetBinder, finalGradation);
    
    // Calculate volumetrics
    calculateVolumetrics(solution, materials, targetBinder, totalAggMass);
}

// Update gradation table
function updateGradationTable(gradation) {
    const tableBody = document.querySelector('#gradationTable tbody');
    tableBody.innerHTML = '';
    
    envelope.sieves_mm.forEach((sieve, index) => {
        const row = document.createElement('tr');
        
        const sieveCell = document.createElement('td');
        sieveCell.textContent = sieve;
        row.appendChild(sieveCell);
        
        const lowerCell = document.createElement('td');
        lowerCell.textContent = envelope.lower[index];
        row.appendChild(lowerCell);
        
        const passingCell = document.createElement('td');
        passingCell.textContent = formatNum(gradation[sieve], 1);
        row.appendChild(passingCell);
        
        const upperCell = document.createElement('td');
        upperCell.textContent = envelope.upper[index];
        row.appendChild(upperCell);
        
        const statusCell = document.createElement('td');
        const inRange = isInRange(gradation[sieve], envelope.lower[index], envelope.upper[index]);
        statusCell.appendChild(createStatusElement(inRange ? 'pass' : 'fail'));
        row.appendChild(statusCell);
        
        tableBody.appendChild(row);
    });
}

// Update gradation chart
function updateGradationChart(gradation) {
    const ctx = document.getElementById('gradationChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (chart) {
        chart.destroy();
    }
    
    // Prepare data for chart
    const labels = envelope.sieves_mm;
    const lowerData = envelope.lower;
    const upperData = envelope.upper;
    const combinedData = labels.map(sieve => gradation[sieve]);
    
    // Create chart
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Lower Limit',
                    data: lowerData,
                    borderColor: 'rgba(100, 116, 139, 0.5)',
                    borderWidth: 1,
                    pointRadius: 2,
                    fill: '+1',
                    backgroundColor: 'rgba(241, 245, 249, 0.5)'
                },
                {
                    label: 'Upper Limit',
                    data: upperData,
                    borderColor: 'rgba(100, 116, 139, 0.5)',
                    borderWidth: 1,
                    pointRadius: 2,
                    fill: false
                },
                {
                    label: 'Combined Gradation',
                    data: combinedData,
                    borderColor: 'rgba(37, 99, 235, 1)',
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    borderWidth: 2,
                    pointRadius: 4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'category',
                    reverse: true,
                    title: {
                        display: true,
                        text: 'Sieve Size (mm)'
                    },
                },
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Percent Passing (%)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNum(context.raw, 1)}%`;
                        }
                    }
                },
                legend: {
                    position: 'bottom'
                },
                title: {
                    display: true,
                    text: 'Aggregate Gradation'
                }
            }
        }
    });
}

// Check compliance with constraints
function checkCompliance(solution, materials, targetBinder, gradation) {
    const complianceList = document.getElementById('complianceList');
    complianceList.innerHTML = '';
    
    // Check sum to 100%
    let totalProportion = 0;
    materials.forEach(material => {
        totalProportion += solution[material.id] || 0;
    });
    
    addComplianceItem(complianceList, 
        'Sum of all proportions equals 100%', 
        isEqual(totalProportion, 100)
    );
    
    // Check binder target
    let totalBinder = 0;
    materials.forEach(material => {
        const proportion = solution[material.id] || 0;
        if (material.type === 'binder') {
            totalBinder += proportion;
        } else if (material.type === 'rap') {
            totalBinder += proportion * material.rapBinder / 100;
        }
    });
    
    addComplianceItem(complianceList, 
        `Total binder content equals target (${targetBinder}%)`, 
        isEqual(totalBinder, targetBinder)
    );
    
    // Check gradation envelope
    let allGradationPassed = true;
    envelope.sieves_mm.forEach((sieve, index) => {
        const passing = gradation[sieve];
        const lower = envelope.lower[index];
        const upper = envelope.upper[index];
        
        if (!isInRange(passing, lower, upper)) {
            allGradationPassed = false;
        }
    });
    
    addComplianceItem(complianceList, 
        'Combined gradation within specification envelope', 
        allGradationPassed
    );
    
    // Check non-negativity
    let allNonNegative = true;
    materials.forEach(material => {
        const proportion = solution[material.id] || 0;
        if (proportion < 0) {
            allNonNegative = false;
        }
    });
    
    addComplianceItem(complianceList, 
        'All material proportions are non-negative', 
        allNonNegative
    );
}

// Add compliance item to list
function addComplianceItem(list, text, passed) {
    const item = document.createElement('li');
    item.textContent = text + ' ';
    item.appendChild(createStatusElement(passed ? 'pass' : 'fail'));
    list.appendChild(item);
}

/**
 * Volumetric Calculations
 */

// Calculate volumetric properties
function calculateVolumetrics(solution, materials, targetBinder, totalAggMass) {
    // Get volumetric inputs
    const binderSG = parseNum(document.getElementById('binderSG').value) || DEFAULT_BINDER_SG;
    const mixSG = parseNum(document.getElementById('mixSG').value);
    const defaultAggSG = parseNum(document.getElementById('defaultAggSG').value) || DEFAULT_AGG_SG;
    
    // Calculate blended aggregate specific gravity (Gsb)
    let blendedGsb = 0;
    let denominator = 0;
    
    materials.forEach(material => {
        if (material.type !== 'binder') {
            const proportion = solution[material.id] || 0;
            const aggMass = proportion * material.aggFraction;
            
            if (aggMass > 0) {
                denominator += aggMass / material.sg;
            }
        }
    });
    
    if (totalAggMass > 0 && denominator > 0) {
        blendedGsb = totalAggMass / denominator;
    } else {
        blendedGsb = defaultAggSG;
    }
    
    // Calculate maximum theoretical specific gravity (Gmm)
    const Pb = targetBinder / 100; // Binder content as fraction
    const Ps = totalAggMass / 100; // Aggregate content as fraction
    
    const Gmm = 1 / (Pb / binderSG + Ps / blendedGsb);
    
    // Update volumetric table
    let Va = NaN;
    let VMA = NaN;
    let VFA = NaN;
    
    if (!isNaN(mixSG)) {
        // Calculate air voids (Va)
        Va = 100 * (1 - mixSG / Gmm);
        
        // Calculate voids in mineral aggregate (VMA)
        VMA = 100 - (mixSG * Ps / blendedGsb * 100);
        
        // Calculate voids filled with asphalt (VFA)
        if (VMA > 0) {
            VFA = 100 * ((VMA - Va) / VMA);
            // Bound VFA between 0-100 if numeric
            if (!isNaN(VFA)) {
                VFA = Math.max(0, Math.min(100, VFA));
            }
        }
        
        // Update volumetric note
        document.getElementById('volumetricsNote').textContent = 
            'Note: Volumetric calculations based on provided Gmb and computed Gmm.';
    } else {
        // Update volumetric note
        document.getElementById('volumetricsNote').textContent = 
            'Note: Volumetric calculations require Gmb input (bulk specific gravity of compacted mix).';
    }
    
    // Update volumetric values
    updateVolumetricValue('airVoids', Va, VOLUMETRIC_SPECS.Va);
    updateVolumetricValue('vma', VMA, VOLUMETRIC_SPECS.VMA);
    updateVolumetricValue('vfa', VFA, VOLUMETRIC_SPECS.VFA);
}

// Update volumetric value in the table
function updateVolumetricValue(id, value, spec) {
    const valueElement = document.getElementById(id);
    const statusElement = document.getElementById(id + 'Status');
    
    if (isNaN(value)) {
        valueElement.textContent = 'N/A';
        statusElement.innerHTML = '';
        statusElement.appendChild(createStatusElement('na'));
        return;
    }
    
    valueElement.textContent = formatNum(value, 1) + spec.unit;
    
    const inRange = isInRange(value, spec.min, spec.max);
    statusElement.innerHTML = '';
    statusElement.appendChild(createStatusElement(inRange ? 'pass' : 'fail'));
}

/**
 * Event Listeners and Initialization
 */

// Initialize the application
async function initialize() {
    try {
        // Load the envelope data
        const response = await fetch('specs/r116_dga14.json');
        envelope = await response.json();
        
        // Initialize sieve columns
        initializeSieveColumns();
        
        // Add event listeners
        document.getElementById('addAggBtn').addEventListener('click', () => addMaterialRow('aggregate'));
        document.getElementById('addRapBtn').addEventListener('click', () => addMaterialRow('rap'));
        document.getElementById('addBinderBtn').addEventListener('click', () => addMaterialRow('binder'));
        document.getElementById('loadSampleBtn').addEventListener('click', loadSampleScenario);
        document.getElementById('solveBtn').addEventListener('click', buildAndSolveModel);
        
        // Add one row of each type to start
        addMaterialRow('aggregate');
        addMaterialRow('binder');
        
        console.log('Asphalt Mix Optimiser initialized successfully.');
    } catch (error) {
        console.error('Error initializing application:', error);
        showError('Failed to load specification data. Please refresh the page or contact support.');
    }
}

// Start the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);
