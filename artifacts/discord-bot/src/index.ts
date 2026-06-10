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
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';

const CLIENT_ID = '1513571324646391959';
const STAFF_ROLE_ID = '1514355564455530526';

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

// Rastrear tickets abiertos: channelId → userId
const ticketsAbiertos = new Map<string, string>();

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
    const unidadesStr = item.unidades > 0 ? `\`${item.unidades}\`` : '`⚠️ Sin stock`';

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
// 🎫 CREAR CANAL TICKET
// =========================
async function crearTicketCanal(opts: {
  guild: NonNullable<TextChannel['guild']>;
  userId: string;
  username: string;
  tipo: 'pedido' | 'reclamacion';
  itemName: string;
}): Promise<TextChannel | null> {
  const { guild, userId, username, tipo, itemName } = opts;
  const emoji = tipo === 'pedido' ? '🎫' : '🚨';
  const prefix = tipo === 'pedido' ? 'pedido' : 'reclamo';
  const channelName = `${prefix}-${username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);

  try {
    const channel = await guild.channels.create({
      name: `${emoji}｜${channelName}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: userId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: STAFF_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
    });

    ticketsAbiertos.set(channel.id, userId);
    return channel as TextChannel;
  } catch (err) {
    console.error('Error al crear canal:', err);
    return null;
  }
}


