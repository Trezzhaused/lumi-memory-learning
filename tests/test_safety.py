import unittest

from tests.blue_team import BlueTeamTests
from tests.red_team import RedTeamTests


if __name__ == "__main__":
    suite = unittest.TestSuite()
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(BlueTeamTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(RedTeamTests))
    unittest.TextTestRunner(verbosity=2).run(suite)
