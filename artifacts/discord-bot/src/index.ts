import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  ThreadAutoArchiveDuration,
  ChannelType,
} from 'discord.js';

const CLIENT_ID = '1513571324646391959';
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ Falta la variable de entorno DISCORD_TOKEN');
  process.exit(1);
}


// =========================
// 📦 STOCK UNIFICADO
// =========================
interface StockItem {
  emoji: string;
  precio: number;
  unidades: number;
  ultimaVenta: { timestamp: number; userId: string } | null;
  ultimoRestock: number;
}

const stock: Record<string, StockItem> = {
  "Web Básica": {
    emoji: "🌐",
    precio: 5,
    unidades: 10,
    ultimaVenta: null,
    ultimoRestock: Math.floor(Date.now() / 1000),
  },
  "Web Pro": {
    emoji: "💎",
    precio: 15,
    unidades: 5,
    ultimaVenta: null,
    ultimoRestock: Math.floor(Date.now() / 1000),
  },
  "Bot Discord": {
    emoji: "🤖",
    precio: 10,
    unidades: 3,
    ultimaVenta: null,
    ultimoRestock: Math.floor(Date.now() / 1000),
  },
};

function buildStockEmbed(): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('📦 BD » STOCK')
    .setDescription('A continuación se mostrará el stock de nuestros pedidos.')
    .setColor(0x5865f2)
    .setTimestamp()
    .setFooter({ text: 'BD Services · Stock actualizado automáticamente' });

  for (const [nombre, item] of Object.entries(stock)) {
    const ultimaVenta = item.ultimaVenta
      ? `<t:${item.ultimaVenta.timestamp}:f> · <@${item.ultimaVenta.userId}>`
      : '`Sin ventas aún`';
    const ultimoRestock = `<t:${item.ultimoRestock}:f>`;
    const unidadesStr = item.unidades > 0
      ? `\`${item.unidades}\``
      : '`⚠️ Sin stock`';

    embed.addFields({
      name: `${item.emoji} ${nombre}`,
      value: [
        `> 📦 **Unidades:** ${unidadesStr}`,
        `> 💰 **Precio:** \`${item.precio}€\``,
        `> 🛒 **Última venta:** ${ultimaVenta}`,
        `> 🔄 **Último restock:** ${ultimoRestock}`,
      ].join('\n'),
    });
  }

  return embed;
}


// =========================
// 🔧 SLASH COMMANDS
// =========================
const commands = [
  new SlashCommandBuilder()
    .setName('reclamacion')
    .setDescription('📩 Abre una reclamación sobre tu pedido')
    .addStringOption(opt =>
      opt
        .setName('producto')
        .setDescription('Producto que reclamás')
        .setRequired(true)
        .addChoices(
          { name: '🌐 Web Básica', value: 'Web Básica' },
          { name: '💎 Web Pro', value: 'Web Pro' },
          { name: '🤖 Bot Discord', value: 'Bot Discord' },
        )
    ),
];

const rest = new REST().setToken(token);
rest
  .put(Routes.applicationCommands(CLIENT_ID), { body: commands })
  .then(() => console.log('✅ Slash commands registrados globalmente'))
  .catch(console.error);


// =========================
// 🤖 CLIENTE DISCORD
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, () => {
  console.log(`🤖 BD Bot conectado como ${client.user!.tag}`);
});


