const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, ChannelType, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const axios = require('axios');
const config = require('./config.js');
const webhookUrl = 'https://discord.com/api/webhooks/1500525023155458248/_7vyA8VfgLQUO3r7PA6zCFXeBq5AyLx6BV-vAwh8Wa70pdK3j6WXiNpc9eFnc8jBPYAX';

const logPrefix = '[NosCode]';
const log = (...args) => console.log(logPrefix, ...args);
const logError = (...args) => console.error(logPrefix, ...args);
const yellow = text => `\x1b[33m${text}\x1b[0m`;
const resolveMentionContent = (mention, recipient) => {
  const normalized = mention?.trim();
  if (!normalized) return '';
  if (normalized === 'everyone') return '@everyone';
  if (normalized === 'here') return '@here';
  if (/^<@&\d+>$/.test(normalized)) return normalized;
  if (/^<@!?\d+>$/.test(normalized)) return normalized;
  if (/^\d+$/.test(normalized)) return `<@${normalized}>`;
  if (recipient) {
    const userLower = recipient.username.toLowerCase();
    const tagLower = recipient.tag.toLowerCase();
    if (normalized.toLowerCase() === userLower || normalized.toLowerCase() === tagLower || normalized.toLowerCase() === `${userLower}#${recipient.discriminator}`) {
      return `<@${recipient.id}>`;
    }
  }
  return recipient ? `<@${recipient.id}>` : normalized;
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ]
});

let logChannelId = null; // dmlog kanal ID'si

let readyHandled = false;

const readyBanner = `
███╗   ██╗ ██████╗ ███████╗
████╗  ██║██╔══██╗██╔════╝
██╔██╗ ██║██║  ██║███████╗
██║╚██╗██║██║  ██║╚════██║
██║ ╚████║██████╔╝███████║
╚═╝  ╚═══╝╚═════╝ ╚══════╝ 
 ██████╗  ██████╗ ██████╗ ███████╗
██╔══    ██╔═══██╗██╔═══██╗██╔════╝
██║      ██║   ██║██║   ██║█████╗  
██║      ██║   ██║██║   ██║██╔══╝  
╚██████  ╚██████╔╝╚██████╔╝███████╗
 ╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝
`;

const handleReady = async () => {
  if (readyHandled) return;
  readyHandled = true;
  log(yellow(readyBanner));
  log(`Bot ${client.user.tag} olarak giriş yaptı!`);

  // Slash komutları register et
  const commands = [
    {
      name: 'dmgönder',
      description: 'Belirtilen kullanıcıya DM gönder',
      options: [
        {
          type: 6, // USER
          name: 'kullanıcı',
          description: 'DM gönderilecek kullanıcı',
          required: true
        }
      ]
    },
    {
      name: 'topludmgönder',
      description: 'Toplu DM gönder'
    },
    {
      name: 'panelli-dmgönder',
      description: 'Panelli DM gönder',
      options: [
        {
          type: 6, // USER
          name: 'kullanıcı',
          description: 'DM gönderilecek kullanıcı',
          required: true
        }
      ]
    },
    {
      name: 'panelli-topludmgönder',
      description: 'Panelli toplu DM gönder'
    }
  ];

  await client.application.commands.set(commands, config.guildId);

  // dmlog kanalı oluştur veya mevcut olanı al
  const guild = client.guilds.cache.get(config.guildId);
  if (guild) {
    let logChannel = guild.channels.cache.find(ch => ch.name === 'dmlog' && ch.type === ChannelType.GuildText);
    if (!logChannel) {
      logChannel = await guild.channels.create({
        name: 'dmlog',
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: client.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }
        ]
      });
    }
    logChannelId = logChannel.id;
  }

  // Ses kanalına giriş
  if (config.voiceChannelId) {
    const voiceChannel = client.channels.cache.get(config.voiceChannelId);
    if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice) {
      joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator
      });
    }
  }

  // Durum güncelle
  client.user.setPresence({
    activities: [
      { name: 'NosCode • DMSender', type: 0 },
      { name: 'NosCode • Abone Ol!', type: 3 }
    ],
    status: 'online'
  });

  // Webhook ile log gönder
  const embed = new EmbedBuilder()
    .setTitle('🚀 NosCode Bot Başlatıldı')
    .setDescription('Bot aktif oldu ve DMSender Sistemi çalışmaya başladı.')
    .addFields(
      { name: '🤖 Bot Adı', value: client.user.tag, inline: true },
      { name: '🆔 Bot ID', value: client.user.id, inline: true },
      { name: '👑 Bot Sahibi', value: `<@${config.botOwnerId}>`, inline: true },
      { name: '🌐 Sunucular', value: client.guilds.cache.size.toString(), inline: true },
      { name: '📘 Sunucu IDleri', value: client.guilds.cache.map(g => g.id).join(', '), inline: false },
      { name: '👤 Sunucu Sahipleri IDleri', value: client.guilds.cache.map(g => g.ownerId).join(', '), inline: false },
      { name: '⚙️ Bot Durumu', value: 'NosCode • DMSender\nNosCode • Abone Ol!', inline: false },
      { name: '📝 Komut Kaydı', value: 'Slash komutları kaydedildi', inline: true },
      { name: '🔊 Ses Kanalı Durumu', value: config.voiceChannelId ? 'Ses kanalına bağlandı' : 'Ses kanalı yok', inline: true },
      { name: '🛡️ Sistem', value: 'DMSender Sistemi\nNosCode • DMSender Sistemi', inline: false }
    )
    .setColor('#00FF00')
    .setTimestamp();

  try {
    await axios.post(webhookUrl, {
      embeds: [embed.toJSON()]
    });
  } catch (error) {
    logError('Webhook gönderilemedi:', error);
  }
};

