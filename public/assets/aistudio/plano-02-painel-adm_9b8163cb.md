# Plano 02 — Painel do ADM (cadastro manual)

> Execute SOMENTE este plano. A extração automática de dados pelo link NÃO entra aqui (é o plano 04). Neste plano o ADM cola o link e preenche os campos na mão. No final, liste o que foi feito e o que ficou pendente.

## Pré-requisito
Plano 01 concluído (Firebase, coleção `produtos`, `detectarPlataforma`, `produtosService`).

## Objetivo desta etapa
Painel em `/admin` onde só o ADM consegue entrar, cadastrar, editar e remover produtos.

## Tarefas

1. **Login**
   - Rota `/admin/login` com botão "Entrar com Google".
   - Guarda de rota: se não estiver logado, ou se o e-mail não estiver na lista de ADMs, redirecionar para o login com mensagem "Sem permissão".
   - Botão "Sair" no topo do painel.

2. **Lista de produtos** em `/admin`
   - Tabela (no celular vira lista de cards) com: miniatura, título, plataforma (selo colorido), preço atual, status, data.
   - Busca por título e filtro por status e por plataforma.
   - Ações por linha: editar, ativar/desativar, marcar como expirado, excluir (com confirmação).

3. **Formulário de cadastro/edição** em `/admin/novo` e `/admin/editar/:id`
   - Campo **Link do produto** em destaque no topo. Ao colar/alterar o link: validar que é uma URL `https` e preencher o campo **Plataforma** automaticamente com `detectarPlataforma`. O ADM pode trocar a plataforma na mão.
   - Deixar um botão **"Buscar dados do link"** visível, mas desabilitado, com o texto "Em breve". Ele será ligado no plano 04.
   - Campos: título, descrição, URL da imagem, preço atual, preço original (opcional), link de afiliado (opcional), status, destaque.
   - Validações: título obrigatório, preço atual maior que zero, preço original (se existir) maior ou igual ao atual, URL da imagem válida.
   - **Pré-visualização ao vivo** do card do produto ao lado do formulário (no celular, abaixo). Pode ser um card provisório; na etapa 03 troca pelo card definitivo.
   - Salvar grava `origemDados: "manual"`, `criadoEm`/`atualizadoEm`.

4. **Feedback**: toasts de sucesso/erro, botão de salvar com loading, não perder o que foi digitado em caso de erro.

## Critério de pronto
- Só o e-mail de ADM entra no `/admin`.
- Consigo cadastrar um produto colando link, preenchendo os campos e vendo a prévia.
- Consigo editar, desativar e excluir.
- A plataforma é detectada sozinha para links da Shopee, Mercado Livre, Amazon, Magalu e TikTok Shop.

## Não fazer agora
Vitrine pública, extração automática, contador de cliques.
