from __future__ import annotations

import numpy as np
import pandas as pd

from .config import TrainingConfig, seed_everything
from .models.transformer import TransformerCategoryModel


def train_transformer(train_frame: pd.DataFrame, validation_frame: pd.DataFrame, config: TrainingConfig) -> TransformerCategoryModel:
    from datasets import Dataset
    from transformers import DataCollatorWithPadding, EarlyStoppingCallback, Trainer, TrainingArguments

    seed_everything(config.seed)
    labels = sorted(train_frame["label"].unique().tolist())
    label2id = {label: i for i, label in enumerate(labels)}
    base = TransformerCategoryModel.build(config.transformer_name, labels, config.max_length)
    tokenizer, model = base.tokenizer, base.model
    train = Dataset.from_pandas(train_frame[["text", "label"]], preserve_index=False)
    valid = Dataset.from_pandas(validation_frame[["text", "label"]], preserve_index=False)

    def tokenize(batch):
        encoded = tokenizer(batch["text"], truncation=True, max_length=config.max_length)
        encoded["labels"] = [label2id[x] for x in batch["label"]]
        return encoded

    train = train.map(tokenize, batched=True, remove_columns=["text", "label"])
    valid = valid.map(tokenize, batched=True, remove_columns=["text", "label"])

    def metrics(eval_pred):
        from sklearn.metrics import accuracy_score, f1_score
        predictions, targets = eval_pred
        predicted = np.argmax(predictions, axis=-1)
        return {"accuracy": accuracy_score(targets, predicted), "macro_f1": f1_score(targets, predicted, average="macro", zero_division=0), "weighted_f1": f1_score(targets, predicted, average="weighted", zero_division=0)}

    args = TrainingArguments(
        output_dir=str(config.model_dir / "training"),
        learning_rate=config.learning_rate,
        per_device_train_batch_size=config.batch_size,
        per_device_eval_batch_size=config.batch_size,
        num_train_epochs=config.epochs,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        logging_strategy="steps",
        logging_steps=100,
        report_to="none",
        seed=config.seed,
        data_seed=config.seed,
        save_total_limit=2,
    )
    trainer = Trainer(model=model, args=args, train_dataset=train, eval_dataset=valid, processing_class=tokenizer, data_collator=DataCollatorWithPadding(tokenizer), compute_metrics=metrics, callbacks=[EarlyStoppingCallback(early_stopping_patience=2)])
    trainer.train()
    wrapper = TransformerCategoryModel(model, tokenizer, labels, config.max_length)
    wrapper.save(config.model_dir)
    return wrapper
