import React, { useState, useEffect } from "react";
import { analyzeImage, analyzeFace, generateImage } from "@/src/lib/gemini";
import { supabaseDb } from "@/src/lib/supabaseDb";
import { signOut } from "@/src/lib/auth";
import { getOrInitCredits, consumeCredit, type CreditInfo } from "@/src/lib/credits";
import { saveGeneration, fetchHistory, type Generation } from "@/src/lib/history";
import { trackApiCall } from "@/src/lib/admin";
import { applyWatermark } from "@/src/lib/watermark";
import AuthScreen from "@/src/components/AuthScreen";
import AdminPanel from "@/src/components/AdminPanel";
import AlbumsAdmin from "@/src/components/AlbumsAdmin";
import FaceScanOverlay from "@/src/components/FaceScanOverlay";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { 
  Upload,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  User,
  Camera,
  Layers,
  Aperture,
  Copy,
  Check,
  Menu,
  X,
  Wrench,
  Cpu,
  ChevronLeft,
  MessageCircle,
  ScanSearch,
  Loader2,
  FileText,
  Download,
  RotateCcw,
  Eye,
  Settings,
  Save,
  LayoutDashboard
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";

const ADMIN_EMAIL = "leoclecio@outlook.com";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={className}
    fill="currentColor"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.554 4.189 1.605 6.006L0 24l6.149-1.613a11.77 11.77 0 005.895 1.587h.005c6.635 0 12.032-5.396 12.035-12.03a11.782 11.782 0 00-3.526-8.504" />
  </svg>
);

// Types
type Step = "reference" | "prompt" | "user-image" | "result";
type View = "gerar" | "historico" | "albums" | "admin";
type GerarMode = null | "referencia" | "direto";

interface AnalysisResult {
  prompt: string;
  details: {
    pose: string;
    outfit: string;
    background: string;
    lighting: string;
    camera: string;
  };
}

