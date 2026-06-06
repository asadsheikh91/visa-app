# AI Scorer Implementation Summary

## Overview

The AI scoring engine has been fully implemented using Anthropic's Claude Opus 4.5 model. This document provides a comprehensive overview of the implementation.

## Architecture

```
Client Request
     ↓
POST /api/reports/{id}/submit
     ↓
score_application(answers) ← Anthropic Claude API
     ↓
Store: risk_score, risk_level, summary, breakdown
     ↓
Return: risk_score, risk_level, summary, teaser (2 worst items)
     ↓
Client receives partial results
     ↓
[User pays via LemonSqueezy]
     ↓
POST /api/webhooks/lemonsqueezy
     ↓
Mark report as paid
     ↓
send_report_email() → Full breakdown via email
     ↓
GET /api/reports/{id} → Returns full breakdown
```

## Input Schema

The `score_application()` function expects these exact keys:

```python
{
    # Financial Stability
    "monthly_income_pkr": int,          # Monthly income in Pakistani Rupees
    "bank_balance_pkr": int,            # Current bank balance in PKR
    "bank_balance_consistent": bool,    # Consistent for 3+ months?
    "trip_sponsor": str,                # "self" | "employer" | "family"
    
    # Home Ties
    "employment_status": str,           # "employed" | "business_owner" | "student" | "unemployed"
    "owns_property": bool,              # Owns property in Pakistan?
    "has_dependents": bool,             # Has spouse/children in Pakistan?
    "prior_international_travel": bool, # Has traveled internationally before?
    
    # Purpose & Documentation
    "visit_purpose": str,               # "tourism" | "business" | "family_visit" | "education"
    "has_detailed_itinerary": bool,     # Day-by-day itinerary?
    "has_hotel_and_return_ticket": bool,# Hotel bookings + return ticket?
    "has_schengen_insurance": bool,     # €30,000 minimum coverage?
    
    # Risk Profile
    "prior_visa_refusal": bool,         # Previously refused any visa?
    "age": int,                         # Applicant age
    "marital_status": str,              # "single" | "married" | "divorced"
    "target_schengen_country": str      # e.g. "France", "Germany"
}
```

## Output Schema

The AI returns:

```python
{
    "risk_score": int,        # 0-100 (0=certain rejection, 100=very strong)
    "risk_level": str,        # "critical" | "high" | "moderate" | "good"
    "summary": str,           # One sentence summary
    "breakdown": [            # Always exactly 4 items
        {
            "category": str,      # One of 4 categories
            "score": int,         # 0-25
            "max_score": 25,      # Always 25
            "issue": str,         # Specific problem found
            "fix": str            # Actionable recommendation
        }
    ]
}
```

## Categories

The breakdown always contains exactly 4 items, one per category:

1. **Financial Stability** - Income, bank balance, sponsor, financial consistency
2. **Home Ties** - Employment, property ownership, dependents, travel history
3. **Purpose & Documentation** - Visit purpose, itinerary, bookings, insurance
4. **Risk Profile** - Age, marital status, prior refusals, target country

## Risk Level Mapping

- **0-30**: Critical (red flag, very likely rejection)
- **31-50**: High (significant concerns, rejection likely)
- **51-75**: Moderate (acceptable with improvements)
- **76-100**: Good (strong application)

## Teaser Logic

The `get_teaser()` function:

1. Sorts breakdown by score (ascending)
2. Takes the 2 items with the lowest scores
3. Replaces the `fix` field with: "Unlock full report to see the fix for this issue"
4. Returns these 2 items

This creates a paywall - users see their problems but must pay to see solutions.

## Model Configuration

```python
model="claude-opus-4-5"      # Premium model for accuracy
max_tokens=1000              # Sufficient for structured output
temperature=0                # Deterministic, consistent scoring
```

**Why Opus?** This is a paid product. Users are paying for high-quality, accurate assessments. Opus provides:
- Superior reasoning about complex visa requirements
- Better understanding of Pakistani applicant context
- More actionable, specific recommendations
- Consistent JSON formatting

## System Prompt Design

The system prompt:

