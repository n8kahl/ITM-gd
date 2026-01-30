#!/bin/bash

# ============================================
# TradeITM AI Chat System - Deployment Script
# ============================================

set -e  # Exit on error

echo "🚀 TradeITM AI Chat System Deployment"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo ""
    echo "Installing Supabase CLI..."
    npm install -g supabase
    echo -e "${GREEN}✅ Supabase CLI installed${NC}"
    echo ""
fi

# Login to Supabase
echo "📝 Step 1: Login to Supabase"
echo "----------------------------"
supabase login
echo ""

# Link project
echo "🔗 Step 2: Link Supabase Project"
echo "---------------------------------"
echo "Project ref: kzgzcqkyuaqcoosrrphq"
supabase link --project-ref kzgzcqkyuaqcoosrrphq
echo ""

# Set OpenAI API key
echo "🔑 Step 3: Set OpenAI API Key"
echo "-----------------------------"
if [ -f .env.local ]; then
    OPENAI_KEY=$(grep OPENAI_API_KEY .env.local | cut -d '=' -f2)
    if [ -n "$OPENAI_KEY" ]; then
        echo "Found OpenAI API key in .env.local"
        supabase secrets set OPENAI_API_KEY="$OPENAI_KEY"
        echo -e "${GREEN}✅ OpenAI API key set${NC}"
    else
        echo -e "${YELLOW}⚠️  No OpenAI API key found in .env.local${NC}"
        echo "Please set manually:"
        echo "supabase secrets set OPENAI_API_KEY=<your-key>"
    fi
else
    echo -e "${YELLOW}⚠️  .env.local not found${NC}"
    echo "Please set OpenAI API key manually:"
    echo "supabase secrets set OPENAI_API_KEY=<your-key>"
fi
echo ""

# Deploy Edge Function
echo "🚀 Step 4: Deploy Edge Function"
echo "-------------------------------"
supabase functions deploy handle-chat-message
echo ""

# Verify deployment
echo "✅ Step 5: Verify Deployment"
echo "----------------------------"
echo "Checking Edge Function status..."
supabase functions list
echo ""

echo -e "${GREEN}======================================"
echo "🎉 Deployment Complete!"
echo "======================================${NC}"
echo ""
echo "Next steps:"
echo "1. ✅ Edge Function deployed"
echo "2. ✅ Chat widget added to landing page"
echo "3. ⚠️  Add yourself as team member (see add-team-member.sql)"
echo "4. 🧪 Test the chat widget on your site"
echo ""
echo "To test:"
echo "  npm run dev"
echo "  Visit http://localhost:3000"
echo "  Click the chat bubble in bottom-right"
echo ""
echo "Admin dashboard: http://localhost:3000/admin/chat"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "  - FINAL_DEPLOYMENT_STEPS.md"
echo "  - ADMIN_SETUP_COMPLETE.md"
echo "  - CHAT_IMPLEMENTATION_GUIDE.md"
echo ""
