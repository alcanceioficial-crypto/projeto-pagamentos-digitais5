
const express = require("express");
const router = express.Router();

const {
  criarCobrancaCartao,
  pagarCobrancaCartao,
} = require("../services/efiCartao.service");

const { salvarPedido } = require("../services/pedidoStore.service");

/* ======================================================
   CONFIGURAÇÃO (DEVE SER IGUAL AO pix.routes.js)
====================================================== */

const PRECO_UNITARIO = 0.50;
const DESCRICAO_PRODUTO = "Camiseta Levanta Limeira";

/* ======================================================
   GERAR COBRANÇA DE CARTÃO + PAGAR COM TOKEN
====================================================== */
router.post("/gerar_pagamento", async (req, res) => {
  try {
    const {
      itens,
      nome,
      whatsapp,
      endereco,
      payment_token,
      dadosCartao,
    } = req.body;

    // -------- Validações --------
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: "Nenhum item enviado" });
    }

    if (!nome || !whatsapp || !endereco) {
      return res.status(400).json({ erro: "Dados do cliente incompletos" });
    }

    if (!payment_token) {
      return res.status(400).json({ erro: "Token do cartão ausente" });
    }

    if (!dadosCartao || !dadosCartao.nomeTitular || !dadosCartao.cpfTitular) {
      return res.status(400).json({ erro: "Dados do titular incompletos" });
    }

    // -------- Calcula total --------
    let total = 0;
    let totalPecas = 0;

    for (const item of itens) {
      const qtd = parseInt(item.quantidade, 10);
      if (!qtd || qtd < 1 || qtd > 50) {
        return res.status(400).json({ erro: "Quantidade inválida" });
      }
      total += PRECO_UNITARIO * qtd;
      totalPecas += qtd;
    }

    total = Number(total.toFixed(2));

    if (total < 0.01) {
      return res.status(400).json({ erro: "Valor mínimo não atingido" });
    }

    const descricao = `${DESCRICAO_PRODUTO} (${totalPecas} ${
      totalPecas === 1 ? "peça" : "peças"
    }) - ${nome}`;

    console.log(`💳 Iniciando cobrança cartão | valor: R$ ${total} | peças: ${totalPecas}`);

    // -------- 1. Cria a cobrança --------
    const cobranca = await criarCobrancaCartao({
      valor: total,
      descricao,
      nome,
      cpf: dadosCartao.cpfTitular,
      email: dadosCartao.email,
      telefone: whatsapp,
    });

    console.log(`💳 Cobrança criada | charge_id: ${cobranca.chargeId}`);

    // -------- 2. Salva pedido em memória (associado ao charge_id) --------
    // ⚠️ Usamos charge_id como chave porque o webhook de cartão vem com charge_id
    salvarPedido(cobranca.chargeId, {
      nome,
      whatsapp,
      endereco,
      itens: itens.map(i => ({
        tipo: "Camiseta Normal",
        tamanho: i.tamanho,
        quantidade: i.quantidade,
        preco: PRECO_UNITARIO,
      })),
      total,
      metodoPagamento: "cartao",
    });

    // -------- 3. Paga a cobrança com o token do cartão --------
    const pagamento = await pagarCobrancaCartao(
      cobranca.chargeId,
      payment_token,
      {
        ...dadosCartao,
        rua: endereco.rua,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cep: endereco.cep,
        cidade: endereco.cidade,
        estado: endereco.estado,
        complemento: endereco.complemento,
      }
    );

    console.log(`💳 Pagamento processado | charge_id: ${cobranca.chargeId}`);

    // -------- 4. Devolve resultado --------
    const statusPagamento = pagamento?.data?.status || pagamento?.status || "unknown";

    res.json({
      chargeId: cobranca.chargeId,
      status: statusPagamento,
      valor: total,
      totalPecas,
      metodo: "cartao",
      mensagem:
        statusPagamento === "paid"
          ? "Pagamento aprovado!"
          : "Pagamento em processamento. Aguarde a confirmação.",
    });

  } catch (err) {
    console.error("❌ Erro ao gerar pagamento cartão:", err.message);

    if (err.response) {
      console.error("   Status:", err.response.status);
      console.error("   Body:", JSON.stringify(err.response.data, null, 2));
    }

    res.status(500).json({
      erro: "Erro ao processar pagamento com cartão",
      detalhe: err.response?.data || err.message,
    });
  }
});

module.exports = router;
