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
// 📦 STOCK
// =========================
interface StockItem {
  emoji: string;
  precio: number;
  unidades: number;
  ultimaVenta: { timestamp: number; userId: string } | null;
  ultimoRestock: number;
}

const stock: Record<string, StockItem> = {
  "Web Básica":   { emoji: "🌐", precio: 5,  unidades: 10, ultimaVenta: null, ultimoRestock: Math.floor(Date.now() / 1000) },
  "Web Pro":      { emoji: "💎", precio: 15, unidades: 5,  ultimaVenta: null, ultimoRestock: Math.floor(Date.now() / 1000) },
  "Bot Discord":  { emoji: "🤖", precio: 10, unidades: 3,  ultimaVenta: null, ultimoRestock: Math.floor(Date.now() / 1000) },
};

function buildStockEmbed(): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('📦 BD » STOCK')
    .setDescription('A continuación se mostrará el stock de nuestros pedidos.')
    .setColor(0x5865f2)
    .setTimestamp()
    .setFooter({ text: 'BD Services · Stock actualizado automáticamente' });

  for (const [nombre, item] of Object.entries(stock)) {
    const ultimaVenta  = item.ultimaVenta ? `<t:${item.ultimaVenta.timestamp}:f> · <@${item.ultimaVenta.userId}>` : '`Sin ventas aún`';
    const ultimoRestock = `<t:${item.ultimoRestock}:f>`;
    const unidadesStr  = item.unidades > 0 ? `\`${item.unidades}\`` : '`⚠️ Sin stock`';
    embed.addFields({ name: `${item.emoji} ${nombre}`, value: [`> 📦 **Unidades:** ${unidadesStr}`, `> 💰 **Precio:** \`${item.precio}€\``, `> 🛒 **Última venta:** ${ultimaVenta}`, `> 🔄 **Último restock:** ${ultimoRestock}`].join('\n') });
  }
  return embed;
}


// =========================
// 📋 POSTULACIONES
// =========================
const PREGUNTAS: { seccion?: string; texto: string }[] = [
  { seccion: '🧾 Información básica',       texto: '¿Cuál es tu nombre o apodo?' },
  {                                          texto: '¿Cuántos años tienes?' },
  {                                          texto: '¿En qué país vives y cuál es tu zona horaria?' },
  {                                          texto: '¿Cuánto tiempo sueles estar activo en Discord al día?' },
  { seccion: '💬 Experiencia',               texto: '¿Has sido staff en algún otro servidor? Si es así, ¿cuál era tu rol?' },
  {                                          texto: '¿Qué conocimientos tienes sobre moderación en Discord?' },
  {                                          texto: '¿Has usado herramientas como bots de moderación (Dyno, MEE6, Carl-bot, etc.)?' },
  { seccion: '⚖️ Situaciones de moderación', texto: '¿Qué harías si un usuario insulta a otros miembros?' },
  {                                          texto: '¿Cómo actuarías si ves spam o flood en el chat?' },
  {                                          texto: 'Si dos usuarios están discutiendo fuertemente, ¿cómo lo resolverías?' },
  {                                          texto: '¿Qué harías si un usuario VIP rompe una norma importante?' },
  {                                          texto: '¿Cómo actuarías si no hay pruebas claras en un conflicto?' },
  { seccion: '🧠 Comportamiento y criterio', texto: '¿Por qué quieres ser staff en este servidor?' },
  {                                          texto: '¿Qué significa para ti ser un buen moderador?' },
  {                                          texto: '¿Cómo manejas el estrés o situaciones de presión?' },
  {                                          texto: '¿Cómo te aseguras de ser imparcial?' },
  { seccion: '🛠️ Responsabilidad',           texto: '¿Qué harías si ves a otro staff actuando mal?' },
  {                                          texto: '¿Qué harías si un usuario te reporta a ti personalmente?' },
  {                                          texto: '¿Qué harías si tienes dudas sobre una decisión importante?' },
  { seccion: '⏳ Disponibilidad',             texto: '¿Cuántas horas puedes dedicar al servidor diariamente o semanalmente?' },
  {                                          texto: '¿Tienes algún horario fijo o restricciones de tiempo?' },
];

interface AppState {
  userId: string;
  currentQ: number;
  answers: string[];
}

// channelId → estado de la postulación
const appsActivas = new Map<string, AppState>();

