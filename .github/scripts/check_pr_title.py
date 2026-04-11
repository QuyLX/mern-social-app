import os
import re
import pathlib
import sys


def main() -> int:
    title = os.environ.get("TITLE", "").strip()
    if not title:
        print("::error title=pr-title::PR title is empty")
        return 1

    workspace = pathlib.Path(os.environ.get("GITHUB_WORKSPACE", "."))
    path = workspace / ".github" / "pr-title.regex"
    if not path.is_file():
        print("::error title=pr-title::Missing .github/pr-title.regex")
        return 1

    raw = path.read_text(encoding="utf-8")
    pattern_lines = [
        ln.strip()
        for ln in raw.splitlines()
        if ln.strip() and not ln.strip().startswith("#")
    ]
    if not pattern_lines:
        print("::error title=pr-title::Add a regex line to .github/pr-title.regex (non-comment)")
        return 1

    pattern = pattern_lines[-1]
    try:
        ok = re.fullmatch(pattern, title) is not None
    except re.error as e:
        print(f"::error title=pr-title::Invalid regex: {e}")
        return 1

    if not ok:
        print("::error title=pr-title::PR title does not match the rule in .github/pr-title.regex")
        print(f"::notice::Title was: {title!r}")
        return 1

    print("PR title OK:", title)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