export default function App() {
  const [user, setUser] = useState<SupabaseUser | null | undefined>(undefined);
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [history, setHistory] = useState<Generation[]>([]);
  const [step, setStep] = useState<Step>("reference");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [analysisDetails, setAnalysisDetails] = useState<AnalysisResult | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [watermarkedImage, setWatermarkedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<"reference" | "user" | null>(null);
  const [error, setError] = useState<{ message: string; type?: "api" | "size" | "gen" | "auth" } | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [view, setView] = useState<View>("gerar");
  const [gerarMode, setGerarMode] = useState<GerarMode>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [activeMenuSection, setActiveMenuSection] = useState<string | null>(null);
  const [configUrl, setConfigUrl] = useState("");
  const [configKey, setConfigKey] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);

  useEffect(() => {

    supabaseDb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: { subscription } } = supabaseDb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        supabaseDb.from("profiles").upsert({ id: u.id, email: u.email }).then(() => {});
        getOrInitCredits(u.id).then(setCreditInfo);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Carrega créditos e histórico quando usuário loga
  useEffect(() => {
    if (!user) return;
    getOrInitCredits(user.id).then(setCreditInfo);
    fetchHistory(user.id).then(setHistory);
  }, [user]);

  // Aguarda resolução da sessão
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user === null) return <AuthScreen />;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "reference" | "user") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError({ 
        message: "A imagem selecionada é muito grande (máximo 10MB). Por favor, escolha um arquivo menor.",
        type: "size"
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === "reference") {
        setReferenceImage(base64);
      } else {
        setUserImage(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const analyzeReference = async () => {
    if (!referenceImage || !user) return;
    setIsLoading(true);
    setError(null);

    // Verifica saldo antes mas só desconta após sucesso
    const credits = await getOrInitCredits(user.id);
    if (!credits || credits.credits <= 0) {
      setError({ message: "Sem créditos. Aguarde o reset em 24h.", type: "api" });
      setIsLoading(false);
      return;
    }

    setIsScanning("reference");

    try {
      const promptData = await analyzeImage(referenceImage);

      const fullPrompt = `${promptData.base} ${promptData.facePreservation} Pose: ${promptData.pose} Outfit: ${promptData.outfit} Background: ${promptData.background} Lighting: ${promptData.lighting} Camera: ${promptData.camera}`;

      const result: AnalysisResult = {
        prompt: fullPrompt,
        details: {
          pose: promptData.pose,
          outfit: promptData.outfit,
          background: promptData.background,
          lighting: promptData.lighting,
          camera: promptData.camera,
        },
      };

      // Só desconta crédito após sucesso confirmado
      await consumeCredit(user.id);
      const updated = await getOrInitCredits(user.id);
      setCreditInfo(updated);
      trackApiCall(user.id, "analyze", import.meta.env.VITE_SUPABASE_URL ?? "");

      setAnalysisDetails(result);
      setGeneratedPrompt(result.prompt);
      setStep("prompt");
    } catch (err: any) {
      console.error("Analysis error:", err);
      let message = "Ocorreu um erro inesperado ao analisar a imagem.";
      const errorStr = (err.message || "").toLowerCase();
      if (errorStr.includes("non-2xx") || errorStr.includes("402")) {
        message = "Capacidade de processamento atingida. O serviço estará disponível novamente em breve.";
      } else if (errorStr.includes("429") || errorStr.includes("limite")) {
        message = "Muitas requisições em sequência. Aguarde alguns instantes e tente novamente.";
      } else if (errorStr.includes("fetch failed") || !navigator.onLine) {
        message = "Falha na conexão. Verifique sua internet e tente novamente.";
      }
      setError({ message, type: "api" });
    } finally {
      setIsLoading(false);
      setIsScanning(null);
    }
  };

  const generateFinalImage = async () => {
    if (!userImage || !generatedPrompt || !user) return;
    setIsLoading(true);
    setError(null);

    const credits = await getOrInitCredits(user.id);
    if (!credits || credits.credits <= 0) {
      setError({ message: "Sem créditos. Aguarde o reset em 24h.", type: "gen" });
      setIsLoading(false);
      return;
    }

    setIsScanning("user");

    try {
      const faceDescription = await analyzeFace(userImage!);
      const imageUrl = await generateImage(generatedPrompt, userImage!, referenceImage!, faceDescription);

      // Só desconta crédito após sucesso confirmado
      await consumeCredit(user.id);
      const updated = await getOrInitCredits(user.id);
      setCreditInfo(updated);
      trackApiCall(user.id, "generate", import.meta.env.VITE_SUPABASE_URL ?? "");

      setFinalImage(imageUrl);
      const wm = await applyWatermark(imageUrl);
      setWatermarkedImage(wm);
      await saveGeneration(user.id, generatedPrompt, imageUrl);
      fetchHistory(user.id).then(setHistory);
      setStep("result");
    } catch (err: any) {
      console.error("Generation error:", err);
      let message = "Falha ao gerar a imagem final. Por favor, tente novamente.";
      const errorStr = (err.message || "").toLowerCase();

      if (errorStr.includes("non-2xx") || errorStr.includes("402")) {
        message = "Capacidade de processamento atingida. O serviço estará disponível novamente em breve.";
      } else if (errorStr.includes("safety") || errorStr.includes("blocked")) {
        message = "Imagem bloqueada pelos filtros de segurança. Tente com outra foto.";
      } else if (errorStr.includes("429") || errorStr.includes("limite")) {
        message = "Muitas requisições em sequência. Aguarde alguns instantes e tente novamente.";
      } else if (errorStr.includes("fetch failed") || !navigator.onLine) {
        message = "Falha na conexão. Verifique sua internet e tente novamente.";
      }

      setError({ message, type: "gen" });
    } finally {
      setIsLoading(false);
      setIsScanning(null);
    }
  };

  const loadConfig = async () => {
    const { data } = await supabaseDb.from("app_config").select("lovable_url, lovable_anon_key").eq("id", 1).single();
    if (data) { setConfigUrl(data.lovable_url); setConfigKey(data.lovable_anon_key); }
  };

  const saveConfig = async () => {
    setConfigSaving(true);
    setConfigMsg(null);
    const { error } = await supabaseDb.from("app_config").upsert({ id: 1, lovable_url: configUrl, lovable_anon_key: configKey });
    setConfigSaving(false);
    if (error) {
      setConfigMsg("Erro ao salvar.");
    } else {
      setConfigMsg("Salvo! Recarregando...");
      setTimeout(() => window.location.reload(), 1500);
    }
    setTimeout(() => setConfigMsg(null), 3000);
  };

  const copyText = (text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  const downloadImage = async (src: string, filename: string) => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback: open in new tab
      window.open(src, "_blank");
    }
  };

  const reset = () => {
    setReferenceImage(null);
    setUserImage(null);
    setGeneratedPrompt("");
    setAnalysisDetails(null);
    setFinalImage(null);
    setWatermarkedImage(null);
    setStep("reference");
    setGerarMode(null);
  };

  const copyToClipboard = async () => {
    try {
      copyText(generatedPrompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30">
      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-8 left-6 right-6 md:left-auto md:right-8 md:w-96 z-[300] bg-red-500/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl overflow-hidden border border-white/10"
          >
            <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{error.message}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-900/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-[100] border-b border-white/5 backdrop-blur-md bg-[#050505]/90">
        <div className="max-w-5xl mx-auto p-6 flex justify-between items-center">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full bg-orange-500/30 blur-md"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.15, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                >
                  <Aperture className="w-10 h-10 text-orange-500 relative z-10" />
                </motion.div>
              </div>
              <h1 className="text-xl font-bold tracking-tight">FotoPrompts <span className="text-orange-500">AI</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-4 relative">
            <div className="hidden md:flex items-center text-xs uppercase tracking-widest text-white/40">
              <span>Passo {step === "reference" ? 1 : step === "prompt" ? 2 : step === "user-image" ? 3 : 4} de 4</span>
            </div>
            {creditInfo && (
              <span className="flex items-center gap-1 text-xs text-orange-500 font-bold tracking-widest">
                <Aperture className="w-3 h-3" />
                {creditInfo.credits} créditos
              </span>
            )}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors relative z-50"
            >
              {isMenuOpen ? <X className="w-5 h-5 text-white/60" /> : <Menu className="w-5 h-5 text-white/60" />}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto p-6 pt-24 pb-28">
        {/* Histórico view */}
        {view === "historico" && (
          <motion.div key="historico-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-2xl font-black tracking-tighter mb-6">Histórico</h2>
            {history.length === 0 ? (
              <p className="text-[11px] text-white/30 text-center py-12">Nenhuma geração ainda.</p>
            ) : (
              <div className="space-y-2">
                {history.map((g) => (
                  <div key={g.id} className="flex gap-3 bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden p-2">
                    {g.result_image_url && (
                      <img src={g.result_image_url} alt="" className="w-16 h-20 object-cover rounded-lg shrink-0" referrerPolicy="no-referrer" />
                    )}
                    <div className="flex flex-col flex-1 min-w-0 justify-between py-0.5">
                      <div>
                        <p className="text-[9px] text-white/20 mb-1">{new Date(g.created_at).toLocaleString("pt-BR")}</p>
                        <p className="text-[10px] text-white/50 leading-relaxed line-clamp-3">{g.prompt}</p>
                      </div>
                      <div className="flex gap-3 mt-2">
                        {g.result_image_url && (
                          <button onClick={() => downloadImage(g.result_image_url!, `retrato-${g.id.slice(0,6)}.png`)} className="flex items-center gap-1 text-[9px] text-white/40 hover:text-orange-400 transition-colors">
                            <Download className="w-3 h-3" /> Baixar
                          </button>
                        )}
                        <button onClick={() => copyText(g.prompt)} className="flex items-center gap-1 text-[9px] text-white/40 hover:text-orange-400 transition-colors">
                          <Copy className="w-3 h-3" /> Copiar prompt
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Albums view */}
        {view === "albums" && (
          <motion.div key="albums-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-2xl font-black tracking-tighter mb-6">Álbuns</h2>
            <AlbumsAdmin userId={user.id} />
          </motion.div>
        )}

        {/* Admin view */}
        {view === "admin" && user.email === ADMIN_EMAIL && (
          <motion.div key="admin-view" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <AdminPanel />
          </motion.div>
        )}

        {/* Gerar view */}
        {view === "gerar" && (
        <AnimatePresence mode="wait">

          {/* Tela de escolha do modo */}
          {!gerarMode && step === "reference" && (
            <motion.div
              key="choose-mode"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex flex-col gap-4"
            >
              <div className="mb-2">
                <p className="text-[10px] tracking-[0.3em] text-orange-500 font-bold uppercase mb-3">Novo Ensaio</p>
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase text-white leading-none">Por onde<br />começar?</h2>
              </div>

              <div className="flex flex-col gap-3 w-full mt-2">
                {/* Card referência */}
                <button
                  onClick={() => setGerarMode("referencia")}
                  className="group relative overflow-hidden rounded-2xl text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center gap-5 p-5"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-500" />
                  <div className="relative z-10 w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center shrink-0">
                    <Camera className="w-7 h-7 text-white" />
                  </div>
                  <div className="relative z-10 flex-1 text-left">
                    <span className="text-[9px] font-bold tracking-[0.25em] text-orange-200/60 block mb-0.5">01 — RECOMENDADO</span>
                    <h3 className="text-lg font-black tracking-tight text-white leading-tight">Analisar Referência</h3>
                    <p className="text-[11px] text-white/60 leading-relaxed mt-0.5">Envie uma foto, a IA extrai pose, iluminação e estilo.</p>
                  </div>
                  <ArrowRight className="relative z-10 w-5 h-5 text-white/50 shrink-0 group-hover:text-white transition-colors" />
                </button>

                {/* Card já tenho prompt */}
                <button
                  onClick={() => { setGerarMode("direto"); setStep("prompt"); }}
                  className="group relative overflow-hidden rounded-2xl text-left bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.07] transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center gap-5 p-5"
                >
                  <div className="w-14 h-14 bg-white/8 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-orange-500/15 transition-colors">
                    <FileText className="w-7 h-7 text-white/40 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="text-[9px] font-bold tracking-[0.25em] text-white/20 block mb-0.5">02 — TENHO MEU PROMPT</span>
                    <h3 className="text-lg font-black tracking-tight text-white leading-tight">Já tenho Prompt</h3>
                    <p className="text-[11px] text-white/40 leading-relaxed mt-0.5 group-hover:text-white/55 transition-colors">Cole ou escreva seu prompt e gere direto.</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/20 shrink-0 group-hover:text-white/50 transition-colors" />
                </button>
              </div>
            </motion.div>
          )}

          {gerarMode === "referencia" && step === "reference" && (
            <motion.div
              key="reference-base"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center"
            >
              <div>
                <button onClick={reset} className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 mb-5 transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" /> Voltar
                </button>
                <span className="text-orange-500 text-xs font-bold uppercase tracking-[0.3em] mb-4 block">Passo 01</span>
                <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter leading-[0.9] uppercase text-white">Foto de Referência</h2>
                <p className="text-white/50 text-base md:text-lg mb-8 leading-relaxed">
                  Escolha uma foto que tenha a pose, iluminação e ambiente que você deseja replicar. 
                  IA analisará cada detalhe para criar um blueprint perfeito.
                </p>
                <div className="flex flex-col gap-4">
                  {[
                    "Analisa pose corporal e passo",
                    "Extrai iluminação e gradação de cor",
                    "Identifica vestimenta e ambiente",
                    "Gera prompt completo",
                    "Hiper-Realismo"
                  ].map(item => (
                    <div key={item} className="flex items-center gap-3 text-white/40 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-orange-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-blue-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative z-10 aspect-[3/4] bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-8 transition-all hover:border-white/20">
                  {referenceImage ? (
                    <div className="relative w-full h-full">
                      <img src={referenceImage} alt="Ref" className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                      {isScanning === "reference" && <FaceScanOverlay />}
                      <button onClick={() => setReferenceImage(null)} className="absolute top-4 right-4 p-2 bg-black/60 rounded-full hover:bg-black/80 z-10"><RotateCcw className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Upload className="w-8 h-8 text-white/40" /></div>
                      <p className="text-white/60 font-medium mb-2">Arraste ou clique para enviar</p>
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, "reference")} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </>
                  )}
                </div>
                {referenceImage && (
                  <button onClick={analyzeReference} disabled={isLoading} className="relative z-30 w-full mt-6 py-4 bg-orange-500 text-white font-bold tracking-widest rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanSearch className="w-5 h-5" />}
                    {isLoading ? "Analisando..." : "Analisar referência"}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {step === "prompt" && (gerarMode === "direto" || analysisDetails) && (
            <motion.div key="prompt" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-4xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <button onClick={reset} className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 mb-3 transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" /> Voltar
                  </button>
                  <span className="text-orange-500 text-xs font-bold uppercase tracking-[0.3em] mb-2 block">
                    {gerarMode === "direto" ? "Passo 01" : "Passo 02"}
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">
                    {gerarMode === "direto" ? "Seu Prompt" : "Prompt Gerado"}
                  </h2>
                </div>
                <button
                  onClick={() => setStep("user-image")}
                  disabled={!generatedPrompt.trim()}
                  className="px-6 py-3 bg-zinc-900 border border-orange-500/30 rounded-full text-sm font-bold tracking-widest hover:bg-orange-500/10 disabled:opacity-30 flex items-center gap-2"
                >
                  Próximo passo <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-[10px] uppercase tracking-[0.3em] text-white/40 block">
                        {gerarMode === "direto" ? "Cole ou escreva seu prompt" : "Prompt"}
                      </label>
                      <button onClick={copyToClipboard} className="text-[10px] uppercase tracking-widest text-orange-500 hover:text-orange-400 flex items-center gap-2">
                        {isCopied ? "Copiado!" : "Copiar"} {isCopied ? <Check className="w-3" /> : <Copy className="w-3" />}
                      </button>
                    </div>
                    <textarea
                      value={generatedPrompt}
                      onChange={(e) => setGeneratedPrompt(e.target.value)}
                      readOnly={gerarMode === "referencia"}
                      placeholder={gerarMode === "direto" ? "Ex: A professional portrait photo of a woman in golden hour light, bokeh background, 85mm lens..." : undefined}
                      className="w-full h-64 bg-transparent border-none text-white/80 leading-relaxed resize-none font-mono text-sm focus:outline-none placeholder:text-white/20"
                    />
                  </div>
                </div>

                {referenceImage && (
                  <div className="space-y-6">
                    <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 opacity-50 filter grayscale">
                      <img src={referenceImage} alt="Ref" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === "user-image" && (
            <motion.div key="user-image" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div>
                <span className="text-orange-500 text-xs font-bold uppercase tracking-[0.3em] mb-4 block">Passo 03</span>
                <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter leading-[0.9] uppercase">Sua Foto</h2>
                <p className="text-white/50 text-base md:text-lg mb-8 leading-relaxed">
                  Agora envie uma foto nítida sua. Preservaremos seus traços faciais enquanto aplicamos o estilo de referência.
                </p>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h4 className="text-white/80 text-sm font-bold mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-orange-500" /> Melhores Resultados</h4>
                  <ul className="text-xs text-white/40 space-y-2">
                    <li>• Retrato nítido e bem iluminado</li>
                    <li>• Fundo neutro, se possível</li>
                    <li>• Olhando para a câmera</li>
                  </ul>
                </div>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-blue-500 rounded-2xl blur opacity-20 transition duration-1000"></div>
                <div className="relative z-10 aspect-[3/4] bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-8 transition-all hover:border-white/20">
                  {userImage ? (
                    <div className="relative w-full h-full">
                      <img src={userImage} alt="User" className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                      {isScanning === "user" && <FaceScanOverlay />}
                      <button onClick={() => setUserImage(null)} className="absolute top-4 right-4 p-2 bg-black/60 rounded-full hover:bg-black/80 z-10"><RotateCcw className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><User className="w-8 h-8 text-white/40" /></div>
                      <p className="text-white/60 font-medium mb-2">Envie seu retrato</p>
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, "user")} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </>
                  )}
                </div>
                {userImage && (
                  <button onClick={generateFinalImage} disabled={isLoading} className="relative z-30 w-full mt-6 py-4 bg-orange-500 text-white font-bold tracking-widest rounded-xl hover:bg-orange-600 flex items-center justify-center gap-2">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {isLoading ? "Gerando..." : "Gerar retrato"}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {step === "result" && finalImage && (
            <motion.div key="result" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
              <div className="mb-8 md:mb-12 text-center text-white">
                <span className="text-orange-500 text-xs font-bold uppercase tracking-[0.3em] mb-4 block">Resultado Final</span>
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter uppercase leading-none">Gerado</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 w-full">
                <div className="lg:col-span-3">
                  <div className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                    <img src={watermarkedImage ?? finalImage!} alt="Final" className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => downloadImage(finalImage!, "retrato-refinado.png")} title="Baixar original" className="w-11 h-11 shrink-0 bg-orange-500 text-white hover:bg-orange-600 transition-colors rounded-full flex items-center justify-center">
                      <Download className="w-4 h-4" />
                    </button>
                    {watermarkedImage && (
                      <button onClick={() => downloadImage(watermarkedImage, "retrato-cliente.png")} className="flex-1 py-3 bg-zinc-700 text-white/80 font-bold tracking-widest rounded-full text-xs hover:bg-zinc-600 transition-colors flex items-center justify-center gap-2">
                        <Aperture className="w-3.5 h-3.5" /> Baixar c/ Marca d'água
                      </button>
                    )}
                    <button onClick={reset} title="Recomeçar" className="w-11 h-11 shrink-0 bg-zinc-800 text-white/70 hover:bg-zinc-700 transition-colors rounded-full flex items-center justify-center">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {referenceImage && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                      <h4 className="text-[10px] uppercase tracking-widest text-white/40 mb-4">Referência Usada</h4>
                      <div className="aspect-[3/4] rounded-lg overflow-hidden grayscale opacity-30">
                        <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                  )}
                  {userImage && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                      <h4 className="text-[10px] uppercase tracking-widest text-white/40 mb-4">Foto Original</h4>
                      <div className="aspect-[3/4] rounded-lg overflow-hidden grayscale opacity-30">
                        <img src={userImage} alt="Original" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-[200] bg-[#050505] border-t border-white/8 flex items-center justify-around">
        <button
          onClick={() => setView("gerar")}
          className={`flex flex-col items-center gap-1.5 py-4 px-6 transition-colors ${view === "gerar" ? "text-orange-500" : "text-white/30 hover:text-white/60"}`}
        >
          <Aperture className="w-6 h-6" />
          <span className="text-[10px] font-bold tracking-widest">GERAR</span>
        </button>
        <button
          onClick={() => setView("historico")}
          className={`flex flex-col items-center gap-1.5 py-4 px-6 transition-colors ${view === "historico" ? "text-orange-500" : "text-white/30 hover:text-white/60"}`}
        >
          <Eye className="w-6 h-6" />
          <span className="text-[10px] font-bold tracking-widest">HISTÓRICO</span>
        </button>
        <button
          onClick={() => setView("albums")}
          className={`flex flex-col items-center gap-1.5 py-4 px-6 transition-colors ${view === "albums" ? "text-orange-500" : "text-white/30 hover:text-white/60"}`}
        >
          <Layers className="w-6 h-6" />
          <span className="text-[10px] font-bold tracking-widest">ÁLBUNS</span>
        </button>
        {user.email === ADMIN_EMAIL && (
          <button
            onClick={() => setView("admin")}
            className={`flex flex-col items-center gap-1.5 py-4 px-6 transition-colors ${view === "admin" ? "text-orange-500" : "text-white/30 hover:text-white/60"}`}
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-[10px] font-bold tracking-widest">ADMIN</span>
          </button>
        )}
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[201]" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed top-0 right-0 bottom-0 w-[70%] md:w-1/2 bg-[#0a0a0a] border-l border-white/10 z-[202] shadow-2xl p-8 flex flex-col">
              <div className="flex justify-between items-center mb-8">
                {activeMenuSection && <button onClick={() => setActiveMenuSection(null)} className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-full transition-colors group"><ChevronLeft className="w-4 h-4 text-white/40 group-hover:text-orange-500" /></button>}
                <button onClick={() => { setIsMenuOpen(false); setActiveMenuSection(null); }} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X className="w-5 h-5 text-white/40" /></button>
              </div>
              <AnimatePresence mode="wait">
                {!activeMenuSection ? (
                  <motion.div key="main-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.1 }} className="flex flex-col">
                    <button onClick={() => setActiveMenuSection("criador")} className="w-full flex items-center justify-between py-4 border-b border-white/5 hover:pl-2 transition-all group">
                      <div className="flex items-center gap-3"><User className="w-4 h-4 text-white/40 group-hover:text-orange-500 transition-colors" /><span className="text-[10px] font-bold tracking-[0.2em] text-white/60 group-hover:text-white transition-colors">Criador</span></div>
                      <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-orange-500 transition-colors" />
                    </button>
                    <button onClick={() => setActiveMenuSection("funcoes")} className="w-full flex items-center justify-between py-4 border-b border-white/5 hover:pl-2 transition-all group">
                      <div className="flex items-center gap-3"><Cpu className="w-4 h-4 text-white/40 group-hover:text-orange-500 transition-colors" /><span className="text-[10px] font-bold tracking-[0.2em] text-white/60 group-hover:text-white transition-colors">Funções</span></div>
                      <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-orange-500 transition-colors" />
                    </button>
                    <a href="https://wa.me/5515992568868?text=Olá Leoclécio, gostaria de saber mais sobre o FotoPrompts AI." target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between py-4 border-b border-white/5 hover:pl-2 transition-all group">
                      <div className="flex items-center gap-3"><WhatsAppIcon className="w-4 h-4 text-white/40 group-hover:text-orange-500 transition-colors" /><span className="text-[10px] font-bold tracking-[0.2em] text-white/60 group-hover:text-white transition-colors">WhatsApp</span></div>
                      <ArrowRight className="w-3 h-3 text-white/20 group-hover:text-orange-500 transition-colors" />
                    </a>
                    <div className="pt-8 mt-auto">
                      <p className="text-[8px] tracking-[0.2em] text-white/20 mb-1 uppercase">Logado como</p>
                      <p className="text-[10px] text-white/40 mb-4 truncate">{user.email}</p>
                      <button
                        onClick={async () => { await signOut(); setIsMenuOpen(false); }}
                        className="w-full py-3 border border-red-500/20 text-red-400 text-[10px] font-bold tracking-widest rounded-xl hover:bg-red-500/10 transition-colors"
                      >
                        Sair da conta
                      </button>
                    </div>
                  </motion.div>
                ) : activeMenuSection === "criador" ? (
                  <motion.div key="criador-info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="flex flex-col overflow-y-auto scrollbar-hide">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20 mb-4 shrink-0"><User className="w-5 h-5 text-orange-500" /></div>
                    <h3 className="text-lg font-bold tracking-tighter mb-3 shrink-0">Desenvolvimento</h3>
                    <p className="text-[11px] text-white/60 leading-relaxed mb-4">FotoPrompts AI foi concebido e desenvolvido por <span className="text-orange-500">Leoclécio Ambrosio</span>.</p>
                    <div className="space-y-3 mb-6">
                      <div>
                        <span className="block text-[8px] tracking-widest text-white/20 mb-1">Contato</span>
                        <div className="flex items-center gap-2">
                          <WhatsAppIcon className="w-3 h-3 text-orange-500" />
                          <p className="text-[10px] text-white/50">WhatsApp: (15) 99256-8868</p>
                        </div>
                      </div>
                      <div>
                        <span className="block text-[8px] tracking-widest text-white/20 mb-1">Missão</span>
                        <p className="text-[10px] text-white/50 leading-relaxed">Democratizar o acesso a ferramentas de estética visual de alto nível, unindo inteligência artificial e direção de arte.</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-white/5 mt-auto">
                      <div className="flex items-center justify-between text-[8px] tracking-widest text-white/20">
                        <span>Versão</span><span className="text-orange-500/50">1.0.4 Stable</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="funcoes-info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="flex flex-col overflow-y-auto scrollbar-hide">
                    <div className="w-10 h-10 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20 mb-4 shrink-0"><Cpu className="w-5 h-5 text-orange-500" /></div>
                    <h3 className="text-lg font-bold tracking-tighter mb-4 shrink-0">Capacidades do Sistema</h3>
                    <div className="space-y-6 pb-4">
                      {[
                        { n: "01", title: "Análise de Referência", desc: "O sistema decompõe imagens de referência em metadados técnicos, identificando esquemas de iluminação, profundidade de campo e composição." },
                        { n: "02", title: "Engenharia de Prompt", desc: "Traduz conceitos visuais subjetivos em linguagem de máquina otimizada, utilizando termos técnicos de fotografia e cinema." },
                        { n: "03", title: "Transformação de Estilo", desc: "Aplica o \"Style Transfer\" avançado, onde a estrutura facial do usuário é preservada enquanto o ambiente é reconstruído." },
                        { n: "04", title: "Processamento Gemini", desc: "Utiliza a arquitetura multimodal do Gemini para entender nuances contextuais e garantir fidelidade visual." }
                      ].map(item => (
                        <div key={item.n} className="group">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-bold text-orange-500/50">{item.n}</span>
                            <span className="text-[9px] font-bold tracking-widest text-white/80">{item.title}</span>
                          </div>
                          <p className="text-[10px] text-white/40 leading-relaxed pl-5">{item.desc}</p>
                        </div>
                      ))}
                      <div className="pt-2">
                        <span className="block text-[8px] tracking-widest text-white/20 mb-2">Stack Tecnológico</span>
                        <div className="flex flex-wrap gap-1.5">
                          {["Gemini Flash", "Vision API", "React", "Tailwind"].map(tech => (
                            <span key={tech} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[7px] tracking-widest text-white/30">{tech}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
