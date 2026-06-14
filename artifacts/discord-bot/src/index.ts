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
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActivityType,
  GuildMember,
  Role,
  Guild,
} from 'discord.js';

// ══════════════════════════════════════════
// ⚙️  CONFIGURACIÓN
// ══════════════════════════════════════════
const CLIENT_ID     = '1513571324646391959';
const GUILD_ID      = '1511755312162668815';
const STAFF_ROLE_ID = '1514355564455530526';

// Canales de logs (tienda/postulaciones)
const LOG_POSTULACIONES = '1514359622125879488';
const LOG_RECLAMACIONES = '1514359675997393017';
const LOG_PEDIDOS       = '1514359810836009010';
const LOG_STOCK         = '1514359845720166430';

// Canales de logs de moderación (se crean automáticamente si no existen)
let LOG_MOD  = '';   // bans, kicks, mutes, warns
let LOG_MSGS = '';   // mensajes eliminados

const token = process.env.DISCORD_TOKEN;
if (!token) { console.error('❌ Falta DISCORD_TOKEN'); process.exit(1); }

const PREFIX = '.';
const ANTI_LINKS = false; // Pon true para activar anti-links


// ══════════════════════════════════════════
// 📦  STOCK
// ══════════════════════════════════════════
interface StockItem {
  emoji: string; precio: number; unidades: number;
  ultimaVenta: { timestamp: number; userId: string } | null;
  ultimoRestock: number;
}
const stock: Record<string, StockItem> = {
  'Web Básica':  { emoji: '🌐', precio: 5,  unidades: 10, ultimaVenta: null, ultimoRestock: Math.floor(Date.now() / 1000) },
  'Web Pro':     { emoji: '💎', precio: 15, unidades: 5,  ultimaVenta: null, ultimoRestock: Math.floor(Date.now() / 1000) },
  'Bot Discord': { emoji: '🤖', precio: 10, unidades: 3,  ultimaVenta: null, ultimoRestock: Math.floor(Date.now() / 1000) },
};

function buildStockEmbed(): EmbedBuilder {
  const e = new EmbedBuilder().setTitle('📦 BD » STOCK').setDescription('Stock de nuestros pedidos.').setColor(0x5865f2).setTimestamp().setFooter({ text: 'BD Services · Stock actualizado automáticamente' });
  for (const [nombre, item] of Object.entries(stock)) {
    const venta   = item.ultimaVenta ? `<t:${item.ultimaVenta.timestamp}:f> · <@${item.ultimaVenta.userId}>` : '`Sin ventas aún`';
    const unis    = item.unidades > 0 ? `\`${item.unidades}\`` : '`⚠️ Sin stock`';
    e.addFields({ name: `${item.emoji} ${nombre}`, value: [`> 📦 **Unidades:** ${unis}`, `> 💰 **Precio:** \`${item.precio}€\``, `> 🛒 **Última venta:** ${venta}`, `> 🔄 **Último restock:** <t:${item.ultimoRestock}:f>`].join('\n') });
  }
  return e;
}


// ══════════════════════════════════════════
// 📋  POSTULACIONES
// ══════════════════════════════════════════
const PREGUNTAS: { seccion?: string; texto: string }[] = [
  { seccion: '🧾 Información básica',        texto: '¿Cuál es tu nombre o apodo?' },
  {                                           texto: '¿Cuántos años tienes?' },
  {                                           texto: '¿En qué país vives y cuál es tu zona horaria?' },
  {                                           texto: '¿Cuánto tiempo sueles estar activo en Discord al día?' },
  { seccion: '💬 Experiencia',                texto: '¿Has sido staff en algún otro servidor? Si es así, ¿cuál era tu rol?' },
  {                                           texto: '¿Qué conocimientos tienes sobre moderación en Discord?' },
  {                                           texto: '¿Has usado herramientas como bots de moderación (Dyno, MEE6, Carl-bot, etc.)?' },
  { seccion: '⚖️ Situaciones de moderación', texto: '¿Qué harías si un usuario insulta a otros miembros?' },
  {                                           texto: '¿Cómo actuarías si ves spam o flood en el chat?' },
  {                                           texto: 'Si dos usuarios están discutiendo fuertemente, ¿cómo lo resolverías?' },
  {                                           texto: '¿Qué harías si un usuario VIP rompe una norma importante?' },
  {                                           texto: '¿Cómo actuarías si no hay pruebas claras en un conflicto?' },
  { seccion: '🧠 Comportamiento y criterio',  texto: '¿Por qué quieres ser staff en este servidor?' },
  {                                           texto: '¿Qué significa para ti ser un buen moderador?' },
  {                                           texto: '¿Cómo manejas el estrés o situaciones de presión?' },
  {                                           texto: '¿Cómo te aseguras de ser imparcial?' },
  { seccion: '🛠️ Responsabilidad',            texto: '¿Qué harías si ves a otro staff actuando mal?' },
  {                                           texto: '¿Qué harías si un usuario te reporta a ti personalmente?' },
  {                                           texto: '¿Qué harías si tienes dudas sobre una decisión importante?' },
  { seccion: '⏳ Disponibilidad',              texto: '¿Cuántas horas puedes dedicar al servidor diariamente o semanalmente?' },
  {                                           texto: '¿Tienes algún horario fijo o restricciones de tiempo?' },
];
interface AppState { userId: string; currentQ: number; answers: string[]; }
const appsActivas = new Map<string, AppState>();

function buildPreguntaEmbed(idx: number): EmbedBuilder {
  const p = PREGUNTAS[idx];
  return new EmbedBuilder().setColor(0x5865f2).setTitle(`📋 Pregunta ${idx + 1} / ${PREGUNTAS.length}`).setDescription(p.seccion ? `**${p.seccion}**\n\n${p.texto}` : p.texto).setFooter({ text: 'Escribe tu respuesta a continuación' });
}
function buildResumenTexto(userId: string, answers: string[]): string[] {
  const now = Math.floor(Date.now() / 1000);
  const header = `📋 **POSTULACIÓN COMPLETADA**\n**Solicitante:** <@${userId}>\n**Fecha:** <t:${now}:f>\n\n`;
  let seccionActual = '';
  const lines: string[] = [header];
  PREGUNTAS.forEach((p, i) => {
    if (p.seccion && p.seccion !== seccionActual) { seccionActual = p.seccion; lines.push(`\n**${p.seccion}**\n`); }
    lines.push(`**${i + 1}.** ${p.texto}\n> ${answers[i] ?? '*(sin respuesta)*'}\n`);
  });
  const chunks: string[] = [];
  let current = '';
  for (const line of lines) {
    if (current.length + line.length > 1900) { chunks.push(current); current = ''; }
    current += line;
  }
  if (current) chunks.push(current);
  return chunks;
}


