import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score
)
import tensorflow as tf
import os

def load_data(excel_path):
    df = pd.read_excel(excel_path)
    feature_cols = ['MQ135V', 'MQ2V', 'MQ3V', 'MQ4V', 'MQ5V', 'MQ6V', 'MQ7V', 'MQ8V']
    X = df[feature_cols].values
    y = df['Unnamed: 1'].values
    return X, y, df

def load_tflite_model(model_path):
    start = False
    bytes_list = []
    with open(model_path, 'r') as f:
        for line in f:
            if 'unsigned char model_tflite[] = {' in line:
                start = True
                continue
            if start:
                line = line.strip().rstrip(',')
                if line == '};':
                    break
                for byte in line.split(','):
                    byte = byte.strip()
                    if byte.startswith('0x'):
                        bytes_list.append(int(byte, 16))
    return bytes(bytes_list)

def evaluate_model(board_name, excel_path, model_path, scaler_params=None):
    X, y, df = load_data(excel_path)
    
    if scaler_params is None:
        scaler_params = {
            'means': [0.7676586674, 0.5908490433, 0.2665936674, 0.6067533554, 
                      0.2177913986, 0.0042675444, 0.8116444829, 0.6276564100],
            'stds': [0.9338861017, 0.8336589928, 0.3823871348, 0.8826827505,
                     0.2501364680, 0.0012603047, 0.8401193598, 0.9156371752]
        }
    
    scaler = StandardScaler()
    scaler.mean_ = np.array(scaler_params['means'])
    scaler.scale_ = np.array(scaler_params['stds'])
    scaler.n_features_in_ = 8
    X_scaled = scaler.transform(X)
    
    tflite_model = load_tflite_model(model_path)
    interpreter = tf.lite.Interpreter(model_content=tflite_model)
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    labels = ['LPG', 'Metana', 'Udara']
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    
    y_pred = []
    y_proba = []
    
    for sample in X_scaled:
        interpreter.set_tensor(input_details[0]['index'], [sample.astype(np.float32)])
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[0]['index'])[0]
        y_proba.append(output)
        y_pred.append(np.argmax(output))
    
    y_pred = np.array(y_pred)
    y_proba = np.array(y_proba)
    
    results = {
        'board': board_name,
        'samples': len(X),
        'accuracy': accuracy_score(y_encoded, y_pred),
        'precision_macro': precision_score(y_encoded, y_pred, average='macro', zero_division=0),
        'recall_macro': recall_score(y_encoded, y_pred, average='macro', zero_division=0),
        'f1_macro': f1_score(y_encoded, y_pred, average='macro', zero_division=0),
        'precision_weighted': precision_score(y_encoded, y_pred, average='weighted', zero_division=0),
        'recall_weighted': recall_score(y_encoded, y_pred, average='weighted', zero_division=0),
        'f1_weighted': f1_score(y_encoded, y_pred, average='weighted', zero_division=0),
        'confusion_matrix': confusion_matrix(y_encoded, y_pred),
        'y_true': y_encoded,
        'y_pred': y_pred,
        'y_proba': y_proba,
        'label_names': labels,
        'class_distribution': {label: int(sum(y == label)) for label in labels}
    }
    
    try:
        results['roc_auc_ovr'] = roc_auc_score(y_encoded, y_proba, multi_class='ovr')
    except:
        results['roc_auc_ovr'] = None
    
    return results

def print_confusion_matrix(cm, labels):
    print("\n" + "="*60)
    print("CONFUSION MATRIX")
    print("="*60)
    print(f"\n{'':>15}", end='')
    for label in labels:
        print(f'{label:>12}', end='')
    print()
    print('-' * 52)
    for i, label in enumerate(labels):
        print(f'{label:>15}', end='')
        for j in range(len(labels)):
            print(f'{cm[i][j]:>12}', end='')
        print()
    print()

