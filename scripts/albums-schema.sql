-- Execute no Supabase SQL Editor do projeto prtxdbknlmlezwxpcyxv

-- Catálogo de modelos (importados do Telegram)
CREATE TABLE IF NOT EXISTS models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  original_filename TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Álbuns criados para clientes
CREATE TABLE IF NOT EXISTS albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  title TEXT NOT NULL,
  client_name TEXT,
  photographer_id UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modelos incluídos em cada álbum
CREATE TABLE IF NOT EXISTS album_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES albums ON DELETE CASCADE,
  model_id UUID REFERENCES models ON DELETE CASCADE,
  order_index INT DEFAULT 0
);

-- Seleções feitas pelos clientes
CREATE TABLE IF NOT EXISTS selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES albums ON DELETE CASCADE,
  model_id UUID REFERENCES models ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  notes TEXT,
  selected_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE selections ENABLE ROW LEVEL SECURITY;

-- Models: leitura pública, escrita autenticada
CREATE POLICY "Public read models" ON models FOR SELECT USING (true);
CREATE POLICY "Auth write models" ON models FOR ALL USING (auth.role() = 'authenticated');

-- Albums: leitura pública (por token), escrita autenticada
CREATE POLICY "Public read albums" ON albums FOR SELECT USING (true);
CREATE POLICY "Auth write albums" ON albums FOR ALL USING (auth.role() = 'authenticated');

-- Album_models: leitura pública, escrita autenticada
CREATE POLICY "Public read album_models" ON album_models FOR SELECT USING (true);
CREATE POLICY "Auth write album_models" ON album_models FOR ALL USING (auth.role() = 'authenticated');

-- Selections: qualquer um pode inserir, só autenticado lê
CREATE POLICY "Public insert selections" ON selections FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth read selections" ON selections FOR SELECT USING (auth.role() = 'authenticated');

-- Bucket público para imagens dos modelos
-- (criar manualmente no Supabase > Storage: bucket "models", marcar como público)
