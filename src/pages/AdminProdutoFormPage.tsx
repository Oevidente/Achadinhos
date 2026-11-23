import { type FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Link2, Loader2, Sparkles } from 'lucide-react';
import { CardProduto } from '../components/CardProduto';
import { extrairDadosDoLink, type ConfiancaPreco } from '../services/extratorService';
import {
  atualizarProduto,
  buscarProduto,
  criarProduto,
} from '../services/produtosService';
import {
  PLATAFORMAS,
  STATUS_PRODUTO,
  type OrigemDadosProduto,
  type Plataforma,
  type StatusProduto,
} from '../types/produto';
import {
  isHttpsUrl,
  parsePrecoInput,
  validarFormularioProduto,
  type ProdutoFormErros,
  type ProdutoFormState,
} from '../utils/adminHelpers';
import { formatarPrecoParaInput } from '../utils/extratorHelpers';
import { detectarPlataforma, PLATAFORMAS_CONFIG } from '../utils/plataformas';

interface AdminProdutoFormPageProps {
  produtoId?: string;
  onNavigate: (path: string) => void;
  onToast: (tipo: 'sucesso' | 'erro', mensagem: string) => void;
}

const ESTADO_INICIAL: ProdutoFormState = {
  linkOriginal: '',
  plataforma: 'outra',
  titulo: '',
  descricao: '',
  imagemUrl: '',
  precoAtual: '',
  precoOriginal: '',
  linkAfiliado: '',
  status: 'ativo',
  destaque: false,
  validoAte: '',
};

