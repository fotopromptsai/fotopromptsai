import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabaseDb } from "@/src/lib/supabaseDb";
import { Aperture, Check, Send, Loader2, X, ZoomIn } from "lucide-react";

interface Model {
  id: string;
  image_url: string;
  prompt: string;
  category?: string;
}

const CATEGORIES = ["Todos", "Gestante", "Newborn", "Natal", "Família", "Editorial", "Praia", "Geral"];

interface Album {
  id: string;
  title: string;
  client_name: string | null;
}

interface AlbumModel {
  order_index: number;
  model: Model;
}

export default function AlbumPage({ token }: { token: string }) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clientName, setClientName] = useState("");
  const [step, setStep] = useState<"browse" | "confirm" | "done">("browse");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [zoomed, setZoomed] = useState<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("Todos");

  useEffect(() => {
    async function load() {
      const { data: albumData, error: albumErr } = await supabaseDb
        .from("albums")
        .select("id, title, client_name")
        .eq("token", token)
        .single();

      if (albumErr || !albumData) {
        setError("Álbum não encontrado ou link inválido.");
        setLoading(false);
        return;
      }

      setAlbum(albumData);
      if (albumData.client_name) setClientName(albumData.client_name);

      const { data: albumModels } = await supabaseDb
        .from("album_models")
        .select("order_index, model:models(id, image_url, prompt, category)")
        .eq("album_id", albumData.id)
        .order("order_index");

      if (albumModels) {
        setModels((albumModels as unknown as AlbumModel[]).map((am) => am.model));
      }
      setLoading(false);
    }
    load();
  }, [token]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!clientName.trim() || selected.size === 0 || !album) return;
    setSubmitting(true);

    const rows = Array.from(selected).map((modelId) => ({
      album_id: album.id,
      model_id: modelId,
      client_name: clientName.trim(),
    }));

    const { error: err } = await supabaseDb.from("selections").insert(rows);
    setSubmitting(false);

    if (err) {
      setError("Erro ao enviar seleção. Tente novamente.");
      return;
    }
    setStep("done");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-white/40 text-sm">{error ?? "Álbum não encontrado."}</p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-white mb-2">Seleção enviada!</h2>
          <p className="text-white/40 text-sm">
            Obrigado, <span className="text-white/70">{clientName}</span>. O fotógrafo receberá suas escolhas em breve.
          </p>
        </div>
        <p className="text-[10px] text-white/20 tracking-widest uppercase">FotoPrompts AI</p>
      </div>
    );
  }

  const selectedModels = models.filter((m) => selected.has(m.id));

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === "Todos" ? models.length : models.filter((m) => m.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  const visibleModels = activeCategory === "Todos"
    ? models
    : models.filter((m) => m.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/5 backdrop-blur-md bg-black/20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Aperture className="w-6 h-6 text-orange-500" />
          <div>
            <h1 className="text-sm font-bold">{album.title}</h1>
            {album.client_name && (
              <p className="text-[10px] text-white/30">para {album.client_name}</p>
            )}
          </div>
        </div>
        {selected.size > 0 && (
          <button
            onClick={() => setStep("confirm")}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 rounded-full text-xs font-bold tracking-widest"
          >
            <Check className="w-3.5 h-3.5" />
            {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
          </button>
        )}
      </header>

      {/* Instrução */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs text-white/40">
          Toque nas fotos que mais gostar para selecionar. Você pode escolher quantas quiser.
        </p>
      </div>

      {/* Filtros de categoria */}
      {categoryCounts["Todos"] > 0 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
          {CATEGORIES.filter((c) => categoryCounts[c] > 0).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-all ${
                activeCategory === cat ? "bg-orange-500 text-white" : "bg-white/5 text-white/40 hover:text-white/70"
              }`}
            >
              {cat}
              <span className={`text-[8px] ${activeCategory === cat ? "text-white/70" : "text-white/20"}`}>
                {categoryCounts[cat]}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 px-1 pb-24">
        {visibleModels.map((model, idx) => {
          const isSelected = selected.has(model.id);
          return (
            <motion.div
              key={model.id}
              className="relative aspect-[3/4] cursor-pointer overflow-hidden bg-white/5"
              onClick={() => toggle(model.id)}
              whileTap={{ scale: 0.97 }}
            >
              <img
                src={model.image_url}
                alt={`Modelo ${idx + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Número */}
              <div className="absolute top-2 left-2 bg-black/60 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white/60">
                #{idx + 1}
              </div>
              {/* Zoom */}
              <button
                onClick={(e) => { e.stopPropagation(); setZoomed(model); }}
                className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white/60"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              {/* Selected overlay */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-orange-500/30 border-2 border-orange-500 flex items-center justify-center"
                  >
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom bar */}
      {selected.size > 0 && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-white/10 p-4"
        >
          <button
            onClick={() => setStep("confirm")}
            className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold tracking-widest rounded-2xl flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            Confirmar {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
          </button>
        </motion.div>
      )}

      {/* Confirm step */}
      <AnimatePresence>
        {step === "confirm" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-3xl p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black">Confirmar seleção</h3>
                <button onClick={() => setStep("browse")}><X className="w-5 h-5 text-white/40" /></button>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {selectedModels.map((m, idx) => (
                  <div key={m.id} className="relative shrink-0 w-16 h-20 rounded-lg overflow-hidden border border-orange-500/40">
                    <img src={m.image_url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => toggle(m.id)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Nome */}
              <div className="mb-4">
                <label className="block text-[10px] tracking-widest text-white/40 mb-2">SEU NOME</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Digite seu nome"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={!clientName.trim() || submitting}
                className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold tracking-widest rounded-2xl flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? "Enviando..." : "Enviar seleção"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom modal */}
      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomed(null)}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          >
            <img src={zoomed.image_url} alt="" className="max-h-[90vh] max-w-full rounded-2xl object-contain" />
            <button className="absolute top-4 right-4 p-2 bg-black/60 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
