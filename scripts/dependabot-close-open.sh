#!/usr/bin/env bash
# Close open Dependabot PRs in bulk. Run locally with your GitHub CLI login:
#   bash scripts/dependabot-close-open.sh
set -euo pipefail

repo="${1:-ingmarstruijs/WikiTraveler}"

mapfile -t numbers < <(gh pr list --repo "$repo" --state open --author "app/dependabot" --json number --jq '.[].number')

if [ "${#numbers[@]}" -eq 0 ]; then
  echo "No open Dependabot PRs."
  exit 0
fi

echo "Closing ${#numbers[@]} Dependabot PR(s): ${numbers[*]}"

for n in "${numbers[@]}"; do
  gh pr close "$n" --repo "$repo" --comment "@dependabot close — batch later; majors ignored in dependabot.yml"
  echo "closed #$n"
done

echo "Done."
