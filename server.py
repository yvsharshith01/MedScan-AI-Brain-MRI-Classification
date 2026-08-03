import os
import io
import base64
import torch
import torch.nn as nn
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from torchvision import transforms
import timm

app = Flask(__name__, static_folder=".")
CORS(app)

# Device Configuration
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), "best_vit_brain_mri.pth")

# Preprocessing Pipeline (matches training validation transforms)
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

model = None
class_names = ['glioma', 'meningioma', 'notumor', 'pituitary']
best_val_acc = 0.9519

def load_trained_model():
    global model, class_names, best_val_acc
    if not os.path.exists(CHECKPOINT_PATH):
        print(f"Warning: Checkpoint file '{CHECKPOINT_PATH}' not found!")
        return False
    
    try:
        print(f"Loading trained ViT model from '{CHECKPOINT_PATH}' on {device}...")
        checkpoint = torch.load(CHECKPOINT_PATH, map_location=device)
        class_names = checkpoint.get('class_names', class_names)
        best_val_acc = checkpoint.get('val_acc', 0.9519)
        num_classes = len(class_names)

        model = timm.create_model('vit_tiny_patch16_224', pretrained=False, num_classes=num_classes)
        model.load_state_dict(checkpoint['model_state_dict'])
        model = model.to(device)
        model.eval()
        print(f"ViT Model successfully loaded! Best Val Accuracy: {best_val_acc * 100:.2f}%")
        return True
    except Exception as e:
        print(f"Error loading checkpoint: {e}")
        return False

# Initialize model at server start
is_model_loaded = load_trained_model()

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_files(path):
    if os.path.exists(os.path.join(".", path)):
        return send_from_directory(".", path)
    return send_from_directory(".", "index.html")

@app.route("/api/status", methods=["GET"])
def get_status():
    return jsonify({
        "status": "online" if is_model_loaded else "fallback",
        "model_name": "vit_tiny_patch16_224",
        "device": str(device),
        "val_accuracy": round(best_val_acc * 100, 2),
        "classes": class_names,
        "is_loaded": is_model_loaded
    })

@app.route("/api/predict", methods=["POST"])
def predict():
    if not is_model_loaded or model is None:
        return jsonify({"error": "ViT model is not loaded"}), 500

    try:
        img_bytes = None
        if 'image' in request.files:
            file = request.files['image']
            img_bytes = file.read()
        elif request.json and 'image' in request.json:
            b64_data = request.json['image']
            if ',' in b64_data:
                b64_data = b64_data.split(',')[1]
            img_bytes = base64.b64decode(b64_data)
        else:
            return jsonify({"error": "No image provided in request"}), 400

        # Load & Preprocess Image
        raw_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        input_tensor = transform(raw_img).unsqueeze(0).to(device)

        # Inference
        with torch.no_grad():
            if device.type == 'cuda':
                with torch.amp.autocast('cuda'):
                    outputs = model(input_tensor)
            else:
                outputs = model(input_tensor)

            probabilities = torch.softmax(outputs, dim=1).squeeze().cpu().numpy().tolist()

        # Build prediction mapping
        category_meta = {
            'glioma': {'name': 'Glioma Tumor', 'color': '#ef4444', 'desc': 'A type of tumor that occurs in the brain and spinal cord, arising from glial cells.'},
            'meningioma': {'name': 'Meningioma Tumor', 'color': '#f59e0b', 'desc': 'A tumor that arises from the meninges — the membranes that surround your brain and spinal cord.'},
            'notumor': {'name': 'No Tumor Detected', 'color': '#10b981', 'desc': 'Healthy brain tissue scan showing no signs of abnormal tumorous growth.'},
            'pituitary': {'name': 'Pituitary Tumor', 'color': '#8b5cf6', 'desc': 'An abnormal growth in the pituitary gland, located at the base of the brain.'}
        }

        predictions = []
        for cls_name, prob in zip(class_names, probabilities):
            meta = category_meta.get(cls_name, {'name': cls_name.capitalize(), 'color': '#3b82f6', 'desc': 'Brain MRI Scan Classification'})
            predictions.append({
                'id': cls_name,
                'name': meta['name'],
                'color': meta['color'],
                'desc': meta['desc'],
                'probability': float(prob)
            })

        # Sort by highest confidence
        predictions.sort(key=lambda x: x['probability'], reverse=True)

        return jsonify({
            "success": True,
            "predictions": predictions,
            "top_prediction": predictions[0],
            "model": "Vision Transformer (ViT)",
            "accuracy": f"{best_val_acc * 100:.2f}%"
        })

    except Exception as e:
        print(f"Prediction Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting MediScan AI PyTorch ViT Backend on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
