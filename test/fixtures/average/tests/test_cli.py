from weather.cli import main


def test_main_returns_zero():
    assert main(['Paris']) == 0
