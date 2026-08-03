import os
import torch
import torch.nn as functional_nn
import torchvision.transforms as transforms
import numpy as np
import streamlit as st
from PIL import Image
import matplotlib.pyplot as plt
import timm

# Attempt to load the architecture defined in vit_model.py
try:
    import vit_model
except ImportError:
    vit_model = None

# 1. Page Configuration
st.set_page_config(
    page_title="NeuroScan AI - Brain MRI Classification",
    layout="wide"
)

# Custom styling
st.markdown(
    """
    <style>
    .main-header {
        font-size: 32px;
        font-weight: bold;
        color: #1E3A8A;
    }
    .sub-text {
        font-size: 16px;
        color: #4B5563;
    }
    </style>
    """,
    unsafe_allow_html=True
)

st.markdown('<div class="main-header">NeuroScan AI: Brain MRI Tumor Classification System</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-text">AI-assisted Vision Transformer (ViT) analysis for educational and preliminary screening.</div>', unsafe_allow_html=True)
st.write("---")

# 2. Sidebar - Patient Information Form
st.sidebar.header("Patient Record Details")
patient_id = st.sidebar.text_input("Patient ID", value="PID-1049")
patient_age = st.sidebar.number_input("Age", min_value=1, max_value=120, value=45)
patient_gender = st.sidebar.selectbox("Gender", ["Female", "Male", "Other"])
scan_date = st.sidebar.date_input("MRI Date")
mri_type = st.sidebar.selectbox("MRI Contrast / Sequence", ["T1-weighted", "T2-weighted", "FLAIR", "T1-Contrast"])

# 3. Model Loading Helper
@st.cache_resource
def load_classifier_model():
    model_path = "best_vit_brain_mri.pth"
    if not os.path.exists(model_path):
        return None, None, "Model file best_vit_brain_mri.pth not found."
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    try:
        checkpoint = torch.load(model_path, map_location=device)
        
        # Extract stored class names if present in the checkpoint dictionary
        class_names = ["Glioma", "Meningioma", "No Tumor", "Pituitary"]
        if isinstance(checkpoint, dict) and "class_names" in checkpoint:
            class_names = checkpoint["class_names"]
            
        state_dict = checkpoint
        if isinstance(checkpoint, dict):
            if "model_state_dict" in checkpoint:
                state_dict = checkpoint["model_state_dict"]
            elif "state_dict" in checkpoint:
                state_dict = checkpoint["state_dict"]
        
        model_instance = None
        
        # Attempt 1: Build via vit_model.py with explicit 192-dimension ViT-Tiny parameters
        if vit_model is not None:
            for func_name in ["vit_tiny", "vit_tiny_patch16_224", "get_model", "build_model"]:
                if hasattr(vit_model, func_name):
                    try:
                        model_instance = getattr(vit_model, func_name)(num_classes=len(class_names))
                        break
                    except Exception:
                        try:
                            model_instance = getattr(vit_model, func_name)()
                            break
                        except Exception:
                            continue
                            
            if model_instance is None and hasattr(vit_model, "VisionTransformer"):
                try:
                    model_instance = vit_model.VisionTransformer(
                        img_size=224,
                        patch_size=16,
                        embed_dim=192,
                        depth=12,
                        num_heads=3,
                        num_classes=len(class_names)
                    )
                except Exception:
                    try:
                        model_instance = vit_model.VisionTransformer(
                            embed_dim=192,
                            depth=12,
                            num_heads=3,
                            num_classes=len(class_names)
                        )
                    except Exception:
                        model_instance = None

        # Verify that Attempt 1 loads weights without size mismatch
        if model_instance is not None:
            try:
                model_instance.load_state_dict(state_dict, strict=False)
                model_instance.to(device)
                model_instance.eval()
                return model_instance, class_names, None
            except Exception:
                model_instance = None  # Reset if size mismatch occurred

        # Attempt 2: Automatic fallback to timm's vit_tiny_patch16_224 (Guaranteed 192 embed_dim, 12 blocks, 3 heads)
        model_instance = timm.create_model("vit_tiny_patch16_224", pretrained=False, num_classes=len(class_names))
        model_instance.load_state_dict(state_dict, strict=False)
        model_instance.to(device)
        model_instance.eval()
        return model_instance, class_names, None
            
    except Exception as error_msg:
        return None, None, str(error_msg)

