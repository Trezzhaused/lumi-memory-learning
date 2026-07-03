# Local HunyuanVideo checkout

Clone https://github.com/Tencent-Hunyuan/HunyuanVideo into this directory (or point `HUNYUAN_VIDEO_REPO_PATH` at another location) to enable local video generation.

Lumi will look for a Python entrypoint such as:
- `scripts/hunyuan_video_generate.py`
- `hunyuan_video_generate.py`
- `generate.py`
- `run.py`
- `infer.py`

If your workflow uses a custom wrapper, point `HUNYUAN_VIDEO_SCRIPT_PATH` at it and make sure the script writes an MP4 file to the `--output` argument.
