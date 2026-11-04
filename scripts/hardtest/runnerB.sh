#!/bin/bash
cd "$(dirname "${BASH_SOURCE[0]}")/.."
node scripts/hardtest/p4-stress.mjs
echo "RUNNER B DONE"
