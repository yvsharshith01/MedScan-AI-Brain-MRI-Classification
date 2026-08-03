# Integrated Medical Healthcare Assistant & Brain MRI Tumor Classification System

An end-to-end web-based clinical screening platform that combines deep learning medical imaging classification with rule-based healthcare triage tools. The system evaluates patient Brain MRI scans using a PyTorch Vision Transformer (ViT) while providing automated symptom assessment, pharmacological lookups, and emergency protocols.

---

## 1. Project Motivation & Problem Statement
Preliminary diagnostic triage in neurology requires rapid evaluation of both structural imaging (MRI) and clinical presentation (symptoms/history). This project integrates a Vision Transformer (ViT-Tiny)—leveraging multi-head self-attention to capture global spatial dependencies across brain tissue—with an interactive clinical frontend to assist in educational screening and preliminary assessment workflows.

---

## 2. Core System Modules

### Module A: Deep Learning Brain MRI Classifier
- **Architecture:** PyTorch Vision Transformer (vit_tiny_patch16_224 / Custom Multi-Head Self-Attention).
- **Patch Embedding:** Divides input MRI slices (224x224 RGB) into 16x16 non-overlapping patches with positional encodings.
- **Diagnostic Classes:**
  - `Glioma`: Neoplasms originating in glial supportive cells.
  - `Meningioma`: Tumors arising from meningeal membranes.
  - `Pituitary`: Masses developing within the pituitary gland.
  - `No Tumor`: Normal anatomical brain structures.
- **Evaluation Performance:** Achieves >95% validation accuracy across multi-class test sets.
- **Visual Interpretability:** Generates a dynamic region-of-interest (ROI) overlay on input slices to highlight attention zones.

### Module B: Interactive Clinical Symptom Diagnostic Engine
- Multi-step guided evaluation tree that maps patient inputs against structured condition profiles (`data/symptoms.json`).
- Calculates weighted likelihood percentages and assigns triage priority levels (Immediate Emergency, Urgent Care, Routine Consultation, Self-Monitoring).

### Module C: Pharmacological Reference & Emergency Protocol System
- **Medication Database:** Queryable JSON directory (`data/medications.json`) indexing drug indications, dosage parameters, and contraindications.
- **Emergency First Aid Guides:** Standardized response protocols (`data/first-aid.json`) covering CPR, hemorrhage management, burns, and fractures.
- **Preventive Health Engine:** Actionable wellness guidelines categorized by cardiovascular health, nutrition, and sleep hygiene (`data/health-tips.json`).

---

## 3. System Architecture & Data Flow

    [ Client Browser (HTML5 / Vanilla JS / CSS3) ]
          |
          +--> Async REST API Requests (JSON / FormData)
          |
    [ Flask Backend Web Server (server.py) ]
          |
          +--> Route 1: Clinical Data Lookup -> [/data JSON Databases]
          |
          +--> Route 2: Image Preprocessing -> [PyTorch Vision Transformer Engine]
                                                    |
                                                    v
                                        [ best_vit_brain_mri.pth ]

---

## 4. Repository Structure

    ├── best_vit_brain_mri.pth   # Trained Vision Transformer checkpoint weights
    ├── vit_model.py             # ViT architecture definitions (PatchEmbed, MHSA layers)
    ├── train_vit.py             # Training pipeline, loss functions, and augmentation
    ├── server.py                # Flask REST API backend and static content server
    ├── index.html               # Frontend dashboard interface
    ├── css/                     # Modulated UI stylesheets (layout, components, animations)
    ├── js/
    │   ├── image-analyzer.js    # MRI upload handler, API client, and heatmap renderer
    │   ├── symptom-checker.js   # Decision-tree quiz engine and triage logic
    │   ├── medication-db.js     # Search and filter utilities for drug directory
    │   ├── first-aid.js         # Emergency protocol UI controller
    │   └── utils.js             # Shared helper functions and state handlers
    └── data/                    # JSON clinical datasets and sample MRI image libraries

---

## 5. Local Setup & Execution

### Prerequisites
- Python 3.10 or higher (3.11 recommended)
- `pip` package manager
- Optional: CUDA-compatible NVIDIA GPU for accelerated inference

### Installation Steps

1. **Clone the repository:**
   `git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git`
   `cd YOUR_REPOSITORY_NAME`

2. **Create and activate a virtual environment:**
   `python -m venv venv`
   
   On Windows:
   `venv\Scripts\activate`
   
   On Linux/macOS:
   `source venv/bin/activate`

3. **Install dependencies:**
   `pip install torch torchvision timm flask flask-cors pillow`

4. **Launch the backend application:**
   `python server.py`

5. **Access the interface:**
   Open a web browser and navigate to `http://localhost:5000`.

---

## 6. Training & Custom Dataset Evaluation
To train the Vision Transformer on custom MRI datasets, ensure images are structured by class directory inside `./data/Training` and `./data/Testing`, then execute:

    python train_vit.py --data_dir ./data --epochs 30 --batch_size 16 --lr 1e-4 --use_timm

---

## 7. Academic Disclaimer
This software is developed strictly for **educational, academic, and demonstration purposes**. It is not an FDA-approved medical device and must not be used for actual clinical diagnosis, patient triage, or pharmacological advice.