1. **Establishes expertise** - Schengen visa specialist for Pakistani applicants
2. **Provides context** - ~50% refusal rate, EU consular guidelines
3. **Sets scoring philosophy** - Harsh but fair, realistic expectations
4. **Enforces structure** - JSON-only output, exact schema
5. **Ensures quality** - Concrete fixes, not generic advice

Key scoring rule: Pakistani applicants start at -15 points baseline due to country-level risk perception. This reflects real-world embassy bias.

## Error Handling

### Anthropic API Errors

```python
try:
    message = await client.messages.create(...)
except Exception as e:
    raise HTTPException(503, "AI service unavailable")
```

Returns 503 (Service Unavailable) for API failures, rate limits, network issues.

### JSON Parsing Errors

```python
try:
    result = json.loads(response_text)
except json.JSONDecodeError:
    raise HTTPException(500, "Scoring service error")
```

Returns 500 (Internal Server Error) if Claude returns invalid JSON.

The code strips markdown fences before parsing:
```python
response_text = re.sub(r'^```json\s*', '', response_text)
response_text = re.sub(r'\s*```$', '', response_text)
```

## Database Storage

The `Report` model stores:

```python
answers: JSON          # Full applicant answers
risk_score: Integer    # Overall score (0-100)
risk_level: String     # "critical" | "high" | "moderate" | "good"
summary: String        # One-line summary
breakdown: JSON        # Full 4-item breakdown with fixes
```

## API Response Flow

### Before Payment (Submit + Get)

```json
{
  "risk_score": 58,
  "risk_level": "moderate",
  "summary": "Limited international travel history...",
  "teaser": [
    {
      "category": "Home Ties",
      "score": 18,
      "max_score": 25,
      "issue": "No prior international travel...",
      "fix": "Unlock full report to see the fix for this issue"
    },
    {
      "category": "Financial Stability",
      "score": 20,
      "max_score": 25,
      "issue": "Bank balance meets minimum...",
      "fix": "Unlock full report to see the fix for this issue"
    }
  ]
}
```

### After Payment (Get)

```json
{
  "risk_score": 58,
  "risk_level": "moderate",
  "summary": "Limited international travel history...",
  "breakdown": [
    {
      "category": "Financial Stability",
      "score": 20,
      "max_score": 25,
      "issue": "Bank balance meets minimum requirements...",
      "fix": "Increase monthly savings rate and maintain consistent bank statements for 6 months before application."
    },
    {
      "category": "Home Ties",
      "score": 18,
      "max_score": 25,
      "issue": "No prior international travel raises concerns...",
      "fix": "Consider obtaining visas to easier countries first (UAE, Turkey, Thailand) to build travel history."
    },
    // ... 2 more items
  ]
}
```

## Email Template

The email includes:

- **Visual Score Badge** - Large, colored score (red/orange/yellow/green)
- **Risk Level** - Color-coded risk level label
- **Summary Box** - Highlighted one-sentence summary
- **Full Breakdown** - All 4 categories with scores, issues, and fixes
- **Styled Cards** - Each breakdown item in a bordered card
- **Disclaimer** - Legal disclaimer about not guaranteeing approval

## Cost Analysis

### Per Request Costs

- **Model:** Claude Opus 4.5
- **Input tokens:** ~500 (system prompt + user message)
- **Output tokens:** ~300 (structured JSON response)
- **Cost per assessment:** ~$0.03-0.05

### Monthly Projections

| Reports/Month | Cost |
|---------------|------|
| 100 | $3-5 |
| 500 | $15-25 |
| 1,000 | $30-50 |
| 5,000 | $150-250 |

### Optimization Options

If costs become an issue:

1. **Switch to Sonnet** - Use `claude-3-5-sonnet-20241022` (~70% cost reduction, still excellent quality)
2. **Cache system prompt** - Implement prompt caching (50% reduction on repeated calls)
3. **Batch processing** - Queue requests during off-peak hours
4. **Tiered models** - Use Sonnet for free previews, Opus for paid reports

## Testing

### Unit Test

```bash
python test_ai_scorer.py
```

Tests three profiles:
- Strong applicant (should score 60-100)
- Weak applicant (should score 0-40)
- Moderate applicant (should score 30-70)

### Integration Test

```bash
# Start server
uvicorn main:app --reload

