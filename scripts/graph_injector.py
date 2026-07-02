#!/usr/bin/env python3
import json
import os
import re
import sys

try:
    from neo4j import GraphDatabase
except ImportError as exc:  # pragma: no cover - exercised when the driver is missing
    print(json.dumps({"status": "error", "message": f"neo4j package missing: {exc}"}))
    sys.exit(0)


def _sanitize_label(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", value or "").strip("_").upper()
    return cleaned or fallback


def inject_relationship(entity_a: str, rel_type: str, entity_b: str) -> str:
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD")
    if not password:
        return json.dumps({"status": "error", "message": "NEO4J_PASSWORD must be configured before graph injection can run."})

    safe_relation = _sanitize_label(rel_type, "RELATED_TO")
    query = (
        f"MERGE (a:Entity {{name: $name_a}}) "
        f"MERGE (b:Entity {{name: $name_b}}) "
        f"MERGE (a)-[r:{safe_relation}]->(b) "
        f"RETURN a.name AS source, type(r) AS relation, b.name AS target"
    )

    try:
        with GraphDatabase.driver(uri, auth=(user, password)) as driver:
            with driver.session() as session:
                session.run(query, name_a=entity_a, name_b=entity_b)
                return json.dumps({
                    "status": "success",
                    "message": f"Linked {entity_a} -> {safe_relation} -> {entity_b}",
                })
    except Exception as exc:  # pragma: no cover - depends on local service availability
        return json.dumps({"status": "error", "message": str(exc)})


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"status": "error", "message": "usage: graph_injector.py <entity_a> <relationship_type> <entity_b>"}))
        sys.exit(0)

    print(inject_relationship(sys.argv[1], sys.argv[2], sys.argv[3]))