function buildPreguntaEmbed(idx: number): EmbedBuilder {
  const p = PREGUNTAS[idx];
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📋 Pregunta ${idx + 1} / ${PREGUNTAS.length}`)
    .setDescription(p.seccion ? `**${p.seccion}**\n\n${p.texto}` : p.texto)
    .setFooter({ text: 'Escribe tu respuesta a continuación' });
  return embed;
}

function buildResumenEmbed(userId: string, answers: string[]): EmbedBuilder[] {
  // Dividir en múltiples embeds si hace falta (máx 25 fields por embed)
  const embeds: EmbedBuilder[] = [];
  const chunks: { name: string; value: string }[][] = [[]];

  PREGUNTAS.forEach((p, i) => {
    const field = {
      name: `${i + 1}. ${p.texto.length > 100 ? p.texto.slice(0, 97) + '…' : p.texto}`,
      value: (answers[i] ?? '*(sin respuesta)*').slice(0, 1024),
    };
    if (chunks[chunks.length - 1].length >= 25) chunks.push([]);
    chunks[chunks.length - 1].push(field);
  });

  chunks.forEach((fields, ci) => {
    const e = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTimestamp()
      .addFields(fields);

    if (ci === 0) {
      e.setTitle('📋 Postulación completada')
        .setDescription(`**Solicitante:** <@${userId}>\n**Fecha:** <t:${Math.floor(Date.now() / 1000)}:f>`)
        .setAuthor({ name: 'BD Services · Sistema de postulaciones' });
    }
    if (ci === chunks.length - 1) {
      e.setFooter({ text: 'BD Services · Revisa las respuestas y decide' });
    }
    embeds.push(e);
  });

  return embeds;
}


// =========================
// 🎫 CREAR CANAL TICKET
// =========================
async function crearTicketCanal(opts: {
  guild: NonNullable<TextChannel['guild']>;
  userId: string;
  username: string;
  tipo: 'pedido' | 'reclamacion' | 'postulacion';
  itemName?: string;
}): Promise<TextChannel | null> {
  const { guild, userId, username, tipo } = opts;
  const map = { pedido: '🎫｜pedido', reclamacion: '🚨｜reclamo', postulacion: '📋｜postula' };
  const channelName = `${map[tipo]}-${username}`.toLowerCase().replace(/[^a-z0-9-｜]/g, '-').slice(0, 45);

  try {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id,     deny:  [PermissionFlagsBits.ViewChannel] },
        { id: userId,       allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ],
    });
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
      opt.setName('producto').setDescription('Producto que reclamás').setRequired(true)
        .addChoices(
          { name: '🌐 Web Básica', value: 'Web Básica' },
          { name: '💎 Web Pro',    value: 'Web Pro' },
          { name: '🤖 Bot Discord', value: 'Bot Discord' },
        )
    ),
  new SlashCommandBuilder()
    .setName('postular')
    .setDescription('📋 Postúlate para ser staff de BD Services'),
];

const GUILD_ID = '1511755312162668815';

const rest = new REST().setToken(token);
rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
  .then(() => console.log('✅ Slash commands registrados (guild)'))
  .catch(console.error);


// =========================
// 🤖 CLIENTE
// =========================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, () => console.log(`🤖 BD Bot conectado como ${client.user!.tag}`));


// =========================
// 💬 MENSAJES
// =========================
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  const msg = message.content.trim();

  // ─── Flujo de postulación activa ───
  const appState = appsActivas.get(message.channelId);
  if (appState && message.author.id === appState.userId) {
    appState.answers.push(msg);
    const next = appState.currentQ + 1;

    if (next < PREGUNTAS.length) {
      appState.currentQ = next;
      return void message.channel.send({ embeds: [buildPreguntaEmbed(next)] });
    }

    // Todas las preguntas respondidas → resumen + botones
    appsActivas.delete(message.channelId);

    const resumenEmbeds = buildResumenEmbed(appState.userId, appState.answers);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`post_aceptar:${appState.userId}`)
        .setLabel('✅ Aceptar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`post_rechazar:${appState.userId}`)
        .setLabel('❌ Rechazar')
        .setStyle(ButtonStyle.Danger),
    );

    await message.channel.send({
      content: `<@&${STAFF_ROLE_ID}> Nueva postulación completada por <@${appState.userId}>`,
      embeds: resumenEmbeds,
      components: [row],
    });
    return;
  }

  // ─── Comandos normales ───
  if (msg === '!tienda') {
    const embed = new EmbedBuilder().setTitle('🛍️ BD » TIENDA').setDescription('Nuestros productos disponibles:').setColor(0x57f287).setTimestamp().setFooter({ text: 'BD Services · Usa !buy <producto> para comprar' });
    for (const [nombre, item] of Object.entries(stock)) {
      embed.addFields({ name: `${item.emoji} ${nombre}`, value: `> 💰 **Precio:** \`${item.precio}€\`\n> 📦 **Stock:** \`${item.unidades} unidades\``, inline: true });
    }
    return void message.reply({ embeds: [embed] });
  }

  if (msg === '!stock') {
    return void message.reply({ embeds: [buildStockEmbed()] });
  }

  if (msg.startsWith('!restock ')) {
    if (!message.member?.permissions.has('Administrator')) return void message.reply('❌ Solo el staff puede usar este comando.');
    const partes = msg.slice(9).trim().split(' ');
    const cantidadStr = partes.pop();
    const itemName = partes.join(' ');
    const cantidad = parseInt(cantidadStr ?? '', 10);
    if (!itemName || isNaN(cantidad) || cantidad <= 0) return void message.reply('❌ Uso: `!restock <producto> <cantidad>`');
    if (!stock[itemName]) return void message.reply(`❌ Producto no encontrado. Disponibles: ${Object.keys(stock).map(n => `\`${n}\``).join(', ')}`);
    stock[itemName].unidades += cantidad;
    stock[itemName].ultimoRestock = Math.floor(Date.now() / 1000);
    const item = stock[itemName];
    return void message.reply({ embeds: [new EmbedBuilder().setTitle('🔄 Restock realizado').setDescription(`**${item.emoji} ${itemName}** actualizado.`).addFields({ name: '📦 Añadidas', value: `\`+${cantidad}\``, inline: true }, { name: '📦 Total', value: `\`${item.unidades}\``, inline: true }, { name: '🔄 Por', value: `<@${message.author.id}>`, inline: true }, { name: '🕐 Fecha', value: `<t:${item.ultimoRestock}:f>` }).setColor(0x57f287).setTimestamp()] });
  }

  if (msg.startsWith('!buy ')) {
    const itemName = msg.slice(5).trim();
    if (!stock[itemName]) return void message.reply('❌ Ese producto no existe. Usa `!tienda`.');
    if (stock[itemName].unidades <= 0) return void message.reply(`❌ Sin stock de **${itemName}**.`);

    stock[itemName].unidades--;
    stock[itemName].ultimaVenta = { timestamp: Math.floor(Date.now() / 1000), userId: message.author.id };
    const item = stock[itemName];

    const ticketChannel = await crearTicketCanal({ guild: message.guild, userId: message.author.id, username: message.author.username, tipo: 'pedido', itemName });
    if (!ticketChannel) {
      stock[itemName].unidades++;
      stock[itemName].ultimaVenta = null;
      return void message.reply('❌ No se pudo crear el ticket. El bot necesita permiso de Gestionar canales.');
    }

    await message.reply(`✅ Pedido registrado. Canal creado: ${ticketChannel}`);

    const ticketEmbed = new EmbedBuilder().setTitle('🎫 Nuevo Pedido — BD Services').setDescription(`Hola <@${message.author.id}>, gracias por tu compra. El staff te atenderá en breve.`).addFields({ name: `${item.emoji} Producto`, value: `\`${itemName}\``, inline: true }, { name: '💰 Total', value: `\`${item.precio}€\``, inline: true }, { name: '📦 Stock restante', value: `\`${item.unidades}\``, inline: true }, { name: '🕐 Pedido el', value: `<t:${Math.floor(Date.now() / 1000)}:f>` }, { name: '👤 Cliente', value: `<@${message.author.id}>` }).setColor(0x5865f2).setTimestamp().setFooter({ text: 'BD Services · Sistema de tickets' });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket_entregado:${itemName}:${message.author.id}`).setLabel('✅ Marcar entregado').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ticket_cancelar:${itemName}:${message.author.id}`).setLabel('❌ Cancelar pedido').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_cerrar:${message.author.id}`).setLabel('🔒 Cerrar ticket').setStyle(ButtonStyle.Secondary),
    );
    await ticketChannel.send({ content: `<@${message.author.id}> | <@&${STAFF_ROLE_ID}>`, embeds: [ticketEmbed], components: [row] });
    return;
  }
});


// =========================
// 🎛️ INTERACCIONES
// =========================
client.on(Events.InteractionCreate, async (interaction) => {

  if (interaction.isChatInputCommand()) {

    // /postular
    if (interaction.commandName === 'postular') {
      if (!interaction.guild) return;

      const ticketChannel = await crearTicketCanal({ guild: interaction.guild, userId: interaction.user.id, username: interaction.user.username, tipo: 'postulacion' });
      if (!ticketChannel) return void interaction.reply({ content: '❌ No se pudo crear el canal. El bot necesita Gestionar canales.', ephemeral: true });

      await interaction.reply({ content: `📋 Canal de postulación creado: ${ticketChannel}`, ephemeral: true });

      const bienvenida = new EmbedBuilder()
        .setTitle('📋 Postulación a Staff — BD Services')
        .setDescription(`Hola <@${interaction.user.id}>, bienvenido al proceso de postulación.\n\nTe haré **${PREGUNTAS.length} preguntas** una a una. Responde con sinceridad, no hay prisa.\n\n¡Mucho ánimo! 💪`)
        .setColor(0x5865f2)
        .setTimestamp()
        .setFooter({ text: 'BD Services · Postulaciones' });

      await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [bienvenida] });
      await ticketChannel.send({ embeds: [buildPreguntaEmbed(0)] });

      appsActivas.set(ticketChannel.id, { userId: interaction.user.id, currentQ: 0, answers: [] });
      return;
    }

    // /reclamacion
    if (interaction.commandName === 'reclamacion') {
      if (!interaction.guild) return;
      const producto = interaction.options.getString('producto', true);
      const item = stock[producto];
      const ticketChannel = await crearTicketCanal({ guild: interaction.guild, userId: interaction.user.id, username: interaction.user.username, tipo: 'reclamacion', itemName: producto });
      if (!ticketChannel) return void interaction.reply({ content: '❌ No se pudo crear el canal.', ephemeral: true });

      await interaction.reply({ content: `🚨 Canal de reclamación creado: ${ticketChannel}`, ephemeral: true });

      const embed = new EmbedBuilder().setTitle('🚨 Reclamación — BD Services').setDescription(`Hola <@${interaction.user.id}>, has abierto una reclamación para **${item.emoji} ${producto}**.\nExplica tu problema aquí y el staff te ayudará.`).addFields({ name: '👤 Cliente', value: `<@${interaction.user.id}>`, inline: true }, { name: `${item.emoji} Producto`, value: `\`${producto}\``, inline: true }).setColor(0xfee75c).setTimestamp().setFooter({ text: 'BD Services · Sistema de reclamaciones' });
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`rec_resuelto:${producto}:${interaction.user.id}`).setLabel('✅ Resuelto').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rec_reembolso:${producto}:${interaction.user.id}`).setLabel('🔄 Reembolso / Restaurar stock').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ticket_cerrar:${interaction.user.id}`).setLabel('🔒 Cerrar ticket').setStyle(ButtonStyle.Secondary),
      );
      await ticketChannel.send({ content: `<@${interaction.user.id}> | <@&${STAFF_ROLE_ID}>`, embeds: [embed], components: [row] });
      return;
    }
  }

  if (!interaction.isButton()) return;

  const colonIdx = interaction.customId.indexOf(':');
  const accion = interaction.customId.slice(0, colonIdx);
  const resto  = interaction.customId.slice(colonIdx + 1);
  const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || (interaction.member as any)?.roles?.cache?.has(STAFF_ROLE_ID);

  async function cerrarCanal(msg: EmbedBuilder) {
    await interaction.update({ embeds: [msg], components: [] });
    setTimeout(async () => {
      if (interaction.channel?.type === ChannelType.GuildText) await (interaction.channel as TextChannel).delete().catch(() => {});
    }, 5000);
  }

  // 🔒 Cerrar ticket
  if (accion === 'ticket_cerrar') {
    return void cerrarCanal(new EmbedBuilder().setTitle('🔒 Ticket cerrado').setDescription(`Cerrado por <@${interaction.user.id}>. El canal se elimina en 5 segundos.`).setColor(0x99aab5).setTimestamp());
  }

  // ✅ Pedido entregado
  if (accion === 'ticket_entregado') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff puede hacer esto.', ephemeral: true });
    const lastColon = resto.lastIndexOf(':');
    const itemName = resto.slice(0, lastColon);
    const userId = resto.slice(lastColon + 1);
    return void cerrarCanal(new EmbedBuilder().setTitle('✅ Pedido entregado').setDescription(`**${stock[itemName]?.emoji ?? ''} ${itemName}** entregado a <@${userId}> por <@${interaction.user.id}>.\nEliminando canal en 5 segundos.`).setColor(0x57f287).setTimestamp());
  }

  // ❌ Cancelar pedido
  if (accion === 'ticket_cancelar') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff puede hacer esto.', ephemeral: true });
    const lastColon = resto.lastIndexOf(':');
    const itemName = resto.slice(0, lastColon);
    const userId = resto.slice(lastColon + 1);
    const item = stock[itemName];
    if (item) { item.unidades++; item.ultimaVenta = null; }
    return void cerrarCanal(new EmbedBuilder().setTitle('❌ Pedido cancelado').setDescription(`Pedido de **${item?.emoji ?? ''} ${itemName}** de <@${userId}> cancelado. Stock restaurado: \`${item?.unidades}\` unidades.\nEliminando en 5 segundos.`).setColor(0xed4245).setTimestamp());
  }

  // ✅ Reclamación resuelta
  if (accion === 'rec_resuelto') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff puede hacer esto.', ephemeral: true });
    const lastColon = resto.lastIndexOf(':');
    const producto = resto.slice(0, lastColon);
    const userId = resto.slice(lastColon + 1);
    return void cerrarCanal(new EmbedBuilder().setTitle('✅ Reclamación resuelta').setDescription(`Reclamación de **${stock[producto]?.emoji ?? ''} ${producto}** de <@${userId}> marcada como resuelta por <@${interaction.user.id}>.\nEliminando en 5 segundos.`).setColor(0x57f287).setTimestamp());
  }

  // 🔄 Reembolso
  if (accion === 'rec_reembolso') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff puede hacer esto.', ephemeral: true });
    const lastColon = resto.lastIndexOf(':');
    const producto = resto.slice(0, lastColon);
    const userId = resto.slice(lastColon + 1);
    const item = stock[producto];
    if (item) { item.unidades++; item.ultimaVenta = null; }
    return void cerrarCanal(new EmbedBuilder().setTitle('🔄 Reembolso procesado').setDescription(`Reembolso de **${item?.emoji ?? ''} ${producto}** para <@${userId}> procesado. Stock restaurado: \`${item?.unidades}\` unidades.\nEliminando en 5 segundos.`).setColor(0xfee75c).setTimestamp());
  }

  // ✅ Postulación aceptada
  if (accion === 'post_aceptar') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff puede hacer esto.', ephemeral: true });
    const userId = resto;
    const embed = new EmbedBuilder()
      .setTitle('🎉 Postulación Aceptada')
      .setDescription(`<@${userId}>, tu postulación ha sido **aceptada** por <@${interaction.user.id}>.\n¡Bienvenido al equipo de BD Services! 🎊\n\nEl staff se pondrá en contacto contigo para los próximos pasos.`)
      .setColor(0x57f287)
      .setTimestamp()
      .setFooter({ text: 'BD Services · Postulaciones' });

    await interaction.update({ components: [] });
    await interaction.channel?.send({ content: `<@${userId}>`, embeds: [embed] });
    return;
  }

  // ❌ Postulación rechazada
  if (accion === 'post_rechazar') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff puede hacer esto.', ephemeral: true });
    const userId = resto;
    return void cerrarCanal(new EmbedBuilder()
      .setTitle('❌ Postulación Rechazada')
      .setDescription(`<@${userId}>, tu postulación ha sido **rechazada** por <@${interaction.user.id}>.\nPuedes volver a postularte en el futuro. ¡Ánimo!\nEliminando canal en 5 segundos.`)
      .setColor(0xed4245)
      .setTimestamp()
      .setFooter({ text: 'BD Services · Postulaciones' }));
  }
});


// =========================
// 🔑 LOGIN
// =========================
client.login(token);
