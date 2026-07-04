import torch
import torch.nn as nn
import torch.nn.functional as F


class FrontierMultiModalLossEngine(nn.Module):
    """Provides flow-matching and STFT-based alignment losses for video/audio coherence."""

    def __init__(self, audio_sample_rate: int = 16000, n_fft: int = 512, hop_length: int = 128) -> None:
        super().__init__()
        self.audio_sample_rate = audio_sample_rate
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.register_buffer("window", torch.hann_window(n_fft), persistent=False)

    def compute_differentiable_stft_loss(self, synthesized_audio: torch.Tensor, target_audio: torch.Tensor) -> torch.Tensor:
        s_audio = synthesized_audio.squeeze(1) if synthesized_audio.dim() == 3 else synthesized_audio
        t_audio = target_audio.squeeze(1) if target_audio.dim() == 3 else target_audio
        stft_s = torch.stft(s_audio, n_fft=self.n_fft, hop_length=self.hop_length, window=self.window, return_complex=True)
        stft_t = torch.stft(t_audio, n_fft=self.n_fft, hop_length=self.hop_length, window=self.window, return_complex=True)
        mag_s = torch.abs(stft_s) + 1e-7
        mag_t = torch.abs(stft_t) + 1e-7
        spectral_loss = torch.norm(mag_t - mag_s, p="fro") / torch.norm(mag_t, p="fro")
        log_magnitude_loss = F.l1_loss(torch.log(mag_t), torch.log(mag_s))
        return spectral_loss + log_magnitude_loss

    def compute_flow_matching_video_loss(self, pred_flow_vectors: torch.Tensor, target_clean_frames: torch.Tensor, input_noisy_frames: torch.Tensor) -> torch.Tensor:
        true_velocity_trajectories = target_clean_frames - input_noisy_frames
        return F.mse_loss(pred_flow_vectors, true_velocity_trajectories)
