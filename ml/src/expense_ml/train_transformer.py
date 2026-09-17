from __future__ import annotations

import os

import numpy as np
import pandas as pd

from .config import TrainingConfig, seed_everything
from .models.transformer import TransformerCategoryModel


def _workers(config: TrainingConfig) -> int:
    if config.dataloader_workers is not None:
        return max(0, config.dataloader_workers)
    return max(1, min((os.cpu_count() or 2) // 2, 4))


def _precision_flags(config: TrainingConfig) -> tuple[bool, bool]:
    mode = config.mixed_precision.strip().lower()
    if mode == "fp16":
        if not torch_available_cuda():
            raise ValueError("FP16 mixed precision requires CUDA")
        return True, False
    if mode == "bf16":
        if not torch_available_cuda():
            raise ValueError("BF16 mixed precision requires CUDA")
        import torch
        if not torch.cuda.is_bf16_supported():
            raise ValueError("BF16 was requested but the active CUDA device does not support it")
        return False, True
    if mode not in {"auto", "none", "off"}:
        raise ValueError("mixed_precision must be one of: auto, none, fp16, bf16")
    if mode in {"none", "off"} or not torch_available_cuda():
        return False, False
    import torch
    if torch.cuda.is_bf16_supported():
        return False, True
    return True, False


def train_transformer(
    train_frame: pd.DataFrame,
    validation_frame: pd.DataFrame | None,
    config: TrainingConfig,
) -> TransformerCategoryModel:
    from datasets import Dataset
    from transformers import DataCollatorWithPadding, EarlyStoppingCallback, Trainer, TrainingArguments

    if train_frame.empty:
        raise ValueError("Transformer training requires a non-empty train frame.")
    if validation_frame is not None and validation_frame.empty:
        raise ValueError("A provided Transformer validation frame cannot be empty.")

    train_labels = set(train_frame["label"])
    if len(train_labels) < 2:
        raise ValueError("Transformer training requires at least two distinct labels.")
    if validation_frame is not None:
        unseen = sorted(set(validation_frame["label"]) - train_labels)
        if unseen:
            raise ValueError(f"Validation contains labels absent from training data: {unseen}")

    seed_everything(config.seed)
    labels = sorted(train_labels)
    label2id = {label: i for i, label in enumerate(labels)}
    base = TransformerCategoryModel.build(config.transformer_name, labels, config.max_length)
    tokenizer, model = base.tokenizer, base.model
    train = Dataset.from_pandas(train_frame[["text", "label"]], preserve_index=False)
    valid = (
        Dataset.from_pandas(validation_frame[["text", "label"]], preserve_index=False)
        if validation_frame is not None
        else None
    )
    workers = _workers(config)
    tokenization_workers = max(1, min(workers, 4))

    def tokenize(batch):
        encoded = tokenizer(batch["text"], truncation=True, max_length=config.max_length)
        encoded["labels"] = [label2id[x] for x in batch["label"]]
        return encoded

    train = train.map(
        tokenize,
        batched=True,
        num_proc=tokenization_workers,
        remove_columns=["text", "label"],
        desc="Tokenizing train",
    )
    if valid is not None:
        valid = valid.map(
            tokenize,
            batched=True,
            num_proc=tokenization_workers,
            remove_columns=["text", "label"],
            desc="Tokenizing validation",
        )

    def metrics(eval_pred):
        from sklearn.metrics import accuracy_score, f1_score
        predictions, targets = eval_pred
        predicted = np.argmax(predictions, axis=-1)
        return {
            "accuracy": accuracy_score(targets, predicted),
            "macro_f1": f1_score(targets, predicted, average="macro", zero_division=0),
            "weighted_f1": f1_score(targets, predicted, average="weighted", zero_division=0),
        }

    fp16, bf16 = _precision_flags(config)
    cuda = torch_available_cuda()
    has_validation = valid is not None
    args = TrainingArguments(
        output_dir=str(config.model_dir / "training"),
        learning_rate=config.learning_rate,
        per_device_train_batch_size=config.batch_size,
        per_device_eval_batch_size=config.eval_batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        num_train_epochs=config.epochs,
        eval_strategy="epoch" if has_validation else "no",
        save_strategy="epoch" if has_validation else "no",
        load_best_model_at_end=has_validation,
        metric_for_best_model="macro_f1" if has_validation else None,
        greater_is_better=True if has_validation else None,
        logging_strategy="steps",
        logging_steps=100,
        report_to="none",
        disable_tqdm=not config.progress,
        seed=config.seed,
        data_seed=config.seed,
        save_total_limit=2,
        fp16=fp16,
        bf16=bf16,
        dataloader_num_workers=workers,
        dataloader_pin_memory=config.pin_memory and cuda,
        dataloader_persistent_workers=config.persistent_workers and workers > 0,
        tf32=tf32_available(),
    )
    callbacks = [EarlyStoppingCallback(early_stopping_patience=2)] if has_validation else []
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train,
        eval_dataset=valid,
        processing_class=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=metrics if has_validation else None,
        callbacks=callbacks,
    )
    trainer.train()
    wrapper = TransformerCategoryModel(model, tokenizer, labels, config.max_length)
    wrapper.save(config.model_dir)
    return wrapper


def torch_available_cuda() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def tf32_available() -> bool:
    try:
        import torch
        return torch.cuda.is_available() and torch.cuda.get_device_capability(0)[0] >= 8
    except Exception:
        return False
