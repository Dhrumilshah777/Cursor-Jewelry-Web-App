# Deploy Backend to Railway

Follow these steps to get your backend running on Railway.

---

## 1. Push your code to GitHub (if not already)

Your backend lives in the **`backend`** folder. Railway will deploy from your GitHub repo.

- If you removed the GitHub remote earlier, add it back and push:
  ```bash
  cd "C:\Users\dhrumil shah\.cursor\projects\e-Cursor-jewlery-App"
  git remote add origin https://github.com/Dhrumilshah777/Cursor-Jewelry-E-comm.git
  git add .
  git commit -m "Prepare backend for Railway"
  git push -u origin master
  ```
- If the repo is already connected and up to date, skip to step 2.

---

## 2. Create a MongoDB database (if you don’t have one)

Railway can host MongoDB, or you can use **MongoDB Atlas** (free tier).

**Option A – MongoDB Atlas**

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and create a free account.
2. Create a **Cluster** (free M0).
3. **Database Access** → Add user (username + password). Note the password.
4. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (0.0.0.0/0) so Railway can connect.
5. **Database** → **Connect** → **Connect your application** → copy the connection string. It looks like:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/DATABASE?retryWrites=true&w=majority`
6. Replace `<password>` in that string with your real password. This is your **MONGODB_URI**.

**Option B – Railway MongoDB**

1. In Railway, create a **New Project**.
2. Click **+ New** → **Database** → **MongoDB**.
3. After it’s created, open the MongoDB service → **Variables** (or **Connect**) and copy the **MONGO_URL** or **MONGODB_URI**. Use this as **MONGODB_URI** for your backend.

---

## 3. Create a Railway project and deploy the backend

1. Go to [railway.app](https://railway.app) and sign in (GitHub is easiest).
2. Click **New Project**.
3. Choose **Deploy from GitHub repo**.
4. Select your repo: **Dhrumilshah777/Cursor-Jewelry-E-comm** (or your actual repo name). Authorize Railway if asked.
5. Railway adds a service from the repo. **Do not** add a second MongoDB here if you already use Atlas or a separate Railway MongoDB.
6. Click the **backend service** (the one from your repo).

---

## 4. Set Root Directory to `backend`

1. Open the backend service.
2. Go to **Settings** (or the **Settings** tab).
3. Find **Root Directory** (or **Source**).
4. Set it to **`backend`** and save.

Railway will run `npm install` and `npm start` from the `backend` folder.

---

## 5. Add environment variables

1. In the backend service, open **Variables** (or **Environment**).
2. Add these (use your real values):

| Variable | Example / notes |
|----------|------------------|
| `PORT` | `5000` (Railway can override this; you can leave it or omit and let Railway set it.) |
| `MONGODB_URI` | Your Atlas or Railway MongoDB connection string |
| `ADMIN_SECRET` | A strong secret (e.g. random string) for admin key login |
| `JWT_SECRET` | A long random string (e.g. 32+ chars) for JWT signing |
| `GOOGLE_CLIENT_ID` | Your Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth client secret |
| `ALLOWED_ADMIN_EMAILS` | Comma-separated admin emails, e.g. `you@gmail.com` |
| `FRONTEND_URL` | Your frontend URL, e.g. `http://localhost:3000` or `https://your-app.vercel.app` |
| `BACKEND_URL` | **Leave empty for now** – set it in step 6 after you get the Railway URL |

3. Save. Railway will redeploy when you change variables.

---

## 6. Get the public URL and set BACKEND_URL

1. In the backend service, go to **Settings** → **Networking** (or **Deployments** → your deployment).
2. Click **Generate Domain** (or **Add domain**). Railway will give a URL like:
   `https://cursor-jewelry-e-comm-backend-production-xxxx.up.railway.app`
3. Copy that URL (no path, no trailing slash).
4. In **Variables**, add or update:
   - **`BACKEND_URL`** = that URL (e.g. `https://cursor-jewelry-e-comm-backend-production-xxxx.up.railway.app`)
5. Save. Let the service redeploy.

---

## 7. Point your frontend to the backend

- **Local frontend:** In `frontend/.env.local` (create if needed), set:
  ```env
  NEXT_PUBLIC_API_URL=https://your-railway-backend-url.up.railway.app
  ```
- **Vercel (or other host):** In the frontend project’s environment variables, set **`NEXT_PUBLIC_API_URL`** to the same Railway URL.

Restart or redeploy the frontend so it uses the new API URL.

---

## 8. Google OAuth (if you use it)

In **Google Cloud Console** → your OAuth 2.0 Client:

1. **Authorized JavaScript origins:** add your frontend URL and the Railway backend URL, e.g.  
   `https://your-backend.up.railway.app`
2. **Authorized redirect URIs:** add:
   - `https://your-backend.up.railway.app/api/auth/google/callback`
   - `https://your-backend.up.railway.app/api/auth/google/user/callback`

Replace `your-backend.up.railway.app` with your real Railway backend domain.

---

## 9. Check that it’s running

- Open: `https://YOUR_RAILWAY_URL/api/health`  
  You should see: `{"status":"ok","message":"Jewelry API is running"}`.
- Then use your frontend (or Postman) to hit `/api/products` and admin routes as needed.

---

## Quick checklist

- [ ] Code pushed to GitHub (repo has `backend` folder).
- [ ] Railway project created, service from GitHub, **Root Directory** = `backend`.
- [ ] **MONGODB_URI** set (Atlas or Railway MongoDB).
- [ ] **ADMIN_SECRET**, **JWT_SECRET**, **GOOGLE_***, **ALLOWED_ADMIN_EMAILS** set.
- [ ] **FRONTEND_URL** and **BACKEND_URL** (Railway URL) set.
- [ ] Domain generated for the backend service.
- [ ] **NEXT_PUBLIC_API_URL** in frontend set to Railway URL.
- [ ] Google OAuth redirect URIs updated to the Railway backend URL.
- [ ] `/api/health` returns OK.

If any step fails (e.g. build error or 502), check the **Deployments** → **View logs** for that service on Railway.
