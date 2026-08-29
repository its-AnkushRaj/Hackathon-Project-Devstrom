// --- STATE MANAGEMENT ---
const state = {
    limitPercent: 30,
    budget: 3000,
    currency: '₹', // Default Currency
    members: [{ id: 1, name: "Roommate 1", room: "Bedroom A", income: 4000, customPercent: 50 }],
    expenses: [{ id: 1, name: "Rent", category: "Housing", amount: 1500, splitMethod: "equal" }]
};

let isDarkMode = false;

// --- CORE LOGIC & CALCULATION ---
function calculate() {
    let totalIncome = state.members.reduce((sum, m) => sum + (parseFloat(m.income) || 0), 0);
    let totalExpenses = state.expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Calculate sum of custom percentages and check if any expense actually uses the custom split
    let totalCustomPercent = state.members.reduce((sum, m) => sum + (parseFloat(m.customPercent) || 0), 0);
    let hasCustomExpense = state.expenses.some(e => e.splitMethod === 'custom');

    // Reset member liabilities
    let memberStats = state.members.map(m => ({ ...m, totalOwed: 0 }));

    // Apply Split Engine
    state.expenses.forEach(exp => {
        let amount = parseFloat(exp.amount) || 0;
        if (amount === 0 || memberStats.length === 0) return;

        memberStats.forEach(member => {
            let share = 0;
            if (exp.splitMethod === 'equal') {
                share = amount / memberStats.length;
            } else if (exp.splitMethod === 'income') {
                let mIncome = parseFloat(member.income) || 0;
                share = totalIncome > 0 ? amount * (mIncome / totalIncome) : 0;
            } else if (exp.splitMethod === 'custom') {
                let mPercent = parseFloat(member.customPercent) || 0;
                share = amount * (mPercent / 100);
            }
            
            member.totalOwed += share; // Add to the total share
        });
    });

    // Pass the custom split data into the alerts function
    renderAlerts(totalExpenses, totalIncome, hasCustomExpense, totalCustomPercent);
    renderAffordability(totalExpenses, totalIncome, memberStats);
}

// --- DOM RENDERERS ---
function renderUI() {
    const memContainer = document.getElementById('members-container');
    memContainer.innerHTML = state.members.map((m, i) => `
        <div class="list-item">
            <div class="row">
                <strong>#${i + 1}</strong>
                <input type="text" value="${m.name}" onchange="updateMember(${m.id}, 'name', this.value)" placeholder="Name">
                <input type="text" value="${m.room}" onchange="updateMember(${m.id}, 'room', this.value)" placeholder="Room">
                <button onclick="removeMember(${m.id})">X</button>
            </div>
            <div class="row">
                <label>Income (${state.currency}):</label>
                <input type="number" value="${m.income}" onchange="updateMember(${m.id}, 'income', this.value)">
                <label>Custom Split (%):</label>
                <input type="number" value="${m.customPercent}" onchange="updateMember(${m.id}, 'customPercent', this.value)">
            </div>
        </div>
    `).join('');

    const expContainer = document.getElementById('expenses-container');
    expContainer.innerHTML = state.expenses.map((e, i) => `
        <div class="list-item">
            <div class="row">
                <input type="text" value="${e.name}" onchange="updateExpense(${e.id}, 'name', this.value)">
                <select onchange="updateExpense(${e.id}, 'category', this.value)">
                    <option value="Housing" ${e.category === 'Housing' ? 'selected' : ''}>Housing (Rent)</option>
                    <option value="Utility" ${e.category === 'Utility' ? 'selected' : ''}>Utility (Water/Elec)</option>
                    <option value="Other" ${e.category === 'Other' ? 'selected' : ''}>Other</option>
                </select>
                <button onclick="removeExpense(${e.id})">X</button>
            </div>
            <div class="row">
                <label>Amount (${state.currency}):</label>
                <input type="number" value="${e.amount}" onchange="updateExpense(${e.id}, 'amount', this.value)">
                <label>Split Method:</label>
                <select onchange="updateExpense(${e.id}, 'splitMethod', this.value)">
                    <option value="equal" ${e.splitMethod === 'equal' ? 'selected' : ''}>Equal</option>
                    <option value="income" ${e.splitMethod === 'income' ? 'selected' : ''}>Income-Based</option>
                    <option value="custom" ${e.splitMethod === 'custom' ? 'selected' : ''}>Custom %</option>
                </select>
            </div>
        </div>
    `).join('');

    calculate();
}

