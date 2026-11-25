import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RotateCcw,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import codeGsTemplate from '../../apps-script/Code.gs?raw';
import { extratorConfig, obterExtratorConfigAtiva } from '../config';
import {
  testarConexaoExtrator,
  type ResultadoDiagnosticoExtrator,
} from '../services/extratorService';
import {
  gerarCodigoAppsScriptComToken,
  gerarTokenSeguroExtrator,
  limparConfigExtratorLocal,
  salvarConfigExtratorLocal,
  validarUrlAppsScript,
  type OrigemConfigExtrator,
} from '../utils/extratorConfig';

interface ExtratorConfigModalProps {
  aberto: boolean;
  onFechar: () => void;
  onToast: (tipo: 'sucesso' | 'erro', mensagem: string) => void;
  onConfigAtualizada?: () => void;
}

function textoOrigem(origem: OrigemConfigExtrator): {
  label: string;
  classe: string;
} {
  if (origem === 'navegador') {
    return {
      label: 'Salvo neste navegador',
      classe: 'border-[#22C55E]/40 bg-[#122616] text-[#86EFAC]',
    };
  }
  if (origem === 'ambiente') {
    return {
      label: 'Padrão do GitHub / Build',
      classe: 'border-slate-600/50 bg-slate-800/60 text-slate-200',
    };
  }
  return {
    label: 'Não configurado',
    classe: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  };
}

