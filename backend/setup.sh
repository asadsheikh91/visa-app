#!/bin/bash

# Setup script for Unix/Linux/Mac

echo "Setting up Visa Application Risk Assessment API..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    exit 1
fi

echo ""
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f .env ]; then
    echo ""
    echo "Copying .env.example to .env..."
    cp .env.example .env
    echo "Please edit .env file with your actual credentials"
else
    echo ""
    echo ".env file already exists, skipping..."
fi

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your database and API credentials"
echo "2. Ensure PostgreSQL is running"
echo "3. Run: alembic revision --autogenerate -m 'Initial migration'"
echo "4. Run: alembic upgrade head"
echo "5. Start the server: uvicorn main:app --reload"
echo ""
echo "API documentation will be available at: http://localhost:8000/docs"