// =========================
// 💬 COMANDOS DE TEXTO
// =========================
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const msg = message.content.trim();


  // 🛍️ TIENDA
  if (msg === '!tienda') {
    const embed = new EmbedBuilder()
      .setTitle('🛍️ BD » TIENDA')
      .setDescription('Estos son nuestros productos disponibles:')
      .setColor(0x57f287)
      .setTimestamp()
      .setFooter({ text: 'BD Services · Usa !buy <producto> para comprar' });

    for (const [nombre, item] of Object.entries(stock)) {
      embed.addFields({
        name: `${item.emoji} ${nombre}`,
        value: `> 💰 **Precio:** \`${item.precio}€\`\n> 📦 **Stock:** \`${item.unidades} unidades\``,
        inline: true,
      });
    }

    return void message.reply({ embeds: [embed] });
  }


  // 📦 STOCK
  if (msg === '!stock') {
    return void message.reply({ embeds: [buildStockEmbed()] });
  }


  // 🔄 RESTOCK (solo administradores)
  if (msg.startsWith('!restock ')) {
    const member = message.member;
    if (!member?.permissions.has('Administrator')) {
      return void message.reply('❌ Solo el staff puede usar este comando.');
    }

    const partes = msg.slice(9).trim().split(' ');
    const cantidadStr = partes.pop();
    const itemName = partes.join(' ');
    const cantidad = parseInt(cantidadStr ?? '', 10);

    if (!itemName || isNaN(cantidad) || cantidad <= 0) {
      return void message.reply('❌ Uso correcto: `!restock <producto> <cantidad>`\nEjemplo: `!restock Web Pro 5`');
    }

    if (!stock[itemName]) {
      return void message.reply(`❌ Producto no encontrado. Productos disponibles:\n${Object.keys(stock).map(n => `\`${n}\``).join(', ')}`);
    }

    stock[itemName].unidades += cantidad;
    stock[itemName].ultimoRestock = Math.floor(Date.now() / 1000);

    const item = stock[itemName];
    const embed = new EmbedBuilder()
      .setTitle('🔄 Restock realizado')
      .setDescription(`El stock de **${item.emoji} ${itemName}** ha sido actualizado.`)
      .addFields(
        { name: '📦 Unidades añadidas', value: `\`+${cantidad}\``, inline: true },
        { name: '📦 Stock total', value: `\`${item.unidades} unidades\``, inline: true },
        { name: '🔄 Restock por', value: `<@${message.author.id}>`, inline: true },
        { name: '🕐 Fecha', value: `<t:${item.ultimoRestock}:f>`, inline: false },
      )
      .setColor(0x57f287)
      .setTimestamp()
      .setFooter({ text: 'BD Services · Stock actualizado' });

    return void message.reply({ embeds: [embed] });
  }


  // 💰 COMPRAR
  if (msg.startsWith('!buy ')) {
    const itemName = msg.slice(5).trim();

    if (!stock[itemName]) {
      return void message.reply('❌ Ese producto no existe. Usa `!tienda` para ver los disponibles.');
    }

    if (stock[itemName].unidades <= 0) {
      return void message.reply(`❌ No hay stock de **${itemName}** en este momento.`);
    }

    stock[itemName].unidades--;
    stock[itemName].ultimaVenta = {
      timestamp: Math.floor(Date.now() / 1000),
      userId: message.author.id,
    };

    const item = stock[itemName];

    const confirmEmbed = new EmbedBuilder()
      .setTitle('🎫 Pedido registrado')
      .setDescription(`Tu pedido ha sido abierto. Se ha creado un ticket a continuación.`)
      .addFields(
        { name: `${item.emoji} Producto`, value: `\`${itemName}\``, inline: true },
        { name: '💰 Precio', value: `\`${item.precio}€\``, inline: true },
        { name: '📦 Stock restante', value: `\`${item.unidades} unidades\``, inline: true },
      )
      .setColor(0x5865f2)
      .setTimestamp()
      .setFooter({ text: 'BD Services · Ticket creado automáticamente' });

    const reply = await message.reply({ embeds: [confirmEmbed] });

    // Crear hilo (ticket)
    const channel = message.channel;
    if (
      channel.type === ChannelType.GuildText ||
      channel.type === ChannelType.GuildAnnouncement
    ) {
      try {
        const thread = await channel.threads.create({
          name: `🎫 ${itemName} · ${message.author.username}`,
          autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
          startMessage: reply,
          reason: `Pedido de ${message.author.tag}`,
        });

        const ticketEmbed = new EmbedBuilder()
          .setTitle('📋 Ticket de Pedido')
          .setDescription(`Hola <@${message.author.id}>, gracias por tu compra.\nEl staff se pondrá en contacto contigo para gestionar la entrega.`)
          .addFields(
            { name: `${item.emoji} Producto`, value: `\`${itemName}\``, inline: true },
            { name: '💰 Total', value: `\`${item.precio}€\``, inline: true },
            { name: '🕐 Pedido', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
          )
          .setColor(0xfee75c)
          .setTimestamp()
          .setFooter({ text: 'BD Services · Gestiona el pedido con los botones de abajo' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`pedido_entregado:${itemName}:${message.author.id}`)
            .setLabel('✅ Marcar como entregado')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`pedido_cancelar:${itemName}:${message.author.id}`)
            .setLabel('❌ Cancelar pedido')
            .setStyle(ButtonStyle.Danger),
        );

        await thread.send({ embeds: [ticketEmbed], components: [row] });
      } catch (err) {
        console.error('Error al crear hilo:', err);
      }
    }

    return;
  }
});


