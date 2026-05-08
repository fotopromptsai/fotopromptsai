-- Adiciona user_id na tabela albums para isolar álbuns por usuário
-- Execute no Supabase → SQL Editor

-- 1. Adicionar coluna user_id
ALTER TABLE albums
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Atribuir álbuns existentes ao usuário admin (substitua pelo UUID real do admin)
--    Para descobrir o UUID: SELECT id FROM auth.users WHERE email = 'leoclecio@outlook.com';
-- UPDATE albums SET user_id = '<UUID_DO_ADMIN>' WHERE user_id IS NULL;

-- 3. Ativar RLS
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

-- 4. Policies: cada usuário vê/modifica apenas seus próprios álbuns
DROP POLICY IF EXISTS "Users see own albums"   ON albums;
DROP POLICY IF EXISTS "Users insert own albums" ON albums;
DROP POLICY IF EXISTS "Users update own albums" ON albums;
DROP POLICY IF EXISTS "Users delete own albums" ON albums;
-- Leitura pública por token (para a página do cliente /album/:token)
DROP POLICY IF EXISTS "Public read album by token" ON albums;

CREATE POLICY "Users see own albums"
  ON albums FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own albums"
  ON albums FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own albums"
  ON albums FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own albums"
  ON albums FOR DELETE
  USING (user_id = auth.uid());

-- Permite que qualquer pessoa (não autenticada) leia um álbum pelo token
-- Necessário para a página pública /album/:token
CREATE POLICY "Public read album by token"
  ON albums FOR SELECT
  TO anon
  USING (true);
