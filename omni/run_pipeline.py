import os

from omni.asset_exporters import AssetExporterEngine
from omni.autonomous_infer import AutonomousGenerationPipeline


if __name__ == "__main__":
    prompt_tokens = [101, 432, 894, 2105, 342, 9022, 102]
    checkpoint_path = os.getenv("OMNI_CHECKPOINT_PATH", "models/omni_weights.pt")
    output_dir = os.getenv("OMNI_OUTPUT_DIR", "outputs")

    pipeline = AutonomousGenerationPipeline(checkpoint_path=checkpoint_path)
    outputs = pipeline.generate_all_modalities(input_text_tokens=prompt_tokens)

    AssetExporterEngine.export_audio_wav(
        audio_tensor=outputs["audio_waveform"],
        output_path=os.path.join(output_dir, "generated_soundtrack.wav"),
        sample_rate=16000,
    )
    AssetExporterEngine.export_mesh_obj(
        mesh_tensor=outputs["mesh_coordinates"],
        output_path=os.path.join(output_dir, "generated_character.obj"),
    )
    AssetExporterEngine.export_video_mp4(
        video_tensor=outputs["video_tensor"],
        output_path=os.path.join(output_dir, "generated_scene.mp4"),
        fps=24,
    )