model_instance, class_names, error_message = load_classifier_model()

# 4. Image Preprocessing Helper
def preprocess_mri(image_object):
    transform_pipeline = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    image_rgb = image_object.convert("RGB")
    tensor_image = transform_pipeline(image_rgb).unsqueeze(0)
    return tensor_image

# 5. Main Application Workflow
uploaded_file = st.file_uploader("Upload Patient Brain MRI Scan (JPG, JPEG, PNG)", type=["jpg", "jpeg", "png"])

if uploaded_file is not None:
    raw_image = Image.open(uploaded_file)
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Input MRI Scan")
        st.image(raw_image, caption=f"Scan Sequence: {mri_type}", use_container_width=True)
        
    with col2:
        st.subheader("Diagnostic Prediction")
        
        if model_instance is None:
            st.error(f"Failed to load PyTorch model: {error_message}")
            st.info("Check vit_model.py to see the exact class name used for the Vision Transformer.")
        else:
            with st.spinner("Analyzing anatomical features using Vision Transformer..."):
                input_tensor = preprocess_mri(raw_image)
                device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                input_tensor = input_tensor.to(device)
                
                with torch.no_grad():
                    raw_logits = model_instance(input_tensor)
                    probabilities_tensor = torch.softmax(raw_logits, dim=1)
                    probabilities = probabilities_tensor.cpu().numpy()[0]
                
                # Use class names loaded from checkpoint or fallback to indices
                labels = class_names if class_names and len(class_names) == len(probabilities) else [f"Class {i}" for i in range(len(probabilities))]
                    
                predicted_index = int(np.argmax(probabilities))
                predicted_label = labels[predicted_index]
                confidence_score = float(probabilities[predicted_index]) * 100.0

                # Display metrics
                st.metric(label="Classification Outcome", value=predicted_label)
                st.metric(label="Confidence Score", value=f"{confidence_score:.2f}%")
                
                # Probability Bar Chart
                st.write("Class Probability Distribution:")
                fig, ax = plt.subplots(figsize=(6, 2.5))
                colors = ["#3B82F6"] * len(probabilities)
                colors[predicted_index] = "#EF4444" if "no" not in predicted_label.lower() else "#22C55E"
                ax.barh(labels[:len(probabilities)], [p * 100 for p in probabilities], color=colors)
                ax.set_xlim(0, 100)
                ax.set_xlabel("Probability (%)")
                ax.spines["top"].set_visible(False)
                ax.spines["right"].set_visible(False)
                plt.tight_layout()
                st.pyplot(fig)

                # Generate Downloadable Diagnostic Report
                report_text = (
                    "NEUROSCAN AI - DIAGNOSTIC SCREENING REPORT\n"
                    "==========================================\n"
                    f"Patient ID: {patient_id}\n"
                    f"Age: {patient_age} | Gender: {patient_gender}\n"
                    f"Scan Date: {scan_date} | Sequence: {mri_type}\n"
                    "------------------------------------------\n"
                    f"AI Screening Result: {predicted_label}\n"
                    f"Model Confidence: {confidence_score:.2f}%\n"
                    "Architecture: Vision Transformer (ViT-Tiny, 192 dim)\n"
                    "------------------------------------------\n"
                    "Recommendation: Consult a certified radiologist/neurologist for clinical correlation.\n"
                    "Disclaimer: This software is developed for educational and academic demonstration only.\n"
                )
                
                st.download_button(
                    label="Download Clinical Summary (TXT)",
                    data=report_text,
                    file_name=f"Report_{patient_id}.txt",
                    mime="text/plain"
                )
else:
    st.info("Please upload an MRI image from the sidebar or main panel to initiate evaluation.")