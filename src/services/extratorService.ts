/**
 * Serviço de extração de metadados de links de produtos via Google Apps Script + fallback local pela URL.
 *
 * 100% gratuito e compatível com GitHub Pages:
 * - Mercado Livre (links /social/, /p/MLB, meli.la): extrai título, imagem, preço atual e preço original.
 * - Shopee (shopee.com.br, s.shopee.com.br, shp.ee): usa User-Agent WhatsApp para obter título, descrição e imagem SSR + slug da URL.
 * - TikTok Shop (vt.tiktok.com, tiktok.com/view/product): captura parâmetro `og_info` nos redirecionamentos para obter título e imagem mesmo com Security Check.
 * - Caso o extrator remoto não esteja configurado, extrai dados disponíveis na própria URL (slug / og_info) quando possível.
 */

import { APP_CONFIG, obterExtratorConfigAtiva } from '../config';
import { isHttpsUrl } from '../utils/adminHelpers';
import {
  analisarRespostaDiagnostico,
  isErroConfiguracaoExtrator,
  validarUrlAppsScript,
  type ResultadoDiagnosticoExtrator,
} from '../utils/extratorConfig';
import {
  extrairMetadadosPelaUrlLocal,
  isDominioPermitidoExtrator,
  montarUrlRequisicaoExtrator,
  normalizarRespostaExtrator,
  type ExtratorResultado,
} from '../utils/extratorHelpers';
import { obterPlataformasVisiveis, PLATAFORMAS_CONFIG } from '../utils/plataformas';

export type { ConfiancaPreco, ExtratorResultado } from '../utils/extratorHelpers';
export type { ResultadoDiagnosticoExtrator } from '../utils/extratorConfig';

export class ExtratorConfigError extends Error {
  readonly isConfigError = true;

  constructor(message: string) {
    super(message);
    this.name = 'ExtratorConfigError';
  }
}

export async function testarConexaoExtrator(
  urlInput?: string,
  tokenInput?: string
): Promise<ResultadoDiagnosticoExtrator> {
  const ativa = obterExtratorConfigAtiva();
  const url = (urlInput ?? ativa.url).trim();
  const token = (tokenInput ?? ativa.token).trim();

  const validacaoUrl = validarUrlAppsScript(url);
  if (!validacaoUrl.valida) {
    return {
      ok: false,
      versao: null,
      tokenConfigurado: null,
      tokenValido: null,
      origemToken: null,
      versaoAntigaOuErrada: false,
      titulo: 'URL do Apps Script inválida',
      detalhe: validacaoUrl.erro ?? 'Informe uma URL válida terminando em /exec.',
    };
  }

  if (!token) {
    return {
      ok: false,
      versao: null,
      tokenConfigurado: null,
      tokenValido: false,
      origemToken: null,
      versaoAntigaOuErrada: false,
      titulo: 'Token não informado',
      detalhe: 'Informe ou gere um token para testar a conexão com o Google Apps Script.',
    };
  }

  const endpoint = new URL(url);
  endpoint.searchParams.set('action', 'diagnostico');
  endpoint.searchParams.set('token', token);

  const controller = new AbortController();
  const timerId = window.setTimeout(() => {
    controller.abort();
  }, APP_CONFIG.extratorTimeoutMs);

  try {
    const resposta = await fetch(endpoint.toString(), {
      method: 'GET',
      signal: controller.signal,
    });
    const contentType = resposta.headers.get('content-type') ?? '';
    const corpo = await resposta.text();
    return analisarRespostaDiagnostico(resposta.status, contentType, corpo);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        versao: null,
        tokenConfigurado: null,
        tokenValido: null,
        origemToken: null,
        versaoAntigaOuErrada: false,
        titulo: 'Tempo limite esgotado (15s)',
        detalhe:
          'O Google Apps Script demorou muito para responder. Tente testar novamente em alguns segundos.',
      };
    }
    return {
      ok: false,
      versao: null,
      tokenConfigurado: null,
      tokenValido: null,
      origemToken: null,
      versaoAntigaOuErrada: false,
      titulo: 'Não foi possível conectar ao Google Apps Script',
      detalhe:
        'O navegador foi bloqueado ou a URL não existe. Confirme se a URL termina em /exec e se "Quem pode acessar" está definido como "Qualquer pessoa".',
    };
  } finally {
    window.clearTimeout(timerId);
  }
}

export async function extrairDadosDoLink(url: string): Promise<ExtratorResultado> {
  const urlLimpa = url.trim();

  if (!isHttpsUrl(urlLimpa)) {
    throw new Error('Informe uma URL válida iniciando com https:// antes de buscar os dados.');
  }

  if (!isDominioPermitidoExtrator(urlLimpa)) {
    const nomesPermitidos = obterPlataformasVisiveis()
      .filter((id) => id !== 'outra')
      .map((id) => PLATAFORMAS_CONFIG[id].nome);
    const listaFormatada =
      nomesPermitidos.length > 1
        ? `${nomesPermitidos.slice(0, -1).join(', ')} ou ${nomesPermitidos[nomesPermitidos.length - 1]}`
        : nomesPermitidos.join('');
    throw new Error(`Domínio fora da lista permitida. Use links de ${listaFormatada}.`);
  }

  const fallbackLocal = extrairMetadadosPelaUrlLocal(urlLimpa);
  const configAtiva = obterExtratorConfigAtiva();

  if (!configAtiva.url || !configAtiva.token) {
    if (fallbackLocal) {
      return fallbackLocal;
    }
    throw new ExtratorConfigError(
      'Extrator remoto ainda não configurado. Clique em "Configurar extrator" para informar a URL do Google Apps Script e o token.'
    );
  }

  const endpoint = montarUrlRequisicaoExtrator(
    configAtiva.url,
    configAtiva.token,
    urlLimpa
  );

  const controller = new AbortController();
  const timerId = window.setTimeout(() => {
    controller.abort();
  }, APP_CONFIG.extratorTimeoutMs);

  try {
    const resposta = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
    });

    const contentType = resposta.headers.get('content-type') ?? '';
    const rawBody = await resposta.text();

    if (
      contentType.toLowerCase().includes('text/html') ||
      rawBody.trim().startsWith('<!DOCTYPE') ||
      rawBody.trim().startsWith('<html')
    ) {
      throw new ExtratorConfigError(
        'O Google Apps Script retornou uma página HTML em vez de JSON. Confira se a implantação está publicada para "Qualquer pessoa" e se a URL termina em /exec.'
      );
    }

    if (!resposta.ok) {
      if (fallbackLocal) return fallbackLocal;
      throw new Error(`O serviço extrator respondeu com erro HTTP ${resposta.status}.`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      if (fallbackLocal) return fallbackLocal;
      throw new Error('O serviço extrator retornou uma resposta inválida.');
    }

    return normalizarRespostaExtrator(payload, urlLimpa);
  } catch (error) {
    if (error instanceof ExtratorConfigError) {
      throw error;
    }
    if (error instanceof Error && isErroConfiguracaoExtrator(error.message)) {
      throw new ExtratorConfigError(error.message);
    }
    if (fallbackLocal) {
      return fallbackLocal;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        'Tempo limite esgotado (15s) ao consultar a loja. Preencha os dados manualmente.'
      );
    }
    if (error instanceof TypeError) {
      throw new ExtratorConfigError(
        'Não foi possível conectar ao serviço extrator. Verifique a URL configurada ou abra "Configurar extrator".'
      );
    }
    throw error instanceof Error
      ? error
      : new Error('Falha inesperada ao buscar dados do link.');
  } finally {
    window.clearTimeout(timerId);
  }
}
