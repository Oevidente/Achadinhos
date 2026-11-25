export const STORAGE_KEY_EXTRATOR_URL = 'achadinhos_extrator_url';
export const STORAGE_KEY_EXTRATOR_TOKEN = 'achadinhos_extrator_token';

export interface ExtratorCredenciais {
  url: string;
  token: string;
}

export type OrigemConfigExtrator = 'navegador' | 'ambiente' | 'nao_configurado';

export interface ExtratorConfigResolvida extends ExtratorCredenciais {
  origem: OrigemConfigExtrator;
  temOverrideLocal: boolean;
}

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function obterStoragePadrao(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function lerConfigExtratorLocal(storage?: StorageLike | null): ExtratorCredenciais {
  const alvo = storage === undefined ? obterStoragePadrao() : storage;
  if (!alvo) {
    return { url: '', token: '' };
  }
  try {
    return {
      url: (alvo.getItem(STORAGE_KEY_EXTRATOR_URL) ?? '').trim(),
      token: (alvo.getItem(STORAGE_KEY_EXTRATOR_TOKEN) ?? '').trim(),
    };
  } catch {
    return { url: '', token: '' };
  }
}

export function salvarConfigExtratorLocal(
  url: string,
  token: string,
  storage?: StorageLike | null
): ExtratorCredenciais {
  const alvo = storage === undefined ? obterStoragePadrao() : storage;
  const limpaUrl = url.trim();
  const limpoToken = token.trim();

  if (alvo) {
    try {
      if (limpaUrl) {
        alvo.setItem(STORAGE_KEY_EXTRATOR_URL, limpaUrl);
      } else {
        alvo.removeItem(STORAGE_KEY_EXTRATOR_URL);
      }

      if (limpoToken) {
        alvo.setItem(STORAGE_KEY_EXTRATOR_TOKEN, limpoToken);
      } else {
        alvo.removeItem(STORAGE_KEY_EXTRATOR_TOKEN);
      }
    } catch {
      // Ignora erro de quota/privacidade do navegador
    }
  }

  return { url: limpaUrl, token: limpoToken };
}

export function limparConfigExtratorLocal(storage?: StorageLike | null): void {
  const alvo = storage === undefined ? obterStoragePadrao() : storage;
  if (!alvo) return;
  try {
    alvo.removeItem(STORAGE_KEY_EXTRATOR_URL);
    alvo.removeItem(STORAGE_KEY_EXTRATOR_TOKEN);
  } catch {
    // Ignora falha de acesso ao storage
  }
}

export function resolverConfigExtrator(
  envConfig: ExtratorCredenciais,
  localConfig: ExtratorCredenciais
): ExtratorConfigResolvida {
  const envUrl = envConfig.url.trim();
  const envToken = envConfig.token.trim();
  const localUrl = localConfig.url.trim();
  const localToken = localConfig.token.trim();

  const temOverrideLocal = Boolean(localUrl || localToken);
  const url = localUrl || envUrl;
  const token = localToken || envToken;

  let origem: OrigemConfigExtrator = 'nao_configurado';
  if (url && token) {
    origem = temOverrideLocal ? 'navegador' : 'ambiente';
  } else if (temOverrideLocal) {
    origem = 'navegador';
  }

  return {
    url,
    token,
    origem,
    temOverrideLocal,
  };
}

export function validarUrlAppsScript(rawUrl: string): {
  valida: boolean;
  aviso?: string;
  erro?: string;
} {
  const url = rawUrl.trim();
  if (!url) {
    return { valida: false, erro: 'Informe a URL do Web App do Google Apps Script.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valida: false, erro: 'URL inválida. Cole o link completo começando com https://.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valida: false, erro: 'A URL do Apps Script deve começar com https://.' };
  }

  if (parsed.pathname.endsWith('/dev')) {
    return {
      valida: false,
      erro: 'Essa é uma URL de teste (/dev). Publique a implantação e use a URL terminada em /exec.',
    };
  }

  if (
    parsed.hostname.includes('script.google.com') &&
    !parsed.pathname.endsWith('/exec')
  ) {
    return {
      valida: true,
      aviso: 'A URL do Web App do Apps Script normalmente termina com /exec.',
    };
  }

  return { valida: true };
}

export function gerarTokenSeguroExtrator(tamanhoBytes = 18): string {
  const bytes = new Uint8Array(tamanhoBytes);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function gerarCodigoAppsScriptComToken(template: string, token: string): string {
  const tokenLimpo = token.trim();
  const tokenEscapado = tokenLimpo
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r|\n/g, '');
  const linhaToken = `var TOKEN_SECRETO = '${tokenEscapado}';`;

  if (/^var\s+TOKEN_SECRETO\s*=.*;/m.test(template)) {
    return template.replace(/^var\s+TOKEN_SECRETO\s*=.*;/m, linhaToken);
  }
  return `${linhaToken}\n${template}`;
}

export function isErroConfiguracaoExtrator(mensagem: string): boolean {
  const m = mensagem.toLowerCase();
  return (
    m.includes('token não configurado') ||
    m.includes('token de autenticação inválido') ||
    m.includes('token ausente') ||
    m.includes('extrator remoto ainda não configurado') ||
    m.includes('quem pode acessar') ||
    m.includes('apps script') ||
    m.includes('/exec') ||
    m.includes('não foi possível conectar ao serviço extrator')
  );
}

export interface ResultadoDiagnosticoExtrator {
  ok: boolean;
  versao: string | null;
  tokenConfigurado: boolean | null;
  tokenValido: boolean | null;
  origemToken: string | null;
  versaoAntigaOuErrada: boolean;
  titulo: string;
  detalhe: string;
}

export function analisarRespostaDiagnostico(
  statusHttp: number,
  contentType: string,
  rawBody: string
): ResultadoDiagnosticoExtrator {
  const corpo = rawBody.trim();
  const ctLower = contentType.toLowerCase();

  if (
    ctLower.includes('text/html') ||
    corpo.startsWith('<!DOCTYPE') ||
    corpo.startsWith('<html') ||
    corpo.includes('accounts.google.com')
  ) {
    return {
      ok: false,
      versao: null,
      tokenConfigurado: null,
      tokenValido: false,
      origemToken: null,
      versaoAntigaOuErrada: false,
      titulo: 'Acesso bloqueado pelo Google (retornou HTML em vez de JSON)',
      detalhe:
        'Na janela "Gerenciar implantações" do Apps Script, confirme que "Executar como" está em "Eu", "Quem pode acessar" está em "Qualquer pessoa" e que a URL termina em /exec.',
    };
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    const json = JSON.parse(corpo) as unknown;
    if (json && typeof json === 'object') {
      parsed = json as Record<string, unknown>;
    }
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return {
      ok: false,
      versao: null,
      tokenConfigurado: null,
      tokenValido: null,
      origemToken: null,
      versaoAntigaOuErrada: false,
      titulo: `Resposta inesperada (HTTP ${statusHttp})`,
      detalhe:
        'O endereço não retornou JSON válido do extrator. Confira se a URL copiada é a do Web App (/exec).',
    };
  }

  const versao = typeof parsed.versao === 'string' ? parsed.versao : null;
  const tokenConfigurado =
    typeof parsed.tokenConfigurado === 'boolean' ? parsed.tokenConfigurado : null;
  const tokenValido =
    typeof parsed.tokenValido === 'boolean' ? parsed.tokenValido : null;
  const origemToken =
    typeof parsed.origemToken === 'string' ? parsed.origemToken : null;
  const erro = typeof parsed.erro === 'string' ? parsed.erro.trim() : '';

  if (parsed.ok === true) {
    return {
      ok: true,
      versao,
      tokenConfigurado: tokenConfigurado ?? true,
      tokenValido: tokenValido ?? true,
      origemToken,
      versaoAntigaOuErrada: false,
      titulo: `Conexão aprovada${versao ? ` (Apps Script v${versao})` : ''}`,
      detalhe: origemToken
        ? `Token validado via ${origemToken}. O extrator está pronto para puxar links!`
        : 'Token validado com sucesso. O extrator está pronto para puxar links!',
    };
  }

  if (erro.includes('Informe uma URL válida')) {
    return {
      ok: true,
      versao: 'anterior',
      tokenConfigurado: true,
      tokenValido: true,
      origemToken,
      versaoAntigaOuErrada: false,
      titulo: 'Conexão e token validados!',
      detalhe:
        'Esta URL está respondendo e aceitou o seu token (versão anterior do script, sem diagnóstico detalhado). Você já pode extrair links normalmente.',
    };
  }

  const ehErroAntigoSemDiagnostico =
    !versao &&
    erro.includes('Defina TOKEN_SECRETO nas Propriedades do script ou no código');

  if (ehErroAntigoSemDiagnostico) {
    return {
      ok: false,
      versao: null,
      tokenConfigurado: false,
      tokenValido: false,
      origemToken: null,
      versaoAntigaOuErrada: true,
      titulo: 'Esta URL ainda aponta para uma versão antiga do Apps Script sem token',
      detalhe:
        'O servidor respondeu com a versão antiga do script onde o token ainda não foi definido. Copie o código atualizado abaixo, cole no Code.gs, salve (Ctrl+S) e vá em Implantar > Gerenciar implantações > Editar (lápis) > Versão: Nova versão > Implantar. Se você criou uma "Nova implantação", cole aqui a NOVA URL /exec gerada.',
    };
  }

  if (tokenConfigurado === false || erro.toLowerCase().includes('token não configurado')) {
    return {
      ok: false,
      versao,
      tokenConfigurado: false,
      tokenValido: false,
      origemToken,
      versaoAntigaOuErrada: !versao,
      titulo: `Token não configurado no Apps Script${versao ? ` (v${versao})` : ''}`,
      detalhe:
        erro ||
        'Cole o Code.gs gerado abaixo no Apps Script, salve (Ctrl+S) e publique uma Nova versão.',
    };
  }

  return {
    ok: false,
    versao,
    tokenConfigurado,
    tokenValido: false,
    origemToken,
    versaoAntigaOuErrada: false,
    titulo: `Falha na validação do token${versao ? ` (v${versao})` : ''}`,
    detalhe: erro || 'O token informado no painel não confere com o do Apps Script.',
  };
}
