from pathlib import Path
from runpy import run_path
import sys


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    starter = root / "starter-repo"

    if sys.argv[1:2] == ["check"]:
        submitted_team = (root / "TEAMS.md").read_text(encoding="utf-8")
        starter_team = (starter / "TEAMS.md").read_text(encoding="utf-8")
        if submitted_team != starter_team:
            sys.exit("TEAMS.md must match starter-repo/TEAMS.md before running check.")

    run_path(str(starter / "run.py"), run_name="__main__")
