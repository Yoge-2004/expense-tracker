from pathlib import Path


def test_combined_docker_runtime_declares_required_ports_and_services():
    root = Path(__file__).parents[2]
    dockerfile = (root / "Dockerfile").read_text(encoding="utf-8")
    supervisor = (root / "docker/supervisord.conf").read_text(encoding="utf-8")
    nginx = (root / "docker/nginx.conf").read_text(encoding="utf-8")

    assert "EXPOSE 7860 8080 8000" in dockerfile
    assert "127.0.0.1:8080" in supervisor
    assert "127.0.0.1 --port 8000" in supervisor
    assert "listen 7860" in nginx
    assert "127.0.0.1:8000" in nginx
    assert "127.0.0.1:8080" in nginx


def test_production_docker_context_excludes_training_code_and_local_data():
    root = Path(__file__).parents[2]
    ignore = (root / ".dockerignore").read_text(encoding="utf-8")
    assert "ml/jobs" in ignore
    assert "ml/tests" in ignore
    assert "ml/data" in ignore
    assert "ml/artifacts" in ignore
