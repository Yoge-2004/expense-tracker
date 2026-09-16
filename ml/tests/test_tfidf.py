from pathlib import Path

from expense_ml.models.tfidf import TfidfCategoryModel


def test_tfidf_fit_predict_and_save_load(tmp_path: Path):
    texts = ["swiggy dinner", "restaurant lunch", "uber ride", "taxi trip"] * 3
    labels = ["food", "food", "transport", "transport"] * 3
    model = TfidfCategoryModel.fit(texts, labels)
    prediction = model.predict(["swiggy lunch"])
    assert prediction.labels[0] == "food"
    model.save(tmp_path)
    loaded = TfidfCategoryModel.load(tmp_path)
    assert loaded.predict(["uber ride"]).labels[0] == "transport"
