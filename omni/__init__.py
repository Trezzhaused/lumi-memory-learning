"""Prototype multimodal Omni-Model training, export, and streaming modules."""

from omni.audio_neural_codec import OmniAudioSynthesisNetwork
from omni.audio_visual_gates import AudioToVideoGatingMatrix
from omni.cinematic_motion import CinematicCameraTokenizer
from omni.consistency_engine import SpatioTemporalConsistencyCache
from omni.cluster_daemon import ClusterWatchdogDaemon
from omni.fault_tolerance import ClusterFaultToleranceEngine
from omni.grpc_stream_server import MediaStreamChunk, OmniStreamingService
from omni.hyperparameter_orchestrator import AutonomousGridOrchestrator
from omni.master_backend_orchestrator import MasterBackendOrchestrator
from omni.master_production_runner import CompleteAutonomousVideoProducer
from omni.master_studio_orchestrator import AbsoluteStudioCore
from omni.multi_format_writer import MultiFormatBinaryTransmuxer
from omni.studio_logger import DistributedStudioLogger, send_node_log
from omni.studio_supervisor import StudioSupervisorEngine
from omni.voice_registry import VoiceProfileRegistry

try:  # pragma: no cover - optional dependency
    from omni.frontier_losses import FrontierMultiModalLossEngine
except Exception:  # pragma: no cover - optional dependency
    FrontierMultiModalLossEngine = None

__all__ = [
    "AbsoluteStudioCore",
    "AudioToVideoGatingMatrix",
    "AutonomousGridOrchestrator",
    "CinematicCameraTokenizer",
    "ClusterFaultToleranceEngine",
    "ClusterWatchdogDaemon",
    "CompleteAutonomousVideoProducer",
    "DistributedStudioLogger",
    "FrontierMultiModalLossEngine",
    "MasterBackendOrchestrator",
    "MediaStreamChunk",
    "MultiFormatBinaryTransmuxer",
    "OmniAudioSynthesisNetwork",
    "OmniStreamingService",
    "send_node_log",
    "SpatioTemporalConsistencyCache",
    "StudioSupervisorEngine",
    "VoiceProfileRegistry",
]
