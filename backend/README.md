# Visa Application Risk Assessment API

FastAPI backend for assessing visa application risk using AI-powered analysis.

## Project Structure

```
backend/
├── main.py                 # FastAPI application and startup
├── database.py             # Database configuration and session management
├── models.py               # SQLAlchemy ORM models
├── schemas.py              # Pydantic request/response schemas
├── routers/
│   ├── reports.py          # Report management endpoints
│   └── webhooks.py         # LemonSqueezy webhook handler
├── services/
│   ├── ai_scorer.py        # AI scoring logic (stub)
│   └── email_service.py    # Email delivery via Resend
├── alembic/                # Database migration files
├── .env.example            # Environment variable template
└── requirements.txt        # Python dependencies
```

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: PostgreSQL connection string (async format)
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `R2_BUCKET_NAME`, `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`: Cloudflare R2 credentials
- `LEMONSQUEEZY_WEBHOOK_SECRET`: Secret for verifying webhooks
- `RESEND_API_KEY`: API key for Resend email service

### 3. Set Up Database

#### Option A: Using Docker Compose (Recommended for Development)

```bash
# Start PostgreSQL in a container
docker-compose up -d

# Verify it's running
docker-compose ps
```

The database will be available at `localhost:5432` with credentials from docker-compose.yml.

#### Option B: Use Your Own PostgreSQL

Make sure PostgreSQL is running and update the `DATABASE_URL` in `.env`.

#### Create and Apply Migrations

```bash
# Create initial migration
alembic revision --autogenerate -m "Initial migration"

# Apply migration
alembic upgrade head
```

### 4. Run the Server

```bash
# Development mode with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or use the built-in runner
python main.py
```

The API will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

## API Endpoints

### Reports

#### `POST /api/reports/start`
Start a new visa application assessment.

**Request:**
```json
{
  "email": "user@example.com",
  "visa_type": "schengen"
}
```

**Response:**
```json
{
  "report_id": "uuid",
  "user_id": "uuid"
}
```

#### `POST /api/reports/{report_id}/submit`
Submit application answers for AI scoring.

**Request:**
```json
{
  "answers": {
    "question1": "answer1",
    "question2": "answer2"
  }
}
```

**Response:**
```json
{
  "risk_score": 75,
  "teaser": [
    {
      "category": "Financial Stability",
      "score": 45,
      "issue": "...",
      "fix": "..."
    },
    {
      "category": "Travel History",
      "score": 60,
      "issue": "...",
      "fix": "..."
    }
  ]
}
```

#### `GET /api/reports/{report_id}`
Retrieve a report.

**Unpaid Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "visa_type": "schengen",
  "risk_score": 75,
  "paid": false,
  "created_at": "2024-01-01T00:00:00"
}
```

**Paid Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "visa_type": "schengen",
  "risk_score": 75,
  "paid": true,
  "breakdown": [...],
  "created_at": "2024-01-01T00:00:00"
}
```

### Webhooks

#### `POST /api/webhooks/lemonsqueezy`
Handles LemonSqueezy webhook events (order_created).

Expects `X-Signature` header for verification.

When an order is created with `custom_data.report_id`, the report is marked as paid and a full report email is sent.

## Database Models

### User
- `id` (UUID, primary key)
- `email` (String, unique)
- `created_at` (DateTime)

### Report
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key to User)
- `visa_type` (String, default "schengen")
- `answers` (JSON, nullable)
- `risk_score` (Integer, nullable)
- `breakdown` (JSON, nullable)
- `paid` (Boolean, default False)
- `lemon_squeezy_order_id` (String, nullable)
- `created_at` (DateTime)

## Services

### AI Scorer (`services/ai_scorer.py`)

The `score_application()` function is currently a stub that returns mock data. 

To implement:
1. Format the answers into a structured prompt
2. Call Anthropic's Claude API with the prompt
3. Parse the JSON response into the expected format

### Email Service (`services/email_service.py`)

Uses Resend to send full report emails to users after payment.

## Development Notes

- CORS is currently set to allow all origins. Restrict this in production.
- Database tables are created automatically on startup. Use Alembic for schema changes.
- The AI scorer service needs to be implemented with actual Anthropic API calls.
- Webhook signature verification is implemented but ensure your secret is secure.

## Next Steps

1. Implement actual AI scoring logic using Anthropic's Claude
2. Set up Cloudflare R2 for document storage (if needed)
3. Configure proper CORS origins for production
4. Add rate limiting and authentication middleware
5. Set up monitoring and logging
6. Add comprehensive error handling
7. Write tests
