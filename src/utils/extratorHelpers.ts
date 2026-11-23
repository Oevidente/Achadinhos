import { PLATAFORMAS, type Plataforma } from '../types/produto';
import { isHttpsUrl } from './adminHelpers';
import { detectarPlataforma } from './plataformas';
import { PRODUTO_LIMITES } from './produtoValidation';

export type ConfiancaPreco = 'alta' | 'baixa' | 'nao_encontrado';

export interface ExtratorResultado {
  ok: true;
  plataforma: Plataforma;
  titulo: string;
  descricao: string;
  imagemUrl: string;
  precoAtual: number | null;
  precoOriginal: number | null;
  moeda: string;
  confiancaPreco: ConfiancaPreco;
  avisos: string[];
}

export function isDominioPermitidoExtrator(url: string): boolean {
  if (!isHttpsUrl(url)) return false;
  return detectarPlataforma(url) !== 'outra';
}

export function montarUrlRequisicaoExtrator(
  endpointBase: string,
  token: string,
  targetUrl: string
): string {
  const endpoint = new URL(endpointBase);
  endpoint.searchParams.set('url', targetUrl.trim());
  endpoint.searchParams.set('token', token);
  return endpoint.toString();
}

export function formatarPrecoParaInput(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor) || valor <= 0) {
    return '';
  }
  return valor.toFixed(2).replace('.', ',');
}

export function normalizarRespostaExtrator(
  payload: unknown,
  urlOriginal: string
): ExtratorResultado {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta inválida do serviço extrator.');
  }

  const dados = payload as Record<string, unknown>;
  if (dados.ok !== true) {
    const motivo =
      typeof dados.erro === 'string' && dados.erro.trim()
        ? dados.erro.trim()
        : 'Não foi possível extrair os dados deste link.';
    throw new Error(motivo);
  }

  const plataformaBruta = String(dados.plataforma ?? '');
  const plataforma: Plataforma = PLATAFORMAS.includes(plataformaBruta as Plataforma)
    ? (plataformaBruta as Plataforma)
    : detectarPlataforma(urlOriginal);

  const titulo =
    typeof dados.titulo === 'string'
      ? dados.titulo.trim().slice(0, PRODUTO_LIMITES.TITULO_MAX)
      : '';

  if (!titulo) {
    throw new Error('O extrator não encontrou o título do produto. Preencha manualmente.');
  }

  const descricao =
    typeof dados.descricao === 'string'
      ? dados.descricao.trim().slice(0, PRODUTO_LIMITES.DESCRICAO_MAX)
      : '';

  const imagemUrl =
    typeof dados.imagemUrl === 'string'
      ? dados.imagemUrl.trim().slice(0, PRODUTO_LIMITES.URL_MAX)
      : '';

  const precoAtualNum =
    dados.precoAtual === null || dados.precoAtual === undefined
      ? null
      : Number(dados.precoAtual);
  const precoAtual =
    precoAtualNum !== null && Number.isFinite(precoAtualNum) && precoAtualNum > 0
      ? Math.round(precoAtualNum * 100) / 100
      : null;

  const precoOrigNum =
    dados.precoOriginal === null || dados.precoOriginal === undefined
      ? null
      : Number(dados.precoOriginal);
  const precoOriginal =
    precoOrigNum !== null && Number.isFinite(precoOrigNum) && precoOrigNum > 0
      ? Math.round(precoOrigNum * 100) / 100
      : null;

  const confiancaBruta = String(dados.confiancaPreco ?? '');
  const confiancaPreco: ConfiancaPreco =
    confiancaBruta === 'alta' || confiancaBruta === 'baixa' || confiancaBruta === 'nao_encontrado'
      ? confiancaBruta
      : precoAtual !== null
      ? 'baixa'
      : 'nao_encontrado';

  const moeda =
    typeof dados.moeda === 'string' && dados.moeda.trim()
      ? dados.moeda.trim().toUpperCase().slice(0, 10)
      : 'BRL';

  const avisos = Array.isArray(dados.avisos)
    ? dados.avisos.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : [];

  return {
    ok: true,
    plataforma,
    titulo,
    descricao,
    imagemUrl,
    precoAtual,
    precoOriginal,
    moeda,
    confiancaPreco,
    avisos,
  };
}
