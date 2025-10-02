const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true); // Allow all origins for production
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import and use routes
try {
  const authRoutes = require('../classybet-backend/routes/auth');
  const adminRoutes = require('../classybet-backend/routes/admin');
  const gameRoutes = require('../classybet-backend/routes/game');
  const paymentRoutes = require('../classybet-backend/routes/payments');
  const setupRoutes = require('./setup');

  // Use routes
  app.use('/api/auth', authRoutes);
  app.use('/admin', adminRoutes);
  app.use('/api/game', gameRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/setup', setupRoutes);

} catch (error) {
  console.error('Error loading routes:', error);
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: 'production',
    routes: {
      auth: '/api/auth/*',
      admin: '/admin/*',
      game: '/api/game/*',
      payments: '/api/payments/*'
    }
  });
});

// Root API endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'ClassyBet Aviator Backend API',
    status: 'OK',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      admin: '/admin',
      api: '/api'
    },
    timestamp: new Date().toISOString()
  });
});

// Fallback for admin routes (serve admin HTML)
app.get('/admin*', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>ClassyBet Admin</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; margin-bottom: 30px; }
            .login-form { margin-top: 30px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
            input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
            button { width: 100%; padding: 12px; background: #007cba; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
            button:hover { background: #005a87; }
            .error { color: red; margin-top: 10px; }
            .success { color: green; margin-top: 10px; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 30px; }
            .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; color: #007cba; }
            .stat-label { color: #666; margin-top: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎮 ClassyBet Admin Panel</h1>
            
            <div id="login-section">
                <div class="login-form">
                    <div class="form-group">
                        <label for="email">Email:</label>
                        <input type="email" id="email" placeholder="admin@classybet.com" value="admin@classybet.com">
                    </div>
                    <div class="form-group">
                        <label for="password">Password:</label>
                        <input type="password" id="password" placeholder="Enter password">
                    </div>
                    <button onclick="login()">Login to Admin Panel</button>
                    <div id="message"></div>
                </div>
            </div>

            <div id="admin-content" style="display: none;">
                <h2>📊 Dashboard</h2>
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value" id="total-users">--</div>
                        <div class="stat-label">Total Users</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="total-bets">--</div>
                        <div class="stat-label">Total Bets</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="total-transactions">--</div>
                        <div class="stat-label">Transactions</div>
                    </div>
                </div>
                
                <button onclick="logout()" style="margin-top: 30px; background: #dc3545;">Logout</button>
            </div>
        </div>

        <script>
            async function login() {
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const message = document.getElementById('message');
                
                try {
                    const response = await fetch('/admin/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        message.innerHTML = '<div class="success">Login successful!</div>';
                        localStorage.setItem('adminToken', data.token);
                        showAdminContent();
                        loadStats();
                    } else {
                        message.innerHTML = '<div class="error">' + (data.error || 'Login failed') + '</div>';
                    }
                } catch (error) {
                    message.innerHTML = '<div class="error">Connection error: ' + error.message + '</div>';
                }
            }
            
            function showAdminContent() {
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('admin-content').style.display = 'block';
            }
            
            function logout() {
                localStorage.removeItem('adminToken');
                document.getElementById('login-section').style.display = 'block';
                document.getElementById('admin-content').style.display = 'none';
            }
            
            async function loadStats() {
                const token = localStorage.getItem('adminToken');
                if (!token) return;
                
                try {
                    const response = await fetch('/admin/dashboard-stats', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    
                    if (response.ok) {
                        const stats = await response.json();
                        document.getElementById('total-users').textContent = stats.totalUsers || 0;
                        document.getElementById('total-bets').textContent = stats.totalBets || 0;
                        document.getElementById('total-transactions').textContent = stats.totalTransactions || 0;
                    }
                } catch (error) {
                    console.error('Error loading stats:', error);
                }
            }
            
            // Check if already logged in
            if (localStorage.getItem('adminToken')) {
                showAdminContent();
                loadStats();
            }
        </script>
    </body>
    </html>
  `);
});

// Profile route fallback
app.get('/profile*', (req, res) => {
  res.redirect('/admin');
});

// Catch all for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Export for Vercel
module.exports = app;