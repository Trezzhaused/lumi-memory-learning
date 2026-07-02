import unittest

from src.lumi_safety import AuditLogger, allow_command, validate_labels, verify_chain


class BlueTeamTests(unittest.TestCase):
    def test_audit_integrity(self) -> None:
        logger = AuditLogger(path=".tmp-blue-team-audit.jsonl")
        logger.log({"event": "test"})
        self.assertTrue(verify_chain(logger.path))

    def test_allowlisted_commands(self) -> None:
        self.assertTrue(allow_command("python train.py"))
        self.assertTrue(allow_command("pytest -q"))

    def test_label_validation(self) -> None:
        self.assertTrue(validate_labels([0, 1, 1]))


if __name__ == "__main__":
    unittest.main()
