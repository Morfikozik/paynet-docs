#!/usr/bin/env bash
# Copies one commit of the portal into a checkout of the GitLab project as ONE new commit (IT's history is kept).
#   scripts/sync-to-gitlab.sh <source-git-dir> <gitlab-checkout-dir> <message>
# Takes exactly the files of the source HEAD commit (git archive), except .github (GitHub-only) and .bolt.
# Prints "NO_CHANGES" if GitLab already has exactly this version.
set -euo pipefail
src="${1:?source git dir}"; dst="${2:?gitlab checkout}"; msg="${3:?commit message}"
[ -d "$dst/.git" ] || { echo "not a git checkout: $dst" >&2; exit 1; }
git -C "$dst" rm -rq --ignore-unmatch -- .                       # start from an empty tree
find "$dst" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +  # untracked leftovers too
git -C "$src" archive --format=tar HEAD -- . ':(exclude).github' ':(exclude).bolt' | tar -x -C "$dst"
cd "$dst"
git add -A
if git diff --cached --quiet; then echo "NO_CHANGES"; exit 0; fi
git -c user.name="Paynet docs (GitHub)" -c user.email="noreply@paynet-business.github" commit -q -m "$msg"
git diff --stat HEAD~1 HEAD | tail -1
