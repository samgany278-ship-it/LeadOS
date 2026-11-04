#!/bin/bash
cd "$(dirname "${BASH_SOURCE[0]}")/.."
node scripts/hardtest/p1-production-run.mjs
node scripts/hardtest/p3-handoff.mjs
echo "RUNNER A DONE"
