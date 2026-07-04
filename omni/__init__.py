"""Prototype multimodal Omni-Model training, export, and streaming modules."""

from omni.audio_neural_codec import OmniAudioSynthesisNetwork
from omni.cinematic_motion import CinematicCameraTokenizer
from omni.consistency_engine import SpatioTemporalConsistencyCache
from omni.fault_tolerance import ClusterFaultToleranceEngine
from omni.grpc_stream_server import MediaStreamChunk, OmniStreamingService
from omni.hyperparameter_orchestrator import AutonomousGridOrchestrator
from omni.master_backend_orchestrator import MasterBackendOrchestrator
from omni.master_production_runner import CompleteAutonomousVideoProducer
from omni.multi_format_writer import MultiFormatBinaryTransmuxer
from omni.voice_registry import VoiceProfileRegistry

try:  # pragma: no cover - optional dependency
    from omni.frontier_losses import FrontierMultiModalLossEngine
except Exception:  # pragma: no cover - optional dependency
    FrontierMultiModalLossEngine = None

__all__ = [
    "AutonomousGridOrchestrator",
    "CinematicCameraTokenizer",
    "ClusterFaultToleranceEngine",
    "CompleteAutonomousVideoProducer",
    "FrontierMultiModalLossEngine",
    "MasterBackendOrchestrator",
    "MediaStreamChunk",
    "MultiFormatBinaryTransmuxer",
    "OmniAudioSynthesisNetwork",
    "OmniStreamingService",
    "SpatioTemporalConsistencyCache",
    "VoiceProfileRegistry",
]
