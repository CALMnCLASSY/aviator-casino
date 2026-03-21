const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve base.html as the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'base.html'));
});

// Handle all other routes by serving base.html (for SPA routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'base.html'));
});

app.listen(PORT, () => {
    console.log(`\n🌐 ClassyBet Frontend Server is running!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🎮 Game: http://localhost:${PORT}/base.html`);
    console.log(`📱 Mobile: http://localhost:${PORT}/index.html`);
    console.log('='.repeat(50));
});