export function AdminProdutoFormPage({
  produtoId,
  onNavigate,
  onToast,
}: AdminProdutoFormPageProps) {
  const modoEdicao = Boolean(produtoId);

  const [form, setForm] = useState<ProdutoFormState>(ESTADO_INICIAL);
  const [erros, setErros] = useState<ProdutoFormErros>({});
  const [carregandoProduto, setCarregandoProduto] = useState(modoEdicao);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [extraindo, setExtraindo] = useState(false);
  const [origemDados, setOrigemDados] = useState<OrigemDadosProduto>('manual');
  const [camposExtraidos, setCamposExtraidos] = useState<Set<keyof ProdutoFormState>>(
    () => new Set()
  );
  const [confiancaPreco, setConfiancaPreco] = useState<ConfiancaPreco | null>(null);

  useEffect(() => {
    if (!produtoId) {
      setForm(ESTADO_INICIAL);
      setErros({});
      setCarregandoProduto(false);
      setErroCarga(null);
      setOrigemDados('manual');
      setCamposExtraidos(new Set());
      setConfiancaPreco(null);
      return;
    }

    let ativo = true;
    const carregar = async () => {
      setCarregandoProduto(true);
      setErroCarga(null);
      try {
        const produto = await buscarProduto(produtoId);
        if (!ativo) return;
        if (!produto) {
          setErroCarga('Produto não encontrado.');
          return;
        }
        setForm({
          linkOriginal: produto.linkOriginal,
          plataforma: produto.plataforma,
          titulo: produto.titulo,
          descricao: produto.descricao,
          imagemUrl: produto.imagemUrl,
          precoAtual: String(produto.precoAtual),
          precoOriginal: produto.precoOriginal !== null ? String(produto.precoOriginal) : '',
          linkAfiliado: produto.linkAfiliado ?? '',
          status: produto.status,
          destaque: produto.destaque,
          validoAte: produto.validoAte ?? '',
        });
        setOrigemDados(produto.origemDados);
        setCamposExtraidos(new Set());
        setConfiancaPreco(null);
      } catch {
        if (!ativo) return;
        setErroCarga('Não foi possível carregar os dados do produto.');
      } finally {
        if (ativo) setCarregandoProduto(false);
      }
    };

    void carregar();
    return () => {
      ativo = false;
    };
  }, [produtoId]);

  const handleLinkOriginalChange = (novoLink: string) => {
    const plataformaAuto = detectarPlataforma(novoLink);
    setForm((prev) => ({
      ...prev,
      linkOriginal: novoLink,
      plataforma: novoLink.trim() ? plataformaAuto : prev.plataforma,
    }));

    if (novoLink.trim() && !isHttpsUrl(novoLink)) {
      setErros((prev) => ({
        ...prev,
        linkOriginal: 'Informe uma URL válida iniciando com https://',
      }));
    } else {
      setErros((prev) => {
        const copia = { ...prev };
        delete copia.linkOriginal;
        return copia;
      });
    }
  };

  const atualizarCampo = <K extends keyof ProdutoFormState>(
    campo: K,
    valor: ProdutoFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    if (erros[campo]) {
      setErros((prev) => {
        const copia = { ...prev };
        delete copia[campo];
        return copia;
      });
    }
    if (campo === 'precoAtual' && confiancaPreco) {
      setConfiancaPreco(null);
    }
  };

  const handleBuscarDadosDoLink = async () => {
    setExtraindo(true);
    try {
      const extraido = await extrairDadosDoLink(form.linkOriginal);
      const preenchidos = new Set<keyof ProdutoFormState>();

      setForm((prev) => {
        const precoAtualFmt = formatarPrecoParaInput(extraido.precoAtual);
        const precoOrigFmt = formatarPrecoParaInput(extraido.precoOriginal);

        if (extraido.titulo) preenchidos.add('titulo');
        if (extraido.descricao) preenchidos.add('descricao');
        if (extraido.imagemUrl) preenchidos.add('imagemUrl');
        if (precoAtualFmt) preenchidos.add('precoAtual');
        if (precoOrigFmt) preenchidos.add('precoOriginal');
        preenchidos.add('plataforma');

        return {
          ...prev,
          plataforma: extraido.plataforma,
          titulo: extraido.titulo || prev.titulo,
          descricao: extraido.descricao || prev.descricao,
          imagemUrl: extraido.imagemUrl || prev.imagemUrl,
          precoAtual: precoAtualFmt || prev.precoAtual,
          precoOriginal: precoOrigFmt || prev.precoOriginal,
        };
      });

      setCamposExtraidos(preenchidos);
      setConfiancaPreco(extraido.confiancaPreco);
      setOrigemDados('automatico');
      setErros({});

      if (extraido.confiancaPreco === 'baixa' || extraido.confiancaPreco === 'nao_encontrado') {
        onToast('sucesso', 'Dados preenchidos. Confere o preço antes de salvar.');
      } else {
        onToast('sucesso', 'Dados preenchidos pelo extrator. Revise antes de salvar.');
      }
    } catch (error) {
      const motivo =
        error instanceof Error
          ? error.message
          : 'Não foi possível extrair os dados do link. Preencha manualmente.';
      onToast('erro', motivo);
    } finally {
      setExtraindo(false);
    }
  };

  const classeCampoExtraido = (campo: keyof ProdutoFormState, temErro: boolean) => {
    if (temErro) return 'border-red-500 focus:border-red-400 bg-[#070A07]';
    if (
      campo === 'precoAtual' &&
      (confiancaPreco === 'baixa' || confiancaPreco === 'nao_encontrado')
    ) {
      return 'border-amber-400 bg-amber-500/10 focus:border-amber-300';
    }
    if (camposExtraidos.has(campo)) {
      return 'border-[#22C55E]/50 bg-[#0A170D] focus:border-[#22C55E]';
    }
    return 'border-[#1E2A20] bg-[#070A07] focus:border-[#22C55E]';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validacao = validarFormularioProduto(form);
    if (!validacao.valido) {
      setErros(validacao.erros);
      onToast('erro', 'Revise os campos destacados antes de salvar.');
      return;
    }

    setSalvando(true);
    try {
      if (modoEdicao && produtoId) {
        await atualizarProduto(produtoId, {
          linkOriginal: form.linkOriginal,
          plataforma: form.plataforma,
          titulo: form.titulo,
          descricao: form.descricao,
          imagemUrl: form.imagemUrl,
          precoAtual: validacao.precoAtualNum,
          precoOriginal: validacao.precoOriginalNum,
          linkAfiliado: form.linkAfiliado.trim() || null,
          status: form.status,
          destaque: form.destaque,
          validoAte: validacao.validoAteValor,
          origemDados,
        });
        onToast('sucesso', 'Produto atualizado com sucesso.');
      } else {
        await criarProduto({
          linkOriginal: form.linkOriginal,
          plataforma: form.plataforma,
          titulo: form.titulo,
          descricao: form.descricao,
          imagemUrl: form.imagemUrl,
          precoAtual: validacao.precoAtualNum,
          precoOriginal: validacao.precoOriginalNum,
          linkAfiliado: form.linkAfiliado.trim() || null,
          status: form.status,
          destaque: form.destaque,
          validoAte: validacao.validoAteValor,
          origemDados,
        });
        onToast('sucesso', 'Produto cadastrado com sucesso.');
      }
      onNavigate('/admin');
    } catch {
      onToast(
        'erro',
        'Não foi possível salvar o produto. Verifique sua conexão; os dados continuam preenchidos.'
      );
    } finally {
      setSalvando(false);
    }
  };

  if (carregandoProduto) {
    return (
      <div className="rounded-xl border border-[#1E2A20] bg-[#0F1410] p-10 flex items-center justify-center gap-3 text-sm text-slate-300">
        <Loader2 className="w-4 h-4 animate-spin text-[#22C55E]" />
        Carregando dados do produto...
      </div>
    );
  }

  if (erroCarga) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 space-y-4">
        <p className="text-sm text-red-200">{erroCarga}</p>
        <button
          type="button"
          onClick={() => onNavigate('/admin')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1E2A20] bg-[#0F1410] text-sm font-medium text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para a lista
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para produtos
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {modoEdicao ? 'Editar produto' : 'Novo produto'}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-7 rounded-xl border border-[#1E2A20] bg-[#0F1410] p-5 sm:p-6 space-y-5"
        >
          {/* Destaque no topo: Link do produto + Plataforma + Botão "Em breve" */}
          <div className="rounded-xl border border-[#22C55E]/30 bg-[#09120B] p-4 space-y-4">
            <div>
              <label
                htmlFor="campo-link-original"
                className="block text-sm font-semibold text-white mb-1.5"
              >
                Link do produto *
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="campo-link-original"
                    type="url"
                    value={form.linkOriginal}
                    onChange={(e) => handleLinkOriginalChange(e.target.value)}
                    placeholder="https://s.shopee.com.br/..."
                    className={`w-full rounded-lg border bg-[#070A07] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none ${
                      erros.linkOriginal
                        ? 'border-red-500 focus:border-red-400'
                        : 'border-[#1E2A20] focus:border-[#22C55E]'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleBuscarDadosDoLink()}
                  disabled={extraindo || salvando || !form.linkOriginal.trim()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#22C55E]/40 bg-[#122616] hover:bg-[#19331F] text-xs font-semibold text-[#86EFAC] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                >
                  {extraindo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{extraindo ? 'Buscando dados...' : 'Buscar dados do link'}</span>
                </button>
              </div>
              {erros.linkOriginal && (
                <p className="mt-1.5 text-xs text-red-400">{erros.linkOriginal}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="campo-plataforma"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Plataforma (detectada automaticamente)
              </label>
              <select
                id="campo-plataforma"
                value={form.plataforma}
                onChange={(e) =>
                  atualizarCampo('plataforma', e.target.value as Plataforma)
                }
                className={`w-full sm:w-64 rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${classeCampoExtraido(
                  'plataforma',
                  false
                )}`}
              >
                {PLATAFORMAS.map((platId) => (
                  <option key={platId} value={platId}>
                    {PLATAFORMAS_CONFIG[platId].nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="campo-titulo"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Título *
              </label>
              <input
                id="campo-titulo"
                type="text"
                value={form.titulo}
                onChange={(e) => atualizarCampo('titulo', e.target.value)}
                placeholder="Ex.: Fone de Ouvido Bluetooth TWS"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none ${classeCampoExtraido(
                  'titulo',
                  Boolean(erros.titulo)
                )}`}
              />
              {erros.titulo && (
                <p className="mt-1 text-xs text-red-400">{erros.titulo}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="campo-descricao"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Descrição
              </label>
              <textarea
                id="campo-descricao"
                rows={3}
                value={form.descricao}
                onChange={(e) => atualizarCampo('descricao', e.target.value)}
                placeholder="Detalhes principais da oferta ou especificações..."
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none ${classeCampoExtraido(
                  'descricao',
                  Boolean(erros.descricao)
                )}`}
              />
              {erros.descricao && (
                <p className="mt-1 text-xs text-red-400">{erros.descricao}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="campo-imagem"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                URL da imagem *
              </label>
              <input
                id="campo-imagem"
                type="url"
                value={form.imagemUrl}
                onChange={(e) => atualizarCampo('imagemUrl', e.target.value)}
                placeholder="https://..."
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none ${classeCampoExtraido(
                  'imagemUrl',
                  Boolean(erros.imagemUrl)
                )}`}
              />
              {erros.imagemUrl && (
                <p className="mt-1 text-xs text-red-400">{erros.imagemUrl}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="campo-preco-atual"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Preço atual (R$) *
                </label>
                <input
                  id="campo-preco-atual"
                  type="text"
                  inputMode="decimal"
                  value={form.precoAtual}
                  onChange={(e) => atualizarCampo('precoAtual', e.target.value)}
                  placeholder="99,90"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white tabular-nums placeholder:text-slate-500 focus:outline-none ${classeCampoExtraido(
                    'precoAtual',
                    Boolean(erros.precoAtual)
                  )}`}
                />
                {erros.precoAtual ? (
                  <p className="mt-1 text-xs text-red-400">{erros.precoAtual}</p>
                ) : (
                  (confiancaPreco === 'baixa' || confiancaPreco === 'nao_encontrado') && (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Confere o preço antes de salvar</span>
                    </p>
                  )
                )}
              </div>

              <div>
                <label
                  htmlFor="campo-preco-original"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Preço original (opcional)
                </label>
                <input
                  id="campo-preco-original"
                  type="text"
                  inputMode="decimal"
                  value={form.precoOriginal}
                  onChange={(e) => atualizarCampo('precoOriginal', e.target.value)}
                  placeholder="149,90"
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm text-white tabular-nums placeholder:text-slate-500 focus:outline-none ${classeCampoExtraido(
                    'precoOriginal',
                    Boolean(erros.precoOriginal)
                  )}`}
                />
                {erros.precoOriginal && (
                  <p className="mt-1 text-xs text-red-400">{erros.precoOriginal}</p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="campo-link-afiliado"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Link de afiliado (opcional)
              </label>
              <input
                id="campo-link-afiliado"
                type="url"
                value={form.linkAfiliado}
                onChange={(e) => atualizarCampo('linkAfiliado', e.target.value)}
                placeholder="https://..."
                className={`w-full rounded-lg border bg-[#070A07] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none ${
                  erros.linkAfiliado
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-[#1E2A20] focus:border-[#22C55E]'
                }`}
              />
              {erros.linkAfiliado && (
                <p className="mt-1 text-xs text-red-400">{erros.linkAfiliado}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start pt-1">
              <div>
                <label
                  htmlFor="campo-status"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Status
                </label>
                <select
                  id="campo-status"
                  value={form.status}
                  onChange={(e) =>
                    atualizarCampo('status', e.target.value as StatusProduto)
                  }
                  className="w-full rounded-lg border border-[#1E2A20] bg-[#070A07] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#22C55E]"
                >
                  {STATUS_PRODUTO.map((st) => (
                    <option key={st} value={st}>
                      {st === 'ativo' ? 'Ativo' : st === 'inativo' ? 'Inativo' : 'Expirado'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="campo-valido-ate"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Válido até (opcional)
                </label>
                <input
                  id="campo-valido-ate"
                  type="date"
                  value={form.validoAte}
                  onChange={(e) => atualizarCampo('validoAte', e.target.value)}
                  className={`w-full rounded-lg border bg-[#070A07] px-3 py-2.5 text-sm text-white focus:outline-none ${
                    erros.validoAte
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-[#1E2A20] focus:border-[#22C55E]'
                  }`}
                />
                {erros.validoAte ? (
                  <p className="mt-1 text-xs text-red-400">{erros.validoAte}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Após esta data, sai da vitrine.
                  </p>
                )}
              </div>

              <div className="sm:pt-6">
                <label
                  htmlFor="campo-destaque"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[#1E2A20] bg-[#070A07] cursor-pointer select-none"
                >
                  <input
                    id="campo-destaque"
                    type="checkbox"
                    checked={form.destaque}
                    onChange={(e) => atualizarCampo('destaque', e.target.checked)}
                    className="w-4 h-4 accent-[#22C55E] rounded cursor-pointer"
                  />
                  <span className="text-sm font-medium text-slate-200">
                    Em destaque
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-[#1E2A20]">
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              disabled={salvando}
              className="px-4 py-2.5 rounded-lg border border-[#1E2A20] bg-[#070A07] hover:bg-[#161E17] text-sm font-medium text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {salvando
                  ? 'Salvando...'
                  : modoEdicao
                  ? 'Salvar alterações'
                  : 'Cadastrar produto'}
              </span>
            </button>
          </div>
        </form>

        <div className="lg:col-span-5 lg:sticky lg:top-6">
          <div className="rounded-xl border border-[#1E2A20] bg-[#0F1410] p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-300">Pré-visualização do card</span>
              <span>
                {form.status === 'ativo'
                  ? 'Ativo'
                  : form.status === 'inativo'
                  ? 'Inativo'
                  : 'Expirado'}
              </span>
            </div>

            <div className="max-w-xs mx-auto lg:max-w-none">
              <CardProduto
                modoPreview
                produto={{
                  titulo: form.titulo,
                  imagemUrl: form.imagemUrl,
                  precoAtual: Number.isFinite(parsePrecoInput(form.precoAtual))
                    ? parsePrecoInput(form.precoAtual)
                    : 0,
                  precoOriginal:
                    form.precoOriginal.trim() &&
                    Number.isFinite(parsePrecoInput(form.precoOriginal))
                      ? parsePrecoInput(form.precoOriginal)
                      : null,
                  moeda: 'BRL',
                  plataforma: form.plataforma,
                  linkOriginal: form.linkOriginal,
                  linkAfiliado: form.linkAfiliado.trim() || null,
                  destaque: form.destaque,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
