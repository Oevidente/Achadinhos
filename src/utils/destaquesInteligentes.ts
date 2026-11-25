import type { Produto } from '../types/produto';
import {
  calcularDescontoPercentual,
  extrairTimestampMs,
  obterDataHojeIsoLocal,
  produtoEstaExpirado,
} from './adminHelpers';
import { PRODUTO_LIMITES } from './produtoValidation';

export const LIMIAR_SCORE_DESTAQUE_INTELIGENTE = 38;
export const MAX_DESTAQUES_INTELIGENTES_VITRINE = 6;

export interface AvaliacaoApeloProduto {
  score: number;
  ehDestaqueInteligente: boolean;
  motivos: string[];
  motivoPrincipal: string | null;
}

const TERMOS_ALTA_PROCURA: readonly string[] = [
  'smart tv',
  'qled',
  'mini led',
  'oled',
  '4k',
  'playstation',
  'ps5',
  'xbox',
  'nintendo',
  'iphone',
  'galaxy',
  'samsung',
  'apple',
  'xiaomi',
  'air fryer',
  'airfryer',
  'cafeteira',
  'robo aspirador',
  'aspirador',
  'notebook',
  'macbook',
  'monitor',
  'ssd',
  'cadeira ergonomica',
  'jbl',
  'alexa',
  'echo',
  'kindle',
  'creatina',
  'whey',
  'geladeira',
  'refrigerador',
  'lavadora',
  'micro-ondas',
  'microondas',
  'parafusadeira',
  'furadeira',
  'smartwatch',
  'tablet',
  'fone bluetooth',
  'soundbar',
  'projetor',
];

const TERMOS_DIFERENCIAL: readonly string[] = [
  'kit ',
  'combo',
  'original',
  'oficial',
  'inverter',
  'turbo',
  'hermetico',
  'inox',
  'bluetooth',
  'sem fio',
  '5g',
  '120hz',
  '144hz',
  'garantia',
  'frete gratis',
];

function normalizarTextoBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function calcularDiasAteValidade(
  validoAte: string | null | undefined,
  referencia: Date
): number | null {
  const limpa = validoAte?.trim();
  if (!limpa || !PRODUTO_LIMITES.DATA_ISO_REGEX.test(limpa)) return null;
  const hojeIso = obterDataHojeIsoLocal(referencia);
  const [anoH, mesH, diaH] = hojeIso.split('-').map(Number);
  const [anoV, mesV, diaV] = limpa.split('-').map(Number);
  const msHoje = Date.UTC(anoH, mesH - 1, diaH);
  const msValidade = Date.UTC(anoV, mesV - 1, diaV);
  return Math.round((msValidade - msHoje) / (1000 * 60 * 60 * 24));
}

