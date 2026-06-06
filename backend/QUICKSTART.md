# Quick Start Guide

Get your Visa Application Risk Assessment API up and running in minutes.

## 🚀 Quick Setup (5 minutes)

### 1. Install Dependencies

**Windows PowerShell:**
```powershell
.\setup.ps1
```

**Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

Or manually:
```bash
pip install -r requirements.txt
cp .env.example .env
```

### 2. Start PostgreSQL Database

**Using Docker (Recommended):**
```bash
docker-compose up -d
```

**Or use your own PostgreSQL** and update the `DATABASE_URL` in `.env`

### 3. Configure Environment

Edit `.env` file with your credentials:
```env
DATABASE_URL=postgresql+asyncpg://visa_user:visa_password@localhost:5432/visa_db
ANTHROPIC_API_KEY=your_key_here
RESEND_API_KEY=your_key_here
# ... other keys
```

### 4. Create Database Tables

```bash
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

### 5. Start the Server

```bash
uvicorn main:app --reload
```

🎉 **Done!** Visit http://localhost:8000/docs to see your API documentation.

## 🧪 Quick Test

Open your browser to http://localhost:8000/docs and try the interactive API:

1. Click on `POST /api/reports/start`
2. Click "Try it out"
3. Enter:
   ```json
   {
     "email": "test@example.com",
     "visa_type": "schengen"
   }
   ```
4. Click "Execute"
5. Copy the `report_id` from the response
6. Test `POST /api/reports/{report_id}/submit` with sample answers

## 📁 Project Structure Overview

```
backend/
├── main.py              # FastAPI app entry point
├── database.py          # Database connection setup
├── models.py            # Database models (User, Report)
├── schemas.py           # Pydantic validation schemas
├── routers/
│   ├── reports.py       # Report endpoints (start, submit, get)
│   └── webhooks.py      # LemonSqueezy webhook handler
└── services/
    ├── ai_scorer.py     # AI scoring logic (stub)
    └── email_service.py # Email delivery via Resend
```

## 🔑 Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reports/start` | Create new report |
| POST | `/api/reports/{id}/submit` | Submit answers & get AI score |
| GET | `/api/reports/{id}` | Get report (full if paid) |
| POST | `/api/webhooks/lemonsqueezy` | Payment webhook |

## 🛠️ Development Workflow

### Making Database Changes

1. Update models in `models.py`
2. Create migration:
   ```bash
   alembic revision --autogenerate -m "Description of changes"
   ```
3. Apply migration:
   ```bash
   alembic upgrade head
   ```

### Testing the API

See `API_TESTING.md` for detailed examples.

Quick curl test:
```bash
curl -X POST http://localhost:8000/api/reports/start \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "visa_type": "schengen"}'
```

### Viewing Logs

The server logs SQL queries and API requests to the console when running with `--reload`.

## 🔧 Configuration

### Environment Variables

All configuration is in `.env`:

- **DATABASE_URL**: PostgreSQL connection string (async format)
- **ANTHROPIC_API_KEY**: For AI scoring (not yet implemented)
- **RESEND_API_KEY**: For sending report emails
- **R2_***: Cloudflare R2 credentials (for document storage if needed)
- **LEMONSQUEEZY_WEBHOOK_SECRET**: For webhook signature verification

### CORS Settings

Currently set to allow all origins in `main.py`:
```python
allow_origins=["*"]  # ⚠️ Change this in production!
```

Update this to your frontend domain before deploying.

## 📝 Next Steps

### 1. Implement AI Scoring

The current `services/ai_scorer.py` returns mock data. Implement real scoring:

```python
import anthropic
import os

async def score_application(answers: dict) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    
    # Format answers into prompt
    prompt = f"Analyze this visa application: {answers}"
    
    # Call Claude API
    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    
    # Parse and return structured response
    # ... implementation details
```

### 2. Set Up LemonSqueezy

1. Create a LemonSqueezy account
2. Create a product for report purchases
3. Add webhook endpoint: `https://your-domain.com/api/webhooks/lemonsqueezy`
4. Copy webhook secret to `.env`
5. In checkout, pass custom data: `{"report_id": "uuid"}`

### 3. Configure Email Templates

Update `services/email_service.py` with your branding and domain.

### 4. Deploy

- Set up production database (e.g., Railway, Supabase, or AWS RDS)
- Deploy API (e.g., Railway, Fly.io, or AWS)
- Update CORS settings
- Set production environment variables
- Enable HTTPS

## 🐛 Troubleshooting

### Database Connection Error
```
sqlalchemy.exc.OperationalError: could not connect to server
```
**Solution**: Ensure PostgreSQL is running (`docker-compose ps` or check your database service)

### Import Errors
```
ModuleNotFoundError: No module named 'xxx'
```
**Solution**: Install dependencies: `pip install -r requirements.txt`

### Alembic Migration Errors
```
FAILED: Can't locate revision identified by 'xxx'
```
**Solution**: Delete `alembic/versions/*.py` files and recreate migration

### Port Already in Use
```
ERROR: [Errno 48] Address already in use
```
**Solution**: Kill existing process or use different port: `uvicorn main:app --port 8001`

## 📚 Additional Resources

- **README.md**: Comprehensive documentation
- **API_TESTING.md**: Detailed API testing examples
- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **SQLAlchemy Docs**: https://docs.sqlalchemy.org/
- **Alembic Docs**: https://alembic.sqlalchemy.org/

## 💡 Tips

- Use the interactive docs at `/docs` for quick testing
- Check server console for SQL query logs (helps debug database issues)
- Use `docker-compose logs -f postgres` to view database logs
- Set `echo=False` in `database.py` to reduce SQL logging in production

## ⚠️ Before Production

- [ ] Implement real AI scoring logic
- [ ] Update CORS settings with your domain
- [ ] Set up secure environment variables
- [ ] Configure production database with backups
- [ ] Add rate limiting middleware
- [ ] Set up monitoring and error tracking
- [ ] Write comprehensive tests
- [ ] Enable HTTPS
- [ ] Review and test webhook security
- [ ] Set up proper logging infrastructure

---

**Need Help?** Check the full README.md or API documentation at http://localhost:8000/docs
