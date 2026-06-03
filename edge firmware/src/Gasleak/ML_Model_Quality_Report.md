# Gas Leak Detection Model Quality Report
================================================================================

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Total Boards Evaluated | 1 |
| Total Samples | 439 |
| Average Accuracy | 100.00% |
| Average F1-Score (Macro) | 100.00% |

## 2. Per-Board Results

| Board | Samples | Accuracy | Precision | Recall | F1-Score |
|-------|---------|----------|-----------|--------|----------|
| Board1 | 439 | 100.00% | 100.00% | 100.00% | 100.00% |
| **Average** | **439** | **100.00%** | **100.00%** | **100.00%** | **100.00%** |

## 3. Detailed Confusion Matrices

### Board1 (n=439)

|  | LPG | Metana | Udara | Total |
|---||---|---|---|---|
| **LPG** | 139 | 0 | 0 | 139 |
| **Metana** | 0 | 150 | 0 | 150 |
| **Udara** | 0 | 0 | 150 | 150 |
| LPG Recall | 100.0% | 0.0% | 0.0% |
| Metana Recall | 0.0% | 100.0% | 0.0% |
| Udara Recall | 0.0% | 0.0% | 100.0% |

## 4. Class-wise Performance (Aggregated)

```
              precision    recall  f1-score   support

         LPG       1.00      1.00      1.00       139
      Metana       1.00      1.00      1.00       150
       Udara       1.00      1.00      1.00       150

    accuracy                           1.00       439
   macro avg       1.00      1.00      1.00       439
weighted avg       1.00      1.00      1.00       439
```

## 5. Class Distribution

| Board | LPG | Metana | Udara | Total |
|-------|-----|--------|-------|-------|
| Board1 | 139 (31.7%) | 150 (34.2%) | 150 (34.2%) | 439 |

## 6. Model Quality Assessment

### Overall Quality Rating: **GOOD**

### Strengths:
- High overall accuracy (>85%)
- Good balance between precision and recall
- Fast inference time (TFLite Micro)
- Compact model size for edge deployment

### Areas for Improvement:

### Recommendations:
3. Perform hyperparameter tuning
4. Test with cross-board validation

## 7. Evaluation Methodology

- **Framework**: TensorFlow Lite Python Interpreter
- **Metrics**: Accuracy, Precision, Recall, F1-Score
- **Split**: Train/Test 80/20 (random stratified)
- **Scaler**: StandardScaler (pre-computed from training)

