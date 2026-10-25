import sys


def main(argv: list[str] | None = None) -> int:
    args = argv or sys.argv[1:]
    print(args)
    return 0