// ══════════════════════════════════════════
// 🛡️  SISTEMA DE MODERACIÓN
// ══════════════════════════════════════════

// Advertencias por userId
const warns = new Map<string, { reason: string; staffId: string; timestamp: number }[]>();

// Anti-spam: mensajes recientes por userId
const spamTracker = new Map<string, number[]>();

// Temp bans/mutes activos: userId → timeout handle
const tempTimers = new Map<string, NodeJS.Timeout>();

// Rol Muted (se cachea al crearlo/encontrarlo)
let mutedRole: Role | null = null;

/** Parsea "10s", "30m", "2h", "67d" → milisegundos. Devuelve null si inválido. */
function parseTime(str: string): number | null {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const ms = val * (unit[match[2].toLowerCase()] ?? 0);
  return ms > 0 ? ms : null;
}

/** Formatea ms a texto legible: "30 segundos", "5 minutos", "2 horas", "67 días" */
function formatTime(ms: number): string {
  if (ms < 60_000)     return `${Math.round(ms / 1_000)} segundo(s)`;
  if (ms < 3_600_000)  return `${Math.round(ms / 60_000)} minuto(s)`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} hora(s)`;
  return `${Math.round(ms / 86_400_000)} día(s)`;
}

/** Extrae userId de una mención o ID en bruto. */
function parseTargetId(str: string): string | null {
  const mention = str.match(/^<@!?(\d{17,19})>/);
  if (mention) return mention[1];
  const id = str.match(/^(\d{17,19})$/);
  if (id) return id[1];
  return null;
}

/** Verifica si el miembro tiene permiso de staff. */
function isStaffMember(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.Administrator)
    || member.roles.cache.has(STAFF_ROLE_ID);
}

/** Obtiene o crea el rol Muted con permisos correctos. */
async function getOrCreateMutedRole(guild: Guild): Promise<Role> {
  if (mutedRole && guild.roles.cache.has(mutedRole.id)) return mutedRole;
  const existing = guild.roles.cache.find(r => r.name === 'Muted');
  if (existing) { mutedRole = existing; return existing; }

  mutedRole = await guild.roles.create({ name: 'Muted', color: 0x808080, reason: 'BD Bot · Rol Muted automático' });

  // Denegar envío en todos los canales de texto
  for (const [, ch] of guild.channels.cache) {
    if (ch.isTextBased() && ch.type === ChannelType.GuildText) {
      await (ch as TextChannel).permissionOverwrites.create(mutedRole, { SendMessages: false, AddReactions: false }).catch(() => {});
    }
  }
  return mutedRole;
}

/** Crea los canales de log de moderación si no existen. */
async function setupModLogChannels(guild: Guild): Promise<void> {
  const findOrCreate = async (name: string): Promise<string> => {
    const found = guild.channels.cache.find(c => c.name === name && c.type === ChannelType.GuildText) as TextChannel | undefined;
    if (found) return found.id;
    const created = await guild.channels.create({ name, type: ChannelType.GuildText, reason: 'BD Bot · Canal de logs de moderación' }) as TextChannel;
    return created.id;
  };

  LOG_MOD  = await findOrCreate('log-moderacion');
  LOG_MSGS = await findOrCreate('log-mensajes');
  console.log(`📋 Canales de log: #log-moderacion (${LOG_MOD}), #log-mensajes (${LOG_MSGS})`);
}


// ══════════════════════════════════════════
// 🎫  CREAR CANAL TICKET
// ══════════════════════════════════════════
async function crearTicketCanal(opts: { guild: Guild; userId: string; username: string; tipo: string; }): Promise<TextChannel | null> {
  const channelName = `ticket-${opts.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 45);
  try {
    const ch = await opts.guild.channels.create({
      name: channelName, type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: opts.guild.id,  deny:  [PermissionFlagsBits.ViewChannel] },
        { id: opts.userId,    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: STAFF_ROLE_ID,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ],
    });
    return ch as TextChannel;
  } catch (err) { console.error('Error al crear canal:', err); return null; }
}


// ══════════════════════════════════════════
// 📝  LOGS
// ══════════════════════════════════════════
async function sendLog(channelId: string, embed: EmbedBuilder): Promise<void> {
  if (!channelId) return;
  try {
    const ch = await client.channels.fetch(channelId);
    if (ch?.isTextBased()) await (ch as TextChannel).send({ embeds: [embed] });
  } catch { /* sin canal configurado */ }
}

function modEmbed(color: number, title: string, fields: { name: string; value: string; inline?: boolean }[]): EmbedBuilder {
  return new EmbedBuilder().setTitle(title).addFields(fields).setColor(color).setTimestamp().setFooter({ text: 'BD Services · Moderación' });
}


// ══════════════════════════════════════════
// 🔧  SLASH COMMANDS
// ══════════════════════════════════════════
const slashCommands = [

  new SlashCommandBuilder().setName('postular').setDescription('📋 Postúlate para ser staff de BD Services'),
];

const rest = new REST().setToken(token);
Promise.all([
  rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }),
  rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: slashCommands }),
]).then(() => console.log('✅ Slash commands registrados')).catch(console.error);


// ══════════════════════════════════════════
// 🤖  CLIENTE
// ══════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async () => {
  console.log(`🤖 BD Bot conectado como ${client.user!.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  if (guild) {
    // Estado: nombre del servidor
    client.user!.setActivity(`${guild.name}`, { type: ActivityType.Watching });

    // Setup moderación
    await setupModLogChannels(guild);
    await getOrCreateMutedRole(guild).catch(console.error);
  }
});


