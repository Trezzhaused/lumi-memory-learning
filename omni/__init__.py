"""Prototype multimodal Omni-Model training, export, and streaming modules."""

try:  # pragma: no cover - optional dependency
    from omni.audio_neural_codec import OmniAudioSynthesisNetwork
except Exception:  # pragma: no cover - optional dependency
    OmniAudioSynthesisNetwork = None

from omni.audio_visual_gates import AudioToVideoGatingMatrix

try:  # pragma: no cover - optional dependency
    from omni.cinematic_motion import CinematicCameraTokenizer
except Exception:  # pragma: no cover - optional dependency
    CinematicCameraTokenizer = None

try:  # pragma: no cover - optional dependency
    from omni.consistency_engine import SpatioTemporalConsistencyCache
except Exception:  # pragma: no cover - optional dependency
    SpatioTemporalConsistencyCache = None

try:  # pragma: no cover - optional dependency
    from omni.cluster_daemon import ClusterWatchdogDaemon
except Exception:  # pragma: no cover - optional dependency
    ClusterWatchdogDaemon = None

try:  # pragma: no cover - optional dependency
    from omni.fault_tolerance import ClusterFaultToleranceEngine
except Exception:  # pragma: no cover - optional dependency
    ClusterFaultToleranceEngine = None

try:  # pragma: no cover - optional dependency
    from omni.grpc_stream_server import MediaStreamChunk, OmniStreamingService
except Exception:  # pragma: no cover - optional dependency
    MediaStreamChunk = None
    OmniStreamingService = None

try:  # pragma: no cover - optional dependency
    from omni.hyperparameter_orchestrator import AutonomousGridOrchestrator
except Exception:  # pragma: no cover - optional dependency
    AutonomousGridOrchestrator = None

try:  # pragma: no cover - optional dependency
    from omni.master_backend_orchestrator import MasterBackendOrchestrator
except Exception:  # pragma: no cover - optional dependency
    MasterBackendOrchestrator = None

try:  # pragma: no cover - optional dependency
    from omni.master_production_runner import CompleteAutonomousVideoProducer, EliteStudioPipelinePipeliner
except Exception:  # pragma: no cover - optional dependency
    CompleteAutonomousVideoProducer = None
    EliteStudioPipelinePipeliner = None

try:  # pragma: no cover - optional dependency
    from omni.master_studio_orchestrator import AbsoluteStudioCore
except Exception:  # pragma: no cover - optional dependency
    AbsoluteStudioCore = None

try:  # pragma: no cover - optional dependency
    from omni.multi_format_writer import MultiFormatBinaryTransmuxer
except Exception:  # pragma: no cover - optional dependency
    MultiFormatBinaryTransmuxer = None

try:  # pragma: no cover - optional dependency
    from omni.optimized_attention import FlashBlockSparseAttention
except Exception:  # pragma: no cover - optional dependency
    FlashBlockSparseAttention = None

try:  # pragma: no cover - optional dependency
    from omni.fast_stream_remuxer import FastMemoryStreamRemuxer
except Exception:  # pragma: no cover - optional dependency
    FastMemoryStreamRemuxer = None

try:  # pragma: no cover - optional dependency
    from omni.studio_logger import DistributedStudioLogger, send_node_log
except Exception:  # pragma: no cover - optional dependency
    DistributedStudioLogger = None
    send_node_log = None

try:  # pragma: no cover - optional dependency
    from omni.studio_supervisor import StudioSupervisorEngine
except Exception:  # pragma: no cover - optional dependency
    StudioSupervisorEngine = None

try:  # pragma: no cover - optional dependency
    from omni.voice_registry import VoiceProfileRegistry
except Exception:  # pragma: no cover - optional dependency
    VoiceProfileRegistry = None

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
    "EliteStudioPipelinePipeliner",
    "FastMemoryStreamRemuxer",
    "FlashBlockSparseAttention",
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
