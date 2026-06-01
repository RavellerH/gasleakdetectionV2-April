# Gas Leak Detection ML Model
## Technical Presentation Report

---

## 1. Project Overview

**Gas Leak Detection System** is an Edge AI solution for real-time gas leak classification using MQ gas sensors and neural networks deployed on ESP32-S3 microcontrollers.

### System Components
| Component | Description |
|-----------|-------------|
| **Hardware** | ESP32-S3 microcontroller |
| **Sensors** | 8 MQ gas sensors (MQ2, MQ3, MQ4, MQ5, MQ6, MQ7, MQ8, MQ135) |
| **ADC** | ADS1256 for sensor reading |
| **Connectivity** | LoRa Mesh network |
| **Cloud** | NestJS/GraphQL backend |

---

## 2. Dataset

### Training Data
- **Format**: Excel files (.xlsx)
- **Source**: Board-specific sensor readings (Board1-Board11)
- **Samples**: Multiple samples per board

### Features (8 inputs)
| Feature | Description |
|---------|-------------|
| `MQ135V` | Air quality sensor |
| `MQ2V` | LPG, propane, hydrogen |
| `MQ3V` | Alcohol, ethanol |
| `MQ4V` | Methane, CNG |
| `MQ5V` | Natural gas, LPG |
| `MQ6V` | LPG, butane |
| `MQ7V` | Carbon monoxide |
| `MQ8V` | Hydrogen gas |

### Target Classes
| Class | Description |
|-------|-------------|
| `LPG` | Liquefied Petroleum Gas leak |
| `Metana` | Methane leak |
| `Udara` | Normal air (no leak) |

---

## 3. Model Architecture

### Neural Network Design
```
Input Layer:     8 features (sensor readings)
       ↓
Dense Layer:     16 neurons, ReLU activation
Dropout:         0.2
       ↓
Dense Layer:     8 neurons, ReLU activation
Dropout:         0.2
       ↓
Output Layer:    3 neurons, Softmax activation
                 (LPG, Metana, Udara)
```

### Training Configuration
| Parameter | Value |
|-----------|-------|
| Optimizer | Adam |
| Loss Function | Categorical Crossentropy |
| Epochs | 200 (with early stopping) |
| Batch Size | 32 |
| Validation Split | 20% |
| Early Stopping | patience=20 |
| Test Split | 20% |

---

## 4. Data Preprocessing

### StandardScaler Normalization
```python
X_scaled = (X - mean) / scale
```

### Scaler Parameters (Board1 Example)
| Feature | Mean | Std |
|---------|------|-----|
| MQ135V | 0.7677 | 0.9339 |
| MQ2V | 0.5908 | 0.8337 |
| MQ3V | 0.2666 | 0.3824 |
| MQ4V | 0.6068 | 0.8827 |
| MQ5V | 0.2178 | 0.2501 |
| MQ6V | 0.0043 | 0.0013 |
| MQ7V | 0.8116 | 0.8401 |
| MQ8V | 0.6277 | 0.9156 |

---

## 5. TensorFlow Lite Conversion

### Optimization Strategy
```python
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_types = [tf.float16]
```

### Output Files
| File | Description |
|------|-------------|
| `gasleak_model.tflite` | TFLite model file |
| `model_data.cc/.h` | Model weights as C array |
| `scaler_params.cc/.h` | Normalization parameters |

### Memory Requirements
- **Tensor Arena**: 40 KB
- **Alignment**: 16-byte aligned

---

## 6. Edge Inference (C++)

### TFLite Micro Operations
```
AddFullyConnected → Dense layer computation
AddMul            → Element-wise multiplication
AddAdd            → Bias addition
AddLogistic       → Sigmoid activation
AddReshape        → Tensor reshaping
AddQuantize       → Int8 quantization
AddDequantize     → Int8 to float conversion
AddSoftmax        → Output probabilities
```

### Inference Pipeline
```cpp
1. Read raw sensor values (8 floats)
2. Normalize using stored scaler params
3. Load input to TFLite interpreter
4. Invoke inference
5. Get output probabilities
6. Return argmax class + confidence
```

### Confidence Threshold
- **Auto-alert triggered**: > 80% confidence
- **Return values**: Class index (0-2), confidence score

---

## 7. Multi-Board Support

| Board | Status | Notes |
|-------|--------|-------|
| Board1 | Active | Training baseline |
| Board3 | Active | Main deployment |
| Board4 | Active | - |
| Board5 | Active | - |
| Board6 | Active | - |
| Board7 | Active | - |
| Board9 | Active | - |
| Board10 | Active | - |
| Board11 | Active | - |

Each board has:
- `BoardX.xlsx` - Training data
- `gasleak_model.tflite` - Compiled model
- `model_data.cc/.h` - C model data
- `scaler_params.cc/.h` - Scaler parameters

---

## 8. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SENSOR NODES                              │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐                     │
│  │ Board 3 │   │ Board 4 │   │ Board 5 │  ...               │
│  │ ESP32+S │   │ ESP32+S │   │ ESP32+S │                     │
│  │ +NN     │   │ +NN     │   │ +NN     │                     │
│  └────┬────┘   └────┬────┘   └────┬────┘                     │
│       │            │            │                           │
└───────┼────────────┼────────────┼───────────────────────────┘
        │ LoRa Mesh │            │
        ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                  CLUSTER HEAD                                │
│         Aggregates data, manages mesh                        │
└────────────────────────┬────────────────────────────────────┘
                         │ WiFi/Ethernet
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     GATEWAY                                   │
│              NestJS Backend + GraphQL                         │
└────────────────────────┬────────────────────────────────────┘
                         │ REST/GraphQL
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD SERVICES                             │
│            Data storage, analytics, alerts                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Model Files Location

```
edge firmware/src/Gasleak/
├── train_model.py           # Training script
├── test_model.py            # Testing script
├── Board1/
│   ├── Board1.xlsx          # Training data
│   ├── gasleak_model.tflite # TFLite model
│   ├── model_data.cc/.h     # C model data
│   └── scaler_params.cc/.h  # Scaler params
├── Board3/                  # (same structure)
├── Board4/                  # (same structure)
└── ...Board11/              # (same structure)
```

---

## 10. Key Implementation Details

### NeuralNetwork.h Interface
```cpp
class NeuralNetwork {
public:
    NeuralNetwork();
    ~NeuralNetwork();
    float* getInputBuffer();
    float* getOutputBuffer();
    int predict(float &confidence_score);
    int getOutputSize();
    bool isInitialized();
};
```

### Class Mapping
| Index | Class | Alert Action |
|-------|-------|--------------|
| 0 | LPG | Trigger gas alarm |
| 1 | Metana | Trigger gas alarm |
| 2 | Udara | Normal operation |

---

## 11. Performance Metrics

### Expected Accuracy
- Training accuracy: > 95%
- Validation accuracy: > 90%
- Test accuracy: > 85%

### Inference Speed
- TFLite Micro: ~5-10ms per prediction
- Real-time capability: Yes

### Memory Footprint
- Model size: ~50-100 KB
- Tensor arena: 40 KB
- RAM usage: ~50-150 KB

---

## 12. Conclusion

The Gas Leak Detection ML Model provides:

- **Real-time classification** of 3 gas types
- **Edge AI deployment** on resource-constrained ESP32-S3
- **Optimized inference** with TensorFlow Lite Micro
- **Multi-board support** for scalable deployment
- **LoRa mesh networking** for wide-area coverage

This system demonstrates a complete ML pipeline from training to edge deployment for industrial safety applications.