// ══════════════════════════════════════════
// 💬  MENSAJES
// ══════════════════════════════════════════
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  const msg = message.content.trim();
  const member = message.member!;

  // ─── AUTO-MODERACIÓN ─────────────────────
  if (!isStaffMember(member)) {

    // 🔴 Anti-spam: 5 mensajes en 5 segundos → auto-mute 5 min
    const now = Date.now();
    const userMsgs = spamTracker.get(message.author.id) ?? [];
    const recent = userMsgs.filter(t => now - t < 5000);
    recent.push(now);
    spamTracker.set(message.author.id, recent);

    if (recent.length >= 5) {
      spamTracker.delete(message.author.id);
      await message.delete().catch(() => {});
      const muted = await getOrCreateMutedRole(message.guild);
      if (!member.roles.cache.has(muted.id)) {
        await member.roles.add(muted).catch(() => {});
        const warnList = warns.get(message.author.id) ?? [];
        warnList.push({ reason: 'Auto-mod: spam detectado', staffId: client.user!.id, timestamp: Math.floor(now / 1000) });
        warns.set(message.author.id, warnList);

        await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🔇 Mute automático').setDescription(`<@${message.author.id}> ha sido muteado 5 minutos por spam.`).setTimestamp()] });
        await sendLog(LOG_MOD, modEmbed(0xed4245, '🔇 Auto-mute (spam)', [{ name: '👤 Usuario', value: `<@${message.author.id}>`, inline: true }, { name: '⏱️ Duración', value: '5 minutos', inline: true }, { name: '📝 Razón', value: 'Anti-spam automático' }]));

        // Desmutear tras 5 min
        setTimeout(async () => {
          await member.roles.remove(muted).catch(() => {});
        }, 5 * 60_000);
      }
      return;
    }

    // 🟡 Anti-caps: >70% mayúsculas y >10 caracteres
    const letters = msg.replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ]/g, '');
    if (letters.length > 10 && (letters.split('').filter(c => c === c.toUpperCase()).length / letters.length) > 0.7) {
      await message.delete().catch(() => {});
      const warnList = warns.get(message.author.id) ?? [];
      warnList.push({ reason: 'Auto-mod: exceso de mayúsculas', staffId: client.user!.id, timestamp: Math.floor(now / 1000) });
      warns.set(message.author.id, warnList);

      const notice = await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle('⚠️ Anti-caps').setDescription(`<@${message.author.id}>, evita escribir en mayúsculas excesivas. (Advertencia #${warnList.length})`).setTimestamp()] });
      setTimeout(() => notice.delete().catch(() => {}), 8000);
      return;
    }

    // 🔵 Anti-links (si está activado)
    if (ANTI_LINKS && /(https?:\/\/|discord\.gg\/|www\.)/i.test(msg)) {
      await message.delete().catch(() => {});
      const warnList = warns.get(message.author.id) ?? [];
      warnList.push({ reason: 'Auto-mod: enlace no permitido', staffId: client.user!.id, timestamp: Math.floor(now / 1000) });
      warns.set(message.author.id, warnList);
      const notice = await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle('⚠️ Anti-links').setDescription(`<@${message.author.id}>, los enlaces no están permitidos. (Advertencia #${warnList.length})`).setTimestamp()] });
      setTimeout(() => notice.delete().catch(() => {}), 8000);
      return;
    }
  }

  // ─── FLUJO DE POSTULACIÓN ACTIVA ─────────
  const appState = appsActivas.get(message.channelId);
  if (appState && message.author.id === appState.userId) {
    appState.answers.push(msg);
    const next = appState.currentQ + 1;
    if (next < PREGUNTAS.length) {
      appState.currentQ = next;
      return void message.channel.send({ embeds: [buildPreguntaEmbed(next)] });
    }
    appsActivas.delete(message.channelId);
    const chunks = buildResumenTexto(appState.userId, appState.answers);
    for (const chunk of chunks) await message.channel.send({ content: chunk });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`post_aceptar:${appState.userId}`).setLabel('✅ Aceptar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`post_rechazar:${appState.userId}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger),
    );
    await message.channel.send({ content: `<@&${STAFF_ROLE_ID}> Nueva postulación de <@${appState.userId}>`, components: [row] });
    await sendLog(LOG_POSTULACIONES, modEmbed(0x5865f2, '📋 Nueva postulación', [{ name: '👤 Solicitante', value: `<@${appState.userId}>`, inline: true }, { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }]));
    return;
  }


  // ─── COMANDOS TIENDA/STOCK ────────────────
  if (msg === '!tienda') {
    const e = new EmbedBuilder().setTitle('🛍️ BD » TIENDA').setDescription('Productos disponibles:').setColor(0x57f287).setTimestamp().setFooter({ text: 'BD Services · !buy <producto>' });
    for (const [n, item] of Object.entries(stock)) e.addFields({ name: `${item.emoji} ${n}`, value: `> 💰 \`${item.precio}€\`\n> 📦 \`${item.unidades} uds\``, inline: true });
    return void message.reply({ embeds: [e] });
  }
  if (msg === '!stock') return void message.reply({ embeds: [buildStockEmbed()] });

  if (msg.startsWith('!restock ')) {
    if (!isStaffMember(member)) return void message.reply('❌ Sin permisos.');
    const partes = msg.slice(9).trim().split(' ');
    const cantStr = partes.pop();
    const itemName = partes.join(' ');
    const cant = parseInt(cantStr ?? '', 10);
    if (!itemName || isNaN(cant) || cant <= 0) return void message.reply('❌ Uso: `!restock <producto> <cantidad>`');
    if (!stock[itemName]) return void message.reply(`❌ No encontrado: ${Object.keys(stock).map(n => `\`${n}\``).join(', ')}`);
    stock[itemName].unidades += cant;
    stock[itemName].ultimoRestock = Math.floor(Date.now() / 1000);
    const item = stock[itemName];
    await message.reply({ embeds: [new EmbedBuilder().setTitle('🔄 Restock').setColor(0x57f287).addFields({ name: `${item.emoji} Producto`, value: itemName, inline: true }, { name: '📦 Añadidas', value: `\`+${cant}\``, inline: true }, { name: '📦 Total', value: `\`${item.unidades}\``, inline: true }, { name: '🔄 Por', value: `<@${message.author.id}>`, inline: true }).setTimestamp()] });
    await sendLog(LOG_STOCK, modEmbed(0x57f287, '🔄 Restock', [{ name: `${item.emoji} Producto`, value: itemName, inline: true }, { name: '📦 +Unidades', value: `\`+${cant}\``, inline: true }, { name: '📦 Total', value: `\`${item.unidades}\``, inline: true }, { name: '👤 Por', value: `<@${message.author.id}>`, inline: true }]));
    return;
  }

  if (msg.startsWith('!buy ')) {
    const itemName = msg.slice(5).trim();
    if (!stock[itemName]) return void message.reply('❌ No existe. Usa `!tienda`.');
    if (stock[itemName].unidades <= 0) return void message.reply(`❌ Sin stock de **${itemName}**.`);
    stock[itemName].unidades--;
    const ts = Math.floor(Date.now() / 1000);
    stock[itemName].ultimaVenta = { timestamp: ts, userId: message.author.id };
    const item = stock[itemName];
    const ticketChannel = await crearTicketCanal({ guild: message.guild, userId: message.author.id, username: message.author.username, tipo: 'pedido' });
    if (!ticketChannel) { stock[itemName].unidades++; stock[itemName].ultimaVenta = null; return void message.reply('❌ Error al crear ticket. El bot necesita Gestionar canales.'); }
    await message.reply(`✅ Pedido registrado: ${ticketChannel}`);
    const tEmbed = new EmbedBuilder().setTitle('🎫 Nuevo Pedido').setDescription(`Hola <@${message.author.id}>, el staff te atenderá pronto.`).addFields({ name: `${item.emoji} Producto`, value: `\`${itemName}\``, inline: true }, { name: '💰 Total', value: `\`${item.precio}€\``, inline: true }, { name: '📦 Stock restante', value: `\`${item.unidades}\``, inline: true }, { name: '🕐 Pedido el', value: `<t:${ts}:f>` }, { name: '👤 Cliente', value: `<@${message.author.id}>` }).setColor(0x5865f2).setTimestamp().setFooter({ text: 'BD Services' });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket_entregado:${itemName}:${message.author.id}`).setLabel('✅ Marcar entregado').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ticket_cancelar:${itemName}:${message.author.id}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_cerrar:${message.author.id}`).setLabel('🔒 Cerrar').setStyle(ButtonStyle.Secondary),
    );
    await ticketChannel.send({ content: `<@${message.author.id}> | <@&${STAFF_ROLE_ID}>`, embeds: [tEmbed], components: [row] });
    await sendLog(LOG_PEDIDOS, modEmbed(0x5865f2, '🛍️ Nueva compra', [{ name: `${item.emoji} Producto`, value: itemName, inline: true }, { name: '💰 Precio', value: `\`${item.precio}€\``, inline: true }, { name: '👤 Comprador', value: `<@${message.author.id}>`, inline: true }, { name: '🕐 Fecha', value: `<t:${ts}:f>`, inline: true }]));
    return;
  }


  // ─── COMANDOS DE MODERACIÓN (prefijo .) ──────────────────────────────────
  if (!msg.startsWith(PREFIX)) return;
  if (!isStaffMember(member)) return void message.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('❌ No tienes permisos de staff para usar este comando.')] });

  const parts   = msg.slice(1).trim().split(/\s+/);
  const cmd     = parts[0].toLowerCase();
  const args    = parts.slice(1);
  const guild   = message.guild;


  // ─── .ban <user> [razón] ───
  if (cmd === 'ban') {
    const targetId = parseTargetId(args[0] ?? '');
    if (!targetId) return void message.reply('❌ Uso: `.ban <@usuario> [razón]`');
    const reason = args.slice(1).join(' ') || 'Sin razón especificada';
    try {
      const target = await guild.members.fetch(targetId);
      await guild.members.ban(targetId, { reason });
      await message.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('🔨 Usuario baneado').addFields({ name: '👤 Usuario', value: `${target.user.tag}`, inline: true }, { name: '📝 Razón', value: reason, inline: true }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }).setTimestamp()] });
      await sendLog(LOG_MOD, modEmbed(0xed4245, '🔨 Ban', [{ name: '👤 Usuario', value: `${target.user.tag} (${targetId})`, inline: true }, { name: '📝 Razón', value: reason, inline: true }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }]));
    } catch { message.reply('❌ No se pudo banear al usuario.'); }
    return;
  }


  // ─── .kick <user> [razón] ───
  if (cmd === 'kick') {
    const targetId = parseTargetId(args[0] ?? '');
    if (!targetId) return void message.reply('❌ Uso: `.kick <@usuario> [razón]`');
    const reason = args.slice(1).join(' ') || 'Sin razón especificada';
    try {
      const target = await guild.members.fetch(targetId);
      await target.kick(reason);
      await message.reply({ embeds: [new EmbedBuilder().setColor(0xff7f50).setTitle('👢 Usuario expulsado').addFields({ name: '👤 Usuario', value: `${target.user.tag}`, inline: true }, { name: '📝 Razón', value: reason, inline: true }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }).setTimestamp()] });
      await sendLog(LOG_MOD, modEmbed(0xff7f50, '👢 Kick', [{ name: '👤 Usuario', value: `${target.user.tag} (${targetId})`, inline: true }, { name: '📝 Razón', value: reason, inline: true }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }]));
    } catch { message.reply('❌ No se pudo expulsar al usuario.'); }
    return;
  }


  // ─── .mute <user> [razón] ───
  if (cmd === 'mute') {
    const targetId = parseTargetId(args[0] ?? '');
    if (!targetId) return void message.reply('❌ Uso: `.mute <@usuario> [razón]`');
    const reason = args.slice(1).join(' ') || 'Sin razón especificada';
    try {
      const target = await guild.members.fetch(targetId);
      const muted  = await getOrCreateMutedRole(guild);
      if (target.roles.cache.has(muted.id)) return void message.reply('⚠️ El usuario ya está muteado.');
      await target.roles.add(muted, reason);
      await message.reply({ embeds: [new EmbedBuilder().setColor(0x808080).setTitle('🔇 Usuario muteado').addFields({ name: '👤 Usuario', value: `${target.user.tag}`, inline: true }, { name: '📝 Razón', value: reason, inline: true }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }).setTimestamp()] });
      await sendLog(LOG_MOD, modEmbed(0x808080, '🔇 Mute', [{ name: '👤 Usuario', value: `${target.user.tag} (${targetId})`, inline: true }, { name: '📝 Razón', value: reason, inline: true }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }]));
    } catch { message.reply('❌ No se pudo mutear al usuario.'); }
    return;
  }


  // ─── .unmute <user> ───
  if (cmd === 'unmute') {
    const targetId = parseTargetId(args[0] ?? '');
    if (!targetId) return void message.reply('❌ Uso: `.unmute <@usuario>`');
    try {
      const target = await guild.members.fetch(targetId);
      const muted  = await getOrCreateMutedRole(guild);
      if (!target.roles.cache.has(muted.id)) return void message.reply('⚠️ El usuario no está muteado.');
      await target.roles.remove(muted);
      const key = `mute_${targetId}`;
      if (tempTimers.has(key)) { clearTimeout(tempTimers.get(key)!); tempTimers.delete(key); }
      await message.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🔊 Usuario desmuteado').addFields({ name: '👤 Usuario', value: `${target.user.tag}`, inline: true }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }).setTimestamp()] });
      await sendLog(LOG_MOD, modEmbed(0x57f287, '🔊 Unmute', [{ name: '👤 Usuario', value: `${target.user.tag} (${targetId})`, inline: true }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }]));
    } catch { message.reply('❌ No se pudo desmutear al usuario.'); }
    return;
  }


  // ─── .warn <user> [razón] ───
  if (cmd === 'warn') {
    const targetId = parseTargetId(args[0] ?? '');
    if (!targetId) return void message.reply('❌ Uso: `.warn <@usuario> [razón]`');
    const reason = args.slice(1).join(' ') || 'Sin razón especificada';
    try {
      const target = await guild.members.fetch(targetId);
      const warnList = warns.get(targetId) ?? [];
      warnList.push({ reason, staffId: message.author.id, timestamp: Math.floor(Date.now() / 1000) });
      warns.set(targetId, warnList);
      await message.reply({ embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle('⚠️ Advertencia registrada').addFields({ name: '👤 Usuario', value: `${target.user.tag}`, inline: true }, { name: '⚠️ Total warns', value: `\`${warnList.length}\``, inline: true }, { name: '📝 Razón', value: reason, inline: false }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }).setTimestamp()] });
      await sendLog(LOG_MOD, modEmbed(0xfee75c, '⚠️ Warn', [{ name: '👤 Usuario', value: `${target.user.tag} (${targetId})`, inline: true }, { name: '⚠️ Total warns', value: `\`${warnList.length}\``, inline: true }, { name: '📝 Razón', value: reason, inline: false }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }]));
    } catch { message.reply('❌ No se pudo advertir al usuario.'); }
    return;
  }


  // ─── .warnings <user> ───
  if (cmd === 'warnings') {
    const targetId = parseTargetId(args[0] ?? '');
    if (!targetId) return void message.reply('❌ Uso: `.warnings <@usuario>`');
    const warnList = warns.get(targetId) ?? [];
    if (warnList.length === 0) return void message.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ <@${targetId}> no tiene advertencias.`)] });
    const embed = new EmbedBuilder().setTitle(`⚠️ Advertencias de <@${targetId}>`).setColor(0xfee75c).setTimestamp();
    warnList.forEach((w, i) => embed.addFields({ name: `#${i + 1} · <t:${w.timestamp}:D>`, value: `📝 ${w.reason}\n👮 <@${w.staffId}>` }));
    await message.reply({ embeds: [embed] });
    return;
  }


  // ─── .clearwarns <user> ───
  if (cmd === 'clearwarns') {
    const targetId = parseTargetId(args[0] ?? '');
    if (!targetId) return void message.reply('❌ Uso: `.clearwarns <@usuario>`');
    warns.delete(targetId);
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`✅ Advertencias de <@${targetId}> eliminadas.`).setTimestamp()] });
    await sendLog(LOG_MOD, modEmbed(0x57f287, '🧹 Warns eliminados', [{ name: '👤 Usuario', value: `<@${targetId}>`, inline: true }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }]));
    return;
  }


  // ─── .clear <cantidad> ───
  if (cmd === 'clear') {
    const amount = parseInt(args[0] ?? '', 10);
    if (isNaN(amount) || amount < 1 || amount > 100) return void message.reply('❌ Uso: `.clear <1-100>`');
    try {
      const deleted = await (message.channel as TextChannel).bulkDelete(amount + 1, true);
      const notice = await message.channel.send({ embeds: [new EmbedBuilder().setColor(0x5865f2).setDescription(`🗑️ ${deleted.size - 1} mensajes eliminados por <@${message.author.id}>.`).setTimestamp()] });
      setTimeout(() => notice.delete().catch(() => {}), 5000);
      await sendLog(LOG_MSGS, modEmbed(0x5865f2, '🗑️ Purga de mensajes', [{ name: '📊 Eliminados', value: `\`${deleted.size - 1}\``, inline: true }, { name: '📍 Canal', value: `<#${message.channelId}>`, inline: true }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }]));
    } catch { message.reply('❌ No se pudieron eliminar los mensajes (puede que sean muy antiguos).'); }
    return;
  }


  // ─── .tempban <user> <tiempo> [razón] ───
  if (cmd === 'tempban') {
    const targetId = parseTargetId(args[0] ?? '');
    const duration = parseTime(args[1] ?? '');
    if (!targetId || !duration) return void message.reply('❌ Uso: `.tempban <@usuario> <tiempo: 30m/2h/1d> [razón]`');
    const reason = args.slice(2).join(' ') || 'Sin razón especificada';
    const formatted = formatTime(duration);
    try {
      const target = await guild.members.fetch(targetId);
      await guild.members.ban(targetId, { reason: `Tempban ${formatted}: ${reason}` });
      await message.reply({ embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('⏱️ Tempban').addFields({ name: '👤 Usuario', value: `${target.user.tag}`, inline: true }, { name: '⏱️ Duración', value: formatted, inline: true }, { name: '📝 Razón', value: reason, inline: false }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }).setTimestamp()] });
      await sendLog(LOG_MOD, modEmbed(0xed4245, '⏱️ Tempban', [{ name: '👤 Usuario', value: `${target.user.tag} (${targetId})`, inline: true }, { name: '⏱️ Duración', value: formatted, inline: true }, { name: '📝 Razón', value: reason, inline: false }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }]));
      // Desbanear tras duración
      const key = `ban_${targetId}`;
      if (tempTimers.has(key)) clearTimeout(tempTimers.get(key)!);
      tempTimers.set(key, setTimeout(async () => {
        await guild.members.unban(targetId, 'Tempban expirado').catch(() => {});
        await sendLog(LOG_MOD, modEmbed(0x57f287, '✅ Tempban expirado', [{ name: '👤 Usuario', value: `<@${targetId}>`, inline: true }, { name: '⏱️ Duración', value: formatted, inline: true }]));
        tempTimers.delete(key);
      }, duration));
    } catch { message.reply('❌ No se pudo banear temporalmente al usuario.'); }
    return;
  }


  // ─── .tempmute <user> <tiempo> [razón] ───
  if (cmd === 'tempmute') {
    const targetId = parseTargetId(args[0] ?? '');
    const duration = parseTime(args[1] ?? '');
    if (!targetId || !duration) return void message.reply('❌ Uso: `.tempmute <@usuario> <tiempo: 30m/2h/1d> [razón]`');
    const reason = args.slice(2).join(' ') || 'Sin razón especificada';
    const formatted = formatTime(duration);
    try {
      const target = await guild.members.fetch(targetId);
      const muted  = await getOrCreateMutedRole(guild);
      await target.roles.add(muted, reason);
      await message.reply({ embeds: [new EmbedBuilder().setColor(0x808080).setTitle('⏱️ Tempmute').addFields({ name: '👤 Usuario', value: `${target.user.tag}`, inline: true }, { name: '⏱️ Duración', value: formatted, inline: true }, { name: '📝 Razón', value: reason, inline: false }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }).setTimestamp()] });
      await sendLog(LOG_MOD, modEmbed(0x808080, '⏱️ Tempmute', [{ name: '👤 Usuario', value: `${target.user.tag} (${targetId})`, inline: true }, { name: '⏱️ Duración', value: formatted, inline: true }, { name: '📝 Razón', value: reason, inline: false }, { name: '👮 Por', value: `<@${message.author.id}>`, inline: true }]));
      const key = `mute_${targetId}`;
      if (tempTimers.has(key)) clearTimeout(tempTimers.get(key)!);
      tempTimers.set(key, setTimeout(async () => {
        const refreshed = await guild.members.fetch(targetId).catch(() => null);
        if (refreshed) await refreshed.roles.remove(muted).catch(() => {});
        await sendLog(LOG_MOD, modEmbed(0x57f287, '✅ Tempmute expirado', [{ name: '👤 Usuario', value: `<@${targetId}>`, inline: true }, { name: '⏱️ Duración', value: formatted, inline: true }]));
        tempTimers.delete(key);
      }, duration));
    } catch { message.reply('❌ No se pudo mutear temporalmente al usuario.'); }
    return;
  }


  // ─── .setup-tickets ───
  if (cmd === 'setup-tickets') {
    if (!isStaffMember(member)) return;
    const channel = message.channel as TextChannel;
    const embed = new EmbedBuilder()
      .setTitle('<:BD_Seguridad:1515288103793852447> ¿NECESITAS SOPORTE?')
      .setDescription(`
**<:BD_Usuario:1510405445682987070> ¡Bienvenido al sistema de tickets de BD Developer!**

Aquí podrás solicitar ayuda relacionada con nuestros servicios de desarrollo, reportar problemas, realizar compras o contactar con nuestro equipo de soporte.

<:BD_Aviso:1515291008189993072> **Por favor, selecciona la categoría correcta en el menú de abajo, de lo contrario tu ticket podría ser cerrado para mantener una mejor organización.**

## <a:Pincho:1515324119611211938> Importante

🔹 Evita mencionar al staff innecesariamente.
🔹 No abras tickets por pruebas o sin motivo válido.
🔹 Explica tu problema de forma clara y detallada.
🔹 El abuso del sistema de tickets puede resultar en sanciones.

━━━━━━━━━━━━━━━━━━━━━━

## 📂 Categorías Disponibles

<:BD_Moderacion:1515290848105857046> **Soporte General**
¿Necesitas ayuda con alguno de nuestros servicios, bots o configuraciones? Nuestro equipo te asistirá lo antes posible.

<:BD_Alerta:1515290217811021997> **Reclamación**
¿Has tenido algún problema con un servicio, pedido o atención recibida? Abre una reclamación y revisaremos tu caso.

<:BD_Tienda:1515290896789278866> **Compra**
¿Quieres adquirir un bot, sistema, configuración o cualquier servicio de desarrollo? Selecciona esta opción para realizar tu compra.

<:BD_Ban:1515292957664608357> **Reportar Usuario**
¿Algún usuario incumple las normas o está causando problemas dentro de la comunidad? Repórtalo aquí con las pruebas correspondientes.

💡 **Alianza**
¿Representas una comunidad o proyecto y deseas colaborar con BD Developer? Abre un ticket de alianza y hablaremos contigo.
`)
      .setColor(0x5865f2)
      .setFooter({ text: 'BD Services · Sistema de Tickets' });

    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('Selecciona una categoría...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Soporte General').setEmoji('<:BD_Logo:1515294876713877687>').setValue('soporte'),
        new StringSelectMenuOptionBuilder().setLabel('Reclamación').setEmoji('<:Alarma:1466443593198731297>').setValue('reclamacion'),
        new StringSelectMenuOptionBuilder().setLabel('Compra').setEmoji('<:BD_Tienda:1515290896789278866>').setValue('compra'),
        new StringSelectMenuOptionBuilder().setLabel('Reportar Usuario').setEmoji('<:Ban:1502584670640934982>').setValue('reporte'),
        new StringSelectMenuOptionBuilder().setLabel('Alianza').setEmoji('🤝').setValue('alianza'),
        new StringSelectMenuOptionBuilder().setLabel('Apelación').setEmoji('<:BD_Cargando:1515293582578417755>').setValue('apelacion'),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
    return;
  }

  // ─── .infracciones <user> ───
  if (cmd === 'infracciones') {
    const targetId = parseTargetId(args[0] ?? '');
    if (!targetId) return void message.reply('❌ Uso: `.infracciones <@usuario>`');

    let target;
    try { target = await guild.members.fetch(targetId); } catch { return void message.reply('❌ No se encontró al usuario.'); }

    const warnList  = warns.get(targetId) ?? [];
    const mutedR    = await getOrCreateMutedRole(guild);
    const esMuteado = target.roles.cache.has(mutedR.id);
    const tempBan   = tempTimers.has(`ban_${targetId}`);
    const tempMute  = tempTimers.has(`mute_${targetId}`);

    const embed = new EmbedBuilder()
      .setTitle(`📂 Historial de infracciones — ${target.user.tag}`)
      .setThumbnail(target.user.displayAvatarURL())
      .setColor(warnList.length === 0 && !esMuteado ? 0x57f287 : 0xfee75c)
      .setTimestamp()
      .setFooter({ text: 'BD Services · Moderación' });

    // Estado actual
    const estadoLineas: string[] = [];
    estadoLineas.push(esMuteado  ? '🔇 **Muteado:** Sí' + (tempMute ? ' *(temporal)*' : '') : '🔊 **Muteado:** No');
    estadoLineas.push(tempBan    ? '🔨 **Tempban activo:** Sí' : '✅ **Baneado:** No');
    embed.addFields({ name: '📊 Estado actual', value: estadoLineas.join('\n') });

    // Warns
    if (warnList.length === 0) {
      embed.addFields({ name: `⚠️ Advertencias (0)`, value: '✅ Sin advertencias registradas.' });
    } else {
      embed.addFields({ name: `⚠️ Advertencias (${warnList.length})`, value: '\u200b' });
      warnList.slice(-5).forEach((w, i) => {
        const realIdx = warnList.length > 5 ? warnList.length - 5 + i + 1 : i + 1;
        embed.addFields({ name: `#${realIdx} · <t:${w.timestamp}:D>`, value: `📝 ${w.reason}\n👮 <@${w.staffId}>` });
      });
      if (warnList.length > 5) embed.addFields({ name: '\u200b', value: `*y ${warnList.length - 5} advertencia(s) más...*` });
    }

    await message.reply({ embeds: [embed] });
    return;
  }
});