export function avaliarApeloProduto(
  produto: Pick<
    Produto,
    | 'titulo'
    | 'descricao'
    | 'imagemUrl'
    | 'precoAtual'
    | 'precoOriginal'
    | 'cupom'
    | 'cliques'
    | 'status'
    | 'validoAte'
    | 'criadoEm'
    | 'atualizadoEm'
  >,
  referencia: Date = new Date()
): AvaliacaoApeloProduto {
  if (produto.status !== 'ativo' || produtoEstaExpirado(produto, referencia)) {
    return {
      score: 0,
      ehDestaqueInteligente: false,
      motivos: [],
      motivoPrincipal: null,
    };
  }

  let score = 0;
  const motivos: string[] = [];

  if (!produto.imagemUrl.trim() || !Number.isFinite(produto.precoAtual) || produto.precoAtual <= 0) {
    score -= 25;
  }

  const desconto = calcularDescontoPercentual(produto.precoAtual, produto.precoOriginal);
  if (desconto !== null) {
    if (desconto >= 50) {
      score += 40;
      motivos.push(`-${desconto}% OFF`);
    } else if (desconto >= 35) {
      score += 28;
      motivos.push(`-${desconto}% OFF`);
    } else if (desconto >= 20) {
      score += 16;
      motivos.push(`-${desconto}% OFF`);
    } else if (desconto >= 10) {
      score += 8;
    }
  }

  if (
    produto.precoOriginal !== null &&
    Number.isFinite(produto.precoOriginal) &&
    produto.precoOriginal > produto.precoAtual
  ) {
    const economia = produto.precoOriginal - produto.precoAtual;
    if (economia >= 500) {
      score += 22;
      motivos.push('Grande economia');
    } else if (economia >= 150) {
      score += 14;
      motivos.push('Boa economia');
    } else if (economia >= 50) {
      score += 7;
    }
  }

  if (produto.cupom && produto.cupom.trim() !== '') {
    score += 18;
    motivos.push('Com cupom');
  }

  const cliques = Number.isFinite(produto.cliques) ? produto.cliques : 0;
  if (cliques >= 20) {
    score += 20;
    motivos.push('Muito procurado');
  } else if (cliques >= 10) {
    score += 14;
    motivos.push('Em alta');
  } else if (cliques >= 3) {
    score += 7;
    motivos.push('Popular');
  } else if (cliques >= 1) {
    score += 3;
  }

  const texto = normalizarTextoBusca(`${produto.titulo} ${produto.descricao ?? ''}`);
  if (TERMOS_ALTA_PROCURA.some((termo) => texto.includes(termo))) {
    score += 12;
    motivos.push('Alta procura');
  }
  if (TERMOS_DIFERENCIAL.some((termo) => texto.includes(termo))) {
    score += 6;
  }

  const diasValidade = calcularDiasAteValidade(produto.validoAte, referencia);
  if (diasValidade !== null && diasValidade >= 0 && diasValidade <= 3) {
    score += 8;
    motivos.push('Últimos dias');
  }

  const refMs = referencia.getTime();
  const atualizadoMs = extrairTimestampMs(produto.atualizadoEm ?? produto.criadoEm);
  if (atualizadoMs > 0) {
    const horas = (refMs - atualizadoMs) / (1000 * 60 * 60);
    if (horas >= 0 && horas <= 48) {
      score += 6;
    }
  }

  const ehDestaqueInteligente = score >= LIMIAR_SCORE_DESTAQUE_INTELIGENTE;

  return {
    score: Math.max(0, score),
    ehDestaqueInteligente,
    motivos,
    motivoPrincipal: motivos[0] ?? null,
  };
}

export interface ResultadoDestaquesVitrine {
  destaques: Produto[];
  demaisOfertas: Produto[];
  avaliacoesPorId: Map<string, AvaliacaoApeloProduto>;
  idsDestaqueInteligente: Set<string>;
}

export function selecionarDestaquesVitrine(
  produtosVisiveis: readonly Produto[],
  opcoes?: {
    desabilitarDestaques?: boolean;
    maxAutomaticos?: number;
    referencia?: Date;
  }
): ResultadoDestaquesVitrine {
  const desabilitar = opcoes?.desabilitarDestaques ?? false;
  const maxAutomaticos = opcoes?.maxAutomaticos ?? MAX_DESTAQUES_INTELIGENTES_VITRINE;
  const referencia = opcoes?.referencia ?? new Date();

  const avaliacoesPorId = new Map<string, AvaliacaoApeloProduto>();
  for (const produto of produtosVisiveis) {
    avaliacoesPorId.set(produto.id, avaliarApeloProduto(produto, referencia));
  }

  if (desabilitar) {
    return {
      destaques: [],
      demaisOfertas: [...produtosVisiveis],
      avaliacoesPorId,
      idsDestaqueInteligente: new Set<string>(),
    };
  }

  const manuais = produtosVisiveis.filter((p) => p.destaque);

  const candidatosAutomaticos = produtosVisiveis
    .filter((p) => !p.destaque)
    .map((p) => ({
      produto: p,
      avaliacao: avaliacoesPorId.get(p.id)!,
    }))
    .filter((item) => item.avaliacao.ehDestaqueInteligente)
    .sort((a, b) => {
      if (b.avaliacao.score !== a.avaliacao.score) {
        return b.avaliacao.score - a.avaliacao.score;
      }
      return extrairTimestampMs(b.produto.criadoEm) - extrairTimestampMs(a.produto.criadoEm);
    })
    .slice(0, maxAutomaticos);

  const idsDestaqueInteligente = new Set(candidatosAutomaticos.map((c) => c.produto.id));
  const idsDestaqueTotais = new Set([
    ...manuais.map((p) => p.id),
    ...idsDestaqueInteligente,
  ]);

  const destaques = [
    ...manuais,
    ...candidatosAutomaticos.map((c) => c.produto),
  ];

  const demaisOfertas =
    destaques.length === 0
      ? [...produtosVisiveis]
      : produtosVisiveis.filter((p) => !idsDestaqueTotais.has(p.id));

  return {
    destaques,
    demaisOfertas,
    avaliacoesPorId,
    idsDestaqueInteligente,
  };
}
