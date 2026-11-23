# Plano 04 — Extrator de dados pelo link (Google Apps Script)

> Execute SOMENTE este plano. No final, liste o que foi feito e o que ficou pendente.

## Pré-requisito
Planos 01, 02 e 03 concluídos.

## Por que Apps Script
O navegador não consegue ler a página de outro site por causa do CORS. Então a leitura precisa rodar num servidor. Vamos usar um **web app do Google Apps Script** (gratuito, sem cartão). Se no futuro quiser trocar por Cloud Function, tudo fica isolado atrás de uma única função no front: `extrairDadosDoLink(url)`.

## Parte A — Script (entregar o código completo de um `Code.gs`)

1. `doGet(e)` recebe os parâmetros `url` e `token`.
2. **Segurança**:
   - Conferir `token` contra uma constante `TOKEN_SECRETO` (placeholder para eu trocar).
   - Aceitar só URL `https` cujo domínio esteja numa **lista permitida** (os mesmos domínios de `utils/plataformas.ts`). Recusar qualquer outro, para o script não virar proxy aberto.
3. **Buscar a página** com `UrlFetchApp.fetch`, `followRedirects: true`, `muteHttpExceptions: true` e um `User-Agent` de navegador comum. Isso resolve links curtos (`amzn.to`, `s.shopee.com.br`, `vm.tiktok.com`).
4. **Extrair**, nesta ordem de prioridade:
   - JSON-LD (`<script type="application/ld+json">`) com `@type: Product` → nome, descrição, imagem, `offers.price`, `offers.priceCurrency`.
   - Meta tags: `og:title`, `og:description`, `og:image`, `product:price:amount`, `twitter:*`.
   - `<title>` como último recurso.
5. **Retornar JSON** (via `ContentService`, MIME JSON):
```json
{
  "ok": true,
  "plataforma": "mercado_livre",
  "titulo": "...",
  "descricao": "...",
  "imagemUrl": "...",
  "precoAtual": 199.9,
  "precoOriginal": null,
  "moeda": "BRL",
  "confiancaPreco": "alta | baixa | nao_encontrado",
  "avisos": ["..."]
}
```
6. **Falha tratada**: se a página vier bloqueada (captcha, página de verificação, status diferente de 200, sem título), retornar `ok: false` com mensagem clara em `erro`. Nunca retornar erro genérico.
7. **Cache** com `CacheService` por 6 horas por URL, para não repetir busca.
8. Explicar no final, em passos curtos, como implantar: *Implantar > Nova implantação > App da Web > Executar como: eu > Quem tem acesso: qualquer pessoa*.

## Parte B — Integração no site

1. Criar `services/extratorService.ts` com `extrairDadosDoLink(url)` que chama a URL do web app (guardar URL e token em variáveis de ambiente / `config.ts`, nunca dentro de componente).
2. No formulário do ADM, **ativar o botão "Buscar dados do link"**:
   - Mostra loading no botão.
   - Em sucesso: preenche título, descrição, imagem, preços e plataforma, e marca `origemDados: "automatico"`.
   - Campos preenchidos pelo extrator ganham um destaque visual leve; se `confiancaPreco` for `baixa` ou `nao_encontrado`, o campo de preço fica em **amarelo** com a mensagem "Confere o preço antes de salvar".
   - Em falha: toast com o motivo e o formulário continua no modo manual, sem perder o link já colado.
3. O ADM **sempre revisa** antes de salvar. Nada é salvo automaticamente.
4. Tratar timeout (limite de ~15 s) com mensagem amigável.

## Expectativa realista (colocar como comentário no código)
- **Mercado Livre, Magalu**: costuma funcionar bem para título, imagem e preço.
- **Amazon**: funciona em parte; às vezes bloqueia. O caminho oficial para dados e preço é a API de afiliados (PA-API), que exige conta de afiliado aprovada.
- **Shopee e TikTok Shop**: carregam o conteúdo por JavaScript e bloqueiam leitura automática com frequência. O fallback manual do painel é o plano B.
- **Preço** é o dado menos confiável de extrair. Por isso o aviso de confiança e a revisão do ADM.

## Critério de pronto
- Colo um link de Mercado Livre e os campos vêm preenchidos.
- Colo um link bloqueado e o sistema avisa o motivo, sem travar, e eu preencho na mão.
- Domínio fora da lista permitida é recusado.

## Não fazer agora
Revalidação de preços em lote, contador de cliques, SEO.
