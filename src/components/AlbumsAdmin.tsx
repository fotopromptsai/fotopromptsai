import React, { useState, useEffect, useCallback } from "react";
import { supabaseDb } from "@/src/lib/supabaseDb";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, Link2, Check, X, Loader2, ChevronUp,
  Trash2, Copy, Users, Image as ImageIcon, Eye, BookOpen, ChevronDown, Aperture
} from "lucide-react";

interface Model {
  id: string;
  image_url: string;
  prompt: string;
  original_filename: string | null;
}

interface Album {
  id: string;
  token: string;
  title: string;
  client_name: string | null;
  created_at: string;
  _modelCount?: number;
  _selectionCount?: number;
}

interface Selection {
  id: string;
  client_name: string;
  selected_at: string;
  model: { image_url: string; prompt: string; original_filename: string | null };
}

const BASE_URL = window.location.origin;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

export default function AlbumsAdmin({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"albums" | "models">("albums");
  const [albums, setAlbums] = useState<Album[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newClient, setNewClient] = useState("");
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, Selection[]>>({});
  const [modelsPage, setModelsPage] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [copiedCatalog, setCopiedCatalog] = useState(false);
  const [expandedSelection, setExpandedSelection] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [catalogSelections, setCatalogSelections] = useState<Selection[]>([]);
  const [catalogSelCount, setCatalogSelCount] = useState(0);
  const [showCatalogSel, setShowCatalogSel] = useState(false);
  const [loadingCatalogSel, setLoadingCatalogSel] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const PAGE_SIZE = 40;

  const loadAlbums = useCallback(async () => {
    const [{ data }, { count }] = await Promise.all([
      supabaseDb
        .from("albums")
        .select("id, token, title, client_name, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabaseDb
        .from("selections")
        .select("*", { count: "exact", head: true })
        .is("album_id", null),
    ]);

    if (count !== null) setCatalogSelCount(count);

    if (data) {
      const withCounts = await Promise.all(
        data.map(async (album) => {
          const [{ count: modelCount }, { count: selCount }] = await Promise.all([
            supabaseDb.from("album_models").select("*", { count: "exact", head: true }).eq("album_id", album.id),
            supabaseDb.from("selections").select("*", { count: "exact", head: true }).eq("album_id", album.id),
          ]);
          return { ...album, _modelCount: modelCount ?? 0, _selectionCount: selCount ?? 0 };
        })
      );
      setAlbums(withCounts);
    }
  }, [userId]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    const from = modelsPage * PAGE_SIZE;
    let query = supabaseDb
      .from("models")
      .select("id, image_url, prompt, original_filename, category")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (categoryFilter !== "Todos") query = query.eq("category", categoryFilter);
    const { data } = await query;
    if (data) setModels(data as any);
    setModelsLoading(false);
  }, [modelsPage, categoryFilter]);

  useEffect(() => {
    Promise.all([loadAlbums(), loadModels()]).finally(() => setLoading(false));
  }, [loadAlbums, loadModels]);

  const createAlbum = async () => {
    if (!newTitle.trim() || selectedModels.size === 0) return;
    setCreating(true);

    const { data: album, error } = await supabaseDb
      .from("albums")
      .insert({ title: newTitle.trim(), client_name: newClient.trim() || null, user_id: userId })
      .select()
      .single();

    if (error || !album) { setCreating(false); return; }

    const modelRows = Array.from(selectedModels).map((modelId, idx) => ({
      album_id: album.id,
      model_id: modelId,
      order_index: idx,
    }));
    await supabaseDb.from("album_models").insert(modelRows);

    setNewTitle("");
    setNewClient("");
    setSelectedModels(new Set());
    setCreating(false);
    loadAlbums();
  };

  const deleteAlbum = async (id: string) => {
    if (!confirm("Deletar este álbum?")) return;
    await supabaseDb.from("albums").delete().eq("id", id);
    loadAlbums();
  };

  const copyLink = async (token: string) => {
    await copyText(`${BASE_URL}/album/${token}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleCopyCatalog = async () => {
    await copyText(`${BASE_URL}/catalogo`);
    setCopiedCatalog(true);
    setTimeout(() => setCopiedCatalog(false), 2000);
  };

  const handleCopyPrompt = async (id: string, prompt: string) => {
    await copyText(prompt);
    setCopiedPrompt(id);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const loadSelections = async (albumId: string) => {
    const { data } = await supabaseDb
      .from("selections")
      .select("id, client_name, selected_at, model:models(image_url, prompt, original_filename)")
      .eq("album_id", albumId)
      .order("selected_at", { ascending: false });
    if (data) setSelections((prev) => ({ ...prev, [albumId]: data as unknown as Selection[] }));
  };

  const loadCatalogSelections = async () => {
    setLoadingCatalogSel(true);
    const { data } = await supabaseDb
      .from("selections")
      .select("id, client_name, selected_at, model:models(image_url, prompt, original_filename)")
      .is("album_id", null)
      .order("selected_at", { ascending: false });
    if (data) setCatalogSelections(data as unknown as Selection[]);
    setLoadingCatalogSel(false);
  };

  const toggleAlbum = (id: string) => {
    setExpandedAlbum((prev) => {
      if (prev === id) return null;
      loadSelections(id);
      return id;
    });
  };

  const toggleCatalogSel = () => {
    if (!showCatalogSel) loadCatalogSelections();
    setShowCatalogSel((v) => !v);
  };

  const toggleModel = (id: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderSelectionList = (items: Selection[], keyPrefix: string) => (
    <div className="space-y-2">
      {Object.entries(
        items.reduce((acc, s) => {
          if (!acc[s.client_name]) acc[s.client_name] = [];
          acc[s.client_name].push(s);
          return acc;
        }, {} as Record<string, Selection[]>)
      ).map(([name, clientItems]) => (
        <div key={`${keyPrefix}-${name}`} className="bg-white/[0.03] rounded-xl p-3">
          <p className="text-[10px] font-bold text-white/70 mb-3">{name}</p>
          <div className="space-y-3">
            {clientItems.map((s) => (
              <div key={s.id} className="flex gap-3">
                <img src={s.model.image_url} alt="" className="w-14 h-20 object-cover rounded-lg border border-orange-500/30 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={`text-[9px] text-white/40 leading-relaxed ${expandedSelection === s.id ? "" : "line-clamp-4"}`}>
                    {s.model.prompt}
                  </p>
                  <button
                    onClick={() => setExpandedSelection(expandedSelection === s.id ? null : s.id)}
                    className="text-[8px] text-orange-400/60 hover:text-orange-400 mt-1 flex items-center gap-0.5"
                  >
                    {expandedSelection === s.id
                      ? <><ChevronUp className="w-2.5 h-2.5" />ver menos</>
                      : <><ChevronDown className="w-2.5 h-2.5" />ver completo</>}
                  </button>
                  <button
                    onClick={() => handleCopyPrompt(s.id, s.model.prompt)}
                    className="text-[8px] text-white/20 hover:text-white/50 mt-0.5 flex items-center gap-0.5"
                  >
                    {copiedPrompt === s.id
                      ? <><Check className="w-2.5 h-2.5 text-green-400" />copiado!</>
                      : <><Copy className="w-2.5 h-2.5" />copiar prompt</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Tabs */}
      <div className="flex bg-white/5 rounded-xl p-1 gap-1">
        {(["albums", "models"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-bold tracking-widest transition-all ${
              tab === t ? "bg-orange-500 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            {t === "albums" ? "ÁLBUNS" : `MODELOS (${models.length}+)`}
          </button>
        ))}
      </div>

      {tab === "albums" && (
        <div className="space-y-4">
          {/* Link catálogo geral */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[10px] font-bold text-white/70">Catálogo completo</p>
                <p className="text-[9px] text-white/30 font-mono">{BASE_URL}/catalogo</p>
              </div>
              <button
                onClick={handleCopyCatalog}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 rounded-xl text-[10px] text-orange-400 font-bold transition-colors"
              >
                {copiedCatalog ? <Check className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                {copiedCatalog ? "Copiado!" : "Copiar link"}
              </button>
            </div>

            {/* Seleções do catálogo */}
            <div className="border-t border-white/5">
              <button
                onClick={toggleCatalogSel}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-[9px] text-white/40 font-bold tracking-widest flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  SELEÇÕES DO CATÁLOGO
                  {catalogSelCount > 0 && (
                    <span className="bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full text-[8px]">
                      {catalogSelCount}
                    </span>
                  )}
                </span>
                {showCatalogSel
                  ? <ChevronUp className="w-3.5 h-3.5 text-white/30" />
                  : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
              </button>

              <AnimatePresence>
                {showCatalogSel && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      {loadingCatalogSel ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                        </div>
                      ) : catalogSelections.length === 0 ? (
                        <p className="text-[10px] text-white/20 text-center py-4">Nenhuma seleção do catálogo ainda.</p>
                      ) : (
                        renderSelectionList(catalogSelections, "catalog")
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Lista de álbuns */}
          {albums.length === 0 ? (
            <p className="text-[10px] text-white/20 text-center py-4">Nenhum álbum criado ainda.</p>
          ) : (
            albums.map((album) => (
              <div key={album.id} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs font-bold text-white">{album.title}</p>
                      {album.client_name && (
                        <p className="text-[9px] text-white/30 mt-0.5">{album.client_name}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => copyLink(album.token)}
                        className="p-1.5 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg transition-colors"
                        title="Copiar link"
                      >
                        {copiedToken === album.token ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5 text-orange-400" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleAlbum(album.id)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                        title="Ver seleções"
                      >
                        {expandedAlbum === album.id ? (
                          <ChevronUp className="w-3.5 h-3.5 text-white/40" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-white/40" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteAlbum(album.id)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Deletar"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 text-[9px] text-white/30">
                    <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" />{album._modelCount} modelos</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{album._selectionCount} seleções</span>
                    <span>{new Date(album.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {/* Link */}
                  <div className="mt-2 bg-white/5 rounded-lg px-2 py-1.5 flex items-center gap-2">
                    <p className="text-[8px] text-white/30 truncate flex-1 font-mono">
                      {BASE_URL}/album/{album.token}
                    </p>
                    <button onClick={() => copyLink(album.token)}>
                      <Copy className="w-3 h-3 text-white/30 hover:text-white/60" />
                    </button>
                  </div>
                </div>

                {/* Seleções expandidas */}
                <AnimatePresence>
                  {expandedAlbum === album.id && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden border-t border-white/5"
                    >
                      <div className="p-4 space-y-2">
                        <p className="text-[9px] tracking-widest text-white/30 font-bold">SELEÇÕES DO CLIENTE</p>
                        {!selections[album.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                        ) : selections[album.id].length === 0 ? (
                          <p className="text-[10px] text-white/20">Nenhuma seleção ainda.</p>
                        ) : (
                          renderSelectionList(selections[album.id], album.id)
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "models" && (
        <div className="space-y-3">
          {/* Filtro por categoria */}
          <div className="flex gap-1.5 flex-wrap">
            {["Todos", "Gestante", "Newborn", "Natal", "Família", "Editorial", "Praia", "Geral"].map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategoryFilter(cat); setModelsPage(0); }}
                className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-widest transition-all ${categoryFilter === cat ? "bg-orange-500 text-white" : "bg-white/5 text-white/40 hover:text-white/70"}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {selectedModels.size > 0 && (
            <div className="sticky top-0 z-10 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2 flex items-center justify-between">
              <p className="text-[10px] text-orange-400 font-bold">{selectedModels.size} modelos selecionados para o álbum</p>
              <button onClick={() => setSelectedModels(new Set())} className="text-orange-400/60 hover:text-orange-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {modelsLoading ? (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-white/5 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {models.map((model, idx) => {
                const isSel = selectedModels.has(model.id);
                return (
                  <div
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    className="relative aspect-[3/4] cursor-pointer overflow-hidden rounded-lg"
                  >
                    <img
                      src={model.image_url}
                      alt=""
                      className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                      loading="lazy"
                      onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "1"; }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                      <p className="text-[8px] text-white/40">#{modelsPage * PAGE_SIZE + idx + 1}</p>
                      {(model as any).category && (model as any).category !== "Geral" && (
                        <p className="text-[7px] text-orange-400/70 font-bold leading-none">{(model as any).category}</p>
                      )}
                    </div>
                    {isSel && (
                      <div className="absolute inset-0 bg-orange-500/30 border-2 border-orange-500 flex items-center justify-center rounded-lg">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Paginação */}
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => setModelsPage((p) => Math.max(0, p - 1))}
              disabled={modelsPage === 0}
              className="px-3 py-1.5 text-[10px] bg-white/5 rounded-lg disabled:opacity-30"
            >
              Anterior
            </button>
            <span className="px-3 py-1.5 text-[10px] text-white/40">
              Página {modelsPage + 1}
            </span>
            <button
              onClick={() => { setModelsPage((p) => p + 1); }}
              className="px-3 py-1.5 text-[10px] bg-white/5 rounded-lg"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Botão flutuante Criar Álbum */}
      <AnimatePresence>
        {tab === "models" && selectedModels.size > 0 && (
          <motion.button
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            onClick={() => setShowQuickCreate(true)}
            className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-80 z-[150] py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold tracking-widest rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar álbum com {selectedModels.size} modelo{selectedModels.size !== 1 ? "s" : ""}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modal quick create */}
      <AnimatePresence>
        {showQuickCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[160] flex items-end md:items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowQuickCreate(false); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-md bg-[#0f0f0f] border border-white/10 rounded-3xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Aperture className="w-4 h-4 text-orange-500" />
                  <h3 className="text-base font-black">Novo álbum</h3>
                </div>
                <button onClick={() => setShowQuickCreate(false)}>
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </div>

              <p className="text-[10px] text-white/30 mb-4">{selectedModels.size} modelo{selectedModels.size !== 1 ? "s" : ""} selecionado{selectedModels.size !== 1 ? "s" : ""}</p>

              <div className="space-y-3 mb-5">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Título do álbum *"
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
                />
                <input
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  placeholder="Nome do cliente (opcional)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <button
                onClick={async () => {
                  await createAlbum();
                  setShowQuickCreate(false);
                  setTab("albums");
                }}
                disabled={creating || !newTitle.trim()}
                className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold tracking-widest rounded-2xl flex items-center justify-center gap-2 text-sm transition-colors"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? "Criando..." : "Criar álbum"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
