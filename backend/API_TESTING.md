# API Testing Guide

This guide provides example requests for testing the Visa Application Risk Assessment API.

## Prerequisites

- Server running at `http://localhost:8000`
- PostgreSQL database set up and migrations applied

## Testing with cURL

### 1. Health Check

```bash
curl http://localhost:8000/
```

**Expected Response:**
```json
{
  "message": "Visa Application Risk Assessment API"
}
```

### 2. Start a New Report

```bash
curl -X POST http://localhost:8000/api/reports/start \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "visa_type": "schengen"
  }'
```

**Expected Response:**
```json
{
  "report_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

Save the `report_id` for subsequent requests.

### 3. Submit Application Answers

Replace `{REPORT_ID}` with the actual report ID from step 2.

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

**Expected Response:**
```json
{
  "risk_score": 58,
  "risk_level": "moderate",
  "summary": "Limited international travel history is the primary concern for this otherwise solid application.",
  "teaser": [
    {
      "category": "Home Ties",
      "score": 18,
      "max_score": 25,
      "issue": "No prior international travel raises concerns about return intent despite strong home ties.",
      "fix": "Unlock full report to see the fix for this issue"
    },
    {
      "category": "Financial Stability",
      "score": 20,
      "max_score": 25,
      "issue": "Bank balance meets minimum requirements but monthly income could be higher for optimal assessment.",
      "fix": "Unlock full report to see the fix for this issue"
    }
  ]
}
```

### 4. Get Report (Unpaid)

```bash
curl http://localhost:8000/api/reports/{REPORT_ID}
```

**Expected Response (unpaid):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440001",
  "visa_type": "schengen",
  "risk_score": 58,
  "risk_level": "moderate",
  "summary": "Limited international travel history is the primary concern for this otherwise solid application.",
  "paid": false,
  "created_at": "2024-01-01T12:00:00"
}
```

### 5. Simulate LemonSqueezy Webhook (Mark as Paid)

```bash
curl -X POST http://localhost:8000/api/webhooks/lemonsqueezy \
  -H "Content-Type: application/json" \
  -H "X-Signature: test_signature" \
  -d '{
    "meta": {
      "event_name": "order_created"
    },
    "data": {
      "attributes": {
        "identifier": "LS-ORDER-123",
        "custom_data": {
          "report_id": "{REPORT_ID}"
        }
      }
    }
  }'
```

**Note:** In production, the X-Signature header must be a valid HMAC signature.

### 6. Get Report (Paid)

After the webhook marks the report as paid:

```bash
curl http://localhost:8000/api/reports/{REPORT_ID}
```

**Expected Response (paid):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655440001",
  "visa_type": "schengen",
  "risk_score": 58,
  "risk_level": "moderate",
  "summary": "Limited international travel history is the primary concern for this otherwise solid application.",
  "paid": true,
  "breakdown": [
    {
      "category": "Financial Stability",
      "score": 20,
      "max_score": 25,
      "issue": "Bank balance meets minimum requirements but monthly income could be higher for optimal assessment.",
      "fix": "Increase monthly savings rate and maintain consistent bank statements for 6 months before application."
    },
    {
      "category": "Home Ties",
      "score": 18,
      "max_score": 25,
      "issue": "No prior international travel raises concerns about return intent despite strong home ties.",
      "fix": "Consider obtaining visas to easier countries first (UAE, Turkey, Thailand) to build travel history."
    },
    {
      "category": "Purpose & Documentation",
      "score": 23,
      "max_score": 25,
      "issue": "Documentation is complete but could include additional supporting evidence.",
      "fix": "Include employment leave approval letter and detailed daily itinerary with prepaid bookings."
    },
    {
      "category": "Risk Profile",
      "score": 21,
      "max_score": 25,
      "issue": "Age and marital status are positive but lack of prior Schengen travel is a minor concern.",
      "fix": "France has relatively moderate approval rates; ensure all documentation is in French or English with certified translations."
    }
  ],
  "created_at": "2024-01-01T12:00:00"
}
```

## Testing with Python

```python
import requests

BASE_URL = "http://localhost:8000"

# 1. Start a report
response = requests.post(
    f"{BASE_URL}/api/reports/start",
    json={"email": "user@example.com", "visa_type": "schengen"}
)
report_data = response.json()
report_id = report_data["report_id"]
print(f"Created report: {report_id}")

# 2. Submit answers
response = requests.post(
    f"{BASE_URL}/api/reports/{report_id}/submit",
    json={
        "answers": {
            "monthly_income_pkr": 150000,
            "bank_balance_pkr": 800000,
            "bank_balance_consistent": True,
            "trip_sponsor": "self",
            "employment_status": "employed",
            "owns_property": True,
            "has_dependents": True,
            "prior_international_travel": False,
            "visit_purpose": "tourism",
            "has_detailed_itinerary": True,
            "has_hotel_and_return_ticket": True,
            "has_schengen_insurance": True,
            "prior_visa_refusal": False,
            "age": 32,
            "marital_status": "married",
            "target_schengen_country": "France"
        }
    }
)
result = response.json()
print(f"Risk score: {result['risk_score']}")
print(f"Risk level: {result['risk_level']}")
print(f"Summary: {result['summary']}")

# 3. Get report (unpaid)
response = requests.get(f"{BASE_URL}/api/reports/{report_id}")
print(f"Paid status: {response.json()['paid']}")
```

## Testing with Postman

1. Import this collection by creating a new Postman collection
2. Set a collection variable `base_url` to `http://localhost:8000`
3. Set a collection variable `report_id` after creating a report
4. Use `{{base_url}}` and `{{report_id}}` in your requests

### Postman Collection Example

```json
{
  "info": {
    "name": "Visa Risk Assessment API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Start Report",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"user@example.com\",\n  \"visa_type\": \"schengen\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": "{{base_url}}/api/reports/start"
      }
    },
    {
      "name": "Submit Answers",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"answers\": {\n    \"employment_status\": \"employed\"\n  }\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": "{{base_url}}/api/reports/{{report_id}}/submit"
      }
    },
    {
      "name": "Get Report",
      "request": {
        "method": "GET",
        "header": [],
        "url": "{{base_url}}/api/reports/{{report_id}}"
      }
    }
  ]
}
```

## Interactive API Documentation

FastAPI provides interactive API documentation automatically:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

These interfaces allow you to test all endpoints directly in your browser without writing any code.

## Common Issues

### 404 Not Found
- Verify the server is running
- Check that you're using the correct report ID
- Ensure database migrations have been applied

### 422 Unprocessable Entity
- Check your request body format
- Ensure all required fields are present
- Verify field types match the schema

### 500 Internal Server Error
- Check database connection
- Verify environment variables are set
- Check server logs for detailed error messages
