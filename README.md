# Elite Fitness

A full-stack fitness platform with user authentication and a gym e-commerce store. It pairs a static HTML/CSS/JavaScript front end with **two independent Node.js + Express backends** backed by **MySQL**.

> Built as a college mini-project and later hardened (env-based secrets, git history, dependency cleanup) for a job-application code walkthrough.

**Repository:** https://github.com/VedantTichkule/elite-fitness

---

## Features

- **User authentication** — registration and login with bcrypt-hashed passwords, server-side sessions, and a session-check endpoint that drives the UI (user avatar).
- **Gym store** — products loaded from the database by category, a cart persisted in `localStorage`, and a checkout flow.
- **Transactional checkout** — stock is validated and decremented inside a single MySQL transaction with rollback on failure, so inventory can never go inconsistent.
- **Fitness tools** — an in-page **Diet Calculator** (Mifflin–St Jeor BMR, activity multiplier, macro split) plus exercise, schedule, precautions and pros/cons pages.
- **Reviews & contact** pages.

---

## Tech stack

| Layer | Technology |
|---|---|
| Front end | HTML5, CSS3, vanilla JavaScript (`fetch`) |
| Auth backend | Node.js, Express, `express-session`, `bcrypt`, `mysql` |
| Store backend | Node.js, Express, `mysql2/promise` (connection pool), `body-parser` |
| Database | MySQL (two schemas) |
| Dev serving | VS Code Live Server (`:5500`) |

---

## Architecture

```
                    Browser (static front end)
                    http://localhost:5500
                              |
              +---------------+---------------+
              |                               |
   Auth service (:5001)              Store service (:5000)
   user-registration-backend         gym-store-backend
              |                               |
              v                               v
     MySQL: user_registration          MySQL: gym_store
       - users                           - store_products
                                         - manual_orders
                                         - manual_order_items
```

The front end is served statically; both backends expose JSON APIs and allow the front-end origin through **CORS with credentials** so session cookies work.

### Ports

| Service | Port | Base URL |
|---|---|---|
| Front end (Live Server) | 5500 | `http://localhost:5500` |
| Auth backend | 5001 | `http://localhost:5001` |
| Store backend | 5000 | `http://localhost:5000` |

---

## Repository layout

```
.
├── index.html, fitness.html, store.html, login.html, form.html, ...  # front-end pages
├── css/style.css
├── js/userAvatar.js
├── scratch/                       # earlier static prototypes
├── register.php                   # first PHP prototype (superseded by the Node auth backend)
├── products.csv                   # seed data for the store
├── stock/                         # product images and media
├── user-registration-backend/     # auth service  (port 5001)
│   ├── server.js
│   ├── .env.example
│   └── package.json
└── gym-store-backend/
    └── gym-store-backend/         # store service (port 5000)
        ├── server.js
        ├── .env.example
        └── package.json
```

---

## Getting started

### Prerequisites

- Node.js 18+
- MySQL 8+
- A static file server (VS Code **Live Server** works out of the box)

### 1. Create the databases

```sql
CREATE DATABASE user_registration;
CREATE DATABASE gym_store;

-- Auth schema
USE user_registration;
CREATE TABLE users (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email    VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL
);
```

The store backend creates its own tables (`store_products`, `manual_orders`, `manual_order_items`) on startup. Seed the catalogue from `products.csv` into `store_products`.

### 2. Configure environment

Each backend reads its configuration from a `.env` file (never committed). Copy the templates:

```bash
cp user-registration-backend/.env.example user-registration-backend/.env
cp gym-store-backend/gym-store-backend/.env.example gym-store-backend/gym-store-backend/.env
```

Then fill in your MySQL credentials.

**`user-registration-backend/.env`**

```env
PORT=5001
SESSION_SECRET=replace_with_a_long_random_string
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
```

**`gym-store-backend/gym-store-backend/.env`**

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=gym_store
```

### 3. Install and run the backends

```bash
# Auth service  -> http://localhost:5001
cd user-registration-backend
npm install
npm start
```

```bash
# Store service -> http://localhost:5000
cd gym-store-backend/gym-store-backend
npm install
npm start
```

### 4. Serve the front end

Open the project folder with Live Server so the pages are served on `http://localhost:5500`, then open `index.html`.

---

## API reference

### Auth service — `http://localhost:5001`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Register a user (bcrypt-hashes the password, rejects duplicates) |
| `POST` | `/login` | Authenticate and create a session |
| `GET` | `/check-session` | Whether a session exists |
| `GET` | `/current-user` | Current logged-in user |
| `POST` | `/logout` | Destroy the session |
| `POST` | `/confirm-payment` | Record an order for the logged-in user |

### Store service — `http://localhost:5000`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/products` | List products with stock status |
| `POST` | `/check-stock` | Validate availability for a set of items |
| `POST` | `/manual-checkout` | Place an order inside a transaction (stock check → decrement → insert) |

---

## Security notes

- Passwords are hashed with **bcrypt** (cost 10).
- All SQL uses **parameterised queries** (no string concatenation), preventing SQL injection.
- Sessions use an **httpOnly** cookie; the session secret and DB credentials come from environment variables.
- CORS is restricted to the known front-end origins rather than `*`.

---

## Known trade-offs / future work

These are deliberate, documented compromises rather than oversights:

- **Two different MySQL drivers.** The auth service uses the legacy callback-based `mysql` package; the store service uses the modern promise-based `mysql2`. They should be unified on `mysql2/promise`.
- **Redundant user state.** The front end stores the user in both the session cookie (authoritative) and `localStorage`. The `localStorage` copy is unnecessary and should be removed.
- **The store backend still has a hard-coded password fallback** in its DB config; it should require `DB_PASSWORD` from the environment with no fallback.
- **No automated tests.** The next step would be integration tests for the auth flow and the transactional checkout path.
- **`register.php`** is an earlier PHP prototype, kept as a record of the first approach before the project was rebuilt on Node.

---

## Author

**Vedant Tichkule**
GitHub: [@VedantTichkule](https://github.com/VedantTichkule)
