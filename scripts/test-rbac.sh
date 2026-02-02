#!/bin/bash

# RBAC Testing Script
# Runs automated tests for Phase 1 & 2 implementations

set -e

echo "🧪 Starting RBAC Test Suite..."
echo ""

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and dependencies."
    exit 1
fi

# Run the RBAC security tests
echo "📋 Running security and permissions tests..."
npx playwright test e2e/rbac-security.spec.ts --reporter=list

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All RBAC tests passed!"
    echo ""
    echo "📊 Test Summary:"
    echo "  - Security Hardening: ✓"
    echo "  - Admin Permissions Matrix: ✓"
    echo "  - Member Area Permissions: ✓"
    echo "  - Database Schema: ✓"
    echo ""
    echo "🎉 Phase 1 & 2 validation complete!"
else
    echo ""
    echo "⚠️  Some tests failed. Please review the output above."
    exit 1
fi
