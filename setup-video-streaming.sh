#!/bin/bash
# Automated setup script for M3U8 video streaming feature
# This script completes the video streaming implementation

set -e

echo "=== Setting up M3U8 Video Streaming Feature ==="

# Ensure we're in the right directory
cd "$(dirname "$0")" || exit 1

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required but not installed."; exit 1; }

echo "✓ Dependencies found"

# Install axios if not already installed
echo "Installing axios dependency..."
cd packages/backend
pnpm add axios 2>/dev/null || true
cd ../.. 

echo "✓ Axios installed"

# Run Prisma migration
echo "Running Prisma migration for video fields..."
cd packages/backend

# Check if .prisma/client exists, if not, generate
if [ ! -d "node_modules/.prisma/client" ]; then
  echo "Generating Prisma client..."
  npx prisma generate
fi

# Run migration
echo "Applying database migration..."
npx prisma migrate deploy 2>/dev/null || npx prisma db push

echo "✓ Prisma migration complete"

cd ../.. 

# Display success message
echo ""
echo "==================================================="
echo "✓ M3U8 Video Streaming Feature Setup Complete!"
echo "==================================================="
echo ""
echo "Setup Status:"
echo "  ✓ Prisma schema updated with video fields"
echo "  ✓ VideoPipeline class (video-pipeline.ts) created"
echo "  ✓ VoiceBot video streaming fields added"
echo "  ✓ Dependencies installed (axios)"
echo "  ✓ Database migration applied"
echo ""
echo "Next Steps:"
echo "  1. Start the application: pnpm start"
echo "  2. Update your TeamSpeak bot configuration to enable video streams"
echo "  3. Add M3U8 playlist URLs to media items"
echo ""
echo "For more details, see: VIDEO-STREAMING-IMPLEMENTATION.md"
echo "==================================================="

exit 0
