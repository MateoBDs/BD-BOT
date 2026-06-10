import { Client, GatewayIntentBits } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ Falta la variable de entorno DISCORD_TOKEN');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`🤖 BD Bot conectado como ${client.user!.tag}`);
});


// =========================
// 🛍️ TIENDA BD
// =========================
const tienda = [
  { id: 1, nombre: "Web Básica", precio: 5 },
  { id: 2, nombre: "Web Pro", precio: 15 },
  { id: 3, nombre: "Bot Discord", precio: 10 }
];


// =========================
// 📦 STOCKS SEPARADOS
// =========================
let stockPedidos = {
  webs: 5,
  bots: 3
};

let stockTienda: Record<string, number> = {
  "Web Básica": 10,
  "Web Pro": 5,
  "Bot Discord": 3
};


// =========================
// 💬 COMANDOS
// =========================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const msg = message.content;


  // =========================
  // 🛍️ TIENDA
  // =========================
  if (msg === '!tienda') {
    let texto = "🛍️ TIENDA BD:\n\n";
    tienda.forEach(p => {
      texto += `ID ${p.id} | ${p.nombre} - ${p.precio}€\n`;
    });
    return void message.reply(texto);
  }


  // =========================
  // 📦 STOCK PEDIDOS
  // =========================
  if (msg === '!stock pedidos') {
    return void message.reply(
      `📦 STOCK PEDIDOS:\n🌐 Webs: ${stockPedidos.webs}\n🤖 Bots: ${stockPedidos.bots}`
    );
  }


  // =========================
  // 📦 STOCK TIENDA
  // =========================
  if (msg === '!stock tienda') {
    let texto = "📦 STOCK TIENDA BD:\n\n";
    for (let item in stockTienda) {
      texto += `${item}: ${stockTienda[item]}\n`;
    }
    return void message.reply(texto);
  }


  // =========================
  // 💰 COMPRAR TIENDA
  // =========================
  if (msg.startsWith('!buy ')) {
    const itemName = msg.slice(5);

    if (stockTienda[itemName] === undefined) {
      return void message.reply("❌ Ese producto no existe en la tienda");
    }

    if (stockTienda[itemName] <= 0) {
      return void message.reply("❌ No hay stock de ese producto");
    }

    stockTienda[itemName]--;
    return void message.reply(`✅ Compra realizada: ${itemName}\n📩 Contacta staff para entrega`);
  }


  // =========================
  // 🧪 PEDIDO WEB
  // =========================
  if (msg === '!buy web') {
    if (stockPedidos.webs <= 0) {
      return void message.reply("❌ No hay stock de webs");
    }
    stockPedidos.webs--;
    return void message.reply("✅ Pedido de web añadido a cola BD");
  }



});


// =========================
// 🔑 LOGIN
// =========================
client.login(token);
