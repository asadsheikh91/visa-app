# Setup script for Windows PowerShell

Write-Host "Setting up Visa Application Risk Assessment API..." -ForegroundColor Green

# Check if Python is installed
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "`nInstalling Python dependencies..." -ForegroundColor Cyan
python -m pip install -r requirements.txt

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "`nCopying .env.example to .env..." -ForegroundColor Cyan
    Copy-Item .env.example .env
    Write-Host "Please edit .env file with your actual credentials" -ForegroundColor Yellow
} else {
    Write-Host "`n.env file already exists, skipping..." -ForegroundColor Yellow
}

Write-Host "`nSetup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env file with your database and API credentials"
Write-Host "2. Ensure PostgreSQL is running"
Write-Host "3. Run: alembic revision --autogenerate -m 'Initial migration'"
Write-Host "4. Run: alembic upgrade head"
Write-Host "5. Start the server: uvicorn main:app --reload"
Write-Host "`nAPI documentation will be available at: http://localhost:8000/docs" -ForegroundColor Green
