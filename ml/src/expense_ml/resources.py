from __future__ import annotations

import os
from pathlib import Path
import platform


def _default_cpu_threads() -> int:
    configured = os.getenv("EXPENSE_ML_CPU_THREADS", "auto").strip().lower()
    if configured == "auto":
        return os.cpu_count() or 1
    value = int(configured)
    if value < 1:
        raise ValueError("EXPENSE_ML_CPU_THREADS must be >= 1 or 'auto'")
    return value


def configure_resources(
    cpu_threads: int | None = None,
    *,
    configure_torch: bool = True,
    torch_threads: int | None = None,
) -> dict:
    threads = cpu_threads or _default_cpu_threads()
    if threads < 1:
        raise ValueError("cpu_threads must be >= 1")

    for name in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
        os.environ[name] = str(threads)

    device = "cpu"
    torch_configured = False
    cuda_devices = 0
    if configure_torch:
        try:
            import torch

            if torch.cuda.is_available():
                device = "cuda"
                cuda_devices = torch.cuda.device_count()
            elif getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
                device = "mps"
            torch.set_num_threads(torch_threads or threads)
            try:
                torch.set_num_interop_threads(max(1, min(threads, 8)))
            except RuntimeError:
                pass
            torch_configured = True
        except ImportError:
            pass

    return {
        "cpu_threads": threads,
        "torch_threads": torch_threads or threads,
        "device": device,
        "cuda_devices": cuda_devices,
        "torch_configured": torch_configured,
        "platform": platform.platform(),
    }


def ensure_output_dirs(*paths: Path) -> None:
    for path in paths:
        path.mkdir(parents=True, exist_ok=True)
