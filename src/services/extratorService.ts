/**
 * Serviço de extração de metadados de links de produtos via Google Apps Script + fallback local pela URL.
 *
 * 100% gratuito e compatível com GitHub Pages:
 * - Mercado Livre (links /social/, /p/MLB, meli.la): extrai título, imagem, preço atual e preço original.
 * - Shopee (shopee.com.br, s.shopee.com.br, shp.ee): usa User-Agent WhatsApp para obter título, descrição e imagem SSR + slug da URL.
 * - TikTok Shop (vt.tiktok.com, tiktok.com/view/product): captura parâmetro `og_info` nos redirecionamentos para obter título e imagem mesmo com Security Check.
 * - Caso `VITE_EXTRATOR_URL` não esteja configurado, extrai dados disponíveis na própria URL (slug / og_info) quando possível.
 */

import { APP_CONFIG, extratorConfig } from '../config';
import { isHttpsUrl } from '../utils/adminHelpers';
import {
  extrairMetadadosPelaUrlLocal,
  isDominioPermitidoExtrator,
  montarUrlRequisicaoExtrator,
  normalizarRespostaExtrator,
  type ExtratorResultado,
} from '../utils/extratorHelpers';

export type { ConfiancaPreco, ExtratorResultado } from '../utils/extratorHelpers';

export async function extrairDadosDoLink(url: string): Promise<ExtratorResultado> {
  const urlLimpa = url.trim();

  if (!isHttpsUrl(urlLimpa)) {
    throw new Error('Informe uma URL válida iniciando com https:// antes de buscar os dados.');
  }

  if (!isDominioPermitidoExtrator(urlLimpa)) {
    throw new Error(
      'Domínio fora da lista permitida. Use links de Shopee, Mercado Livre, Amazon, TikTok Shop, Magalu, AliExpress, Americanas ou KaBuM!.'
    );
  }

  const fallbackLocal = extrairMetadadosPelaUrlLocal(urlLimpa);

  if (!extratorConfig.url || !extratorConfig.token) {
    if (fallbackLocal) {
      return fallbackLocal;
    }
    throw new Error(
      'Extrator remoto ainda não configurado. Defina VITE_EXTRATOR_URL e VITE_EXTRATOR_TOKEN após implantar o Google Apps Script ou preencha os dados manualmente.'
    );
  }

  const endpoint = montarUrlRequisicaoExtrator(
    extratorConfig.url,
    extratorConfig.token,
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

    if (!resposta.ok) {
      if (fallbackLocal) return fallbackLocal;
      throw new Error(`O serviço extrator respondeu com erro HTTP ${resposta.status}.`);
    }

    let payload: unknown;
    try {
      payload = await resposta.json();
    } catch {
      if (fallbackLocal) return fallbackLocal;
      throw new Error('O serviço extrator retornou uma resposta inválida.');
    }

    return normalizarRespostaExtrator(payload, urlLimpa);
  } catch (error) {
    if (fallbackLocal) {
      return fallbackLocal;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        'Tempo limite esgotado (15s) ao consultar a loja. Preencha os dados manualmente.'
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        'Não foi possível conectar ao serviço extrator. Verifique a URL configurada ou preencha manualmente.'
      );
    }
    throw error instanceof Error
      ? error
      : new Error('Falha inesperada ao buscar dados do link.');
  } finally {
    window.clearTimeout(timerId);
  }
}
