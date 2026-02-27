# Deploy: Backend on Render, Frontend on Vercel

**Repo name:** `Cursor-jewerly-Web-App`  
**Order:** Deploy **backend first** (Render), then **frontend** (Vercel) so you can set the API URL correctly.

Google OAuth is removed for now; admin login uses the **admin key** only.

---

## Step 1: New GitHub repo

1. On GitHub, create a **new** repository named **`Cursor-jewerly-Web-App`** (no need to add README or .gitignore).
2. Locally, point your project to the new repo and push:

   ```bash
   cd "path/to/your/project"
   git remote remove origin
   git remote add origin https://github.com/YOUR_USERNAME/Cursor-jewerly-Web-App.git
   git add .
   git commit -m "Remove Google OAuth; prepare for Render + Vercel"
   git push -u origin main
   ```

   (Use `master` instead of `main` if your branch is `master`.)

---

## Step 2: Deploy backend on Render (do this first)

1. Go to [render.com](https://render.com) and sign in (GitHub is easiest).
2. **New +** → **Web Service**.
3. Connect your GitHub account if needed, then select the repo **Cursor-jewerly-Web-App**.
4. Configure the service:
   - **Name:** e.g. `cursor-jewelry-api`
   - **Region:** choose one close to you
   - **Root Directory:** **`backend`**
   - **Runtime:** **Node**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. **Environment** (Environment Variables):
   - `MONGODB_URI` = your MongoDB connection string (e.g. from [MongoDB Atlas](https://cloud.mongodb.com))
   - `ADMIN_SECRET` = your admin key (same value you’ll use to log in to admin)
   - `NODE_ENV` = `production`

   You do **not** need Google or JWT vars for now.

6. Click **Create Web Service**. Wait for the first deploy to finish.
7. In the top of the service page, copy the **URL** (e.g. `https://cursor-jewelry-api.onrender.com`).  
   This is your **backend URL**. You’ll use it in the frontend.

**Check:** Open `https://YOUR_RENDER_URL/api/health` in the browser. You should see:  
`{"status":"ok","message":"Jewelry API is running"}`.

---

## Step 3: Deploy frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New…** → **Project** → import **Cursor-jewerly-Web-App**.
3. Configure the project:
   - **Root Directory:** click **Edit** → set to **`frontend`** → **Continue**.
   - **Framework Preset:** should be **Next.js** (auto-detected).
   - **Environment Variables:** add:
     - **Name:** `NEXT_PUBLIC_API_URL`
     - **Value:** your Render backend URL from Step 2 (e.g. `https://cursor-jewelry-api.onrender.com`) — no trailing slash.
4. Click **Deploy**. Wait for the build to finish.
5. Open the Vercel URL (e.g. `https://cursor-jewerly-web-app.vercel.app`). The site should load and use the API.

---

## Step 4: Admin login

- Go to **`https://YOUR_VERCEL_URL/admin`** → you’ll be sent to **`/admin/login`**.
- Sign in with the **admin key** you set as `ADMIN_SECRET` on Render.

---

## Summary

| What        | Where  | URL / note                                      |
|------------|--------|--------------------------------------------------|
| Backend    | Render | e.g. `https://cursor-jewelry-api.onrender.com`  |
| Frontend   | Vercel | e.g. `https://cursor-jewerly-web-app.vercel.app`|
| Admin login| Admin key only (no Google)                       |
| MongoDB    | Atlas or any; set `MONGODB_URI` on Render       |

Later, when you add Google OAuth again, you’ll set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`, and `BACKEND_URL` on Render and restore the auth routes and frontend buttons.
