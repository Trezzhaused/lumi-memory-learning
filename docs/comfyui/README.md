# ComfyUI Wan 2.1 workflow examples

This directory contains minimal local workflow examples for running Wan 2.1 image and video generation in ComfyUI.

## Files

- `wan2.1_t2v.json` — native Wan 2.1 T2V workflow for a lightweight 1.3B setup
- `wan2.1_native_i2v.json` — native Wan 2.1 I2V workflow for image-to-video generation

## Model layout

Place the required models in the standard ComfyUI folders:

```text
ComfyUI/models/
├── diffusion_models/
├── text_encoders/
├── vae/
└── clip_vision/
```

## Quick start

1. Install ComfyUI and the required nodes (for example `ComfyUI-VideoHelperSuite`).
2. Copy the workflow JSON into your ComfyUI workspace or drag it into the UI.
3. Load the matching model files from the layout above.
4. Run the workflow and export the result.

For lower-VRAM setups, prefer the FP8 I2V model and keep the latent resolution at 832x480 with 33 frames for the initial test run.
