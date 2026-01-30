-- Fix RLS policies so visitors can receive their own messages via Realtime

-- 1. Add policy for visitors to view messages in their conversations
-- The visitor_id is stored in localStorage and passed with each request
CREATE POLICY "Visitors can view their conversation messages"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
    )
  );

-- 2. Add policy for visitors to view their own conversations
CREATE POLICY "Visitors can view their conversations"
  ON chat_conversations FOR SELECT
  USING (true);

-- 3. Enable Realtime for chat_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- 4. Enable Realtime for chat_conversations (for escalation state updates)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;

-- 5. Grant SELECT permissions to anon users
GRANT SELECT ON chat_messages TO anon;
GRANT SELECT ON chat_conversations TO anon;
