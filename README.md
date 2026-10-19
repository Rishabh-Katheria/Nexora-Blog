# Nexora — Full-Stack Refactor

A premium full-stack application with a React + Vite frontend and FastAPI backend.

## Project Structure

```
Nexora/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py             # FastAPI application entry point
│   │   ├── config.py           # Settings (env-based)
│   │   ├── database.py         # SQLAlchemy engine + session
│   │   ├── models.py           # SQLAlchemy ORM models
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── auth.py             # JWT authentication utilities
│   │   ├── dependencies.py     # FastAPI dependency injection
│   │   ├── admin.py            # SQLAdmin interface
│   │   └── routers/
│   │       ├── articles.py     # Article CRUD endpoints
│   │       ├── categories.py   # Category endpoints
│   │       ├── tags.py         # Tag endpoints
│   │       ├── authors.py      # Author endpoints
│   │       └── auth.py         # Auth endpoints (register, login, token)
│   ├── manage.py               # CLI commands
│   ├── requirements.txt
│   └── .env
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── Layout.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── ArticleCard.tsx
│   │   │   ├── CategoryPills.tsx
│   │   │   ├── AuthorCard.tsx
│   │   │   └── ReadingProgress.tsx
│   │   ├── context/            # React contexts
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   ├── pages/              # Route pages
│   │   │   ├── Home.tsx
│   │   │   ├── ArticleDetail.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── WriteArticle.tsx
│   │   │   ├── EditArticle.tsx
│   │   │   ├── CategoryPage.tsx
│   │   │   ├── SearchResults.tsx
│   │   │   └── NotFound.tsx
│   │   ├── api/                # API client layer
│   │   │   ├── client.ts       # Axios with JWT interceptors
│   │   │   ├── auth.ts
│   │   │   ├── articles.ts
│   │   │   ├── categories.ts
│   │   │   ├── tags.ts
│   │   │   └── authors.ts
│   │   ├── types/index.ts      # TypeScript interfaces
│   │   ├── App.tsx             # Router setup
│   │   ├── main.tsx            # Entry point
│   │   └── index.css           # Tailwind + custom styles
│   ├── package.json
│   ├── vite.config.ts          # Vite + proxy config
│   ├── tailwind.config.js      # Custom design system
│   ├── tsconfig.json
│   └── index.html
```

## Quick Start

### Backend

```bash
cd backend

# Create virtual environment
python -m venv env
source env/bin/activate  # Windows: env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create database tables
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

API runs at `http://localhost:8000/api/`

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at `http://localhost:5173`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/articles/` | GET | List articles (paginated) |
| `/api/articles/` | POST | Create article |
| `/api/articles/:slug/` | GET | Retrieve article |
| `/api/articles/:slug/` | PATCH | Update article |
| `/api/articles/:slug/` | DELETE | Delete article |
| `/api/articles/featured/` | GET | Featured articles |
| `/api/articles/latest/` | GET | Latest articles |
| `/api/articles/my_articles/` | GET | Current user's articles |
| `/api/categories/` | GET | List categories |
| `/api/categories/:slug/` | GET | Get category |
| `/api/tags/` | GET | List tags |
| `/api/authors/` | GET | List authors |
| `/api/authors/:id/` | GET | Get author |
| `/api/auth/register/` | POST | Register new user |
| `/api/auth/token/` | POST | Obtain JWT token |
| `/api/auth/token/refresh/` | POST | Refresh JWT token |
| `/api/auth/me/` | GET/PATCH | Current user profile |

## Features

- JWT authentication with automatic token refresh
- Dark/light mode with system preference detection
- Responsive design (mobile-first)
- Framer Motion animations
- Reading progress indicator
- Category filtering and search
- Article CRUD with rich text content
- View counting
- Featured articles
- Related articles
- Author profiles
- SQLAdmin admin interface
- Cloudinary image uploads
