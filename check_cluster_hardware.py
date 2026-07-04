import sys

import torch


def verify_hardware_readiness() -> bool:
    cuda_available = torch.cuda.is_available()
    print("======================================================================")
    print("🖥️  VERIFYING BARE-METAL COMPUTE INFRASTRUCTURE ACCELERATION CHANNELS")
    print("======================================================================")
    print(f" -> NVIDIA CUDA Acceleration Core Available: {cuda_available}")

    if not cuda_available:
        print("🚨 CRITICAL WARNING: No GPU resources found. Models will compile with massive latency penalties on CPU.")
        return False

    gpu_count = torch.cuda.device_count()
    print(f" -> Total Scalable GPU Execution Hardware Slots Spotted: {gpu_count}")
    for index in range(gpu_count):
        props = torch.cuda.get_device_properties(index)
        print(f"    - Device #{index}: {props.name} | VRAM Memory Allocation Bounds: {props.total_memory / (1024 ** 3):.2f} GB")

    print("\n🚀 Host hardware state looks healthy. Ready to mount Docker cluster layers safely.")
    return True


if __name__ == "__main__":
    sys.exit(0 if verify_hardware_readiness() else 1)
