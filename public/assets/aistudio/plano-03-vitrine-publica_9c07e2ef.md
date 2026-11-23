# Plano 03 — Vitrine pública

> Execute SOMENTE este plano. Não mexa no painel do ADM além de trocar o card provisório da pré-visualização pelo card definitivo. No final, liste o que foi feito e o que ficou pendente.

## Pré-requisito
Planos 01 e 02 concluídos. Já existem produtos cadastrados para testar.

## Objetivo desta etapa
Página inicial que o visitante usa para ver as ofertas e ir até o marketplace. Prioridade total para **celular**.

## Tarefas

1. **Componente `CardProduto`** (reutilizar na pré-visualização do painel):
   - Imagem quadrada com `loading="lazy"` e fallback (imagem cinza com ícone) se der erro de carregamento.
   - Selo da plataforma no canto da imagem, usando a cor definida em `utils/plataformas.ts`.
   - Título limitado a 2 linhas.
   - Preço atual grande; se houver preço original, mostrar riscado e a **% de desconto** calculada.
   - Botão "Ver oferta".
   - Selo "Destaque" quando `destaque = true`.

2. **Botão "Ver oferta"**
   - Abre `linkAfiliado` se existir, senão `linkOriginal`, em nova aba com `rel="noopener noreferrer sponsored"`.

3. **Página inicial `/`**
   - Cabeçalho simples com nome do site e campo de busca por texto.
   - Faixa de **filtros por plataforma** (chips roláveis na horizontal no celular): Todas, Shopee, Mercado Livre, Amazon, TikTok Shop, Magalu e as demais que existirem nos produtos.
   - Ordenação: mais recentes, menor preço, maior desconto.
   - Grid responsivo: 2 colunas no celular, 3 no tablet, 4 no desktop.
   - Mostrar apenas produtos com `status = "ativo"`.
   - Seção "Destaques" no topo, se houver produtos em destaque.

4. **Carregamento**
   - Paginação com botão "Carregar mais" (24 por vez, usando `limit` + `startAfter`).
   - Skeletons enquanto carrega.
   - Estado vazio amigável ("Nenhuma oferta encontrada").
   - Se o Firestore pedir índice composto, mostrar o link do erro no console e me avisar no resumo final qual índice precisa criar. Para filtro por plataforma + ordenação, se ficar complicado, filtrar no cliente enquanto o catálogo for pequeno.

5. **Rodapé** com aviso: "Os preços e a disponibilidade podem mudar a qualquer momento nos sites das lojas. Este site pode receber comissão por compras feitas pelos links."

## Critério de pronto
- Home carrega rápido no celular e mostra os produtos ativos.
- Filtro por plataforma, busca e ordenação funcionam.
- Clicar em "Ver oferta" abre o marketplace em nova aba.
- Produto inativo/expirado não aparece.

## Não fazer agora
Extração automática por link, contador de cliques, SEO.
