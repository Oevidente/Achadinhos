# Plano 05 — Acabamento, revalidação de preço e deploy

> Execute SOMENTE este plano. No final, liste o que foi feito e o que ficou pendente.

## Pré-requisito
Planos 01 a 04 concluídos e funcionando.

## Objetivo desta etapa
Deixar o site confiável no dia a dia e publicado.

## Tarefas

1. **Contador de cliques**
   - Ao clicar em "Ver oferta", incrementar `cliques` do produto com `increment(1)`.
   - Ajustar as regras do Firestore para permitir que qualquer visitante atualize **somente** o campo `cliques`, e só somando 1 (usar `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['cliques'])`). Todo o resto continua só para ADM.
   - Mostrar os cliques por produto na tabela do painel e ordenar por mais clicados.

2. **Revalidação de preço**
   - Na lista do painel, botão "Revalidar" por produto: chama o extrator (plano 04), mostra o preço antigo ao lado do novo e só atualiza se o ADM confirmar.
   - Botão "Revalidar todos os ativos": roda em fila, um de cada vez, com intervalo de 2 segundos entre eles e barra de progresso. Resultado final: quantos atualizaram, quantos falharam.
   - Gravar `atualizadoEm` e exibir "Preço conferido há X" no card, em texto pequeno.

3. **Status automático de expiração**: campo opcional `validoAte` (data) no formulário. Produto com data vencida deixa de aparecer na vitrine.

4. **SEO e compartilhamento**
   - `title` e `meta description` da home.
   - Metatags Open Graph e favicon.
   - Se der, página individual `/p/:id` com título do produto e botão "Ver oferta", para facilitar compartilhar no WhatsApp.

5. **Qualidade**
   - Revisar acessibilidade básica (alt nas imagens, contraste, foco nos botões).
   - Tratar todos os estados de erro de rede com mensagem amigável.
   - Remover `console.log` e qualquer chave exposta.

6. **Deploy**
   - Publicar no Firebase Hosting (ou no deploy que o AI Studio oferecer).
   - Explicar passo a passo como apontar um domínio próprio, se eu quiser.
   - Conferir que as regras do Firestore publicadas são as finais.

## Critério de pronto
- Clique em "Ver oferta" soma no contador.
- Consigo revalidar um produto e ver antes/depois do preço.
- Site publicado e abrindo bem no celular.
