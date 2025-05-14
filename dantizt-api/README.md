# Dantizt API

Backend API for the Dantizt dental clinic management system.

## Features

- Patient management
- Doctor scheduling
- Appointment booking
- Medical history tracking
- Treatment plans
- Payment processing
- Service management
- Data export capabilities

## Technology Stack

- FastAPI
- SQLAlchemy
- PostgreSQL
- Pydantic
- Python 3.8+

## Setup

1. Create and activate virtual environment:
```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
Copy `.env.example` to `.env` and update the values according to your environment.

4. Run database migrations:
```bash
alembic upgrade head
```

5. Start the development server:
```bash
python run.py
```

The API will be available at http://localhost:8000

API documentation will be available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
dantizt-api/
├── app/
│   ├── api/            # API endpoints
│   ├── core/           # Core functionality and config
│   ├── db/             # Database models and session
│   ├── schemas/        # Pydantic models
│   ├── services/       # Business logic
│   └── workers/        # Background tasks
├── scripts/            # Utility scripts
├── views/             # View-related functionality
└── requirements.txt    # Project dependencies
```

## Development

- Follow PEP 8 style guide
- Write tests for new features
- Update documentation when making changes
- Use type hints
- Follow REST API best practices

## License

This project is proprietary and confidential.
