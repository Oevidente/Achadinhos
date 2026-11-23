# Plano 01 — Base do projeto e Firebase

> Execute SOMENTE este plano. Não implemente nada das etapas seguintes. No final, liste o que foi feito e o que ficou pendente.

## Contexto do projeto
Site de produtos em promoção. O ADM cadastra o link de um produto de marketplace (Shopee, Mercado Livre, Amazon, TikTok Shop, Magalu etc.) e o site exibe imagem, título, descrição, preço e a plataforma. O visitante só navega e clica para ir até o marketplace. Não existe carrinho nem pagamento no site.

## Objetivo desta etapa
Deixar a fundação pronta: estrutura do projeto, Firebase conectado, modelo de dados e regras de segurança.

## Tarefas

1. Manter o stack que já estiver no projeto (ou React + TypeScript + Tailwind, se estiver vazio). Organizar em pastas: `components/`, `pages/`, `services/`, `utils/`, `types/`.

2. Conectar ao Firebase usando a integração do AI Studio:
   - **Firestore** (banco de dados)
   - **Authentication** com login Google (só para o ADM)
   - Hosting fica para a etapa final

3. Criar a coleção `produtos` com este modelo (criar também o tipo TypeScript `Produto`):

| Campo | Tipo | Observação |
|---|---|---|
| titulo | string | obrigatório |
| descricao | string | pode ser vazia |
| imagemUrl | string | URL da imagem (não copiar a imagem para Storage, só guardar a URL) |
| precoAtual | number | em reais |
| precoOriginal | number \| null | preço "de", para calcular desconto |
| moeda | string | padrão `"BRL"` |
| plataforma | string | enum abaixo |
| linkOriginal | string | link colado pelo ADM |
| linkAfiliado | string \| null | se existir, é este que o botão usa |
| status | string | `"ativo"` \| `"inativo"` \| `"expirado"` |
| origemDados | string | `"manual"` \| `"automatico"` |
| destaque | boolean | padrão `false` |
| cliques | number | padrão `0` |
| criadoEm | timestamp | serverTimestamp |
| atualizadoEm | timestamp | serverTimestamp |

   Enum de plataformas: `shopee`, `mercado_livre`, `amazon`, `tiktok_shop`, `magalu`, `aliexpress`, `americanas`, `kabum`, `outra`.

4. Criar `utils/plataformas.ts` com um objeto de configuração por plataforma: nome para exibir, cor do selo e lista de domínios que identificam ela. Exemplos de domínios: `shopee.com.br`, `s.shopee.com.br`, `mercadolivre.com.br`, `mercadolibre.com`, `amazon.com.br`, `amzn.to`, `tiktok.com`, `vm.tiktok.com`, `magazineluiza.com.br`, `magalu.com`, `aliexpress.com`. Criar a função `detectarPlataforma(url: string): Plataforma` (retorna `outra` se não reconhecer).

5. Escrever as **regras de segurança do Firestore**:
   - `produtos`: leitura pública; escrita somente para usuário autenticado cujo e-mail esteja na lista de ADMs.
   - Deixar a lista de ADMs numa constante simples nas regras, com um e-mail de exemplo `SEU_EMAIL_AQUI@gmail.com` para eu trocar.
   - Todo o resto da base bloqueado.

6. Criar `services/produtosService.ts` com funções vazias/tipadas: `listarProdutos`, `buscarProduto`, `criarProduto`, `atualizarProduto`, `excluirProduto`. Pode implementar já, são simples.

7. Criar um arquivo `.env.example` / `config.ts` com as chaves do Firebase como variáveis, sem deixar chave hardcoded em componente.

## Critério de pronto
- App abre sem erro.
- Consigo criar e ler um documento de teste em `produtos`.
- Usuário não logado consegue ler, mas não consegue escrever.

## Não fazer agora
Telas bonitas, painel, vitrine, extração de dados por link.
