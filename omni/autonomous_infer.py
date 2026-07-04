import torch

from omni.omni_model_core import AbsoluteOmniEngine


class AutonomousGenerationPipeline:
    def __init__(self, checkpoint_path: str):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = AbsoluteOmniEngine().to(self.device)
        state_dict = torch.load(checkpoint_path, map_location=self.device)
        self.model.load_state_dict(state_dict)
        self.model.eval()

    @torch.inference_mode()
    def generate_all_modalities(self, input_text_tokens: list[int], steps: int = 64):
        del steps
        text_tensor = torch.tensor([input_text_tokens], dtype=torch.long, device=self.device)
        empty_vid = torch.zeros(1, 3, 4, 64, 64, device=self.device)
        empty_mesh = torch.zeros(1, 50, 3, device=self.device)
        empty_aud = torch.zeros(1, 1, 8000, device=self.device)

        out_text, out_vid, out_mesh, out_aud = self.model(text_tensor, empty_vid, empty_mesh, empty_aud)
        return {
            "video_tensor": out_vid.view(1, 3, 4, 64, 64).cpu(),
            "mesh_coordinates": out_mesh.view(-1, 3).cpu(),
            "audio_waveform": out_aud.view(-1).cpu(),
            "text_logits": out_text.cpu(),
        }
