"""
Vendor discipline: branch type/TASK-ID-slug + PR title must contain [TASK-ID].
Set env BRANCH (head ref), TITLE (PR title). Exit 0 on dependabot branches.
"""
from __future__ import annotations

import os
import re
import sys

# feature/SOCIAL-101-add-login — type slug, project key upper, number, optional tail
BRANCH_RE = re.compile(
    r"^[a-z][a-z0-9_-]+/[A-Z][A-Z0-9]*-\d+(?:-[a-z0-9._-]+)*$"
)
# At least one [PROJ-123] in title (common vendor / PM pattern)
TITLE_TASK_RE = re.compile(r"\[([A-Z][A-Z0-9]*-\d+)\]")


def main() -> int:
    branch = (os.environ.get("BRANCH") or "").strip()
    title = (os.environ.get("TITLE") or "").strip()

    if not branch:
        print("::error::BRANCH env is empty")
        return 1
    if not title:
        print("::error::TITLE env is empty")
        return 1

    if branch.startswith("dependabot/"):
        print("Skip vendor checks for Dependabot branch")
        return 0

    if not BRANCH_RE.fullmatch(branch):
        print(
            "::error title=branch::"
            "Branch must be type/TASK-ID-description "
            "(e.g. feature/SOCIAL-101-add-login)."
        )
        print(f"::notice::Got branch: {branch!r}")
        return 1

    if not TITLE_TASK_RE.search(title):
        print(
            "::error title=pr-title::"
            "PR title must include a task id in brackets, e.g. [SOCIAL-101]."
        )
        print(f"::notice::Got title: {title!r}")
        return 1

    print("Vendor branch + title OK:", branch, "|", title)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
