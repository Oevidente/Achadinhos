/**
 * Serviço de extração de metadados de links de produtos via Google Apps Script.
 *
 * Expectativa realista:
 * - Mercado Livre, Magalu: costuma funcionar bem para título, imagem e preço.
 * - Amazon: funciona em parte; às vezes bloqueia. O caminho oficial para dados e preço é a API de afiliados (PA-API), que exige conta de afiliado aprovada.
 * - Shopee e TikTok Shop: carregam o conteúdo por JavaScript e bloqueiam leitura automática com frequência. O fallback manual do painel é o plano B.
 * - Preço é o dado menos confiável de extrair. Por isso o aviso de confiança e a revisão do ADM.
 */

import { APP_CONFIG, extratorConfig } from '../config';
import { isHttpsUrl } from '../utils/adminHelpers';
import {
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

  if (!extratorConfig.url || !extratorConfig.token) {
    throw new Error(
      'Extrator ainda não configurado. Defina VITE_EXTRATOR_URL e VITE_EXTRATOR_TOKEN após implantar o Google Apps Script.'
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
      throw new Error(`O serviço extrator respondeu com erro HTTP ${resposta.status}.`);
    }

    let payload: unknown;
    try {
      payload = await resposta.json();
    } catch {
      throw new Error('O serviço extrator retornou uma resposta inválida.');
    }

    return normalizarRespostaExtrator(payload, urlLimpa);
  } catch (error) {
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
