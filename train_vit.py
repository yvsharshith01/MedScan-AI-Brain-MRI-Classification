import os
import sys
import time
import argparse
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

# Import custom ViT or fallback to timm/torchvision if installed
try:
    from vit_model import VisionTransformer
except ImportError:
    VisionTransformer = None

try:
    # pyrefly: ignore [missing-import]
    import timm
except ImportError:
    timm = None


def get_dataloaders(data_dir: str, img_size: int = 224, batch_size: int = 16, num_workers: int = 0):
    """
    Creates train and validation/test dataloaders for the Brain MRI dataset.
    Expecting structure:
      data_dir/Training/ [glioma, meningioma, notumor, pituitary]
      data_dir/Testing/  [glioma, meningioma, notumor, pituitary]
    """
    train_dir = os.path.join(data_dir, "Training")
    test_dir = os.path.join(data_dir, "Testing")

    if not os.path.exists(train_dir) or not os.path.exists(test_dir):
        raise FileNotFoundError(
            f"Dataset directories not found! Expected '{train_dir}' and '{test_dir}'."
        )

    # Data augmentations for training
    train_transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    # Validation/Testing transformations
    val_transform = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    train_dataset = datasets.ImageFolder(train_dir, transform=train_transform)
    test_dataset = datasets.ImageFolder(test_dir, transform=val_transform)

    train_loader = DataLoader(
        train_dataset, batch_size=batch_size, shuffle=True, num_workers=num_workers, pin_memory=True
    )
    test_loader = DataLoader(
        test_dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers, pin_memory=True
    )

    return train_loader, test_loader, train_dataset.classes


def train_one_epoch(model, loader, criterion, optimizer, scaler, device):
    model.train()
    total_loss, correct, total = 0.0, 0, 0

    for step, (images, labels) in enumerate(loader, 1):
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()

        with torch.amp.autocast('cuda', enabled=(device.type == 'cuda')):
            outputs = model(images)
            loss = criterion(outputs, labels)

        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        total_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    return total_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0

    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        with torch.amp.autocast('cuda', enabled=(device.type == 'cuda')):
            outputs = model(images)
            loss = criterion(outputs, labels)

        total_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    return total_loss / total, correct / total


def main():
    parser = argparse.ArgumentParser(description="Train Vision Transformer (ViT) on Brain MRI Dataset")
    parser.add_argument("--data_dir", type=str, default="./archive (3)", help="Path to archive (3) folder")
    parser.add_argument("--model_name", type=str, default="vit_tiny_patch16_224", help="Pretrained ViT model architecture from timm")
    parser.add_argument("--img_size", type=int, default=224, help="Image resolution")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size")
    parser.add_argument("--epochs", type=int, default=20, help="Number of training epochs")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--use_pretrained", action="store_true", default=True, help="Use pre-trained ViT via timm")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type == 'cuda':
        torch.cuda.empty_cache()
    print("=" * 60)
    print(f"Vision Transformer (ViT) Training Pipeline")
    print(f"Device: {device}")
    print("=" * 60)

    # Load Dataloaders
    print(f"Loading dataset from: {args.data_dir}...")
    train_loader, test_loader, class_names = get_dataloaders(
        data_dir=args.data_dir,
        img_size=args.img_size,
        batch_size=args.batch_size
    )
    num_classes = len(class_names)
    print(f"Detected Classes ({num_classes}): {class_names}")

    # Build Model
    if args.use_pretrained and timm is not None:
        print(f"Using pre-trained ViT model ('{args.model_name}') via timm...")
        model = timm.create_model(args.model_name, pretrained=True, num_classes=num_classes)
    elif VisionTransformer is not None:
        print("Using custom ViT architecture from scratch (vit_model.py)...")
        model = VisionTransformer(img_size=args.img_size, patch_size=16, num_classes=num_classes)
    else:
        raise RuntimeError("No ViT implementation found! Please ensure vit_model.py or timm is available.")

    model = model.to(device)

    # Optimizer, Loss & Scheduler
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    scaler = torch.amp.GradScaler('cuda', enabled=(device.type == 'cuda'))

    best_acc = 0.0
    checkpoint_path = "best_vit_brain_mri.pth"

    print("\nStarting Training Loop...\n")
    for epoch in range(1, args.epochs + 1):
        start_time = time.time()

        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, scaler, device)
        val_loss, val_acc = evaluate(model, test_loader, criterion, device)
        scheduler.step()

        elapsed = time.time() - start_time
        print(f"Epoch [{epoch:02d}/{args.epochs:02d}] ({elapsed:.1f}s) | "
              f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc * 100:.2f}% | "
              f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc * 100:.2f}%")

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_acc': val_acc,
                'class_names': class_names
            }, checkpoint_path)
            print(f"  >>> Checkpoint saved to '{checkpoint_path}' (Best Val Acc: {best_acc * 100:.2f}%)")

    print("\n" + "=" * 60)
    print(f"Training Complete! Best Validation Accuracy: {best_acc * 100:.2f}%")
    print(f"Saved Checkpoint: {os.path.abspath(checkpoint_path)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
