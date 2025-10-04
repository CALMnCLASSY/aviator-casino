# ClassyBet Aviator - Frontend Deployment

## 🌐 Live URLs

- **Frontend (Netlify)**: https://classybet.netlify.app
- **Backend API (Vercel)**: https://aviator-casino.vercel.app

## 📁 Deployment Structure

### Frontend (This Folder - Deploy to Netlify)
- Static files: HTML, CSS, JavaScript
- Location: `/classybet` folder
- Platform: Netlify
- URL: classybet.netlify.app

### Backend (Separate Deployment on Vercel)
- Express.js API server
- MongoDB Atlas database
- JWT authentication
- Location: Root project with `/api` folder
- Platform: Vercel
- URL: aviator-casino.vercel.app

## 🚀 Netlify Deployment Steps

### Method 1: Drag & Drop (Easiest)

1. **Prepare the folder:**
   - Zip the entire `classybet` folder
   - Or prepare to drag the folder directly

2. **Deploy to Netlify:**
   - Go to https://app.netlify.com/drop
   - Drag the `classybet` folder onto the page
   - Wait for deployment to complete
   - Get your temporary URL (e.g., `random-name-123.netlify.app`)

3. **Configure Custom Domain:**
   - Go to Site Settings → Domain Management
   - Click "Add custom domain"
   - Enter: `classybet.netlify.app`
   - Confirm and wait for DNS propagation

### Method 2: Git Integration (Recommended)

1. **Connect Repository:**
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect to your GitHub account
   - Select repository: `CALMnCLASSY/aviator-casino`

2. **Configure Build Settings:**
   ```
   Base directory: classybet
   Build command: (leave empty - static site)
   Publish directory: . (current directory)
   ```

3. **Set Custom Domain:**
   - Site Settings → Domain Management
   - Add domain: `classybet.netlify.app`

4. **Deploy:**
   - Click "Deploy site"
   - Wait 1-2 minutes for deployment
   - Site will be live at classybet.netlify.app

## ✅ Verification Checklist

After deployment, verify:

- [ ] Frontend loads at https://classybet.netlify.app
- [ ] Backend API responds at https://aviator-casino.vercel.app/health
- [ ] Login/Register forms work correctly
- [ ] User authentication persists across page refreshes
- [ ] Game functionality works
- [ ] All images and assets load properly
- [ ] No CORS errors in browser console

## 🔧 Backend Configuration (Already on Vercel)

Your backend environment variables should be set in Vercel:

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password
NODE_ENV=production
```

## 🐛 Troubleshooting

### Login Not Working
- Check backend API is running: https://aviator-casino.vercel.app/health
- Verify environment variables in Vercel dashboard
- Check browser console for CORS errors

### Assets Not Loading
- Verify all file paths are relative
- Check netlify.toml configuration
- Clear browser cache and hard refresh

### 404 Errors on Refresh
- Ensure netlify.toml redirects are configured
- Verify base directory is set to `classybet`

## 📝 Important Notes

- Frontend and backend are **completely separate**
- Frontend is purely static (HTML/CSS/JS)
- Backend handles all API requests and database operations
- CORS is configured in backend to allow frontend domain
- JWT tokens are stored in localStorage
- Session persists across page refreshes

## 🔄 Update Process

To update the frontend:
1. Make changes locally
2. Commit and push to GitHub
3. Netlify auto-deploys (if Git integration)
4. Or drag-and-drop new folder (if manual)

To update the backend:
1. Update code in root project
2. Commit and push to GitHub
3. Vercel auto-deploys

## 📞 API Endpoints

All API calls go to: `https://aviator-casino.vercel.app`

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Verify JWT token
- `GET /profile` - Get user profile
- `GET /health` - Health check

## 🎮 Game Features

- Real-time multiplier updates
- Betting system with balance tracking
- User authentication and profiles
- Transaction history
- Responsive mobile design
- Admin panel (separate deployment)

---

**Last Updated:** October 4, 2025
**Maintainer:** CALMnCLASSY
