import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock,
  Edit3,
  Loader2,
  MousePointerClick,
  Package,
  Plus,
  Power,
  RefreshCw,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RevalidarPrecoModal } from '../components/RevalidarPrecoModal';
import { extrairDadosDoLink, type ExtratorResultado } from '../services/extratorService';
import {
  atualizarPrecoRevalidado,
  atualizarProduto,
  excluirProduto,
  listarProdutos,
} from '../services/produtosService';
import {
  CATEGORIAS_PRODUTO,
  STATUS_PRODUTO,
  type CategoriaProduto,
  type Plataforma,
  type Produto,
  type StatusProduto,
} from '../types/produto';
import {
  filtrarProdutosAdmin,
  formatarDataIsoBr,
  formatarDataProduto,
  formatarMoeda,
  produtoEstaExpirado,
  type OrdenacaoAdmin,
} from '../utils/adminHelpers';
import {
  CATEGORIAS_CONFIG,
  obterCategoriaEfetiva,
  obterNomeCategoria,
} from '../utils/categorias';
import { obterPlataformasVisiveis, PLATAFORMAS_CONFIG } from '../utils/plataformas';

interface AdminProdutosPageProps {
  onNavigate: (path: string) => void;
  onToast: (tipo: 'sucesso' | 'erro', mensagem: string) => void;
}

interface ProgressoLote {
  emExecucao: boolean;
  atual: number;
  total: number;
  atualizados: number;
  falhas: number;
  tituloAtual: string;
}

function corTextoPlataforma(plataforma: Plataforma): string {
  if (plataforma === 'mercado_livre' || plataforma === 'amazon' || plataforma === 'kabum') {
    return '#070A07';
  }
  return '#FFFFFF';
}

function labelStatus(produto: Produto): { texto: string; classe: string } {
  if (produto.status === 'ativo' && produtoEstaExpirado(produto)) {
    return { texto: 'Vencido', classe: 'text-red-400' };
  }
  if (produto.status === 'ativo') {
    return { texto: 'Ativo', classe: 'text-[#4ADE80]' };
  }
  if (produto.status === 'inativo') {
    return { texto: 'Inativo', classe: 'text-amber-300' };
  }
  return { texto: 'Expirado', classe: 'text-red-400' };
}

