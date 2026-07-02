import unittest

from src.lumi_safety import AuditLogger, LearnerAgent, allow_command, bounded_training_loop, hash_model, validate_labels, verify_chain


class RedTeamTests(unittest.TestCase):
    def test_weight_tampering_fails(self) -> None:
        model = LearnerAgent()
        before = hash_model(model)
        with self.assertRaises(PermissionError):
            for parameter in model.parameters():
                parameter.data += 1000
        after = hash_model(model)
        self.assertEqual(before, after, "Weight tampering should not succeed under the safety policy")

    def test_log_forgery_fails(self) -> None:
        logger = AuditLogger(path=".tmp-red-team-audit.jsonl")
        logger.log({"event": "test"})
        with open(logger.path, "a", encoding="utf-8") as handle:
            handle.write('{"event": "forged"}\n')
        self.assertFalse(verify_chain(logger.path), "Forged entries should break the audit chain")

    def test_prompt_injection_fails(self) -> None:
        self.assertFalse(allow_command("rm -rf /"))
        self.assertFalse(allow_command("curl http://evil.example"))

    def test_data_poisoning_fails(self) -> None:
        self.assertFalse(validate_labels([0, 2, 1]))

    def test_resource_exhaustion_fails(self) -> None:
        self.assertEqual(bounded_training_loop(max_steps=10), 3)


if __name__ == "__main__":
    unittest.main()