function renderAlerts(totalExpenses, totalIncome, hasCustomExpense, totalCustomPercent) {
    const alerts = document.getElementById('alerts-container');
    let html = '';

    // NEW ERROR LOGIC: Check if Custom Split is active but does not equal 100%
    if (hasCustomExpense && Math.abs(totalCustomPercent - 100) > 0.01) {
        html += `<div class="alert danger" style="border-width: 2px;">⚠️ <strong>Custom Split Error:</strong> Your assigned custom percentages add up to ${totalCustomPercent}%. They must equal exactly 100% for the math to work!</div>`;
    }

    if (totalExpenses > state.budget) {
        html += `<div class="alert danger">⚠️ Budget Exceeded! Total spending (${state.currency}${totalExpenses}) is over your ${state.currency}${state.budget} limit.</div>`;
    } else if (totalExpenses > state.budget * 0.9) {
        html += `<div class="alert warning">⚠️ Approaching Budget: Total spending is at ${state.currency}${totalExpenses}.</div>`;
    }

    alerts.innerHTML = html;
}

function renderAffordability(totalExpenses, totalIncome, memberStats) {
    // Household Math
    const householdRatio = totalIncome > 0 ? (totalExpenses / totalIncome) : 0;
    const housePercent = (householdRatio * 100).toFixed(1);
    
    const meter = document.getElementById('household-meter');
    const status = document.getElementById('household-status');
    
    meter.style.width = Math.min(housePercent, 100) + '%';
    meter.className = `meter-bar ${housePercent > state.limitPercent ? 'danger' : (housePercent > state.limitPercent - 5 ? 'warning' : 'safe')}`;
    
    status.innerHTML = `Total expenses consume <strong>${housePercent}%</strong> of combined household income. (Limit: ${state.limitPercent}%)`;

    // Individual Math
    const breakdown = document.getElementById('individual-breakdown');
    breakdown.innerHTML = memberStats.map(m => {
        let personalRatio = m.income > 0 ? (m.totalOwed / m.income) * 100 : 0;
        let isOver = personalRatio > state.limitPercent;
        return `
            <div style="margin-top: 10px; padding: 10px; background: var(--bg-main); border-radius: 4px;">
                <strong>${m.name} (${m.room}):</strong> Total Share: ${state.currency}${m.totalOwed.toFixed(2)}
                <br>
                <span style="color: ${isOver ? 'var(--danger)' : 'var(--text-muted)'}; font-size: 0.9em;">
                    Total expenses take ${personalRatio.toFixed(1)}% of income ${isOver ? '(EXCEEDS LIMIT)' : ''}
                </span>
            </div>
        `;
    }).join('');
}

// --- CRUD OPERATIONS ---
function addMember() {
    const id = Date.now();
    state.members.push({ id, name: "New Roommate", room: "TBD", income: 0, customPercent: 0 });
    renderUI();
}

function updateMember(id, field, value) {
    const member = state.members.find(m => m.id === id);
    if (member) member[field] = value;
    renderUI();
}

function removeMember(id) {
    state.members = state.members.filter(m => m.id !== id);
    renderUI();
}

function addExpense() {
    const id = Date.now();
    state.expenses.push({ id, name: "New Expense", category: "Other", amount: 0, splitMethod: "equal" });
    renderUI();
}

function updateExpense(id, field, value) {
    const exp = state.expenses.find(e => e.id === id);
    if (exp) exp[field] = value;
    renderUI();
}

function removeExpense(id) {
    state.expenses = state.expenses.filter(e => e.id !== id);
    renderUI();
}

function updateBudget(val) { state.budget = parseFloat(val) || 0; calculate(); }

function updateLimit(val) { 
    state.limitPercent = parseInt(val); 
    document.getElementById('limit-display').innerText = val + '%';
    calculate(); 
}

// --- SETTINGS LOGIC ---
function updateColor(colorValue) {
    document.documentElement.style.setProperty('--primary', colorValue);
    document.documentElement.style.setProperty('--primary-hover', colorValue); 
}

function updateCurrency(val) {
    state.currency = val;
    // Update the static HTML budget label span
    document.querySelectorAll('.currency-display').forEach(el => el.innerText = val);
    renderUI(); // Re-render lists and calculations to show new currency symbol
}

// --- MODALS, THEME VISUAL TOGGLE & SHARE ---
function openModal(id) {
    if (id === 'share-modal') generateReport();
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function toggleThemeVisual() {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

function generateReport() {
    let report = `--- RENTWISE HOUSEHOLD REPORT ---\n`;
    report += `Budget Limit: ${state.currency}${state.budget} | Affordability Limit: ${state.limitPercent}%\n\n`;
    report += `MEMBERS:\n`;
    state.members.forEach(m => report += `- ${m.name} (${m.room}): Income ${state.currency}${m.income}\n`);
    report += `\nEXPENSES:\n`;
    let total = 0;
    state.expenses.forEach(e => {
        report += `- ${e.name} (${e.category}): ${state.currency}${e.amount} (Split: ${e.splitMethod})\n`;
        total += parseFloat(e.amount) || 0;
    });
    report += `\nTOTAL SPENDING: ${state.currency}${total}\n`;
    document.getElementById('report-output').value = report;
}

function copyReport() {
    const text = document.getElementById('report-output');
    text.select();
    navigator.clipboard.writeText(text.value);
    alert("Report copied to clipboard!");
}

// Initial render
window.onload = renderUI;