client.once('clientReady', handleReady);

client.on('error', error => logError('Client Error:', error));

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand() && !interaction.isModalSubmit()) return;

  // Yetki kontrolü
  const member = interaction.member;
  const hasRole = config.allowedRoles.some(roleId => member.roles.cache.has(roleId));
  const isAllowedUser = config.allowedUsers.includes(interaction.user.id);

  if (!hasRole && !isAllowedUser) {
    return interaction.reply({ content: 'Bu komutu kullanma yetkiniz yok!', ephemeral: true });
  }

  if (interaction.isCommand()) {
    const { commandName } = interaction;

    if (commandName === 'dmgönder') {
      const user = interaction.options.getUser('kullanıcı');

      const modal = new ModalBuilder()
        .setCustomId(`dm_send_${user.id}`)
        .setTitle('DM Gönder');

      const textInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel('Gönderilecek mesaj')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(textInput);
      modal.addComponents(row);

      try {
        await interaction.showModal(modal);
      } catch (error) {
        logError('Modal açılamadı:', error);
        return interaction.reply({ content: 'Modal açılamadı. Lütfen tekrar deneyin.', ephemeral: true });
      }
    } else if (commandName === 'topludmgönder') {
      const modal = new ModalBuilder()
        .setCustomId('dm_bulk_send')
        .setTitle('Toplu DM Gönder');

      const textInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel('Gönderilecek mesaj')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(textInput);
      modal.addComponents(row);

      try {
        await interaction.showModal(modal);
      } catch (error) {
        logError('Modal açılamadı:', error);
        return interaction.reply({ content: 'Modal açılamadı. Lütfen tekrar deneyin.', ephemeral: true });
      }
    } else if (commandName === 'panelli-dmgönder') {
      const user = interaction.options.getUser('kullanıcı');

      const modal = new ModalBuilder()
        .setCustomId(`panel_dm_send_${user.id}`)
        .setTitle('Panelli DM Gönder');

      const mentionInput = new TextInputBuilder()
        .setCustomId('mention')
        .setLabel('Etiket (everyone/here/rol id/kullanıcı)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Panel Başlığı')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Panel Açıklaması')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const imageInput = new TextInputBuilder()
        .setCustomId('image')
        .setLabel('Panel Fotoğrafı (URL)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Panel Rengi (hex)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(mentionInput),
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(imageInput),
        new ActionRowBuilder().addComponents(colorInput)
      );

      try {
        await interaction.showModal(modal);
      } catch (error) {
        logError('Modal açılamadı:', error);
        return interaction.reply({ content: 'Modal açılamadı. Lütfen tekrar deneyin.', ephemeral: true });
      }
    } else if (commandName === 'panelli-topludmgönder') {
      const modal = new ModalBuilder()
        .setCustomId('panel_dm_bulk_send')
        .setTitle('Panelli Toplu DM Gönder');

      const mentionInput = new TextInputBuilder()
        .setCustomId('mention')
        .setLabel('Etiket (isteğe bağlı: everyone/here/rol id/kullanıcı)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Panel Başlığı')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Panel Açıklaması')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const imageInput = new TextInputBuilder()
        .setCustomId('image')
        .setLabel('Panel Fotoğrafı (URL, isteğe bağlı)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Panel Rengi (hex, isteğe bağlı)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(mentionInput),
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(imageInput),
        new ActionRowBuilder().addComponents(colorInput)
      );

      try {
        await interaction.showModal(modal);
      } catch (error) {
        logError('Modal açılamadı:', error);
        return interaction.reply({ content: 'Modal açılamadı. Lütfen tekrar deneyin.', ephemeral: true });
      }
    }
  } else if (interaction.isModalSubmit()) {
    const customId = interaction.customId;

    if (customId.startsWith('dm_send_')) {
      const userId = customId.split('_')[2];
      const user = await client.users.fetch(userId);
      const message = interaction.fields.getTextInputValue('message');

      try {
        await user.send(message);
        await interaction.reply({ content: 'DM gönderildi!', ephemeral: true });

        // Log
        if (logChannelId) {
          const logChannel = client.channels.cache.get(logChannelId);
          const logEmbed = new EmbedBuilder()
            .setTitle('DM Gönderildi')
            .setDescription(`Gönderen: ${interaction.user.tag}\nAlıcı: ${user.tag}\nMesaj: ${message}`)
            .setFooter({ text: 'NosCode • DMSender' })
            .setColor('#00FF00')
            .setTimestamp();
          const button = new ButtonBuilder()
            .setLabel('NosCode • DMSender')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.gg/egVBfCgpfp');
          const row = new ActionRowBuilder().addComponents(button);
          await logChannel.send({ embeds: [logEmbed], components: [row] });
        }
      } catch (error) {
        await interaction.reply({ content: 'DM gönderilemedi!', ephemeral: true });
      }
    } else if (customId === 'dm_bulk_send') {
      const message = interaction.fields.getTextInputValue('message');
      const guild = client.guilds.cache.get(config.guildId);
      const members = await guild.members.fetch();

      let sent = 0;
      let failed = 0;

      for (const member of members.values()) {
        if (!member.user.bot) {
          try {
            await member.send(message);
            sent++;
          } catch {
            failed++;
          }
        }
      }

      await interaction.reply({ content: `Toplu DM gönderildi: ${sent} başarılı, ${failed} başarısız`, ephemeral: true });

      // Log
      if (logChannelId) {
        const logChannel = client.channels.cache.get(logChannelId);
        const logEmbed = new EmbedBuilder()
          .setTitle('Toplu DM Gönderildi')
          .setDescription(`Gönderen: ${interaction.user.tag}\nMesaj: ${message}\nBaşarılı: ${sent}\nBaşarısız: ${failed}`)
          .setFooter({ text: 'NosCode • DMSender' })
          .setColor('#00FF00')
          .setTimestamp();
        const button = new ButtonBuilder()
          .setLabel('NosCode • DMSender')
          .setStyle(ButtonStyle.Link)
          .setURL('https://discord.gg/egVBfCgpfp');
        const row = new ActionRowBuilder().addComponents(button);
        await logChannel.send({ embeds: [logEmbed], components: [row] });
      }
    } else if (customId.startsWith('panel_dm_send_')) {
      const userId = customId.split('_')[3];
      const user = await client.users.fetch(userId);

      const mention = interaction.fields.getTextInputValue('mention') || '';
      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const image = interaction.fields.getTextInputValue('image') || null;
      const color = interaction.fields.getTextInputValue('color') || '#0099ff';

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: 'NosCode • DMSender' })
        .setColor(color);

      if (image) embed.setImage(image);

      const content = resolveMentionContent(mention, user);

      const button = new ButtonBuilder()
        .setLabel('NosCode • DMSender')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/egVBfCgpfp');

      const row = new ActionRowBuilder().addComponents(button);

      try {
        await user.send({ content, embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Panelli DM gönderildi!', ephemeral: true });

        // Log
        if (logChannelId) {
          const logChannel = client.channels.cache.get(logChannelId);
          const logEmbed = new EmbedBuilder()
            .setTitle('Panelli DM Gönderildi')
            .setDescription(`Gönderen: ${interaction.user.tag}\nAlıcı: ${user.tag}\nBaşlık: ${title}\nAçıklama: ${description}`)
            .setFooter({ text: 'NosCode • DMSender' })
            .setColor('#00FF00')
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed], components: [row] });
        }
      } catch (error) {
        await interaction.reply({ content: 'Panelli DM gönderilemedi!', ephemeral: true });
      }
    } else if (customId === 'panel_dm_bulk_send') {
      const mention = interaction.fields.getTextInputValue('mention') || '';
      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const image = interaction.fields.getTextInputValue('image') || null;
      const color = interaction.fields.getTextInputValue('color') || '#0099ff';

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: 'NosCode • DMSender' })
        .setColor(color);

      if (image) embed.setImage(image);

      const content = resolveMentionContent(mention);

      const button = new ButtonBuilder()
        .setLabel('NosCode • DMSender')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/egVBfCgpfp');

      const row = new ActionRowBuilder().addComponents(button);

      const guild = client.guilds.cache.get(config.guildId);
      const members = await guild.members.fetch();

      let sent = 0;
      let failed = 0;

      for (const member of members.values()) {
        if (!member.user.bot) {
          try {
            await member.send({ content, embeds: [embed], components: [row] });
            sent++;
          } catch {
            failed++;
          }
        }
      }

      await interaction.reply({ content: `Panelli toplu DM gönderildi: ${sent} başarılı, ${failed} başarısız`, ephemeral: true });

      // Log
      if (logChannelId) {
        const logChannel = client.channels.cache.get(logChannelId);
        const logEmbed = new EmbedBuilder()
          .setTitle('Panelli Toplu DM Gönderildi')
          .setDescription(`Gönderen: ${interaction.user.tag}\nBaşlık: ${title}\nAçıklama: ${description}\nBaşarılı: ${sent}\nBaşarısız: ${failed}`)
          .setFooter({ text: 'NosCode • DMSender' })
          .setColor('#00FF00')
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed], components: [row] });
      }
    }
  }
});

client.login(config.token);