// ─── LOG: mensajes eliminados ─────────────
client.on(Events.MessageDelete, async (message) => {
  if (!message.guild || message.author?.bot) return;
  if (!LOG_MSGS) return;
  await sendLog(LOG_MSGS, new EmbedBuilder().setTitle('🗑️ Mensaje eliminado').addFields(
    { name: '👤 Autor', value: message.author ? `<@${message.author.id}>` : 'Desconocido', inline: true },
    { name: '📍 Canal', value: `<#${message.channelId}>`, inline: true },
    { name: '📄 Contenido', value: (message.content?.slice(0, 1024)) || '*[sin contenido de texto]*' },
  ).setColor(0x808080).setTimestamp().setFooter({ text: 'BD Services · Logs' }));
});


// ══════════════════════════════════════════
// 🎛️  INTERACCIONES (SLASH + BOTONES)
// ══════════════════════════════════════════
client.on(Events.InteractionCreate, async (interaction) => {

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'ticket_select') {
      const categoria = interaction.values[0];
      const guild = interaction.guild;
      if (!guild) return;

      const ticketChannel = await crearTicketCanal({ 
        guild, 
        userId: interaction.user.id, 
        username: interaction.user.username, 
        tipo: categoria 
      });

      if (!ticketChannel) return void interaction.reply({ content: '❌ Error al crear el ticket.', ephemeral: true });

      await interaction.reply({ content: `✅ Ticket creado: ${ticketChannel}`, ephemeral: true });

      const nombres: Record<string, string> = {
        soporte: '🆘 Soporte General',
        reclamacion: '🚨 Reclamación',
        compra: '🛒 Compra',
        reporte: '👤 Reportar Usuario',
        alianza: '🤝 Alianza',
        apelacion: '⚖️ Apelación'
      };

      const embed = new EmbedBuilder()
        .setTitle('🎫 Ticket Abierto')
        .setColor(0x5865f2)
        .addFields(
          { name: '📂 Categoría', value: nombres[categoria] || categoria, inline: true },
          { name: '👤 Usuario', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'BD Services · Sistema de Tickets' });

      if (categoria === 'compra') {
        embed.setDescription('¡Hola! Si quieres realizar una compra, recuerda que puedes usar el comando `!buy`.');
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ticket_cerrar:${interaction.user.id}`).setLabel('Cerrar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ticket_transcript:${interaction.user.id}`).setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary),
      );

      await ticketChannel.send({ content: `<@${interaction.user.id}> | <@&${STAFF_ROLE_ID}>`, embeds: [embed], components: [row] });
      return;
    }
  }

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'postular') {
      if (!interaction.guild) return;
      const ticketChannel = await crearTicketCanal({ guild: interaction.guild, userId: interaction.user.id, username: interaction.user.username, tipo: 'postulacion' });
      if (!ticketChannel) return void interaction.reply({ content: '❌ El bot necesita Gestionar canales.', ephemeral: true });
      await interaction.reply({ content: `📋 Canal creado: ${ticketChannel}`, ephemeral: true });
      await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [new EmbedBuilder().setTitle('📋 Postulación a Staff').setDescription(`Hola <@${interaction.user.id}>, bienvenido. Haré **${PREGUNTAS.length} preguntas** una a una. ¡Mucho ánimo! 💪`).setColor(0x5865f2).setTimestamp().setFooter({ text: 'BD Services · Postulaciones' })] });
      await ticketChannel.send({ embeds: [buildPreguntaEmbed(0)] });
      appsActivas.set(ticketChannel.id, { userId: interaction.user.id, currentQ: 0, answers: [] });
      return;
    }


  }

  if (!interaction.isButton()) return;

  const colonIdx = interaction.customId.indexOf(':');
  const accion   = interaction.customId.slice(0, colonIdx);
  const resto    = interaction.customId.slice(colonIdx + 1);
  const isStaff  = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || (interaction.member as GuildMember)?.roles?.cache?.has(STAFF_ROLE_ID);

  async function cerrarCanal(embed: EmbedBuilder) {
    await interaction.update({ embeds: [embed], components: [] });
    setTimeout(async () => {
      if (interaction.channel?.type === ChannelType.GuildText) await (interaction.channel as TextChannel).delete().catch(() => {});
    }, 5000);
  }

  if (accion === 'ticket_cerrar') return void cerrarCanal(new EmbedBuilder().setTitle('🔒 Ticket cerrado').setDescription(`Cerrado por <@${interaction.user.id}>. Eliminando en 5 segundos.`).setColor(0x99aab5).setTimestamp());

  if (accion === 'ticket_transcript') {
    return void interaction.reply({ content: '📄 Generando transcripción... (Funcionalidad de ejemplo)', ephemeral: true });
  }

  if (accion === 'ticket_entregado') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff.', ephemeral: true });
    const lastColon = resto.lastIndexOf(':');
    const itemName = resto.slice(0, lastColon), userId = resto.slice(lastColon + 1);
    await sendLog(LOG_PEDIDOS, modEmbed(0x57f287, '✅ Pedido entregado', [{ name: `${stock[itemName]?.emoji ?? '📦'} Producto`, value: itemName, inline: true }, { name: '👤 Cliente', value: `<@${userId}>`, inline: true }, { name: '👮 Staff', value: `<@${interaction.user.id}>`, inline: true }]));
    return void cerrarCanal(new EmbedBuilder().setTitle('✅ Pedido entregado').setDescription(`**${stock[itemName]?.emoji ?? ''} ${itemName}** entregado a <@${userId}>.\nEliminando en 5 segundos.`).setColor(0x57f287).setTimestamp());
  }

  if (accion === 'ticket_cancelar') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff.', ephemeral: true });
    const lastColon = resto.lastIndexOf(':');
    const itemName = resto.slice(0, lastColon), userId = resto.slice(lastColon + 1);
    const item = stock[itemName];
    if (item) { item.unidades++; item.ultimaVenta = null; }
    await sendLog(LOG_PEDIDOS, modEmbed(0xed4245, '❌ Pedido cancelado', [{ name: `${item?.emoji ?? '📦'} Producto`, value: itemName, inline: true }, { name: '👤 Cliente', value: `<@${userId}>`, inline: true }, { name: '📦 Stock restaurado', value: `\`${item?.unidades}\``, inline: true }, { name: '👮 Staff', value: `<@${interaction.user.id}>`, inline: true }]));
    return void cerrarCanal(new EmbedBuilder().setTitle('❌ Pedido cancelado').setDescription(`Pedido de **${item?.emoji ?? ''} ${itemName}** cancelado. Stock restaurado: \`${item?.unidades}\`.\nEliminando en 5 segundos.`).setColor(0xed4245).setTimestamp());
  }

  if (accion === 'rec_resuelto') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff.', ephemeral: true });
    const lastColon = resto.lastIndexOf(':');
    const producto = resto.slice(0, lastColon), userId = resto.slice(lastColon + 1);
    await sendLog(LOG_RECLAMACIONES, modEmbed(0x57f287, '✅ Reclamación resuelta', [{ name: `${stock[producto]?.emoji ?? '📦'} Producto`, value: producto, inline: true }, { name: '👤 Cliente', value: `<@${userId}>`, inline: true }, { name: '👮 Staff', value: `<@${interaction.user.id}>`, inline: true }]));
    return void cerrarCanal(new EmbedBuilder().setTitle('✅ Reclamación resuelta').setDescription(`Reclamación de **${stock[producto]?.emoji ?? ''} ${producto}** resuelta.\nEliminando en 5 segundos.`).setColor(0x57f287).setTimestamp());
  }

  if (accion === 'rec_reembolso') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff.', ephemeral: true });
    const lastColon = resto.lastIndexOf(':');
    const producto = resto.slice(0, lastColon), userId = resto.slice(lastColon + 1);
    const item = stock[producto];
    if (item) { item.unidades++; item.ultimaVenta = null; }
    await sendLog(LOG_RECLAMACIONES, modEmbed(0xfee75c, '🔄 Reembolso', [{ name: `${item?.emoji ?? '📦'} Producto`, value: producto, inline: true }, { name: '👤 Cliente', value: `<@${userId}>`, inline: true }, { name: '📦 Stock restaurado', value: `\`${item?.unidades}\``, inline: true }, { name: '👮 Staff', value: `<@${interaction.user.id}>`, inline: true }]));
    return void cerrarCanal(new EmbedBuilder().setTitle('🔄 Reembolso procesado').setDescription(`Reembolso de **${item?.emoji ?? ''} ${producto}** procesado. Stock restaurado: \`${item?.unidades}\`.\nEliminando en 5 segundos.`).setColor(0xfee75c).setTimestamp());
  }

  if (accion === 'post_aceptar') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff.', ephemeral: true });
    await interaction.update({ components: [] });
    await interaction.channel?.send({ content: `<@${resto}>`, embeds: [new EmbedBuilder().setTitle('🎉 Postulación Aceptada').setDescription(`<@${resto}>, tu postulación ha sido **aceptada** por <@${interaction.user.id}>.\n¡Bienvenido al equipo! 🎊`).setColor(0x57f287).setTimestamp().setFooter({ text: 'BD Services · Postulaciones' })] });
    await sendLog(LOG_POSTULACIONES, modEmbed(0x57f287, '✅ Postulación aceptada', [{ name: '👤 Solicitante', value: `<@${resto}>`, inline: true }, { name: '👮 Por', value: `<@${interaction.user.id}>`, inline: true }]));
    return;
  }

  if (accion === 'post_rechazar') {
    if (!isStaff) return void interaction.reply({ content: '❌ Solo el staff.', ephemeral: true });
    await sendLog(LOG_POSTULACIONES, modEmbed(0xed4245, '❌ Postulación rechazada', [{ name: '👤 Solicitante', value: `<@${resto}>`, inline: true }, { name: '👮 Por', value: `<@${interaction.user.id}>`, inline: true }]));
    return void cerrarCanal(new EmbedBuilder().setTitle('❌ Postulación Rechazada').setDescription(`<@${resto}>, tu postulación fue **rechazada** por <@${interaction.user.id}>.\nPuedes volver a postularte en el futuro. ¡Ánimo!\nEliminando en 5 segundos.`).setColor(0xed4245).setTimestamp().setFooter({ text: 'BD Services · Postulaciones' }));
  }
});


// ══════════════════════════════════════════
// 🔑  LOGIN
// ══════════════════════════════════════════
client.login(token);
