from fastapi.testclient import TestClient
from app.main import app
from app.config import Settings

client = TestClient(app)

def test_root_index():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["docs"] == "/docs"


def test_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    # Root alias /health
    resp_alias = client.get("/health")
    assert resp_alias.status_code == 200
    assert resp_alias.json() == {"status": "ok"}


def test_deep_health_check():
    response = client.get("/api/v1/health/deep")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert "seeded" in data
    assert isinstance(data["plots_count"], int)
    assert isinstance(data["deeds_count"], int)

    # Security assertion: ensure response does NOT leak any secrets
    response_str = response.text.lower()
    for sensitive_keyword in ["secret", "password", "signing_key", "jwt", "psycopg://"]:
        assert sensitive_keyword not in response_str


def test_database_url_normalization():
    s1 = Settings(database_url="postgres://user:pass@ep-cool-host.render.com:5432/landdb")
    assert s1.normalized_database_url.startswith("postgresql+psycopg://")
    assert "user:pass@ep-cool-host.render.com:5432/landdb" in s1.normalized_database_url

    s2 = Settings(database_url="postgresql://user:pass@railway.app:5432/railway")
    assert s2.normalized_database_url.startswith("postgresql+psycopg://")

    s3 = Settings(database_url="postgresql+psycopg://user:pass@host:5432/db")
    assert s3.normalized_database_url == "postgresql+psycopg://user:pass@host:5432/db"

    s4 = Settings(database_url="sqlite:///./landshield.db")
    assert s4.normalized_database_url == "sqlite:///./landshield.db"


def test_port_configuration():
    s_default = Settings()
    assert s_default.effective_port == 8000

    s_custom = Settings(PORT=10000)
    assert s_custom.effective_port == 10000