# In another terminal
curl -X POST http://localhost:8000/api/reports/start \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Use returned report_id
curl -X POST http://localhost:8000/api/reports/{REPORT_ID}/submit \
  -H "Content-Type: application/json" \
  -d @test_data.json
```

## Security Considerations

### API Key Protection

- ✅ API key stored in `.env` (not version controlled)
- ✅ `.gitignore` includes `.env`
- ✅ `.env.example` provided as template

### Input Validation

- ✅ Pydantic schemas validate all inputs
- ✅ Type checking on all answer fields
- ✅ Database constraints prevent invalid data

### Rate Limiting

⚠️ **TODO:** Add rate limiting middleware to prevent abuse:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/reports/{report_id}/submit")
@limiter.limit("3/minute")  # Max 3 submissions per minute per IP
async def submit_report(...):
    ...
```

## Frontend Integration

### Display Risk Level

```javascript
const riskColors = {
  critical: "#dc2626",  // red-600
  high: "#ea580c",      // orange-600
  moderate: "#ca8a04",  // yellow-600
  good: "#16a34a"       // green-600
};

const color = riskColors[report.risk_level];
```

### Show/Hide Breakdown

```javascript
if (report.paid) {
  // Show full breakdown with fixes
  return <FullBreakdown items={report.breakdown} />;
} else {
  // Show teaser with paywall
  return (
    <>
      <TeaserBreakdown items={report.teaser} />
      <PaywallButton reportId={report.id} />
    </>
  );
}
```

## Monitoring

### Key Metrics to Track

1. **API Success Rate** - % of successful Claude API calls
2. **Average Response Time** - Time from request to response
3. **Cost per Report** - Actual API costs
4. **Score Distribution** - Histogram of risk scores
5. **Error Rate** - JSON parsing failures, API errors

### Logging

The service logs:
- ✅ API call failures with error messages
- ✅ JSON parsing errors with response text
- ✅ Successful email deliveries
- ⚠️ **TODO:** Structured logging with request IDs

## Future Enhancements

### Short Term

- [ ] Add caching for identical answer sets
- [ ] Implement rate limiting
- [ ] Add request ID tracking for debugging
- [ ] Create admin dashboard for score analytics

### Medium Term

- [ ] A/B test Opus vs Sonnet quality/cost tradeoff
- [ ] Implement prompt caching to reduce costs
- [ ] Add multi-language support (Urdu, Arabic)
- [ ] Create visual PDF reports

### Long Term

- [ ] Train custom fine-tuned model
- [ ] Add real-time embassy approval rate data
- [ ] Implement ML-based price optimization
- [ ] Build applicant success tracking

## Troubleshooting

### "AI service unavailable"

1. Check `ANTHROPIC_API_KEY` in `.env`
2. Verify API key at https://console.anthropic.com/
3. Check Anthropic status: https://status.anthropic.com/
4. Review server logs for actual error

### "Scoring service error"

1. Check server logs for Claude's raw response
2. Verify system prompt hasn't been modified
3. Try the request again (occasional model errors)
4. Check if model name is correct: `claude-opus-4-5`

### Scores seem too high/low

The system prompt is calibrated for Pakistani applicants with the -15 baseline penalty. If scores seem off:

1. Review the system prompt scoring rules
2. Test with known good/bad profiles
3. Adjust the baseline penalty in system prompt
4. Collect real-world rejection data for calibration

### Teaser showing wrong items

The teaser shows the 2 **lowest-scoring** categories (worst problems). This is intentional - it highlights the issues that need the most improvement.

## Support & Resources

- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **Anthropic Docs:** https://docs.anthropic.com/
- **Claude Opus Specs:** https://www.anthropic.com/claude
- **API Pricing:** https://www.anthropic.com/pricing

## Change Log

### v2.0.0 (Current)

- ✅ Implemented real AI scoring with Claude Opus 4.5
- ✅ Added `risk_level` and `summary` fields
- ✅ Updated breakdown structure with `max_score`
- ✅ Implemented `get_teaser()` paywall logic
- ✅ Enhanced email template with visual styling
- ✅ Created comprehensive testing suite
- ✅ Added migration guide and documentation

### v1.0.0 (Previous)

- ✅ Stub implementation with random scores
- ✅ Basic breakdown structure
- ✅ Simple teaser (first 2 items)