// =========================
// 🔧 SLASH COMMANDS
// =========================
const commands = [
  new SlashCommandBuilder()
    .setName('reclamacion')
    .setDescription('🚨 Abre una reclamación sobre tu pedido')
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
  .then(() => console.log('✅ Slash commands registrados'))
  .catch(console.error);


// =========================
// 🤖 CLIENTE
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
  if (!message.guild) return;
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


  // 🔄 RESTOCK (solo admins)
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
      return void message.reply(`❌ Producto no encontrado. Disponibles:\n${Object.keys(stock).map(n => `\`${n}\``).join(', ')}`);
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


  // 💰 COMPRAR → crea canal ticket
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
    const guild = message.guild;

    const ticketChannel = await crearTicketCanal({
      guild,
      userId: message.author.id,
      username: message.author.username,
      tipo: 'pedido',
      itemName,
    });

    if (!ticketChannel) {
      // Revertir stock si no se pudo crear el canal
      stock[itemName].unidades++;
      stock[itemName].ultimaVenta = null;
      return void message.reply('❌ No se pudo crear el ticket. Asegúrate de que el bot tiene permisos para gestionar canales.');
    }

    await message.reply(`✅ Tu pedido ha sido registrado. Canal creado: ${ticketChannel}`);

    const ticketEmbed = new EmbedBuilder()
      .setTitle('🎫 Nuevo Pedido — BD Services')
      .setDescription(`Hola <@${message.author.id}>, gracias por tu compra.\nEl staff te atenderá en breve para gestionar la entrega.`)
      .addFields(
        { name: `${item.emoji} Producto`, value: `\`${itemName}\``, inline: true },
        { name: '💰 Total', value: `\`${item.precio}€\``, inline: true },
        { name: '📦 Stock restante', value: `\`${item.unidades} unidades\``, inline: true },
        { name: '🕐 Pedido el', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false },
        { name: '👤 Cliente', value: `<@${message.author.id}>`, inline: true },
      )
      .setColor(0x5865f2)
      .setTimestamp()
      .setFooter({ text: 'BD Services · Sistema de tickets' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_entregado:${itemName}:${message.author.id}`)
        .setLabel('✅ Marcar entregado')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket_cancelar:${itemName}:${message.author.id}`)
        .setLabel('❌ Cancelar pedido')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ticket_cerrar:${message.author.id}`)
        .setLabel('🔒 Cerrar ticket')
        .setStyle(ButtonStyle.Secondary),
    );

    await ticketChannel.send({
      content: `<@${message.author.id}> | <@&${STAFF_ROLE_ID}>`,
      embeds: [ticketEmbed],
      components: [row],
    });

    return;
  }
});


// =========================
// 🎛️ INTERACCIONES
// =========================
client.on(Events.InteractionCreate, async (interaction) => {

  // /reclamacion → crea canal de reclamo
  if (interaction.isChatInputCommand() && interaction.commandName === 'reclamacion') {
    if (!interaction.guild) return;

    const producto = interaction.options.getString('producto', true);
    const item = stock[producto];

    const ticketChannel = await crearTicketCanal({
      guild: interaction.guild,
      userId: interaction.user.id,
      username: interaction.user.username,
      tipo: 'reclamacion',
      itemName: producto,
    });

    if (!ticketChannel) {
      return void interaction.reply({ content: '❌ No se pudo crear el canal de reclamación. El bot necesita permisos de gestionar canales.', ephemeral: true });
    }

    await interaction.reply({ content: `🚨 Canal de reclamación creado: ${ticketChannel}`, ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('🚨 Reclamación — BD Services')
      .setDescription(`Hola <@${interaction.user.id}>, has abierto una reclamación para **${item.emoji} ${producto}**.\nEl staff revisará tu caso.`)
      .addFields(
        { name: '❓ Motivo de reclamación', value: '¿Recibiste el producto? ¿Hubo algún problema? Explícalo aquí.' },
        { name: '👤 Cliente', value: `<@${interaction.user.id}>`, inline: true },
        { name: `${item.emoji} Producto`, value: `\`${producto}\``, inline: true },
      )
      .setColor(0xfee75c)
      .setTimestamp()
      .setFooter({ text: 'BD Services · Sistema de reclamaciones' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`rec_resuelto:${producto}:${interaction.user.id}`)
        .setLabel('✅ Resuelto')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`rec_reembolso:${producto}:${interaction.user.id}`)
        .setLabel('🔄 Reembolso / Restaurar stock')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ticket_cerrar:${interaction.user.id}`)
        .setLabel('🔒 Cerrar ticket')
        .setStyle(ButtonStyle.Secondary),
    );

    await ticketChannel.send({
      content: `<@${interaction.user.id}> | <@&${STAFF_ROLE_ID}>`,
      embeds: [embed],
      components: [row],
    });

    return;
  }


  // Botones
  if (interaction.isButton()) {
    const colonIdx = interaction.customId.indexOf(':');
    const accion = interaction.customId.slice(0, colonIdx);
    const resto = interaction.customId.slice(colonIdx + 1);

    const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || (interaction.member as any)?.roles?.cache?.has(STAFF_ROLE_ID);


    // 🔒 Cerrar ticket (cualquier canal)
    if (accion === 'ticket_cerrar') {
      const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket cerrado')
        .setDescription(`Ticket cerrado por <@${interaction.user.id}>.\nEste canal se eliminará en **5 segundos**.`)
        .setColor(0x99aab5)
        .setTimestamp();

      await interaction.update({ embeds: [closeEmbed], components: [] });

      setTimeout(async () => {
        if (interaction.channel && interaction.channel.type === ChannelType.GuildText) {
          await (interaction.channel as TextChannel).delete('Ticket cerrado').catch(() => {});
        }
      }, 5000);
      return;
    }


    // ✅ Pedido entregado
    if (accion === 'ticket_entregado') {
      if (!isStaff) {
        return void interaction.reply({ content: '❌ Solo el staff puede marcar pedidos como entregados.', ephemeral: true });
      }

      const lastColon = resto.lastIndexOf(':');
      const itemName = resto.slice(0, lastColon);
      const userId = resto.slice(lastColon + 1);
      const item = stock[itemName];

      const embed = new EmbedBuilder()
        .setTitle('✅ Pedido entregado')
        .setDescription(`El pedido de **${item?.emoji ?? ''} ${itemName}** para <@${userId}> ha sido marcado como **entregado** por <@${interaction.user.id}>.\nEste canal se eliminará en **5 segundos**.`)
        .setColor(0x57f287)
        .setTimestamp()
        .setFooter({ text: 'BD Services · Ticket cerrado' });

      await interaction.update({ embeds: [embed], components: [] });

      setTimeout(async () => {
        if (interaction.channel?.type === ChannelType.GuildText) {
          await (interaction.channel as TextChannel).delete('Pedido entregado').catch(() => {});
        }
      }, 5000);
      return;
    }


    // ❌ Cancelar pedido
    if (accion === 'ticket_cancelar') {
      if (!isStaff) {
        return void interaction.reply({ content: '❌ Solo el staff puede cancelar pedidos.', ephemeral: true });
      }

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
        .setDescription(`El pedido de **${item?.emoji ?? ''} ${itemName}** para <@${userId}> ha sido **cancelado** por <@${interaction.user.id}>.\nStock restaurado: \`${item?.unidades ?? '?'} unidades\`.\nEste canal se eliminará en **5 segundos**.`)
        .setColor(0xed4245)
        .setTimestamp()
        .setFooter({ text: 'BD Services · Ticket cerrado' });

      await interaction.update({ embeds: [embed], components: [] });

      setTimeout(async () => {
        if (interaction.channel?.type === ChannelType.GuildText) {
          await (interaction.channel as TextChannel).delete('Pedido cancelado').catch(() => {});
        }
      }, 5000);
      return;
    }


    // ✅ Reclamación resuelta
    if (accion === 'rec_resuelto') {
      if (!isStaff) {
        return void interaction.reply({ content: '❌ Solo el staff puede resolver reclamaciones.', ephemeral: true });
      }

      const lastColon = resto.lastIndexOf(':');
      const producto = resto.slice(0, lastColon);
      const userId = resto.slice(lastColon + 1);
      const item = stock[producto];

      const embed = new EmbedBuilder()
        .setTitle('✅ Reclamación resuelta')
        .setDescription(`La reclamación de **${item?.emoji ?? ''} ${producto}** para <@${userId}> ha sido marcada como **resuelta** por <@${interaction.user.id}>.\nEste canal se eliminará en **5 segundos**.`)
        .setColor(0x57f287)
        .setTimestamp()
        .setFooter({ text: 'BD Services · Reclamación cerrada' });

      await interaction.update({ embeds: [embed], components: [] });

      setTimeout(async () => {
        if (interaction.channel?.type === ChannelType.GuildText) {
          await (interaction.channel as TextChannel).delete('Reclamación resuelta').catch(() => {});
        }
      }, 5000);
      return;
    }


    // 🔄 Reembolso / restaurar stock
    if (accion === 'rec_reembolso') {
      if (!isStaff) {
        return void interaction.reply({ content: '❌ Solo el staff puede gestionar reembolsos.', ephemeral: true });
      }

      const lastColon = resto.lastIndexOf(':');
      const producto = resto.slice(0, lastColon);
      const userId = resto.slice(lastColon + 1);
      const item = stock[producto];

      if (item) {
        item.unidades++;
        item.ultimaVenta = null;
      }

      const embed = new EmbedBuilder()
        .setTitle('🔄 Reembolso procesado')
        .setDescription(`El reembolso de **${item?.emoji ?? ''} ${producto}** para <@${userId}> ha sido procesado por <@${interaction.user.id}>.\nStock restaurado: \`${item?.unidades ?? '?'} unidades\`.\nEste canal se eliminará en **5 segundos**.`)
        .setColor(0xfee75c)
        .setTimestamp()
        .setFooter({ text: 'BD Services · Reclamación cerrada' });

      await interaction.update({ embeds: [embed], components: [] });

      setTimeout(async () => {
        if (interaction.channel?.type === ChannelType.GuildText) {
          await (interaction.channel as TextChannel).delete('Reembolso procesado').catch(() => {});
        }
      }, 5000);
      return;
    }
  }
});


// =========================
// 🔑 LOGIN
// =========================
client.login(token);
