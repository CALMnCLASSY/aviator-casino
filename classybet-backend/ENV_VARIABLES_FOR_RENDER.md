# 🔑 ENVIRONMENT VARIABLES FOR RENDER

Copy and paste these exact values into Render Dashboard:

---

## Variable 1: MONGODB_URI
```
mongodb+srv://joshuajoee204_db_user:classyd3v@cluster0.nuiyrip.mongodb.net/classybet?retryWrites=true&w=majority&appName=Cluster0
```

## Variable 2: JWT_SECRET
```
a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1
```

## Variable 3: NODE_ENV
```
production
```

## Variable 4: ADMIN_EMAIL
```
admin@classybet.com
```

## Variable 5: ADMIN_PASSWORD
```
admin123secure
```

## Variable 6: PORT
```
10000
```

## Variable 7: CLIENT_URL
```
https://classybet.netlify.app
```

---

## 📋 HOW TO ADD IN RENDER:

1. During deployment setup, click **"Advanced"**
2. Click **"Add Environment Variable"**
3. For each variable above:
   - Key: Variable name (e.g., `MONGODB_URI`)
   - Value: Copy the value exactly as shown
4. Click "Add" for each one
5. Continue with deployment

---

## ⚠️ IMPORTANT NOTES:

- **MONGODB_URI** now includes `/classybet` database name
- Do NOT add quotes around values
- Copy exactly as shown (no extra spaces)
- Case sensitive!

---

## ✅ AFTER DEPLOYMENT:

Your backend will be available at:
```
https://[your-service-name].onrender.com
```

Test with:
```
https://[your-service-name].onrender.com/health
```

---

**Save this file for reference!** 📌
