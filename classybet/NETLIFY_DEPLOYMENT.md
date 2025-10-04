# 🚀 NETLIFY DEPLOYMENT CHECKLIST

## ✅ Pre-Deployment Completed:
- [x] Netlify configuration file created (netlify.toml)
- [x] Backend API URL configured (https://aviator-casino.vercel.app)
- [x] Frontend code ready in classybet folder
- [x] Changes committed and pushed to GitHub

---

## 📋 DEPLOY TO NETLIFY - STEP BY STEP

### **Option 1: Git Integration (Recommended)**

#### Step 1: Go to Netlify Dashboard
- Visit: https://app.netlify.com
- Log in with your account

#### Step 2: Import Project
1. Click **"Add new site"** → **"Import an existing project"**
2. Choose **"Deploy with GitHub"**
3. Authorize Netlify to access your GitHub repositories
4. Search and select: **`CALMnCLASSY/aviator-casino`**

#### Step 3: Configure Build Settings
```
Base directory: classybet
Build command: (leave empty)
Publish directory: . (dot means current directory)
Branch to deploy: main
```

#### Step 4: Configure Site Name
1. After deployment, go to **Site Settings**
2. Click **"Change site name"**
3. Enter: **`classybet`**
4. Your site will be: **https://classybet.netlify.app**

#### Step 5: Deploy
- Click **"Deploy site"**
- Wait 30-60 seconds
- Your site will be live! 🎉

---

### **Option 2: Drag & Drop (Quick Test)**

#### Step 1: Prepare Folder
- Open File Explorer
- Navigate to: `C:\Users\User\OneDrive\Desktop\aviator-signals-complete\casino\aviator-betting-game-clone\classybet`
- This is your deployment folder

#### Step 2: Deploy
1. Go to: https://app.netlify.com/drop
2. Drag the **entire `classybet` folder** onto the page
3. Wait for upload and deployment (1-2 minutes)
4. You'll get a random URL like: `random-name-123.netlify.app`

#### Step 3: Claim Custom Domain
1. Go to **Site Settings** → **Domain Management**
2. Click **"Add custom domain"**
3. Enter: **`classybet.netlify.app`**
4. Confirm domain

---

## 🔧 Post-Deployment Configuration

### Verify Backend API (Already on Vercel)

1. **Check Backend Health:**
   - Open: https://aviator-casino.vercel.app/health
   - Should return: `{"status":"ok","message":"Server is running"}`

2. **Verify Environment Variables in Vercel:**
   - Go to: https://vercel.com/dashboard
   - Select your project
   - Settings → Environment Variables
   - Confirm these exist:
     ```
     MONGODB_URI = mongodb+srv://...
     JWT_SECRET = your-secret-key
     ADMIN_EMAIL = your-email@example.com
     ADMIN_PASSWORD = your-password
     NODE_ENV = production
     ```

3. **If Variables Missing - Add Them:**
   - Click "Add New"
   - Add each variable
   - Click "Save"
   - Go to Deployments → Click "..." → "Redeploy"

---

## ✅ Testing Checklist

After deployment, test these features:

### Frontend (https://classybet.netlify.app)
- [ ] Site loads without errors
- [ ] All images and assets load
- [ ] Navigation works properly
- [ ] Mobile responsive design works

### Authentication
- [ ] Register new account works
- [ ] Login with credentials works
- [ ] Token is saved in localStorage
- [ ] User stays logged in after refresh
- [ ] Logout works properly

### Game Features
- [ ] Game canvas loads
- [ ] Multiplier animation works
- [ ] Betting controls functional
- [ ] Balance updates correctly
- [ ] Bet history displays

### Console Checks
- [ ] No CORS errors in browser console
- [ ] No 404 errors for assets
- [ ] API calls successful (check Network tab)
- [ ] Console shows: "API Base URL: https://aviator-casino.vercel.app"

---

## 🐛 Troubleshooting

### Issue: Login Returns 500 Error

**Check:**
1. Backend API health: https://aviator-casino.vercel.app/health
2. Vercel function logs (Dashboard → Deployments → View Function Logs)
3. MongoDB connection string is correct
4. Environment variables are set

**Fix:**
- Verify MONGODB_URI includes database name
- Check MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
- Ensure JWT_SECRET is set
- Redeploy Vercel after adding environment variables

### Issue: CORS Errors

**Fix:** Update backend CORS in `api/index.js`:
```javascript
app.use(cors({
    origin: ['https://classybet.netlify.app', 'http://localhost:3000'],
    credentials: true
}));
```

### Issue: Assets Not Loading (404)

**Fix:**
- Check file paths are relative
- Verify netlify.toml is in classybet folder
- Check Base directory setting in Netlify

### Issue: Page Refresh Shows 404

**Fix:**
- Verify netlify.toml redirects are configured
- Should have: `from = "/*"` redirect to `"/index.html"`

---

## 🎯 Quick Commands

### Check Backend Status
```bash
curl https://aviator-casino.vercel.app/health
```

### Test Login API
```bash
curl -X POST https://aviator-casino.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 📞 Support Links

- **Netlify Dashboard:** https://app.netlify.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **GitHub Repo:** https://github.com/CALMnCLASSY/aviator-casino
- **MongoDB Atlas:** https://cloud.mongodb.com

---

## 🎉 Success!

Once everything works:
- ✅ Frontend: https://classybet.netlify.app
- ✅ Backend: https://aviator-casino.vercel.app
- ✅ Both deployed and connected
- ✅ Users can register, login, and play!

---

**Next Steps:**
1. Deploy to Netlify using one of the methods above
2. Test all features thoroughly
3. Monitor Vercel function logs for any backend errors
4. Share your live site! 🎮

**Good luck!** 🚀