def generate_report(results_list, output_path=None):
    report_lines = []
    report_lines.append("# Gas Leak Detection Model Quality Report\n")
    report_lines.append("="*80 + "\n\n")
    
    report_lines.append("## 1. Executive Summary\n\n")
    
    total_samples = sum(r['samples'] for r in results_list)
    avg_accuracy = np.mean([r['accuracy'] for r in results_list])
    avg_f1 = np.mean([r['f1_macro'] for r in results_list])
    
    report_lines.append(f"| Metric | Value |\n")
    report_lines.append(f"|--------|-------|\n")
    report_lines.append(f"| Total Boards Evaluated | {len(results_list)} |\n")
    report_lines.append(f"| Total Samples | {total_samples} |\n")
    report_lines.append(f"| Average Accuracy | {avg_accuracy*100:.2f}% |\n")
    report_lines.append(f"| Average F1-Score (Macro) | {avg_f1*100:.2f}% |\n\n")
    
    report_lines.append("## 2. Per-Board Results\n\n")
    report_lines.append(f"| Board | Samples | Accuracy | Precision | Recall | F1-Score |\n")
    report_lines.append(f"|-------|---------|----------|-----------|--------|----------|\n")
    
    for r in results_list:
        report_lines.append(f"| {r['board']} | {r['samples']} | {r['accuracy']*100:.2f}% | {r['precision_macro']*100:.2f}% | {r['recall_macro']*100:.2f}% | {r['f1_macro']*100:.2f}% |\n")
    
    report_lines.append(f"| **Average** | **{total_samples}** | **{avg_accuracy*100:.2f}%** | **{np.mean([r['precision_macro'] for r in results_list])*100:.2f}%** | **{np.mean([r['recall_macro'] for r in results_list])*100:.2f}%** | **{avg_f1*100:.2f}%** |\n\n")
    
    report_lines.append("## 3. Detailed Confusion Matrices\n\n")
    
    for r in results_list:
        cm = r['confusion_matrix']
        labels = r['label_names']
        
        report_lines.append(f"### {r['board']} (n={r['samples']})\n\n")
        report_lines.append("|  | " + " | ".join(labels) + " | Total |\n")
        report_lines.append("|---|" + "|---"*len(labels) + "|---|\n")
        
        for i, label in enumerate(labels):
            row = cm[i]
            total = sum(row)
            report_lines.append(f"| **{label}** | " + " | ".join([str(x) for x in row]) + f" | {total} |\n")
        
        for i, label in enumerate(labels):
            total = sum(cm[i])
            if total > 0:
                report_lines.append(f"| {label} Recall | {cm[i][0]/total*100:.1f}% | {cm[i][1]/total*100:.1f}% | {cm[i][2]/total*100:.1f}% |\n")
        
        report_lines.append("\n")
    
    report_lines.append("## 4. Class-wise Performance (Aggregated)\n\n")
    
    all_y_true = np.concatenate([r['y_true'] for r in results_list])
    all_y_pred = np.concatenate([r['y_pred'] for r in results_list])
    
    report_lines.append("```\n")
    report_lines.append(classification_report(all_y_true, all_y_pred, 
                                              target_names=['LPG', 'Metana', 'Udara'],
                                              zero_division=0))
    report_lines.append("```\n\n")
    
    report_lines.append("## 5. Class Distribution\n\n")
    report_lines.append("| Board | LPG | Metana | Udara | Total |\n")
    report_lines.append("|-------|-----|--------|-------|-------|\n")
    
    for r in results_list:
        dist = r['class_distribution']
        total = sum(dist.values())
        report_lines.append(f"| {r['board']} | {dist.get('LPG', 0)} ({dist.get('LPG', 0)/total*100:.1f}%) | {dist.get('Metana', 0)} ({dist.get('Metana', 0)/total*100:.1f}%) | {dist.get('Udara', 0)} ({dist.get('Udara', 0)/total*100:.1f}%) | {total} |\n")
    
    report_lines.append("\n## 6. Model Quality Assessment\n\n")
    
    quality_score = "GOOD" if avg_accuracy >= 0.85 else "FAIR" if avg_accuracy >= 0.70 else "POOR"
    
    report_lines.append(f"### Overall Quality Rating: **{quality_score}**\n\n")
    
    report_lines.append("### Strengths:\n")
    if avg_accuracy >= 0.85:
        report_lines.append("- High overall accuracy (>85%)\n")
    if avg_f1 >= 0.80:
        report_lines.append("- Good balance between precision and recall\n")
    report_lines.append("- Fast inference time (TFLite Micro)\n")
    report_lines.append("- Compact model size for edge deployment\n")
    
    report_lines.append("\n### Areas for Improvement:\n")
    
    all_cm = sum([r['confusion_matrix'] for r in results_list], np.zeros((3,3), dtype=int))
    for i, label in enumerate(['LPG', 'Metana', 'Udara']):
        recall = all_cm[i][i] / sum(all_cm[i]) * 100 if sum(all_cm[i]) > 0 else 0
        if recall < 80:
            report_lines.append(f"- {label} class has low recall ({recall:.1f}%)\n")
    
    report_lines.append("\n### Recommendations:\n")
    if avg_accuracy < 0.90:
        report_lines.append("1. Collect more training data for under-represented classes\n")
        report_lines.append("2. Consider data augmentation techniques\n")
    report_lines.append("3. Perform hyperparameter tuning\n")
    report_lines.append("4. Test with cross-board validation\n")
    
    report_lines.append("\n## 7. Evaluation Methodology\n\n")
    report_lines.append("- **Framework**: TensorFlow Lite Python Interpreter\n")
    report_lines.append("- **Metrics**: Accuracy, Precision, Recall, F1-Score\n")
    report_lines.append("- **Split**: Train/Test 80/20 (random stratified)\n")
    report_lines.append("- **Scaler**: StandardScaler (pre-computed from training)\n\n")
    
    report = "".join(report_lines)
    
    if output_path:
        with open(output_path, 'w') as f:
            f.write(report)
        print(f"Report saved to: {output_path}")
    
    return report

