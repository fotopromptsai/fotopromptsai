-- Tabela para controle de cadastros por IP
-- Execute no Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS ip_registrations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip         TEXT NOT NULL,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índice para busca rápida por IP
CREATE INDEX IF NOT EXISTS idx_ip_registrations_ip ON ip_registrations(ip);

-- RLS: somente service role pode ler/escrever (o endpoint usa service key)
ALTER TABLE ip_registrations ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy pública — acesso apenas via service role key
