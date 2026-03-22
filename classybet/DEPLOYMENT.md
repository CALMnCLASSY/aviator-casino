# ClassyBet Aviator - Frontend Deployment

## 🌐 Live URLs

- **Frontend (Netlify)**: https://ClassyBet.netlify.app
- **Frontend (Vercel)**: https://ClassyBet-aviator.vercel.app
- **Backend API (VPS)**: https://back.classybetaviator.com

## 📁 Deployment Structure

### Frontend (This Folder - Deploy to Netlify or Vercel)
- Static files: HTML, CSS, JavaScript
- Location: `/ClassyBet` folder
- Platform: Netlify (primary) or Vercel (alternative)
- URLs: 
  - ClassyBet.netlify.app
  - ClassyBet-aviator.vercel.app

### Backend (Deployed on Render)
- Express.js API server
- MongoDB Atlas database
- JWT authentication
- Location: `/ClassyBet-backend` folder
- Platform: VPS
- URL: back.classybetaviator.com

## 🚀 Netlify Deployment Steps

### Method 1: Drag & Drop (Easiest)

1. **Prepare the folder:**
   - Zip the entire `ClassyBet` folder
   - Or prepare to drag the folder directly

2. **Deploy to Netlify:**
   - Go to https://app.netlify.com/drop
   - Drag the `ClassyBet` folder onto the page
   - Wait for deployment to complete
   - Get your temporary URL (e.g., `random-name-123.netlify.app`)

3. **Configure Custom Domain:**
   - Go to Site Settings → Domain Management
   - Click "Add custom domain"
   - Enter: `ClassyBet.netlify.app`
   - Confirm and wait for DNS propagation

### Method 2: Git Integration (Recommended)

1. **Connect Repository:**
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect to your GitHub account
   - Select repository: `CALMnCLASSY/aviator-casino`

2. **Configure Build Settings:**
   ```
   Base directory: ClassyBet
   Build command: (leave empty - static site)
   Publish directory: . (current directory)
   ```

3. **Set Custom Domain:**
   - Site Settings → Domain Management
   - Add domain: `ClassyBet.netlify.app`

4. **Deploy:**
   - Click "Deploy site"
   - Wait 1-2 minutes for deployment
   - Site will be live at ClassyBet.netlify.app

## ✅ Verification Checklist

After deployment, verify:

- [ ] Frontend loads at https://ClassyBet.netlify.app
- [ ] Backend API responds at https://back.classybetaviator.com/health
- [ ] Login/Register forms work correctly
- [ ] User authentication persists across page refreshes
- [ ] Game functionality works
- [ ] All images and assets load properly
- [ ] No CORS errors in browser console

## 🔧 Backend Configuration (Already on Render)

Your backend environment variables should be set in Render Dashboard:

**Backend URL:** https://back.classybetaviator.com

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password
NODE_ENV=production
CLIENT_URL=https://ClassyBet.netlify.app
```

**Note:** Render free tier spins down after 15 minutes of inactivity. First request may take 30-60 seconds to wake up.

## 🐛 Troubleshooting

### Login Not Working
- Check backend API is running: https://back.classybetaviator.com/health
- **Important:** First request may take 30-60 seconds (Render free tier wake-up)
- Verify environment variables in Render dashboard
- Check browser console for CORS errors

### Assets Not Loading
- Verify all file paths are relative
- Check netlify.toml configuration
- Clear browser cache and hard refresh

### 404 Errors on Refresh
- Ensure netlify.toml redirects are configured
- Verify base directory is set to `ClassyBet`

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

All API calls go to: `https://back.classybetaviator.com`

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
