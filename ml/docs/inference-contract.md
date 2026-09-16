# Future Inference Contract

The training subsystem does not change Spring Boot runtime behavior yet. The eventual inference boundary should accept a normalized transaction description and return:

```json
{
  "category": "Food & Dining",
  "confidence": 0.94,
  "topK": [
    {"category": "Food & Dining", "confidence": 0.94},
    {"category": "Shopping & Retail", "confidence": 0.03},
    {"category": "Entertainment & Recreation", "confidence": 0.01}
  ],
  "modelVersion": "category-transformer-<run-id>"
}
```

The application should treat low-confidence predictions as suggestions rather than silently changing a user's category. A later integration can map the model taxonomy to the user's available global/custom categories and record explicit corrections for evaluation.