export function ExtratorConfigModal({
  aberto,
  onFechar,
  onToast,
  onConfigAtualizada,
}: ExtratorConfigModalProps) {
  const [urlInput, setUrlInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [mostrarToken, setMostrarToken] = useState(false);
  const [origemAtual, setOrigemAtual] = useState<OrigemConfigExtrator>('nao_configurado');
  const [temOverrideLocal, setTemOverrideLocal] = useState(false);
  const [testando, setTestando] = useState(false);
  const [diagnostico, setDiagnostico] = useState<ResultadoDiagnosticoExtrator | null>(null);
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);
  const [copiadoLinha, setCopiadoLinha] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const ativa = obterExtratorConfigAtiva();
    setUrlInput(ativa.url);
    setTokenInput(ativa.token);
    setOrigemAtual(ativa.origem);
    setTemOverrideLocal(ativa.temOverrideLocal);
    setDiagnostico(null);
    setMostrarToken(false);
    setCopiadoCodigo(false);
    setCopiadoLinha(false);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !testando) {
        onFechar();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aberto, testando, onFechar]);

  if (!aberto) return null;

  const validacaoUrl = urlInput.trim() ? validarUrlAppsScript(urlInput) : null;
  const origemBadge = textoOrigem(origemAtual);
  const tokenEfetivo = tokenInput.trim();
  const linhaTokenPreview = `var TOKEN_SECRETO = '${tokenEfetivo
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")}';`;

  const copiarTexto = async (texto: string, tipo: 'codigo' | 'linha') => {
    try {
      await navigator.clipboard.writeText(texto);
      if (tipo === 'codigo') {
        setCopiadoCodigo(true);
        window.setTimeout(() => setCopiadoCodigo(false), 2500);
        onToast('sucesso', 'Código completo do Code.gs copiado já com seu token!');
      } else {
        setCopiadoLinha(true);
        window.setTimeout(() => setCopiadoLinha(false), 2500);
        onToast('sucesso', 'Linha TOKEN_SECRETO copiada.');
      }
    } catch {
      onToast('erro', 'Não foi possível copiar automaticamente neste navegador.');
    }
  };

  const handleGerarToken = () => {
    const novo = gerarTokenSeguroExtrator();
    setTokenInput(novo);
    setMostrarToken(true);
    setDiagnostico(null);
  };

  const handleSalvarETestar = async () => {
    const urlLimpa = urlInput.trim();
    const tokenLimpo = tokenInput.trim();

    salvarConfigExtratorLocal(urlLimpa, tokenLimpo);
    const ativa = obterExtratorConfigAtiva();
    setOrigemAtual(ativa.origem);
    setTemOverrideLocal(ativa.temOverrideLocal);
    onConfigAtualizada?.();

    setTestando(true);
    setDiagnostico(null);
    try {
      const resultado = await testarConexaoExtrator(urlLimpa, tokenLimpo);
      setDiagnostico(resultado);
      if (resultado.ok) {
        onToast('sucesso', 'Extrator salvo e validado com sucesso!');
      } else {
        onToast('erro', resultado.titulo);
      }
    } finally {
      setTestando(false);
    }
  };

  const handleSalvarSemTestar = () => {
    const urlLimpa = urlInput.trim();
    const tokenLimpo = tokenInput.trim();
    const valid = validarUrlAppsScript(urlLimpa);
    if (!valid.valida) {
      onToast('erro', valid.erro ?? 'URL inválida.');
      return;
    }
    if (!tokenLimpo) {
      onToast('erro', 'Informe o token do extrator.');
      return;
    }
    salvarConfigExtratorLocal(urlLimpa, tokenLimpo);
    const ativa = obterExtratorConfigAtiva();
    setOrigemAtual(ativa.origem);
    setTemOverrideLocal(ativa.temOverrideLocal);
    onConfigAtualizada?.();
    onToast('sucesso', 'Configuração do extrator salva neste navegador.');
    onFechar();
  };

  const handleRestaurarPadrao = () => {
    limparConfigExtratorLocal();
    const ativa = obterExtratorConfigAtiva();
    setUrlInput(ativa.url);
    setTokenInput(ativa.token);
    setOrigemAtual(ativa.origem);
    setTemOverrideLocal(ativa.temOverrideLocal);
    setDiagnostico(null);
    onConfigAtualizada?.();
    onToast('sucesso', 'Configuração restaurada para o padrão do build.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="extrator-config-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-xl border border-[#1E2A20] bg-[#0F1410] p-5 sm:p-6 space-y-5 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E] shrink-0">
              <Settings2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="extrator-config-title" className="text-base font-bold text-white">
                  Configurar e testar extrator (Apps Script)
                </h2>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${origemBadge.classe}`}
                >
                  {origemBadge.label}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Salve a URL <code className="text-slate-300">/exec</code> e o token aqui para funcionar imediatamente, sem precisar esperar deploy no GitHub.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFechar}
            disabled={testando}
            aria-label="Fechar configuração do extrator"
            className="p-1.5 rounded-lg border border-[#1E2A20] bg-[#070A07] text-slate-400 hover:text-white cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="extrator-config-url"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              URL do Web App do Google Apps Script (/exec)
            </label>
            <input
              id="extrator-config-url"
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setDiagnostico(null);
              }}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              className="w-full rounded-lg border border-[#1E2A20] bg-[#070A07] px-3 py-2.5 text-sm font-mono text-white placeholder:font-sans placeholder:text-slate-500 focus:outline-none focus:border-[#22C55E]"
            />
            {validacaoUrl?.erro && (
              <p className="mt-1.5 text-xs text-red-400">{validacaoUrl.erro}</p>
            )}
            {validacaoUrl?.aviso && (
              <p className="mt-1.5 text-xs text-amber-300">{validacaoUrl.aviso}</p>
            )}
            {!extratorConfig.url && (
              <p className="mt-1 text-[11px] text-slate-400">
                Copie em Apps Script &gt; Implantar &gt; Gerenciar implantações &gt; URL do app da Web.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="extrator-config-token"
                className="block text-xs font-medium text-slate-300"
              >
                Token secreto (deve ser igual ao TOKEN_SECRETO do Code.gs)
              </label>
              <button
                type="button"
                onClick={handleGerarToken}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#86EFAC] hover:text-[#4ADE80] cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                Gerar token forte
              </button>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="extrator-config-token"
                type={mostrarToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setDiagnostico(null);
                }}
                placeholder="Cole ou gere seu token sem aspas"
                className="w-full rounded-lg border border-[#1E2A20] bg-[#070A07] pl-9 pr-10 py-2.5 text-sm font-mono text-white placeholder:font-sans placeholder:text-slate-500 focus:outline-none focus:border-[#22C55E]"
              />
              <button
                type="button"
                onClick={() => setMostrarToken((prev) => !prev)}
                aria-label={mostrarToken ? 'Ocultar token' : 'Mostrar token'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                {mostrarToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {diagnostico && (
          <div
            role="status"
            className={`rounded-xl border p-4 space-y-1.5 text-xs ${
              diagnostico.ok
                ? 'border-[#22C55E]/40 bg-[#0A180D] text-[#BBF7D0]'
                : 'border-red-500/40 bg-red-500/10 text-red-100'
            }`}
          >
            <p className="font-semibold flex items-center gap-2">
              {diagnostico.ok ? (
                <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{diagnostico.titulo}</span>
            </p>
            <p className="text-slate-200/90 leading-relaxed pl-6">{diagnostico.detalhe}</p>
          </div>
        )}

        <div className="rounded-xl border border-[#1E2A20] bg-[#070A07] p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold text-white">
                Passo rápido para atualizar o Google Apps Script sem erro
              </h3>
              <p className="text-[11px] text-slate-400">
                O botão abaixo copia o <code className="text-slate-300">Code.gs</code> inteiro já com seu token preenchido na linha correta.
              </p>
            </div>
            <button
              type="button"
              disabled={!tokenEfetivo}
              onClick={() =>
                void copiarTexto(
                  gerarCodigoAppsScriptComToken(codeGsTemplate, tokenEfetivo),
                  'codigo'
                )
              }
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#22C55E]/40 bg-[#122616] hover:bg-[#19331F] text-xs font-semibold text-[#86EFAC] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              {copiadoCodigo ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiadoCodigo ? 'Code.gs copiado!' : 'Copiar Code.gs pronto'}</span>
            </button>
          </div>

          {tokenEfetivo && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1E2A20] bg-[#0B100C] px-3 py-2">
              <code className="text-[11px] text-[#86EFAC] truncate">
                {mostrarToken
                  ? linhaTokenPreview
                  : "var TOKEN_SECRETO = '••••••••••••';"}
              </code>
              <button
                type="button"
                onClick={() => void copiarTexto(linhaTokenPreview, 'linha')}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-white cursor-pointer shrink-0"
              >
                {copiadoLinha ? <Check className="w-3 h-3 text-[#22C55E]" /> : <Copy className="w-3 h-3" />}
                <span>{copiadoLinha ? 'Copiada' : 'Copiar linha'}</span>
              </button>
            </div>
          )}

          <ol className="text-[11px] text-slate-300 space-y-1 list-decimal list-inside leading-relaxed">
            <li>
              Cole no arquivo <code className="text-slate-200">Code.gs</code> em{' '}
              <span className="text-white font-medium">script.google.com</span> e aperte{' '}
              <span className="text-white font-medium">Ctrl+S</span>.
            </li>
            <li>
              Clique em <span className="text-white font-medium">Implantar &gt; Gerenciar implantações &gt; Editar (lápis) &gt; Versão: Nova versão &gt; Implantar</span>.
            </li>
            <li>
              Se você clicou em <em>Nova implantação</em> antes, copie a nova URL <code className="text-slate-200">/exec</code> e cole no campo acima.
            </li>
          </ol>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#1E2A20]">
          <div className="flex items-center gap-2">
            {temOverrideLocal && (
              <button
                type="button"
                onClick={handleRestaurarPadrao}
                disabled={testando}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1E2A20] bg-[#070A07] hover:bg-[#161E17] text-xs font-medium text-slate-300 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar padrão do GitHub
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleSalvarSemTestar}
              disabled={testando}
              className="px-3.5 py-2 rounded-lg border border-[#1E2A20] bg-[#070A07] hover:bg-[#161E17] text-xs sm:text-sm font-medium text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              Salvar e fechar
            </button>
            <button
              type="button"
              onClick={() => void handleSalvarETestar()}
              disabled={testando}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-bold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {testando && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{testando ? 'Testando conexão...' : 'Salvar e testar conexão'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
