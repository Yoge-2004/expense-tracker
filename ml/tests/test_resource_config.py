import os

from expense_ml.resources import configure_resources
from expense_ml.train_transformer import _workers
from expense_ml.config import TrainingConfig


def test_configure_resources_uses_explicit_cpu_thread_limit():
    configure_resources(cpu_threads=3)
    assert os.environ["OMP_NUM_THREADS"] == "3"
    assert os.environ["MKL_NUM_THREADS"] == "3"
    assert os.environ["OPENBLAS_NUM_THREADS"] == "3"
    assert os.environ["NUMEXPR_NUM_THREADS"] == "3"


def test_configure_resources_reports_device_without_requiring_torch():
    info = configure_resources(cpu_threads=2, configure_torch=False)
    assert info["cpu_threads"] == 2
    assert info["torch_configured"] is False
    assert info["device"] in {"cpu", "cuda", "mps"}


def test_transformer_worker_count_honors_explicit_setting():
    assert _workers(TrainingConfig(dataloader_workers=4)) == 4
