const express = require("express");
const cors = require("cors");
const pixRoutes = require("./routes/pix.routes");
const webhookRoutes = require("./routes/webhook.routes");
const cartaoRoutes = require("./routes/cartao.routes");

const app = express();

/* 🔓 CORS LIBERADO */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options("*", cors());

app.use(express.json());

/* 📡 Rotas */
app.use("/pix", pixRoutes);
app.use("/webhook", webhookRoutes);
app.use("/cartao", cartaoRoutes);

/* 🩺 Health check */
app.get("/", (req, res) => {
  res.json({ status: "API Pix Efí rodando" });
});

module.exports = app;
