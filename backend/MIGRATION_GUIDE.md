# Migration Guide: AI Scorer Implementation

This guide covers the database schema changes required for the new AI scoring engine.

## Changes Made

### Database Schema Updates

Two new columns have been added to the `reports` table:

1. **`risk_level`** (String, nullable) - Stores the risk level category: "critical", "high", "moderate", or "good"
2. **`summary`** (String, nullable) - Stores a one-sentence summary of the application's assessment

### API Response Changes

#### Submit Report Response (POST `/api/reports/{report_id}/submit`)

**Before:**
```json
{
  "risk_score": 65,
  "teaser": [...]
}
```

**After:**
```json
{
  "risk_score": 65,
  "risk_level": "moderate",
  "summary": "Limited international travel history is the primary concern...",
  "teaser": [...]
}
```

#### Get Report Response (GET `/api/reports/{report_id}`)

**Before:**
```json
{
  "risk_score": 65,
  "paid": false,
  ...
}
```

**After:**
```json
{
  "risk_score": 65,
  "risk_level": "moderate",
  "summary": "Limited international travel history is the primary concern...",
  "paid": false,
  ...
}
```

#### Breakdown Item Structure

**Before:**
```json
{
  "category": "Financial Stability",
  "score": 45,
  "issue": "...",
  "fix": "..."
}
```

**After:**
```json
{
  "category": "Financial Stability",
  "score": 20,
  "max_score": 25,
  "issue": "...",
  "fix": "..."
}
```

## Migration Steps

### Step 1: Update Dependencies

```bash
pip install -r requirements.txt
```

This will install the updated Anthropic SDK (v0.39.0).

### Step 2: Create Migration

```bash
alembic revision --autogenerate -m "Add risk_level and summary to reports"
```

This will generate a new migration file in `alembic/versions/`. The migration should include:

```python
def upgrade():
    op.add_column('reports', sa.Column('risk_level', sa.String(), nullable=True))
    op.add_column('reports', sa.Column('summary', sa.String(), nullable=True))

def downgrade():
    op.drop_column('reports', 'summary')
    op.drop_column('reports', 'risk_level')
```

### Step 3: Apply Migration

```bash
alembic upgrade head
```

### Step 4: Set ANTHROPIC_API_KEY

Add your Anthropic API key to the `.env` file:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

You can get an API key from: https://console.anthropic.com/

### Step 5: Test the AI Scorer

Run the test script:

```bash
python test_ai_scorer.py
```

This will test three different applicant profiles (strong, weak, moderate) and verify the AI scoring is working correctly.

### Step 6: Restart the Server

```bash
uvicorn main:app --reload
```

## Rollback (If Needed)

If you need to rollback the changes:

```bash
alembic downgrade -1
```

This will remove the `risk_level` and `summary` columns.

## Testing the Changes

### Test Submit Endpoint

```bash
curl -X POST http://localhost:8000/api/reports/{REPORT_ID}/submit \
  -H "Content-Type: application/json" \
  -d '{
    "answers": {
      "monthly_income_pkr": 150000,
      "bank_balance_pkr": 800000,
      "bank_balance_consistent": true,
      "trip_sponsor": "self",
      "employment_status": "employed",
      "owns_property": true,
      "has_dependents": true,
      "prior_international_travel": false,
      "visit_purpose": "tourism",
      "has_detailed_itinerary": true,
      "has_hotel_and_return_ticket": true,
      "has_schengen_insurance": true,
      "prior_visa_refusal": false,
      "age": 32,
      "marital_status": "married",
      "target_schengen_country": "France"
    }
  }'
```

You should receive a response with `risk_score`, `risk_level`, `summary`, and `teaser`.

### Test Get Endpoint

```bash
curl http://localhost:8000/api/reports/{REPORT_ID}
```

Before payment, you should see `risk_score`, `risk_level`, and `summary` but NO `breakdown`.

After payment (via webhook), you should see the full `breakdown` array.

## Common Issues

### Issue: "AI service unavailable"

**Cause:** Invalid or missing ANTHROPIC_API_KEY

**Solution:** 
1. Check that `.env` contains `ANTHROPIC_API_KEY=sk-ant-xxxxx`
2. Verify the key is valid at https://console.anthropic.com/
3. Restart the server after adding the key

### Issue: "Scoring service error"

**Cause:** Claude returned invalid JSON or unexpected format

**Solution:**
1. Check server logs for the actual response from Claude
2. The system prompt is very specific - ensure no code changes modified it
3. Try again - occasionally the model may return slightly malformed JSON

### Issue: Migration fails with "column already exists"

**Cause:** Migration was partially applied or database is out of sync

**Solution:**
```bash
# Check current migration state
alembic current

# If needed, manually drop columns and rerun
psql -d visa_db -c "ALTER TABLE reports DROP COLUMN IF EXISTS risk_level;"
psql -d visa_db -c "ALTER TABLE reports DROP COLUMN IF EXISTS summary;"

# Then rerun migration
alembic upgrade head
```

## API Cost Considerations

The AI scoring now uses **Claude Opus 4.5**, which is a premium model:

- **Model:** claude-opus-4-5
- **Cost:** ~$15 per million input tokens, ~$75 per million output tokens
- **Typical request:** ~500 input tokens, ~300 output tokens
- **Cost per assessment:** ~$0.03-0.05

### Cost Optimization Tips

1. **Cache results:** Store the breakdown in the database (already implemented)
2. **Rate limiting:** Implement rate limiting to prevent abuse
3. **Alternative models:** For development/testing, you can temporarily change the model to `claude-3-5-sonnet-20241022` in `services/ai_scorer.py` (much cheaper, still excellent quality)

## Backwards Compatibility

### Existing Reports

Old reports created before this migration will have:
- `risk_level`: NULL
- `summary`: NULL

The API will return these as `null` in JSON responses. Frontend should handle null values gracefully.

### Regenerating Old Reports

If you want to backfill old reports with risk_level and summary, you can create a script:

```python
# backfill_reports.py
import asyncio
from database import async_session_maker
from models import Report
from services.ai_scorer import score_application
from sqlalchemy import select

async def backfill_reports():
    async with async_session_maker() as db:
        result = await db.execute(
            select(Report).where(
                Report.risk_score.isnot(None),
                Report.risk_level.is_(None)
            )
        )
        reports = result.scalars().all()
        
        for report in reports:
            if report.answers:
                scoring_result = await score_application(report.answers)
                report.risk_level = scoring_result["risk_level"]
                report.summary = scoring_result["summary"]
                await db.commit()
                print(f"Backfilled report {report.id}")

asyncio.run(backfill_reports())
```

**Warning:** This will incur API costs for each report regenerated.

## Next Steps

After successful migration:

1. ✅ Update frontend to display `risk_level` and `summary`
2. ✅ Add visual indicators for risk levels (critical=red, high=orange, moderate=yellow, good=green)
3. ✅ Test the paywall - ensure only `teaser` is returned before payment
4. ✅ Test email delivery with new formatting
5. ✅ Monitor API costs in Anthropic dashboard

## Support

If you encounter issues:

1. Check the server logs: `uvicorn main:app --reload` (watch console output)
2. Verify database state: `psql -d visa_db -c "SELECT id, risk_level, summary FROM reports LIMIT 5;"`
3. Test AI scorer independently: `python test_ai_scorer.py`
4. Review API documentation: http://localhost:8000/docs

For Anthropic API issues, check their status page: https://status.anthropic.com/
