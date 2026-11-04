#!/bin/bash
cd "$(dirname "${BASH_SOURCE[0]}")/.."
node scripts/hardtest/p5-failures.mjs
node scripts/hardtest/p6-agent.mjs
echo "RUNNER D DONE"
