# SR Builder - Backend API & MongoDB Cloud Storage

Modern, high-performance Node.js / Express backend with MongoDB and JWT authentication for **SR Builder** (LaTeX Resume Studio).

## Features
- **JWT Authentication**: Secure user registration, password hashing via bcryptjs, and Google sign-in.
- **MongoDB Cloud Storage**: Resumes are stored directly in MongoDB collections (`users` and `projects`).
- **Strict 10-Resume Storage Quota**: Automatic database-level enforcement of maximum 10 active resumes per user.
- **Render Ready**: Includes `render.yaml` for instant zero-configuration deployment to Render free web services.
- **Health Check**: Live `/api/health` monitoring status and MongoDB connectivity.

---

## Quick Start (Local)

1. **Install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Configure environment:**
   Create or edit `.env` in the `server` folder:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string_here
   JWT_SECRET=your_secret_key_here
   CLIENT_URL=http://localhost:5173
   ```

3. **Start the server:**
   ```bash
   npm start
   # or with auto-restart on changes:
   npm run dev
   ```

4. **Verify:**
   Open [http://localhost:5000/api/health](http://localhost:5000/api/health) in your browser.

---

## Deploying to Render (Free Tier)

1. Push your code repository to **GitHub**.
2. Go to **[Render Dashboard](https://dashboard.render.com/)** and click **New +** $\rightarrow$ **Web Service**.
3. Connect your repository:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. In **Environment Variables**, add:
   - `MONGO_URI`: Your MongoDB Atlas connection URI (`mongodb+srv://...`)
   - `JWT_SECRET`: A secure random string
   - `CLIENT_URL`: The URL of your frontend app (or `*`)
5. Click **Deploy Web Service**! Render will give you a live URL like `https://sr-builder-api.onrender.com`.
