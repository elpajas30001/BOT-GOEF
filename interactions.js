const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');
const music = require('./music.js');
const nsfw = require('./nsfw.js');
const moderation = require('./moderation.js');
const state = require('./state.js');
const { stopStreams } = require('./utils.js');

async function handleInteraction(interaction) {
    try {
        if (interaction.isAutocomplete()) {
            const focusedValue = interaction.options.getFocused();
            if (!focusedValue) return interaction.respond([]);

            if (interaction.commandName === 'play') {
                const results = await play.search(focusedValue, { limit: 5 });
                return await interaction.respond(results.map(v => ({ name: v.title.slice(0, 100), value: v.url })));
            }
            if (interaction.commandName === 'rule34' || interaction.commandName === 'hentai') {
                const resp = await fetch(`https://api.rule34.xxx/autocomplete.php?q=${encodeURIComponent(focusedValue)}`);
                const tags = await resp.json();
                return await interaction.respond(tags.slice(0, 25).map(t => ({ name: t.label, value: t.value })));
            }
            return;
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('nsfw_next:')) {
                const parts = interaction.customId.split(':');
                return await nsfw.sendRule34(parts.slice(2).join(':') || 'hentai', interaction, true, parts[1] === 'hentai');
            }
            if (interaction.customId === 'pause_resume') {
                if (music.player.state.status === AudioPlayerStatus.Paused) {
                    music.player.unpause();
                    return await interaction.update({ components: music.getRows(false) });
                } else {
                    music.player.pause();
                    return await interaction.update({ components: music.getRows(true) });
                }
            }
            if (interaction.customId === 'stop') {
                music.musicQueue.length = 0;
                music.player.stop();
                stopStreams();
                const conn = getVoiceConnection(interaction.guild.id);
                if (conn) conn.destroy();
                return await interaction.update({ components: [] });
            }
            if (interaction.customId === 'reset') {
                if (!music.lastMetadata) return interaction.reply({ content: 'No hay previa.', ephemeral: true });
                music.player.stop();
                music.player.unpause();
                await interaction.deferUpdate();
                return await music.startPlayback(music.lastMetadata, interaction, true);
            }
            if (interaction.customId === 'skip' || interaction.customId === 'back') {
                music.player.stop();
                return await interaction.deferUpdate();
            }
            return;
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'volume') {
                const vol = parseFloat(interaction.values[0]);
                if (music.currentResource && music.currentResource.volume) music.currentResource.volume.setVolume(vol);
                return await interaction.deferUpdate();
            }
            if (interaction.customId === 'auto_roll_pick') {
                const role = interaction.guild.roles.cache.get(interaction.values[0]);
                if (!role) return interaction.reply({ content: 'Rol no encontrado.', ephemeral: true });
                state.autoRollRoleId = role.id;
                state.autoRollGuildId = interaction.guild.id;
                return await interaction.reply({ content: `✅ Rol **${role.name}** asignado automáticamente. 🎭`, ephemeral: true });
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        // Commands
        if (interaction.commandName === 'play') {
            await interaction.deferReply();
            const query = interaction.options.getString('cancion');
            if (!interaction.member.voice.channel) return interaction.editReply({ content: 'Entra a un canal de voz.' });
            const meta = await music.getMetadata(query);
            if (!meta) return interaction.editReply('❌ No encontrado.');
            if (music.player.state.status === AudioPlayerStatus.Playing) {
                music.musicQueue.push({ metadata: meta, interaction });
                return interaction.editReply(`✅ En cola (#${music.musicQueue.length}): ${meta.title}`);
            }
            return await music.startPlayback(meta, interaction);
        }

        if (interaction.commandName === 'stop') {
            await interaction.deferReply();
            music.musicQueue.length = 0; music.player.stop();
            const conn = getVoiceConnection(interaction.guild.id);
            if (conn) conn.destroy();
            return await interaction.editReply('⏹️ Detenido.');
        }

        if (interaction.commandName === 'skip') {
            await interaction.deferReply();
            if (music.player.state.status === AudioPlayerStatus.Idle && music.musicQueue.length === 0) return interaction.editReply({ content: 'Nada en cola.' });
            music.player.stop();
            return await interaction.editReply('⏭️ Saltando...');
        }

        if (interaction.commandName === 'queue') {
            await interaction.deferReply();
            let msg = '';
            if (music.lastMetadata && music.player.state.status !== AudioPlayerStatus.Idle) {
                msg += `🎶 **Ahora suena:** ${music.lastMetadata.title}\n\n`;
            }
            if (music.musicQueue.length > 0) {
                msg += `📋 **En cola:**\n` + music.musicQueue.map((item, i) => `${i + 1}. **${item.metadata.title}**`).join('\n');
            } else if (msg === '') {
                return interaction.editReply('Vacía.');
            }
            const embed = new EmbedBuilder().setTitle('🎶 Lista de Reproducción').setDescription(msg.length > 4096 ? msg.slice(0, 4090) + '...' : msg).setColor('#5865F2');
            return await interaction.editReply({ embeds: [embed] });
        }

        if (interaction.commandName === 'ping') return await interaction.reply(`🏓 Latencia: ${interaction.client.ws.ping}ms`);

        if (interaction.commandName === 'info') {
            await interaction.deferReply();
            const sub = interaction.options.getSubcommand();
            if (sub === 'user') {
                const user = interaction.options.getUser('target');
                const member = await interaction.guild.members.fetch(user.id);
                const daysIn = Math.floor((Date.now() - member.joinedTimestamp) / 86400000);
                const roles = member.roles.cache.filter(r => r.name !== '@everyone').map(r => `<@&${r.id}>`).join(' ') || 'Ninguno';
                const embed = new EmbedBuilder()
                    .setTitle(`👤 ${member.displayName}`).setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: 'Tag', value: user.tag, inline: true },
                        { name: 'ID', value: user.id, inline: true },
                        { name: 'Unión', value: `Hace ${daysIn} días`, inline: false },
                        { name: 'Roles', value: roles.length > 1024 ? roles.slice(0, 1020) + '...' : roles }
                    ).setColor(member.displayHexColor || '#5865F2');
                return await interaction.editReply({ embeds: [embed] });
            } else {
                const g = interaction.guild;
                const embed = new EmbedBuilder().setTitle(`🏠 ${g.name}`).setThumbnail(g.iconURL()).addFields(
                    { name: 'ID', value: g.id, inline: true }, { name: 'Miembros', value: g.memberCount.toString(), inline: true }
                ).setColor('#5865F2');
                return await interaction.editReply({ embeds: [embed] });
            }
        }

        if (interaction.commandName === 'roles') {
            await interaction.deferReply();
            const list = interaction.guild.roles.cache.filter(r => r.name !== '@everyone').sort((a, b) => b.position - a.position).map(r => `<@&${r.id}>`).join('\n') || 'Sin roles.';
            const embed = new EmbedBuilder().setTitle('🎭 Roles').setDescription(list.length > 4096 ? list.slice(0, 4090) + '...' : list).setColor('#5865F2');
            return await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
        }

        if (interaction.commandName === 'purge') return await moderation.handlePurge(interaction);

        if (interaction.commandName === 'ban' || interaction.commandName === 'kick' || interaction.commandName === 'mute') {
            await interaction.deferReply();
            const targetUser = interaction.options.getUser('target');
            const target = interaction.guild.members.cache.get(targetUser.id);
            if (!target) return interaction.editReply({ content: 'No encontrado.', ephemeral: true });
            
            const reason = interaction.options.getString('reason') || 'Sin razón';
            if (interaction.commandName === 'kick') {
                if (!target.kickable) return interaction.editReply({ content: '🚫 Sin permisos.', ephemeral: true });
                await target.kick(reason); return await interaction.editReply(`👢 **${target.user.tag}** expulsado.`);
            }
            if (interaction.commandName === 'ban') {
                if (!target.bannable) return interaction.editReply({ content: '🚫 Sin permisos.', ephemeral: true });
                await target.ban({ reason }); return await interaction.editReply(`🔨 **${target.user.tag}** baneado.`);
            }
            if (interaction.commandName === 'mute') {
                const mins = interaction.options.getInteger('minutes');
                if (!target.moderatable) return interaction.editReply({ content: '🚫 Sin permisos.', ephemeral: true });
                await target.timeout(mins * 60 * 1000); return await interaction.editReply(`🔇 **${target.user.tag}** silenciado por ${mins}m.`);
            }
        }

        if (interaction.commandName === 'rule34' || interaction.commandName === 'hentai') {
            if (!interaction.channel?.nsfw) return interaction.reply({ content: '🚫 Canal no NSFW.', ephemeral: true });
            return await nsfw.sendRule34(interaction.options.getString('nombre') || (interaction.commandName === 'hentai' ? 'animated' : 'girl'), interaction, false, interaction.commandName === 'hentai');
        }

        if (interaction.commandName === 'auto-rule34' || interaction.commandName === 'auto-hentai') {
            const activo = interaction.options.getBoolean('activo');
            const isHen = interaction.commandName === 'auto-hentai';
            const channelId = interaction.channelId;
            if (!activo) {
                if (nsfw.autoTasks.has(channelId)) { clearInterval(nsfw.autoTasks.get(channelId)); nsfw.autoTasks.delete(channelId); return await interaction.reply('⏹️ Detenido.'); }
                return await interaction.reply('Sin tareas.');
            }
            const target = interaction.options.getChannel('canal') || interaction.channel;
            const mins = interaction.options.getInteger('minutos') || 10;
            if (isHen && !target.nsfw) return interaction.reply({ content: '🚫 Debe ser NSFW.', ephemeral: true });
            if (nsfw.autoTasks.has(target.id)) clearInterval(nsfw.autoTasks.get(target.id));
            const tags = isHen ? ['animated', 'hentai', 'uncensored', 'big_breasts', 'anime'] : ['girls', 'bikini', 'lingerie', 'sexy', 'ecchi'];
            const interval = setInterval(() => {
                const tag = tags[Math.floor(Math.random() * tags.length)];
                target.send('🔍 Buscando...').then(msg => {
                    nsfw.sendRule34(tag, { deferred: true, replied: false, deferReply: async () => {}, editReply: (d) => msg.edit(d), channel: target, member: interaction.member, guild: interaction.guild, isButton: () => false }, false, isHen);
                });
            }, mins * 60 * 1000);
            nsfw.autoTasks.set(target.id, interval);
            return await interaction.reply(`✅ Auto-${isHen?'Hentai':'Rule34'} cada ${mins}m.`);
        }

        if (interaction.commandName === 'auto-roll') {
            const roles = interaction.guild.roles.cache.filter(r => r.name !== '@everyone').sort((a,b) => b.position - a.position).first(25).map(r => ({ label: r.name.slice(0,100), value: r.id }));
            if (roles.length === 0) return interaction.reply({ content: 'Sin roles.', ephemeral: true });
            const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('auto_roll_pick').setPlaceholder('Elige rol...').addOptions(roles));
            return await interaction.reply({ content: '🎭 Rol auto-roll:', components: [menu], ephemeral: true });
        }

    } catch (e) {
        console.error('Error interacción:', e);
        if (interaction.isAutocomplete()) return; 
        const msg = 'Error inesperado.';
        try {
            if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
            else await interaction.reply({ content: msg, ephemeral: true });
        } catch (err) {}
    }
}

module.exports = { handleInteraction };
