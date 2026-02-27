# Jewelry Showcase

Premium jewelry showcase website — step-by-step build.

## Project structure

```
├── backend/                 # Node.js + Express + MongoDB
│   ├── src/
│   │   ├── config/          # DB connection (db.js)
│   │   ├── controllers/     # Route handlers (to add)
│   │   ├── middleware/      # Auth, etc. (to add)
│   │   ├── models/          # Mongoose schemas: User, Product, Wishlist (to add)
│   │   ├── routes/          # API routes (to add)
│   │   └── server.js        # Entry point
│   ├── .env.example
│   └── package.json
│
├── frontend/                # Next.js (App Router) + Tailwind CSS
│   ├── app/
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Home (to be built in Step 2)
│   │   ├── globals.css
│   │   ├── products/        # Products page (placeholder)
│   │   ├── wishlist/        # Wishlist page (placeholder)
│   │   ├── login/           # Login page (placeholder)
│   │   └── register/        # Register page (placeholder)
│   ├── components/          # Reusable UI (to add)
│   ├── lib/                 # Utils, API client (to add)
│   └── package.json
│
└── README.md
```

## Run locally

### Backend

```bash
cd backend
cp .env.example .env   # Edit .env if needed (e.g. MONGODB_URI)
npm install
npm run dev
```

Server runs at `http://localhost:5000`. Health check: `GET /api/health`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:3000`.

## Next step

Step 2: Build the **Home page** (premium UI, responsive, ready for content).
