# VisaScore - Frontend & Backend Integration Guide

Complete guide for running the full VisaScore application with frontend and backend.

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  Next.js        │ ──────▶ │  FastAPI         │ ──────▶ │  PostgreSQL     │
│  Frontend       │  HTTP   │  Backend         │  Async  │  Database       │
│  Port 3000      │ ◀────── │  Port 8000       │ ◀────── │  Port 5432      │
│                 │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │
                                     │
                                     ▼
                            ┌──────────────────┐
                            │                  │
                            │  Anthropic API   │
                            │  Claude Opus 4.5 │
                            │                  │
                            └──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  LemonSqueezy    │
                            │  Payment Webhook │
                            └──────────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  Resend API      │
                            │  Email Delivery  │
                            └──────────────────┘
```

## Quick Start (Both Services)

### 1. Start Backend

```bash
# Terminal 1
cd backend

# Start PostgreSQL
docker-compose up -d

# Run migrations
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head

# Start FastAPI server
uvicorn main:app --reload
```

Backend runs on: http://localhost:8000

API docs: http://localhost:8000/docs

### 2. Start Frontend

```bash
# Terminal 2
cd frontend

# Start Next.js dev server
npm run dev
```

Frontend runs on: http://localhost:3000

### 3. Test the Integration

1. Visit http://localhost:3000
2. Click "Check My Visa Risk — Free"
3. Complete the assessment form
4. View your risk score and breakdown

## API Flow

### Step 1: User Completes Assessment

**Frontend:** User fills out 15 questions in `/assess`

**API Call 1 - Start Report:**
```javascript
POST http://localhost:8000/api/reports/start
Headers: { "Content-Type": "application/json" }
Body: {
  "email": "user@example.com",
  "visa_type": "schengen"
}

