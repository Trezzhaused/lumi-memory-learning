import asyncio
import json
import logging
import socket
import time
from typing import Optional


class DistributedStudioLogger:
    """Aggregates log events from distributed cluster nodes into a master stream."""

    def __init__(self, host: str = "0.0.0.0", port: int = 9001) -> None:
        self.host = host
        self.port = port
        logging.basicConfig(
            level=logging.INFO,
            format="[%(asctime)s] [NODE-%(name)s] [%(levelname)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        self.master_logger = logging.getLogger("STUDIO_CORE")

    async def handle_node_stream(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        peer_addr = writer.get_extra_info("peername")
        self.master_logger.info("Connected to distributed cluster execution node: %s", peer_addr)
        try:
            while True:
                data = await reader.readline()
                if not data:
                    break
                log_line = data.decode("utf-8").strip()
                try:
                    payload = json.loads(log_line)
                    node_id = payload.get("node_id", "UNKNOWN")
                    level = payload.get("level", "INFO").upper()
                    message = payload.get("message", "")
                    node_logger = logging.getLogger(str(node_id))
                    if level == "ERROR":
                        node_logger.error(message)
                    elif level == "WARNING":
                        node_logger.warning(message)
                    else:
                        node_logger.info(message)
                except json.JSONDecodeError:
                    self.master_logger.info("[%s] %s", peer_addr, log_line)
        except Exception as exc:  # pragma: no cover - defensive logger path
            self.master_logger.error("Connection dropped with node %s: %s", peer_addr, exc)
        finally:
            writer.close()
            await writer.wait_closed()

    async def start_aggregator_server(self) -> None:
        server = await asyncio.start_server(self.handle_node_stream, self.host, self.port)
        self.master_logger.info("🚀 Distributed Log Aggregator listening on %s:%s", self.host, self.port)
        async with server:
            await server.serve_forever()


def send_node_log(target_host: str, target_port: int, node_id: int, level: str, message: str) -> None:
    """Sends a JSON log packet from a worker process back to the aggregator."""
    try:
        payload = json.dumps({"node_id": node_id, "level": level, "message": message, "timestamp": time.time()})
        with socket.create_connection((target_host, target_port), timeout=1.0) as sock:
            sock.sendall((payload + "\n").encode("utf-8"))
    except Exception:
        pass
