from expense_ml.models import DuplicateSimilarityModel, MerchantSimilarityIndex


def test_merchant_index_can_cap_candidates():
    index = MerchantSimilarityIndex.fit(
        [f"merchant vendor {chr(97 + i)}" for i in range(20)],
        max_merchants=5,
    )
    assert len(index.merchants) == 5


def test_duplicate_index_can_cap_rows():
    model = DuplicateSimilarityModel.fit([f"payment {i}" for i in range(20)], max_rows=5)
    assert model.matrix.shape[0] == 5
