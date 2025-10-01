# ClassyBet Setup and Testing Guide

## Quick Setup Steps

### 1. Backend Setup
```bash
cd classybet-backend

# Install dependencies
npm install

# Configure environment
# Edit .env file with your MongoDB URI and settings

# Start the backend server
npm start
```

### 2. Frontend Setup
```bash
# Navigate to the main game folder
cd classybet

# The frontend is ready to use - just open base.html in a browser
# OR serve it with a local server for better development
# Using Python:
python -m http.server 3000
# OR using Node.js:
npx serve -s . -l 3000
```

## Testing Checklist

### Authentication Flow
- [ ] 1. Open the game in browser
- [ ] 2. Click "Register" button
- [ ] 3. Fill registration form with valid data
- [ ] 4. Check backend logs for new user creation
- [ ] 5. Verify Telegram notification (if configured)
- [ ] 6. Test login with registered credentials
- [ ] 7. Verify user balance displays correctly
- [ ] 8. Test logout functionality

### Deposit Flow
- [ ] 1. Login as registered user
- [ ] 2. Click "Deposit" button
- [ ] 3. Fill deposit form (amount: 100, phone: 254700000000)
- [ ] 4. Submit STK Push request
- [ ] 5. Check backend logs for transaction creation
- [ ] 6. Verify transaction appears in profile page
- [ ] 7. Test M-Pesa callback (if configured)

### Game Integration
- [ ] 1. Login and verify balance shows in game
- [ ] 2. Try placing a bet (should work with real balance)
- [ ] 3. Test cashout functionality
- [ ] 4. Verify balance updates after bet/win
- [ ] 5. Check bet history in profile

### Admin Dashboard
- [ ] 1. Access http://localhost:3001/admin
- [ ] 2. Login with admin credentials
- [ ] 3. View user list and transactions
- [ ] 4. Test balance adjustment
- [ ] 5. Process pending transactions

### Profile Page
- [ ] 1. Access http://localhost:3001/profile
- [ ] 2. Login as regular user
- [ ] 3. View transaction history
- [ ] 4. Test deposit via STK Push
- [ ] 5. Update account settings

## Environment Configuration

### Required Environment Variables (.env)
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/classybet
JWT_SECRET=your_secret_key_here
MPESA_CONSUMER_KEY=your_mpesa_key
TELEGRAM_BOT_TOKEN=your_telegram_token
```

### Optional for Full M-Pesa Integration
```
MPESA_CONSUMER_SECRET=your_mpesa_secret
MPESA_PASSKEY=your_mpesa_passkey
TELEGRAM_ADMIN_CHAT_ID=your_chat_id
```

## Database Setup

### MongoDB Collections Created Automatically
- users (authentication and balances)
- transactions (deposit/withdrawal/bet history)  
- bets (game round records)

### Sample Data Creation
The backend automatically creates:
- Admin user (admin@classybet.com / admin123)
- Sample transactions for testing

## API Endpoints

### Authentication
- POST /api/auth/register
- POST /api/auth/login  
- GET /api/auth/profile
- GET /api/auth/transactions
- GET /api/auth/bets

### Game
- POST /api/game/bet
- POST /api/game/cashout
- POST /api/game/end-round
- GET /api/game/active-bets/:round
- GET /api/game/my-bet/:round

### Payments
- POST /api/payments/stk-push
- POST /api/payments/stk-callback

### Admin
- GET /api/admin/users
- PUT /api/admin/user/:id/balance
- GET /api/admin/transactions
- PUT /api/admin/transaction/:id/approve

## Troubleshooting

### Common Issues
1. **CORS Errors**: Check CLIENT_URL in .env matches frontend URL
2. **MongoDB Connection**: Verify MONGODB_URI is correct
3. **Authentication Failed**: Check JWT_SECRET is set
4. **Balance Not Updating**: Verify API integration in frontend
5. **STK Push Fails**: Check M-Pesa credentials in .env

### Debug Steps
1. Check browser console for JavaScript errors
2. Check backend terminal for server logs
3. Verify MongoDB connection in Atlas
4. Test API endpoints with Postman/curl
5. Check network tab in browser dev tools

## Production Deployment

### Security Checklist
- [ ] Change all default passwords
- [ ] Set strong JWT_SECRET
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS
- [ ] Set up proper MongoDB access controls
- [ ] Configure real M-Pesa credentials
- [ ] Set up monitoring and logging

### Deployment Platforms
- **Backend**: Heroku, DigitalOcean, AWS, Railway
- **Frontend**: Netlify, Vercel, GitHub Pages
- **Database**: MongoDB Atlas, DigitalOcean Managed MongoDB

## Support

For issues or questions:
1. Check the backend logs first
2. Verify all environment variables are set
3. Test API endpoints individually
4. Check MongoDB connection and data
5. Review frontend console for errors