// =========================
// 🎛️ INTERACCIONES (SLASH + BOTONES)
// =========================
client.on(Events.InteractionCreate, async (interaction) => {

  // /reclamacion
  if (interaction.isChatInputCommand() && interaction.commandName === 'reclamacion') {
    const producto = interaction.options.getString('producto', true);
    const item = stock[producto];

    const embed = new EmbedBuilder()
      .setTitle('📩 Nueva Reclamación')
      .setDescription(`Hola <@${interaction.user.id}>, has abierto una reclamación para **${item.emoji} ${producto}**.`)
      .addFields(
        { name: '❓ Pregunta', value: '¿Recibiste el producto correctamente y se completó la compra?', inline: false },
      )
      .setColor(0xfee75c)
      .setTimestamp()
      .setFooter({ text: 'BD Services · Sistema de reclamaciones' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`rec_si:${producto}`)
        .setLabel('✅ Sí, lo recibí')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`rec_no:${producto}`)
        .setLabel('❌ No lo recibí')
        .setStyle(ButtonStyle.Danger),
    );

    return void interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  // Botones
  if (interaction.isButton()) {
    const colonIdx = interaction.customId.indexOf(':');
    const accion = interaction.customId.slice(0, colonIdx);
    const resto = interaction.customId.slice(colonIdx + 1);

    // --- Botones de ticket de pedido ---
    if (accion === 'pedido_entregado') {
      const lastColon = resto.lastIndexOf(':');
      const itemName = resto.slice(0, lastColon);
      const userId = resto.slice(lastColon + 1);
      const item = stock[itemName];

      const embed = new EmbedBuilder()
        .setTitle('✅ Pedido entregado')
        .setDescription(`El pedido de **${item?.emoji ?? ''} ${itemName}** para <@${userId}> ha sido marcado como **entregado**.`)
        .setColor(0x57f287)
        .setTimestamp()
        .setFooter({ text: 'BD Services · Ticket cerrado' });

      await interaction.update({ embeds: [embed], components: [] });

      // Archivar el hilo
      if (interaction.channel?.isThread()) {
        await interaction.channel.setArchived(true).catch(() => {});
      }
      return;
    }

    if (accion === 'pedido_cancelar') {
      const lastColon = resto.lastIndexOf(':');
      const itemName = resto.slice(0, lastColon);
      const userId = resto.slice(lastColon + 1);
      const item = stock[itemName];

      if (item) {
        item.unidades++;
        item.ultimaVenta = null;
      }

      const embed = new EmbedBuilder()
        .setTitle('❌ Pedido cancelado')
        .setDescription(`El pedido de **${item?.emoji ?? ''} ${itemName}** para <@${userId}> ha sido **cancelado**.\nEl stock ha sido restaurado automáticamente (\`${item?.unidades ?? '?'} unidades\`).`)
        .setColor(0xed4245)
        .setTimestamp()
        .setFooter({ text: 'BD Services · Ticket cerrado' });

      await interaction.update({ embeds: [embed], components: [] });

      if (interaction.channel?.isThread()) {
        await interaction.channel.setArchived(true).catch(() => {});
      }
      return;
    }

    // --- Botones de reclamación ---
    if (accion === 'rec_si') {
      const producto = resto;
      const embed = new EmbedBuilder()
        .setTitle('✅ Reclamación cerrada')
        .setDescription(`Gracias por confirmar. La compra de **${stock[producto]?.emoji ?? ''} ${producto}** ha sido marcada como **completada**.`)
        .setColor(0x57f287)
        .setTimestamp()
        .setFooter({ text: 'BD Services · Reclamación resuelta' });

      return void interaction.update({ embeds: [embed], components: [] });
    }

    if (accion === 'rec_no') {
      const producto = resto;
      const item = stock[producto];
      if (item) {
        item.unidades++;
        item.ultimaVenta = null;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔄 Stock restaurado')
        .setDescription(`Tu reclamación de **${item?.emoji ?? ''} ${producto}** ha sido registrada.\nEl stock ha sido **restaurado automáticamente** (\`${item?.unidades ?? '?'} unidades\`).`)
        .addFields(
          { name: '📞 Siguiente paso', value: 'Un miembro del staff se pondrá en contacto contigo pronto.' },
        )
        .setColor(0xed4245)
        .setTimestamp()
        .setFooter({ text: 'BD Services · Contacta al staff si necesitas más ayuda' });

      return void interaction.update({ embeds: [embed], components: [] });
    }
  }
});


// =========================
// 🔑 LOGIN
// =========================
client.login(token);
