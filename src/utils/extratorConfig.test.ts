import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analisarRespostaDiagnostico,
  gerarCodigoAppsScriptComToken,
  gerarTokenSeguroExtrator,
  isErroConfiguracaoExtrator,
  lerConfigExtratorLocal,
  limparConfigExtratorLocal,
  resolverConfigExtrator,
  salvarConfigExtratorLocal,
  validarUrlAppsScript,
  type StorageLike,
} from './extratorConfig';

function criarMemoryStorage(): StorageLike {
  const mapa = new Map<string, string>();
  return {
    getItem: (k) => mapa.get(k) ?? null,
    setItem: (k, v) => {
      mapa.set(k, v);
    },
    removeItem: (k) => {
      mapa.delete(k);
    },
  };
}

test('storage local e resolverConfigExtrator priorizam override do navegador sobre env', () => {
  const storage = criarMemoryStorage();
  const env = {
    url: 'https://script.google.com/macros/s/ENV123/exec',
    token: 'token-env',
  };

  assert.deepEqual(resolverConfigExtrator(env, lerConfigExtratorLocal(storage)), {
    url: 'https://script.google.com/macros/s/ENV123/exec',
    token: 'token-env',
    origem: 'ambiente',
    temOverrideLocal: false,
  });

  salvarConfigExtratorLocal(
    ' https://script.google.com/macros/s/LOCAL456/exec ',
    ' token-local ',
    storage
  );

  assert.deepEqual(resolverConfigExtrator(env, lerConfigExtratorLocal(storage)), {
    url: 'https://script.google.com/macros/s/LOCAL456/exec',
    token: 'token-local',
    origem: 'navegador',
    temOverrideLocal: true,
  });

  limparConfigExtratorLocal(storage);
  assert.deepEqual(resolverConfigExtrator(env, lerConfigExtratorLocal(storage)), {
    url: 'https://script.google.com/macros/s/ENV123/exec',
    token: 'token-env',
    origem: 'ambiente',
    temOverrideLocal: false,
  });
});

test('validarUrlAppsScript rejeita /dev e não-HTTPS e aceita /exec', () => {
  assert.equal(validarUrlAppsScript('https://script.google.com/macros/s/AKfycb123/exec').valida, true);
  const devRes = validarUrlAppsScript('https://script.google.com/macros/s/AKfycb123/dev');
  assert.equal(devRes.valida, false);
  assert.match(devRes.erro ?? '', /\/dev/);

  assert.equal(validarUrlAppsScript('http://script.google.com/macros/s/123/exec').valida, false);
  assert.equal(validarUrlAppsScript('').valida, false);
});

test('gerarCodigoAppsScriptComToken injeta token no Code.gs real e passa diagnostico em VM', () => {
  const template = fs.readFileSync(path.resolve(process.cwd(), 'apps-script/Code.gs'), 'utf8');
  const token = gerarTokenSeguroExtrator(12);
  assert.equal(token.length, 24);

  const codigoFinal = gerarCodigoAppsScriptComToken(template, token);
  assert.match(codigoFinal, new RegExp(`var TOKEN_SECRETO = '${token}';`));

  let saida = '';
  const context: Record<string, unknown> = {
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (txt: string) => ({
        setMimeType: () => {
          saida = txt;
          return txt;
        },
      }),
    },
  };
  vm.createContext(context);
  vm.runInContext(codigoFinal, context);

  const doGet = context.doGet as (e: { parameter: Record<string, string> }) => string;
  doGet({ parameter: { action: 'diagnostico', token } });
  const parsed = JSON.parse(saida) as {
    ok: boolean;
    versao: string;
    tokenConfigurado: boolean;
    tokenValido: boolean;
  };
  assert.equal(parsed.ok, true);
  assert.equal(parsed.tokenConfigurado, true);
  assert.equal(parsed.tokenValido, true);
  assert.ok(parsed.versao);
});

test('analisarRespostaDiagnostico identifica HTML, versao antiga, legado valido e sucesso', () => {
  const htmlLogin = analisarRespostaDiagnostico(
    200,
    'text/html; charset=utf-8',
    '<!DOCTYPE html><html><title>Google Accounts</title></html>'
  );
  assert.equal(htmlLogin.ok, false);
  assert.match(htmlLogin.detalhe, /Qualquer pessoa/);

  const versaoAntigaSemToken = analisarRespostaDiagnostico(
    200,
    'application/json',
    JSON.stringify({
      ok: false,
      erro: 'Token não configurado no Google Apps Script (v2026-11-25). Defina TOKEN_SECRETO nas Propriedades do script ou no código e publique uma Nova versão.',
    })
  );
  assert.equal(versaoAntigaSemToken.ok, false);
  assert.equal(versaoAntigaSemToken.versaoAntigaOuErrada, true);

  const legadoComTokenValido = analisarRespostaDiagnostico(
    200,
    'application/json',
    JSON.stringify({
      ok: false,
      erro: 'Informe uma URL válida iniciando com https://.',
    })
  );
  assert.equal(legadoComTokenValido.ok, true);

  const sucessoNovo = analisarRespostaDiagnostico(
    200,
    'application/json',
    JSON.stringify({
      ok: true,
      versao: '2026-11-26',
      tokenConfigurado: true,
      origemToken: 'código (TOKEN_SECRETO)',
      tokenValido: true,
    })
  );
  assert.equal(sucessoNovo.ok, true);
  assert.match(sucessoNovo.titulo, /2026-11-26/);
});

test('isErroConfiguracaoExtrator reconhece erros de token e configuracao', () => {
  assert.equal(
    isErroConfiguracaoExtrator('Token não configurado no Google Apps Script (v2026-11-25).'),
    true
  );
  assert.equal(isErroConfiguracaoExtrator('Token de autenticação inválido'), true);
  assert.equal(isErroConfiguracaoExtrator('A loja exibiu verificação anti-robô (captcha).'), false);
});
