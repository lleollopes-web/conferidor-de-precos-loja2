// Servidor do Conferidor de Preços
// - Guarda os produtos num banco PostgreSQL
// - Recebe leituras de código de barras e devolve nome + preço
// - Permite importar uma planilha (Excel ou CSV) pra atualizar todo o catálogo

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'troque-esta-senha';

// Conexão com o banco de dados (Render fornece DATABASE_URL automaticamente)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

app.use(cors()); // permite que o site no GitHub Pages chame esta API
app.use(express.json());
app.use(express.static(path.join(__dirname, 'público'))); // serve a página de admin

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Garante que a tabela de produtos existe
async function iniciarBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS produtos (
      codigo_barras TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      preco NUMERIC(12,2) NOT NULL,
      atualizado_em TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('Banco de dados pronto.');
}

// Rota de teste, pra saber se o servidor está no ar
app.get('/', (req, res) => {
  res.send('Conferidor de Preços - API no ar. Acesse /admin.html para importar produtos.');
});

app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM produtos');
    res.json({ status: 'ok', total_produtos: rows[0].total });
  } catch (err) {
    res.status(500).json({ status: 'erro', mensagem: err.message });
  }
});

// Busca um produto pelo código de barras
app.get('/api/produto/:codigo', async (req, res) => {
  const codigo = String(req.params.codigo).trim();
  try {
    const { rows } = await pool.query(
      'SELECT codigo_barras, nome, preco FROM produtos WHERE codigo_barras = $1',
      [codigo]
    );
    if (rows.length === 0) {
      return res.status(404).json({ encontrado: false, mensagem: 'Produto não cadastrado.' });
    }
    const produto = rows[0];
    res.json({
      encontrado: true,
      codigo_barras: produto.codigo_barras,
      nome: produto.nome,
      preco: Number(produto.preco),
    });
  } catch (err) {
    res.status(500).json({ encontrado: false, mensagem: 'Erro ao consultar o produto.' });
  }
});

// Middleware simples de proteção para rotas de administração
function checarToken(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, mensagem: 'Senha de administrador incorreta.' });
  }
  next();
}

// Importa uma planilha (.xlsx ou .csv) e substitui a lista de produtos
// Colunas esperadas na planilha: codigo_barras | nome | preco
app.post('/api/importar', checarToken, upload.single('planilha'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, mensagem: 'Nenhum arquivo enviado.' });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const primeiraAba = workbook.SheetNames[0];
    const linhas = XLSX.utils.sheet_to_json(workbook.Sheets[primeiraAba], { defval: '' });

    if (linhas.length === 0) {
      return res.status(400).json({ ok: false, mensagem: 'A planilha está vazia.' });
    }

    // Normaliza os nomes das colunas (aceita variações comuns)
    function pegarValor(linha, opcoes) {
      for (const chave of Object.keys(linha)) {
        const chaveNormalizada = chave.toString().trim().toLowerCase();
        if (opcoes.includes(chaveNormalizada)) return linha[chave];
      }
      return undefined;
    }

    const produtosValidos = [];
    const erros = [];

    linhas.forEach((linha, indice) => {
      const codigo = pegarValor(linha, ['codigo_barras', 'código_barras', 'codigo de barras', 'código de barras', 'codigo', 'código', 'ean', 'barcode']);
      const nome = pegarValor(linha, ['nome', 'produto', 'descricao', 'descrição']);
      let preco = pegarValor(linha, ['preco', 'preço', 'valor', 'price']);

      if (typeof preco === 'string') {
        preco = preco.replace(/[^\d,.-]/g, '').replace(',', '.');
      }
      preco = parseFloat(preco);

      if (!codigo || !nome || isNaN(preco)) {
        erros.push(`Linha ${indice + 2}: dados incompletos ou inválidos.`);
        return;
      }

      produtosValidos.push([String(codigo).trim(), String(nome).trim(), preco]);
    });

    if (produtosValidos.length === 0) {
      return res.status(400).json({ ok: false, mensagem: 'Nenhuma linha válida encontrada na planilha.', erros });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM produtos');
      for (const [codigo, nome, preco] of produtosValidos) {
        await client.query(
          `INSERT INTO produtos (codigo_barras, nome, preco) VALUES ($1, $2, $3)
           ON CONFLICT (codigo_barras) DO UPDATE SET nome = $2, preco = $3, atualizado_em = NOW()`,
          [codigo, nome, preco]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({
      ok: true,
      mensagem: `Importação concluída: ${produtosValidos.length} produtos cadastrados.`,
      total_importado: produtosValidos.length,
      linhas_com_erro: erros,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, mensagem: 'Erro ao processar a planilha: ' + err.message });
  }
});

iniciarBanco()
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  })
  .catch((err) => {
    console.error('Erro ao iniciar o banco de dados:', err);
    process.exit(1);
  });
