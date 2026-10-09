
const axios = require("axios");
const https = require("https");
const fs = require("fs");

console.log("💳 EFI CARTAO SERVICE CARREGADO");

const EFI_ENV = process.env.EFI_ENV || "production";

const baseURL =
  EFI_ENV === "homolog"
    ? "https://cobrancas-h.api.efipay.com.br"
    : "https://cobrancas.api.efipay.com.br";

// 🔐 HTTPS Agent (usa o mesmo certificado do Pix)
function httpsAgent() {
  return new https.Agent({
    pfx: fs.readFileSync("/tmp/efi-cert.p12"),
    passphrase: "",
  });
}

// 🔑 TOKEN (mesma rota de OAuth, mas na URL de cobranças)
async function getToken() {
  const response = await axios.post(
    `${baseURL}/v1/authorize`,
    { grant_type: "client_credentials" },
    {
      httpsAgent: httpsAgent(),
      auth: {
        username: process.env.EFI_CLIENT_ID,
        password: process.env.EFI_CLIENT_SECRET,
      },
    }
  );

  return response.data.access_token;
}

/* ======================================================
   CRIAR COBRANÇA (CARTÃO DE CRÉDITO)
====================================================== */
async function criarCobrancaCartao({ valor, descricao, nome, cpf, email, telefone }) {
  const token = await getToken();

  const body = {
    items: [
      {
        name: descricao || "Pedido Levanta Limeira",
        value: Math.round(valor * 100), // Efí usa centavos
        amount: 1,
      },
    ],
    customer: {
      name: nome,
      cpf: (cpf || "").replace(/\D/g, ""),
      email: email || "cliente@levantaLimeira.com",
      phone_number: (telefone || "").replace(/\D/g, ""),
    },
  };

  const response = await axios.post(
    `${baseURL}/v1/charge`,
    body,
    {
      httpsAgent: httpsAgent(),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return {
    chargeId: response.data.data.charge_id,
    status: response.data.data.status,
    raw: response.data,
  };
}

/* ======================================================
   PAGAR COBRANÇA COM TOKEN DO CARTÃO
====================================================== */
async function pagarCobrancaCartao(chargeId, paymentToken, dadosCartao) {
  const token = await getToken();

  const body = {
    payment: {
      credit_card: {
        payment_token: paymentToken,
        billing_address: {
          street: dadosCartao.rua || "Não informado",
          number: dadosCartao.numero || "S/N",
          neighborhood: dadosCartao.bairro || "Centro",
          zipcode: (dadosCartao.cep || "00000000").replace(/\D/g, ""),
          city: dadosCartao.cidade || "Limeira",
          state: dadosCartao.estado || "SP",
          complement: dadosCartao.complemento || "",
        },
        customer: {
          name: dadosCartao.nomeTitular,
          cpf: (dadosCartao.cpfTitular || "").replace(/\D/g, ""),
          email: dadosCartao.email || "cliente@levantaLimeira.com",
          phone_number: (dadosCartao.telefone || "").replace(/\D/g, ""),
        },
      },
    },
  };

  const response = await axios.post(
    `${baseURL}/v1/charge/${chargeId}/pay`,
    body,
    {
      httpsAgent: httpsAgent(),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}

module.exports = {
  criarCobrancaCartao,
  pagarCobrancaCartao,
};
