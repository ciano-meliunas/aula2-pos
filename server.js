import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';

const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Conexão com banco
mongoose.connect(process.env.MONGODB_URI, { dbName: 'licao_pos' })
    .then(() => console.log('Conectado ao MongoDB com sucesso!'))
    .catch(err => console.error('Erro na conexão:', err.message));

// Modelo de dados
const movimentacaoSchema = new mongoose.Schema({
    descricao: { type: String, required: true, trim: true },
    tipo: { type: String, enum: ['receita', 'despesa'], required: true },
    categoria: { type: String, required: true, trim: true },
    valor: { type: Number, required: true, min: 0 },
    data: { type: Date, default: Date.now }
}, { collection: 'Movimentacoes', timestamps: true });

const Movimentacao = mongoose.model('Movimentacao', movimentacaoSchema, 'Movimentacoes');

// Endpoints

// Rota inicial teste
app.get('/', (req, res) => res.json({ msg: 'API rodando uhuuul' }));

// Registrar movimentações financeiras (entradas e saídas)
app.post('/movimentacoes', async (req, res) => {
    try {
        const novaMovimentacao = await Movimentacao.create(req.body);
        res.status(201).json(novaMovimentacao);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Visualizar lista e filtrar por categorias, datas e tipo
app.get('/movimentacoes', async (req, res) => {
    try {
        const { tipo, categoria, dataInicio, dataFim } = req.query;

        const filtro = {};
        if (tipo) filtro.tipo = tipo;
        if (categoria) filtro.categoria = categoria;

        if (dataInicio || dataFim) {
            filtro.data = {};
            if (dataInicio) filtro.data.$gte = new Date(dataInicio);
            if (dataFim) filtro.data.$lte = new Date(dataFim);
        }

        const movimentacoes = await Movimentacao.find(filtro).sort({ data: -1 });
        res.json(movimentacoes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Identificar saldo
app.get('/saldo', async (req, res) => {
    try {
        const agrupamento = await Movimentacao.aggregate([
            {
                $group: {
                    _id: "$tipo",
                    total: { $sum: "$valor" }
                }
            }
        ]);

        let totalReceitas = 0;
        let totalDespesas = 0;

        agrupamento.forEach(item => {
            if (item._id === 'receita') totalReceitas = item.total;
            if (item._id === 'despesa') totalDespesas = item.total;
        });

        const saldoFinal = totalReceitas - totalDespesas;

        res.json({
            receitas: totalReceitas,
            despesas: totalDespesas,
            saldo: saldoFinal
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deletar movimentação
app.delete('/movimentacoes/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        const movimentacao = await Movimentacao.findByIdAndDelete(req.params.id);
        if (!movimentacao) return res.status(404).json({ error: 'Movimentação não encontrada' });
        res.json({ ok: true, msg: 'Deletado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Iniciar servidor
app.listen(process.env.PORT, () =>
    console.log(`Servidor rodando em http://localhost:${process.env.PORT}`)
);