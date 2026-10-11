.PHONY: setup test run seed clean

setup:
	python -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -r backend/requirements.txt

test:
	cd backend && pytest -v

run:
	cd backend && uvicorn app.main:app --reload --port 8000

seed:
	@echo "Seed script ready for Session S05"

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
