# 🚀 Coolify VPS Deployment & Configuration Guide

## 🌐 Architecture Overview

- **Backend API**: `https://back.classybetaviator.com` (Hosted on Coolify VPS)
- **Frontend**: `https://classybetaviator.com` (Static / CDN)
- **Database**: MongoDB Atlas Cluster
- **Reverse Proxy / SSL**: Traefik / Let's Encrypt managed by Coolify on VPS

---

## 🔑 Environment Variables for Coolify Backend

Add these in your Coolify Application settings:

```env
PORT=4000
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secure-jwt-secret
ADMIN_EMAIL=admin@classybetaviator.com
ADMIN_PASSWORD=your-secure-password
FRONTEND_URL=https://classybetaviator.com
CLIENT_URL=https://classybetaviator.com
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-...
FLUTTERWAVE_SECRET_KEY=FLWSECK-...
FLUTTERWAVE_ENCRYPTION_KEY=...
```

---

## 🔒 SSL Certificate Renewal (Fixing `ERR_CERT_DATE_INVALID`)

If browsers report:
```
Failed to load resource: net::ERR_CERT_DATE_INVALID
TypeError: Failed to fetch
```
This happens when the Let's Encrypt SSL certificate for `back.classybetaviator.com` expires.

### How to Renew / Fix in Coolify:

1. **Log in to your Coolify Dashboard on the VPS** (usually `http://<vps-ip>:8000`).
2. **Navigate to the Backend Application / Resource**:
   - Go to your Project -> Environment -> `classybet-backend` (or backend service).
3. **Check Domains**:
   - Ensure the domain is set to `https://back.classybetaviator.com`.
4. **Trigger SSL Renewal / Restart Traefik**:
   - Option A: Click **Redeploy** or **Restart** on the backend application.
   - Option B: Go to **Server Settings** -> **Proxy (Traefik)** -> Click **Restart Proxy** to force Traefik to request a fresh Let's Encrypt certificate.
5. **If accessing VPS via SSH**:
   - Run:
     ```bash
     # Check Traefik container logs
     docker logs -f coolify-proxy
     
     # Restart Traefik proxy to regenerate SSL certs
     docker restart coolify-proxy
     ```
6. **Verify SSL via Terminal**:
   ```bash
   curl -v https://back.classybetaviator.com/health
   ```
   Should return HTTP `200 OK` with valid TLS handshake.