function MiniaturaProduto({ url, titulo }: { url: string; titulo: string }) {
  const [erro, setErro] = useState(false);

  if (!url || erro) {
    return (
      <div className="w-11 h-11 rounded-lg bg-[#131A14] border border-[#1E2A20] flex items-center justify-center text-slate-400 shrink-0">
        <Package className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div className="w-11 h-11 rounded-lg bg-white border border-[#1E2A20] overflow-hidden flex items-center justify-center p-1 shrink-0">
      <img
        src={url}
        alt={titulo}
        referrerPolicy="no-referrer"
        onError={() => setErro(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
}

export function AdminProdutosPage({ onNavigate, onToast }: AdminProdutosPageProps) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusProduto>('todos');
  const [filtroPlataforma, setFiltroPlataforma] = useState<'todas' | Plataforma>('todas');
  const [filtroCategoria, setFiltroCategoria] = useState<'todas' | 'sem_categoria' | CategoriaProduto>('todas');
  const [ordenacao, setOrdenacao] = useState<OrdenacaoAdmin>('mais_recentes');

  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [revalidandoId, setRevalidandoId] = useState<string | null>(null);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<Produto | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const [revalidacaoModal, setRevalidacaoModal] = useState<{
    produto: Produto;
    extraido: ExtratorResultado;
  } | null>(null);
  const [salvandoRevalidacao, setSalvandoRevalidacao] = useState(false);

  const [progressoLote, setProgressoLote] = useState<ProgressoLote | null>(null);
  const cancelarLoteRef = useRef(false);

  const carregarProdutos = useCallback(async () => {
    setCarregando(true);
    setErroCarregamento(null);
    try {
      const lista = await listarProdutos(100);
      setProdutos(lista);
    } catch {
      setErroCarregamento('Não foi possível carregar os produtos. Verifique sua conexão.');
      onToast('erro', 'Não foi possível carregar os produtos. Verifique sua conexão.');
    } finally {
      setCarregando(false);
    }
  }, [onToast]);

  useEffect(() => {
    void carregarProdutos();
    return () => {
      cancelarLoteRef.current = true;
    };
  }, [carregarProdutos]);

  const produtosFiltrados = useMemo(
    () =>
      filtrarProdutosAdmin(produtos, {
        busca,
        status: filtroStatus,
        plataforma: filtroPlataforma,
        categoria: filtroCategoria,
        ordenacao,
      }),
    [produtos, busca, filtroStatus, filtroPlataforma, filtroCategoria, ordenacao]
  );

  const produtosAtivosValidos = useMemo(
    () => produtos.filter((p) => p.status === 'ativo' && !produtoEstaExpirado(p)),
    [produtos]
  );

  const alterarStatus = async (produto: Produto, novoStatus: StatusProduto) => {
    setProcessandoId(produto.id);
    try {
      await atualizarProduto(produto.id, { status: novoStatus });
      setProdutos((prev) =>
        prev.map((item) =>
          item.id === produto.id ? { ...item, status: novoStatus } : item
        )
      );
      const rotulo =
        novoStatus === 'ativo'
          ? 'ativado'
          : novoStatus === 'inativo'
          ? 'desativado'
          : 'marcado como expirado';
      onToast('sucesso', `"${produto.titulo}" ${rotulo}.`);
    } catch {
      onToast('erro', `Não foi possível atualizar "${produto.titulo}". Verifique sua conexão.`);
    } finally {
      setProcessandoId(null);
    }
  };

  const confirmarExclusao = async () => {
    if (!produtoParaExcluir) return;
    const alvo = produtoParaExcluir;
    setExcluindo(true);
    try {
      await excluirProduto(alvo.id);
      setProdutos((prev) => prev.filter((item) => item.id !== alvo.id));
      onToast('sucesso', `Produto "${alvo.titulo}" excluído.`);
      setProdutoParaExcluir(null);
    } catch {
      onToast('erro', `Não foi possível excluir "${alvo.titulo}". Verifique sua conexão.`);
    } finally {
      setExcluindo(false);
    }
  };

  const iniciarRevalidacaoIndividual = async (produto: Produto) => {
    setRevalidandoId(produto.id);
    try {
      const extraido = await extrairDadosDoLink(produto.linkOriginal);
      setRevalidacaoModal({ produto, extraido });
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar o link deste produto.';
      onToast('erro', msg);
    } finally {
      setRevalidandoId(null);
    }
  };

  const confirmarRevalidacaoIndividual = async (novoPreco: number) => {
    if (!revalidacaoModal) return;
    const alvo = revalidacaoModal.produto;
    setSalvandoRevalidacao(true);
    try {
      await atualizarPrecoRevalidado(alvo.id, novoPreco);
      const agora = new Date();
      setProdutos((prev) =>
        prev.map((item) =>
          item.id === alvo.id
            ? { ...item, precoAtual: novoPreco, atualizadoEm: agora }
            : item
        )
      );
      onToast(
        'sucesso',
        `Preço de "${alvo.titulo}" atualizado para ${formatarMoeda(novoPreco, alvo.moeda)}.`
      );
      setRevalidacaoModal(null);
    } catch {
      onToast('erro', 'Não foi possível salvar o novo preço. Verifique sua conexão.');
    } finally {
      setSalvandoRevalidacao(false);
    }
  };

  const revalidarTodosOsAtivos = async () => {
    const fila = produtosAtivosValidos;
    if (fila.length === 0) {
      onToast('erro', 'Não há produtos ativos para revalidar.');
      return;
    }

    cancelarLoteRef.current = false;
    let atualizados = 0;
    let falhas = 0;

    setProgressoLote({
      emExecucao: true,
      atual: 0,
      total: fila.length,
      atualizados: 0,
      falhas: 0,
      tituloAtual: fila[0].titulo,
    });

    for (let i = 0; i < fila.length; i++) {
      if (cancelarLoteRef.current) break;
      const item = fila[i];

      setProgressoLote({
        emExecucao: true,
        atual: i + 1,
        total: fila.length,
        atualizados,
        falhas,
        tituloAtual: item.titulo,
      });

      try {
        const extraido = await extrairDadosDoLink(item.linkOriginal);
        if (
          extraido.precoAtual !== null &&
          Number.isFinite(extraido.precoAtual) &&
          extraido.precoAtual > 0 &&
          extraido.confiancaPreco !== 'nao_encontrado'
        ) {
          await atualizarPrecoRevalidado(item.id, extraido.precoAtual);
          const agora = new Date();
          setProdutos((prev) =>
            prev.map((p) =>
              p.id === item.id
                ? { ...p, precoAtual: extraido.precoAtual!, atualizadoEm: agora }
                : p
            )
          );
          atualizados++;
        } else {
          falhas++;
        }
      } catch {
        falhas++;
      }

      setProgressoLote({
        emExecucao: true,
        atual: i + 1,
        total: fila.length,
        atualizados,
        falhas,
        tituloAtual: item.titulo,
      });

      if (i < fila.length - 1 && !cancelarLoteRef.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
    }

    const interrompido = cancelarLoteRef.current;
    setProgressoLote({
      emExecucao: false,
      atual: atualizados + falhas,
      total: fila.length,
      atualizados,
      falhas,
      tituloAtual: '',
    });

    if (interrompido) {
      onToast(
        'sucesso',
        `Revalidação interrompida: ${atualizados} atualizados, ${falhas} falharam.`
      );
    } else {
      onToast(
        atualizados > 0 ? 'sucesso' : 'erro',
        `Revalidação concluída: ${atualizados} atualizados, ${falhas} falharam.`
      );
    }
  };

  const loteEmExecucao = Boolean(progressoLote?.emExecucao);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Produtos</h1>
          <p className="text-sm text-slate-400 tabular-nums">
            {produtos.length}{' '}
            {produtos.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void revalidarTodosOsAtivos()}
            disabled={carregando || loteEmExecucao || produtosAtivosValidos.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#22C55E]/40 bg-[#0D1A10] hover:bg-[#142819] text-sm font-medium text-[#86EFAC] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loteEmExecucao ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>Revalidar todos os ativos</span>
          </button>

          <button
            type="button"
            onClick={() => void carregarProdutos()}
            disabled={carregando || loteEmExecucao}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#1E2A20] bg-[#0F1410] hover:bg-[#172119] text-sm font-medium text-slate-200 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/admin/novo')}
            disabled={loteEmExecucao}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Novo produto
          </button>
        </div>
      </div>

      {progressoLote && (
        <section
          aria-live="polite"
          className="rounded-xl border border-[#22C55E]/35 bg-[#0A140D] p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-semibold text-white tabular-nums">
                {progressoLote.emExecucao
                  ? `Revalidando ${progressoLote.atual} de ${progressoLote.total} ativos...`
                  : `Resultado da revalidação: ${progressoLote.atualizados} atualizados, ${progressoLote.falhas} falharam`}
              </p>
              {progressoLote.emExecucao && progressoLote.tituloAtual && (
                <p className="text-xs text-slate-400 truncate">
                  Consultando: {progressoLote.tituloAtual}
                </p>
              )}
            </div>

            {progressoLote.emExecucao ? (
              <button
                type="button"
                onClick={() => {
                  cancelarLoteRef.current = true;
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-200 cursor-pointer self-start sm:self-auto"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Parar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setProgressoLote(null)}
                className="text-xs font-medium text-slate-400 hover:text-white cursor-pointer self-start sm:self-auto"
              >
                Fechar resumo
              </button>
            )}
          </div>

          <div className="w-full h-2 rounded-full bg-[#162219] overflow-hidden">
            <div
              className="h-full bg-[#22C55E] transition-all duration-300"
              style={{
                width: `${
                  progressoLote.total > 0
                    ? Math.round((progressoLote.atual / progressoLote.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
            <span className="text-[#4ADE80]">
              Atualizados: {progressoLote.atualizados}
            </span>
            <span className="text-amber-300">Falharam: {progressoLote.falhas}</span>
          </div>
        </section>
      )}

      <section
        aria-label="Filtros de produtos"
        className="rounded-xl border border-[#1E2A20] bg-[#0F1410] p-4 grid grid-cols-1 md:grid-cols-12 gap-3"
      >
        <div className="md:col-span-4 relative">
          <label htmlFor="busca-titulo" className="sr-only">
            Buscar por título
          </label>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="busca-titulo"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título do produto..."
            className="w-full rounded-lg border border-[#1E2A20] bg-[#070A07] pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#22C55E]"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="filtro-status" className="sr-only">
            Filtrar por status
          </label>
          <select
            id="filtro-status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as 'todos' | StatusProduto)}
            className="w-full rounded-lg border border-[#1E2A20] bg-[#070A07] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#22C55E]"
          >
            <option value="todos">Todos os status</option>
            {STATUS_PRODUTO.map((st) => (
              <option key={st} value={st}>
                {st === 'ativo' ? 'Ativo' : st === 'inativo' ? 'Inativo' : 'Expirado'}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="filtro-plataforma" className="sr-only">
            Filtrar por plataforma
          </label>
          <select
            id="filtro-plataforma"
            value={filtroPlataforma}
            onChange={(e) => setFiltroPlataforma(e.target.value as 'todas' | Plataforma)}
            className="w-full rounded-lg border border-[#1E2A20] bg-[#070A07] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#22C55E]"
          >
            <option value="todas">Todas as lojas</option>
            {obterPlataformasVisiveis().map((platId) => (
              <option key={platId} value={platId}>
                {PLATAFORMAS_CONFIG[platId].nome}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="filtro-categoria" className="sr-only">
            Filtrar por categoria
          </label>
          <select
            id="filtro-categoria"
            value={filtroCategoria}
            onChange={(e) =>
              setFiltroCategoria(
                e.target.value as 'todas' | 'sem_categoria' | CategoriaProduto
              )
            }
            className="w-full rounded-lg border border-[#1E2A20] bg-[#070A07] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#22C55E]"
          >
            <option value="todas">Todas categorias</option>
            <option value="sem_categoria">Sem categoria salva</option>
            {CATEGORIAS_PRODUTO.map((catId) => (
              <option key={catId} value={catId}>
                {CATEGORIAS_CONFIG[catId].nome}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="ordenacao-admin" className="sr-only">
            Ordenar lista
          </label>
          <select
            id="ordenacao-admin"
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as OrdenacaoAdmin)}
            className="w-full rounded-lg border border-[#1E2A20] bg-[#070A07] px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#22C55E]"
          >
            <option value="mais_recentes">Mais recentes</option>
            <option value="mais_clicados">Mais clicados</option>
          </select>
        </div>
      </section>

      {erroCarregamento ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <span>{erroCarregamento}</span>
          <button
            type="button"
            onClick={() => void carregarProdutos()}
            className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-semibold text-white transition-colors cursor-pointer self-start"
          >
            Tentar novamente
          </button>
        </div>
      ) : carregando ? (
        <div className="rounded-xl border border-[#1E2A20] bg-[#0F1410] p-6 space-y-3">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="h-12 rounded-lg bg-[#161F18] animate-pulse"
            />
          ))}
        </div>
      ) : produtos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1E2A20] bg-[#0F1410] py-14 px-6 text-center space-y-3">
          <p className="text-base font-semibold text-white">
            Nenhum produto cadastrado ainda
          </p>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Adicione seu primeiro produto colando o link do marketplace e preenchendo ou
            extraindo os dados.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate('/admin/novo')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-bold text-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Cadastrar primeiro produto
            </button>
          </div>
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-[#1E2A20] bg-[#0F1410] py-12 px-6 text-center space-y-2">
          <p className="text-sm font-medium text-slate-200">
            Nenhum produto encontrado com os filtros atuais.
          </p>
          <button
            type="button"
            onClick={() => {
              setBusca('');
              setFiltroStatus('todos');
              setFiltroPlataforma('todas');
              setFiltroCategoria('todas');
              setOrdenacao('mais_recentes');
            }}
            className="text-xs font-semibold text-[#22C55E] hover:underline cursor-pointer"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <>
          {/* Tabela Desktop */}
          <div className="hidden md:block rounded-xl border border-[#1E2A20] bg-[#0F1410] overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1E2A20] text-xs font-semibold text-slate-400">
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">Plataforma</th>
                  <th className="py-3 px-4 text-right">Preço atual</th>
                  <th className="py-3 px-4 text-right">Cliques</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2A20]">
                {produtosFiltrados.map((produto) => {
                  const plat =
                    PLATAFORMAS_CONFIG[produto.plataforma] ?? PLATAFORMAS_CONFIG.outra;
                  const statusInfo = labelStatus(produto);
                  const ocupado =
                    processandoId === produto.id ||
                    revalidandoId === produto.id ||
                    loteEmExecucao;
                  const proximoStatus: StatusProduto =
                    produto.status === 'ativo' ? 'inativo' : 'ativo';
                  const validadeFmt = formatarDataIsoBr(produto.validoAte);

                  return (
                    <tr
                      key={produto.id}
                      className="hover:bg-[#141C15] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-0 max-w-xs">
                          <MiniaturaProduto
                            url={produto.imagemUrl}
                            titulo={produto.titulo}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {produto.titulo}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              {produto.destaque && (
                                <span className="text-[#22C55E] font-medium">
                                  Destaque
                                </span>
                              )}
                              {obterNomeCategoria(obterCategoriaEfetiva(produto)) && (
                                <span className="px-1.5 py-0.5 rounded bg-[#141D16] text-slate-300 border border-[#1E2A20]">
                                  {obterNomeCategoria(obterCategoriaEfetiva(produto))}
                                </span>
                              )}
                              {produto.cupom && (
                                <span className="font-mono px-1.5 py-0.5 rounded bg-[#122616] text-[#86EFAC] border border-[#22C55E]/30">
                                  {produto.cupom}
                                </span>
                              )}
                              {validadeFmt && (
                                <span className="text-slate-400 tabular-nums">
                                  Válido até {validadeFmt}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap"
                          style={{
                            backgroundColor: plat.corSelo,
                            color: corTextoPlataforma(produto.plataforma),
                          }}
                        >
                          {plat.nome}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-semibold text-white tabular-nums whitespace-nowrap">
                        {formatarMoeda(produto.precoAtual, produto.moeda)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-slate-200 tabular-nums whitespace-nowrap">
                        {produto.cliques}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold ${statusInfo.classe}`}>
                          {statusInfo.texto}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 tabular-nums whitespace-nowrap">
                        {formatarDataProduto(produto.criadoEm)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void iniciarRevalidacaoIndividual(produto)}
                            disabled={ocupado}
                            title="Revalidar preço pelo link"
                            aria-label={`Revalidar preço de "${produto.titulo}"`}
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[#1E2A20] bg-[#070A07] hover:bg-[#19231B] text-xs font-medium text-[#86EFAC] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {revalidandoId === produto.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>Revalidar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onNavigate(`/admin/editar/${produto.id}`)}
                            disabled={ocupado}
                            title="Editar produto"
                            aria-label={`Editar "${produto.titulo}"`}
                            className="p-2 rounded-lg border border-[#1E2A20] bg-[#070A07] hover:bg-[#19231B] text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void alterarStatus(produto, proximoStatus)}
                            disabled={ocupado}
                            title={
                              produto.status === 'ativo'
                                ? 'Desativar produto'
                                : 'Ativar produto'
                            }
                            aria-label={
                              produto.status === 'ativo'
                                ? `Desativar "${produto.titulo}"`
                                : `Ativar "${produto.titulo}"`
                            }
                            className="p-2 rounded-lg border border-[#1E2A20] bg-[#070A07] hover:bg-[#19231B] text-slate-300 hover:text-[#22C55E] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          {produto.status !== 'expirado' && (
                            <button
                              type="button"
                              onClick={() => void alterarStatus(produto, 'expirado')}
                              disabled={ocupado}
                              title="Marcar como expirado"
                              aria-label={`Marcar "${produto.titulo}" como expirado`}
                              className="p-2 rounded-lg border border-[#1E2A20] bg-[#070A07] hover:bg-[#19231B] text-slate-300 hover:text-amber-300 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setProdutoParaExcluir(produto)}
                            disabled={ocupado}
                            title="Excluir produto"
                            aria-label={`Excluir "${produto.titulo}"`}
                            className="p-2 rounded-lg border border-[#1E2A20] bg-[#070A07] hover:border-red-500/40 hover:bg-red-500/10 text-slate-300 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Lista de Cards Mobile */}
          <div className="md:hidden space-y-3">
            {produtosFiltrados.map((produto) => {
              const plat =
                PLATAFORMAS_CONFIG[produto.plataforma] ?? PLATAFORMAS_CONFIG.outra;
              const statusInfo = labelStatus(produto);
              const ocupado =
                processandoId === produto.id ||
                revalidandoId === produto.id ||
                loteEmExecucao;
              const proximoStatus: StatusProduto =
                produto.status === 'ativo' ? 'inativo' : 'ativo';

              return (
                <article
                  key={produto.id}
                  className="rounded-xl border border-[#1E2A20] bg-[#0F1410] p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <MiniaturaProduto url={produto.imagemUrl} titulo={produto.titulo} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="text-sm font-semibold text-white line-clamp-2">
                        {produto.titulo}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold"
                          style={{
                            backgroundColor: plat.corSelo,
                            color: corTextoPlataforma(produto.plataforma),
                          }}
                        >
                          {plat.nome}
                        </span>
                        <span className={`font-semibold ${statusInfo.classe}`}>
                          {statusInfo.texto}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="inline-flex items-center gap-1 text-slate-300 tabular-nums">
                          <MousePointerClick className="w-3.5 h-3.5 text-slate-400" />
                          {produto.cliques}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400 tabular-nums">
                          {formatarDataProduto(produto.criadoEm)}
                        </span>
                        {produto.cupom && (
                          <span className="font-mono px-1.5 py-0.5 rounded bg-[#122616] text-[#86EFAC] border border-[#22C55E]/30 text-[11px]">
                            {produto.cupom}
                          </span>
                        )}
                        {obterNomeCategoria(obterCategoriaEfetiva(produto)) && (
                          <span className="px-1.5 py-0.5 rounded bg-[#141D16] text-slate-300 border border-[#1E2A20] text-[11px]">
                            {obterNomeCategoria(obterCategoriaEfetiva(produto))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1E2A20]">
                    <span className="text-base font-bold text-[#22C55E] tabular-nums">
                      {formatarMoeda(produto.precoAtual, produto.moeda)}
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void iniciarRevalidacaoIndividual(produto)}
                        disabled={ocupado}
                        aria-label={`Revalidar preço de "${produto.titulo}"`}
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[#1E2A20] bg-[#070A07] text-xs font-medium text-[#86EFAC] cursor-pointer disabled:opacity-50"
                      >
                        {revalidandoId === produto.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        Revalidar
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate(`/admin/editar/${produto.id}`)}
                        disabled={ocupado}
                        aria-label={`Editar "${produto.titulo}"`}
                        className="px-2.5 py-2 rounded-lg border border-[#1E2A20] bg-[#070A07] text-xs font-medium text-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void alterarStatus(produto, proximoStatus)}
                        disabled={ocupado}
                        aria-label={
                          produto.status === 'ativo'
                            ? `Desativar "${produto.titulo}"`
                            : `Ativar "${produto.titulo}"`
                        }
                        className="px-2.5 py-2 rounded-lg border border-[#1E2A20] bg-[#070A07] text-xs font-medium text-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        {produto.status === 'ativo' ? 'Desativar' : 'Ativar'}
                      </button>
                      {produto.status !== 'expirado' && (
                        <button
                          type="button"
                          onClick={() => void alterarStatus(produto, 'expirado')}
                          disabled={ocupado}
                          aria-label={`Marcar "${produto.titulo}" como expirado`}
                          className="p-2 rounded-lg border border-[#1E2A20] bg-[#070A07] text-slate-300 cursor-pointer disabled:opacity-50"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setProdutoParaExcluir(produto)}
                        disabled={ocupado}
                        aria-label={`Excluir "${produto.titulo}"`}
                        className="p-2 rounded-lg border border-[#1E2A20] bg-[#070A07] text-red-400 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        aberto={produtoParaExcluir !== null}
        titulo="Excluir produto"
        descricao={
          produtoParaExcluir
            ? `Tem certeza que deseja excluir "${produtoParaExcluir.titulo}"? Essa ação remove o item permanentemente do Firestore.`
            : ''
        }
        carregando={excluindo}
        onConfirmar={() => void confirmarExclusao()}
        onCancelar={() => !excluindo && setProdutoParaExcluir(null)}
      />

      <RevalidarPrecoModal
        aberto={revalidacaoModal !== null}
        produto={revalidacaoModal?.produto ?? null}
        extraido={revalidacaoModal?.extraido ?? null}
        salvando={salvandoRevalidacao}
        onConfirmar={(novoPreco) => void confirmarRevalidacaoIndividual(novoPreco)}
        onCancelar={() => !salvandoRevalidacao && setRevalidacaoModal(null)}
      />
    </div>
  );
}
