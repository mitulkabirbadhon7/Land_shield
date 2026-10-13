.PHONY: setup test run seed smoke smoke-live clean up down logs reset

setup:
	python -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -r backend/requirements.txt

test:
	cd backend && pytest -v

smoke:
	python scripts/smoke_test.py --base-url http://localhost:8000

smoke-live:
	python scripts/smoke_test.py --base-url https://land-shield.onrender.com

run:
	cd backend && uvicorn app.main:app --reload --port 8000

seed:
	cd backend && python scripts/seed.py --reset

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

reset:
	docker compose down -v

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
