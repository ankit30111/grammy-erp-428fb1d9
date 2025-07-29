-- Create tables for WhatsApp webhook tracking

-- Add delivery tracking columns to whatsapp_notifications table
ALTER TABLE whatsapp_notifications 
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE;

-- Create table for WhatsApp replies
CREATE TABLE IF NOT EXISTS whatsapp_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_message_id TEXT NOT NULL,
  sender_number TEXT NOT NULL,
  message_content TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_sender ON whatsapp_replies(sender_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_received_at ON whatsapp_replies(received_at);

-- Enable RLS on whatsapp_replies table
ALTER TABLE whatsapp_replies ENABLE ROW LEVEL SECURITY;

-- Create policies for whatsapp_replies
CREATE POLICY "Allow authenticated users to view whatsapp_replies"
ON whatsapp_replies FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to insert whatsapp_replies"
ON whatsapp_replies FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Add comment for documentation
COMMENT ON TABLE whatsapp_replies IS 'Stores incoming WhatsApp messages/replies from vendors';
COMMENT ON COLUMN whatsapp_replies.whatsapp_message_id IS 'WhatsApp message ID from Meta API';
COMMENT ON COLUMN whatsapp_replies.sender_number IS 'Phone number that sent the reply';
COMMENT ON COLUMN whatsapp_replies.message_content IS 'Content of the reply message';