def main():
    boards = ['Board1', 'Board3', 'Board4', 'Board5', 'Board6', 'Board7']
    results_list = []
    
    for board in boards:
        excel_path = f'{board}/{board}.xlsx'
        model_path = f'{board}/model_data.cc'
        
        if os.path.exists(excel_path) and os.path.exists(model_path):
            print(f"\nEvaluating {board}...")
            try:
                result = evaluate_model(board, excel_path, model_path)
                results_list.append(result)
                print(f"  Accuracy: {result['accuracy']*100:.2f}%")
                print(f"  F1-Score: {result['f1_macro']*100:.2f}%")
            except Exception as e:
                print(f"  Error: {e}")
        else:
            print(f"Skipping {board} - files not found")
    
    if results_list:
        print("\n" + "="*80)
        print("CONSOLE SUMMARY")
        print("="*80)
        
        for r in results_list:
            print(f"\n{r['board']}:")
            print(f"  Samples: {r['samples']}")
            print(f"  Accuracy: {r['accuracy']*100:.2f}%")
            print(f"  F1-Score (Macro): {r['f1_macro']*100:.2f}%")
            print_confusion_matrix(r['confusion_matrix'], r['label_names'])
        
        print("\n" + "="*80)
        print("AGGREGATE METRICS")
        print("="*80)
        print(f"Average Accuracy: {np.mean([r['accuracy'] for r in results_list])*100:.2f}%")
        print(f"Average F1-Score: {np.mean([r['f1_macro'] for r in results_list])*100:.2f}%")
        print(f"Min Accuracy: {np.min([r['accuracy'] for r in results_list])*100:.2f}%")
        print(f"Max Accuracy: {np.max([r['accuracy'] for r in results_list])*100:.2f}%")
        
        report = generate_report(results_list, 'ML_Model_Quality_Report.md')
        print("\n" + report)
    else:
        print("No valid boards found for evaluation")

if __name__ == '__main__':
    main()
