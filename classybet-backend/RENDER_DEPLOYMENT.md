# 🚀 RENDER.COM DEPLOYMENT GUIDE

## 📋 PRE-DEPLOYMENT CHECKLIST

✅ Backend folder: `classybet-backend`
✅ MongoDB URI ready from `.env` file
✅ JWT Secret configured
✅ Health endpoint at `/health`
✅ CORS updated for Netlify frontend

---

## 🎯 STEP 1: CREATE RENDER ACCOUNT

1. Go to: https://render.com
2. Click **"Get Started"** or **"Sign Up"**
3. Sign up with **GitHub** (recommended for auto-deploys)
4. Authorize Render to access your GitHub repositories

---

## 🎯 STEP 2: DEPLOY BACKEND TO RENDER

### Option A: Deploy from GitHub (Recommended)

#### 1. Create New Web Service
1. In Render Dashboard, click **"New +"** → **"Web Service"**
2. Click **"Connect a repository"**
3. Select your repository: **`CALMnCLASSY/aviator-casino`**
4. Click **"Connect"**

#### 2. Configure Build Settings
```
Name: classybet-backend
Region: Oregon (US West) - or closest to you
Branch: main
Root Directory: classybet-backend
Runtime: Node
Build Command: npm install
Start Command: npm start
```

#### 3. Select Free Plan
- Select **"Free"** plan
- Free tier includes:
  - 750 hours/month
  - Spins down after 15 min of inactivity
  - Wakes up on first request (may take 30-60 seconds)

#### 4. Add Environment Variables
Click **"Advanced"** → **"Add Environment Variable"**

Add these one by one:

```
MONGODB_URI
mongodb+srv://joshuajoee204_db_user:classyd3v@cluster0.nuiyrip.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

JWT_SECRET
a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1

NODE_ENV
production

ADMIN_EMAIL
admin@classybet.com

ADMIN_PASSWORD
admin123secure

PORT
10000

CLIENT_URL
https://classybet.netlify.app
```

#### 5. Create Web Service
- Click **"Create Web Service"**
- Render will start building and deploying
- Wait 3-5 minutes for first deployment
- You'll get a URL like: `https://classybet-backend.onrender.com`

---

### Option B: Manual Deploy (Alternative)

If you prefer manual deployment:

1. Create service from "New +" → "Web Service"
2. Choose "Deploy from Git repository"
3. Enter your repo details manually
4. Follow same configuration steps as Option A

---

## 🎯 STEP 3: VERIFY DEPLOYMENT

Once deployment shows **"Live"**:

### Test Health Endpoint
```
https://your-service-name.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "ClassyBet Aviator Backend is running",
  "timestamp": "2025-10-05T...",
  "mongodb": "connected",
  "version": "1.0.0",
  "endpoints": {
    "auth": "/api/auth",
    "game": "/api/game",
    "payments": "/api/payments",
    "admin": "/api/admin",
    "health": "/health"
  }
}
```

### Test API Endpoint
```bash
curl -X POST https://your-service-name.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

---

## 🎯 STEP 4: UPDATE FRONTEND CONFIGURATION

Once backend is deployed, update the frontend to use the new URL:

### Update `classybet/auth.js`

Change the API base URL from:
```javascript
this.apiBase = 'https://aviator-casino.vercel.app';
```

To your new Render URL:
```javascript
this.apiBase = 'https://classybet-backend.onrender.com';
```

---

## 🎯 STEP 5: DELETE OLD `/api` FOLDER

Now that we're using `classybet-backend`, we can remove the old serverless functions:

```bash
cd C:\Users\User\OneDrive\Desktop\aviator-signals-complete\casino\aviator-betting-game-clone
rm -rf api
git add -A
git commit -m "Remove old /api folder - using classybet-backend on Render"
git push origin main
```

---

## 🎯 STEP 6: UPDATE VERCEL (Optional Cleanup)

Since we're no longer using Vercel for backend:

### Option A: Delete Vercel Project
1. Go to Vercel Dashboard
2. Select project
3. Settings → Delete Project

### Option B: Keep for Reference
- Just leave it inactive
- Won't incur any charges

---

## 📋 POST-DEPLOYMENT CHECKLIST

- [ ] Backend deployed on Render successfully
- [ ] Health endpoint returns 200 OK
- [ ] MongoDB connected (check logs in Render dashboard)
- [ ] All environment variables set correctly
- [ ] CORS allows `classybet.netlify.app`
- [ ] Frontend `auth.js` updated with new backend URL
- [ ] Old `/api` folder deleted
- [ ] Changes committed and pushed to GitHub

---

## 🐛 TROUBLESHOOTING

### Issue: Service Won't Start

**Check Render Logs:**
1. Go to Render Dashboard
2. Click your service
3. Click "Logs" tab
4. Look for error messages

**Common Issues:**
- Missing environment variables
- MongoDB connection string incorrect
- Port configuration wrong

**Fix:**
- Verify all environment variables in Render
- Check MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
- Ensure PORT is set to 10000

### Issue: MongoDB Connection Failed

**Symptoms:**
- "MongooseServerSelectionError" in logs
- Backend starts but can't connect to DB

**Fix:**
1. Go to MongoDB Atlas
2. Network Access → Add IP Address
3. Click "Allow Access from Anywhere" (0.0.0.0/0)
4. Wait 2-3 minutes for changes to propagate
5. Restart Render service

### Issue: CORS Errors from Frontend

**Symptoms:**
- Frontend can't make API calls
- "CORS policy" errors in browser console

**Fix:**
1. Verify `classybet-backend/server.js` includes:
   ```javascript
   'https://classybet.netlify.app'
   ```
2. Redeploy backend on Render
3. Clear browser cache

### Issue: Service Spins Down (Free Tier)

**Behavior:**
- First request after 15 min takes 30-60 seconds
- Subsequent requests are fast

**Solutions:**
- **Accept it:** Free tier limitation
- **Upgrade:** $7/month for always-on
- **Use Cron Job:** Keep-alive ping every 10 minutes

---

## 💡 RENDER FREE TIER NOTES

**Limitations:**
- Spins down after 15 minutes of inactivity
- 750 hours/month (enough for most use cases)
- Cold start time: 30-60 seconds

**Advantages:**
- Zero cost
- Automatic HTTPS
- Easy GitHub integration
- Good performance when active
- No credit card required

**Upgrade Options:**
- $7/month: Always-on, no spin-down
- Better for production use
- Faster response times

---

## 🔗 IMPORTANT URLS

**After Deployment:**
- Backend: `https://classybet-backend.onrender.com`
- Frontend: `https://classybet.netlify.app` (deploy next)
- MongoDB: `https://cloud.mongodb.com`

**Dashboards:**
- Render: https://dashboard.render.com
- Netlify: https://app.netlify.com
- MongoDB: https://cloud.mongodb.com
- GitHub: https://github.com/CALMnCLASSY/aviator-casino

---

## 🎉 SUCCESS!

Once everything is working:
- ✅ Backend on Render (classybet-backend)
- ✅ Frontend on Netlify (classybet folder)
- ✅ Database on MongoDB Atlas
- ✅ Clean architecture with proper separation

**Next:** Deploy frontend to Netlify using `classybet` folder!

---

## 📞 NEED HELP?

If you encounter issues:
1. Check Render logs for backend errors
2. Verify MongoDB Atlas IP whitelist
3. Confirm all environment variables are set
4. Test health endpoint first
5. Then test authentication endpoints

**Your backend URL will be:** `https://[your-service-name].onrender.com`

Save this URL - you'll need it for the frontend configuration!
