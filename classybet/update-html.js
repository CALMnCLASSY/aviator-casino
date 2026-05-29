const fs = require('fs');
const path = require('path');

function updateFile(filepath) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');
    
    // Replace hardcoded minimums
    content = content.replace(/min="499"/g, 'min="5"');
    content = content.replace(/KSh 499\.00/g, '...');
    content = content.replace(/KES 499/g, '...');
    content = content.replace(/placeholder="Min: 499"/g, 'placeholder="Min: ..."');
    content = content.replace(/depositAmountEl\.min = 499;/g, 'depositAmountEl.min = window.dynamicMinDeposit || 5;');
    content = content.replace(/depositAmountEl\.placeholder = 'Min: 499';/g, `depositAmountEl.placeholder = 'Min: ' + (window.dynamicMinDeposit || 5);`);
    content = content.replace(/if \(minDepositEl\) minDepositEl\.textContent = 'KSh 499\.00';/g, '');
    
    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Updated', filepath);
}

const files = ['base.html', 'dashboard.html', 'profile.html'];
files.forEach(updateFile);
