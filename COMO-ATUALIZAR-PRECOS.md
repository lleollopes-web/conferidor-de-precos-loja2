# Como atualizar os preços (sem servidor, direto no GitHub)

O site agora lê o arquivo **`produtos.xlsx`** direto do repositório, toda vez
que a página é aberta. Não existe mais backend, banco de dados, nem Render —
só o GitHub Pages.

## Formato da planilha

O arquivo `produtos.xlsx` precisa ter estas três colunas na primeira linha:

| codigo_barras | nome | preco |
|---|---|---|
| 7891000100103 | Leite Integral 1L | 5.49 |
| 7891910000197 | Arroz Branco 5kg | 24.90 |

## Para atualizar os preços

1. Entre no repositório no GitHub (com sua conta, que já tem permissão de
   edição).
2. Clique no arquivo **`produtos.xlsx`** na raiz do repositório.
3. Clique no ícone da lixeira ou nos "..." → **Delete file** (ou, se preferir,
   use **Add file → Upload files** e marque para substituir).
4. Depois de apagar, clique em **Add file → Upload files** e envie a nova
   versão do `produtos.xlsx` (precisa ter exatamente esse nome).
5. Clique em **Commit changes**.

Pronto — em 1 a 2 minutos (tempo do GitHub Pages atualizar o cache), a
próxima pessoa que abrir o site já vai ver os preços novos.

## Quem pode atualizar

Como não existe mais senha dentro do site, o controle de quem pode alterar os
preços passa a ser o **acesso ao repositório do GitHub**:
- Só você (dono do repositório) e as pessoas que você adicionar como
  **colaboradoras** no GitHub conseguem substituir o arquivo.
- Em **Settings → Collaborators**, dá pra convidar outras pessoas do time
  administrativo, se precisar que mais alguém faça essa atualização.

## O que não é mais necessário

A pasta `backend`, o Render e o banco de dados Postgres não são mais usados
neste formato do projeto. Você pode deixar a pasta `backend` no repositório
(não atrapalha nada) ou apagá-la, como preferir.
