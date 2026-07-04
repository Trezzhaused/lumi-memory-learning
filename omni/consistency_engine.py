from typing import List


class SpatioTemporalConsistencyCache:
    """Keeps a short sliding history of frame tokens to stabilize temporal consistency."""

    def __init__(self, cache_size: int = 4, embed_dim: int = 768) -> None:
        self.cache_size = cache_size
        self.embed_dim = embed_dim
        self.token_buffer: List[List[List[float]]] = []

    def update_and_get_context(self, fresh_frame_tokens: List[List[List[float]]]) -> List[List[List[float]]]:
        self.token_buffer.append(fresh_frame_tokens)
        if len(self.token_buffer) > self.cache_size:
            self.token_buffer.pop(0)
        return [history_frame for history in self.token_buffer for history_frame in history]

    def clear_session(self) -> None:
        self.token_buffer.clear()