Response: {
  "report_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**API Call 2 - Submit Answers:**
```javascript
POST http://localhost:8000/api/reports/{report_id}/submit
Headers: { "Content-Type": "application/json" }
Body: {
  "answers": {
    "monthly_income_pkr": 150000,
    "bank_balance_pkr": 800000,
    // ... 14 more fields
  }
}

Response: {
  "risk_score": 58,
  "risk_level": "moderate",
  "summary": "Limited international travel history is the primary concern...",
  "teaser": [
    {
      "category": "Home Ties",
      "score": 18,
      "max_score": 25,
      "issue": "No prior international travel raises concerns...",
      "fix": "Unlock full report to see the fix for this issue"
    },
    // 1 more item
  ]
}
```

**Frontend:** Redirects to `/results/{report_id}`

### Step 2: User Views Results

**API Call 3 - Get Report:**
```javascript
GET http://localhost:8000/api/reports/{report_id}

Response (unpaid): {
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440001",
  "visa_type": "schengen",
  "risk_score": 58,
  "risk_level": "moderate",
  "summary": "Limited international travel history...",
  "paid": false,
  "created_at": "2024-01-01T12:00:00"
}
```

**Frontend:** Shows teaser + paywall

### Step 3: User Pays (LemonSqueezy)

**Frontend:** User clicks "Unlock Full Report — $12"

**Browser:** Redirects to LemonSqueezy checkout:
```
https://visascore.lemonsqueezy.com/checkout/buy/variant-id?checkout[custom][report_id]={report_id}
```

**LemonSqueezy:** After payment, sends webhook to backend

**Webhook:**
```javascript
POST http://localhost:8000/api/webhooks/lemonsqueezy
Headers: {
  "Content-Type": "application/json",
  "X-Signature": "webhook-signature"
}
Body: {
  "meta": {
    "event_name": "order_created"
  },
  "data": {
    "attributes": {
      "identifier": "LS-ORDER-123",
      "custom_data": {
        "report_id": "550e8400-e29b-41d4-a716-446655440000"
      }
    }
  }
}
```

**Backend:**
1. Verifies webhook signature
2. Marks report as paid
3. Sends full report via email (Resend API)

### Step 4: User Sees Full Report

**Frontend:** User refreshes or revisits `/results/{report_id}`

**API Call 4 - Get Report (After Payment):**
```javascript
GET http://localhost:8000/api/reports/{report_id}

Response (paid): {
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440001",
  "visa_type": "schengen",
  "risk_score": 58,
  "risk_level": "moderate",
  "summary": "Limited international travel history...",
  "paid": true,
  "breakdown": [
    {
      "category": "Financial Stability",
      "score": 20,
      "max_score": 25,
      "issue": "Bank balance meets minimum requirements...",
      "fix": "Increase monthly savings rate and maintain consistent bank statements for 6 months before application."
    },
    // 3 more categories with real fixes
  ],
  "created_at": "2024-01-01T12:00:00"
}
```

**Frontend:** Shows green banner + full breakdown

## Environment Configuration

### Backend (.env)

```env
DATABASE_URL=postgresql+asyncpg://visa_user:visa_password@localhost:5432/visa_db
ANTHROPIC_API_KEY=sk-ant-xxxxx
RESEND_API_KEY=re_xxxxx
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret
R2_BUCKET_NAME=your-bucket-name
R2_ENDPOINT_URL=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL=https://visascore.lemonsqueezy.com/checkout/buy/variant-id
```

## CORS Configuration

Backend CORS is currently set to allow all origins. Update for production:

**backend/main.py:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Change from ["*"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Data Flow

### Assessment Form Data

Frontend collects 16 fields:

```typescript
{
  // Financial (4 fields)
  monthly_income_pkr: number,
  bank_balance_pkr: number,
  bank_balance_consistent: boolean,
  trip_sponsor: "self" | "employer" | "family",
  
  // Home Ties (4 fields)
  employment_status: "employed" | "business_owner" | "student" | "unemployed",
  owns_property: boolean,
  has_dependents: boolean,
  prior_international_travel: boolean,
  
  // Documentation (4 fields)
  visit_purpose: "tourism" | "business" | "family_visit" | "education",
  has_detailed_itinerary: boolean,
  has_hotel_and_return_ticket: boolean,
  has_schengen_insurance: boolean,
  
  // Risk Profile (4 fields)
  prior_visa_refusal: boolean,
  age: number,
  marital_status: "single" | "married" | "divorced",
  target_schengen_country: string
}
```

### AI Scoring

Backend sends to Anthropic Claude Opus 4.5:

**Input:** 16 applicant data points
**Processing:** AI analyzes against Schengen visa criteria
**Output:** Risk score (0-100) + 4-category breakdown + fixes

### Paywall Logic

**Teaser (Before Payment):**
- Show 2 worst categories (lowest scores)
- Replace fixes with "Unlock full report..."
- Blur 2 remaining categories

**Full Report (After Payment):**
- Show all 4 categories
- Display actual fixes
- Send email with full report

## Testing Locally

### 1. Test Backend Independently

```bash
# Test health endpoint
curl http://localhost:8000/

# Test creating a report
curl -X POST http://localhost:8000/api/reports/start \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "visa_type": "schengen"}'

# Test AI scoring
python backend/test_ai_scorer.py
```

### 2. Test Frontend Independently

```bash
# Start without backend (will fail on API calls)
npm run dev

# Check pages render
open http://localhost:3000
open http://localhost:3000/assess
```

### 3. Test Full Integration

1. Start both services
2. Complete full user flow
3. Check browser DevTools Network tab
4. Verify database has data:
   ```bash
   psql -d visa_db -c "SELECT id, email FROM users;"
   psql -d visa_db -c "SELECT id, risk_score, paid FROM reports;"
   ```

## Troubleshooting

### "Failed to fetch"

**Symptoms:** Frontend shows error on submission

**Causes:**
1. Backend not running
2. Wrong API URL in frontend .env.local
3. CORS blocking requests

**Solutions:**
```bash
# Check backend is running
curl http://localhost:8000/

# Check frontend env
cat frontend/.env.local

# Check browser console for CORS errors
```

### "AI service unavailable"

**Symptoms:** Submission fails with 503 error

**Cause:** Invalid ANTHROPIC_API_KEY

**Solution:**
```bash
# Check backend .env
cat backend/.env | grep ANTHROPIC

# Test AI scorer directly
cd backend
python test_ai_scorer.py
```

### "Report not found"

**Symptoms:** Results page shows error

**Causes:**
1. Report ID doesn't exist
2. Database connection issue

**Solutions:**
```bash
# Check database
psql -d visa_db -c "SELECT id FROM reports LIMIT 5;"

# Check backend logs for errors
```

## Production Deployment

### 1. Backend Deployment

**Requirements:**
- Production PostgreSQL database
- Valid ANTHROPIC_API_KEY
- Public HTTPS endpoint for webhooks
- Restricted CORS origins

**Platforms:**
- Railway (recommended)
- Fly.io
- AWS/GCP/Azure

See: [backend/DEPLOYMENT_CHECKLIST.md](./backend/DEPLOYMENT_CHECKLIST.md)

### 2. Frontend Deployment

**Requirements:**
- Node.js 18+
- Environment variables set
- Backend API URL (production)

**Platforms:**
- Vercel (recommended)
- Netlify
- AWS Amplify

**Steps:**
1. Push to GitHub
2. Import to Vercel
3. Set environment variables:
   - `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
   - `NEXT_PUBLIC_LEMONSQUEEZY_CHECKOUT_URL=https://...`
4. Deploy

### 3. Configure LemonSqueezy

1. Create product ($12)
2. Set up webhook: `https://api.yourdomain.com/api/webhooks/lemonsqueezy`
3. Copy webhook secret to backend .env
4. Test webhook with LemonSqueezy test mode

## Monitoring

### Backend

- API response times
- AI scorer success rate
- Database query performance
- Anthropic API costs

### Frontend

- Page load times
- Form completion rate
- Conversion rate (form → payment)
- Error rates

### Integration Points

- API call success rate
- Webhook delivery rate
- Email delivery rate

## Security

### Backend

- ✅ API key in environment variable
- ✅ Webhook signature verification
- ✅ Database password in environment variable
- ⚠️ Update CORS for production
- ⚠️ Add rate limiting

### Frontend

- ✅ No sensitive data in client code
- ✅ Environment variables prefixed with NEXT_PUBLIC_
- ✅ No API keys exposed to browser

## Performance

### Backend

- Async database operations
- Connection pooling
- Efficient AI prompts (~500 tokens input)

### Frontend

- Static page pre-rendering
- Optimized bundle size
- Lazy loading for heavy components

## Cost Estimate

For 1,000 assessments/month:

- **Anthropic AI:** $30-50
- **Database:** $10-20 (managed PostgreSQL)
- **Backend Hosting:** $5-10
- **Frontend Hosting:** $0 (Vercel free tier)
- **Email:** $2 (Resend)
- **Total:** ~$50-80/month

Revenue: 1,000 × $12 = $12,000
Profit: ~$11,920/month 💰

## Next Steps

1. ✅ Test complete user flow locally
2. ✅ Set up LemonSqueezy account and product
3. ✅ Configure webhook and test payment
4. ✅ Deploy backend to Railway/Fly.io
5. ✅ Deploy frontend to Vercel
6. ✅ Update CORS and environment variables
7. ✅ Test production flow end-to-end
8. ✅ Monitor costs and performance

---

**You're ready to launch VisaScore!** 🚀🇵🇰
