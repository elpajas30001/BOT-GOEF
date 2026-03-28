const { SlashCommandBuilder, REST, Routes } = require('discord.js');

const commands = [
    new SlashCommandBuilder().setName('play').setDescription('Reproduce una canción').setDefaultMemberPermissions(8n).addStringOption(o => o.setName('cancion').setDescription('Nombre o URL').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder().setName('stop').setDescription('Detiene la música').setDefaultMemberPermissions(8n),
    new SlashCommandBuilder().setName('rule34').setDescription('Busca imágenes NSFW').setDefaultMemberPermissions(8n).addStringOption(o => o.setName('nombre').setDescription('Tag').setAutocomplete(true).setRequired(true)),
    new SlashCommandBuilder().setName('hentai').setDescription('Busca GIFs/Videos NSFW').setDefaultMemberPermissions(8n).addStringOption(o => o.setName('nombre').setDescription('Tag (opcional)').setAutocomplete(true)),
    new SlashCommandBuilder().setName('ping').setDescription('Verifica la latencia del bot').setDefaultMemberPermissions(8n),
    new SlashCommandBuilder().setName('info').setDescription('Muestra información').setDefaultMemberPermissions(8n).addSubcommand(s => s.setName('user').setDescription('Info de un usuario').addUserOption(o => o.setName('target').setDescription('Usuario').setRequired(true))).addSubcommand(s => s.setName('server').setDescription('Info del servidor')),
    new SlashCommandBuilder().setName('roles').setDescription('Muestra los roles del servidor').setDefaultMemberPermissions(8n),
    new SlashCommandBuilder().setName('ban').setDescription('Banea a un usuario').setDefaultMemberPermissions(8n).addUserOption(o => o.setName('target').setDescription('Usuario').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Razón')),
    new SlashCommandBuilder().setName('mute').setDescription('Silencia (timeout) a un usuario').setDefaultMemberPermissions(8n).addUserOption(o => o.setName('target').setDescription('Usuario').setRequired(true)).addIntegerOption(o => o.setName('minutes').setDescription('Minutos').setRequired(true)),
    new SlashCommandBuilder().setName('kick').setDescription('Expulsa a un usuario del servidor').setDefaultMemberPermissions(8n).addUserOption(o => o.setName('target').setDescription('Usuario').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Razón')),
    new SlashCommandBuilder().setName('auto-rule34').setDescription('Envío automático de Rule34').setDefaultMemberPermissions(8n)
        .addBooleanOption(o => o.setName('activo').setDescription('True para activar, False para detener').setRequired(true))
        .addChannelOption(o => o.setName('canal').setDescription('Canal (opcional)'))
        .addIntegerOption(o => o.setName('minutos').setDescription('Cada cuántos minutos')),
    new SlashCommandBuilder().setName('auto-hentai').setDescription('Envío automático de Hentai').setDefaultMemberPermissions(8n)
        .addBooleanOption(o => o.setName('activo').setDescription('True para activar, False para detener').setRequired(true))
        .addChannelOption(o => o.setName('canal').setDescription('Canal (opcional)'))
        .addIntegerOption(o => o.setName('minutos').setDescription('Cada cuántos minutos')),
    new SlashCommandBuilder().setName('auto-roll').setDescription('Asigna rol automáticamente a nuevos miembros').setDefaultMemberPermissions(8n),
    new SlashCommandBuilder().setName('skip').setDescription('Salta la canción actual').setDefaultMemberPermissions(8n),
    new SlashCommandBuilder().setName('queue').setDescription('Muestra la cola de reproducción').setDefaultMemberPermissions(8n),
    new SlashCommandBuilder().setName('purge').setDescription('Elimina mensajes').setDefaultMemberPermissions(8n)
        .addIntegerOption(o => o.setName('cantidad').setDescription('Mensajes (1-5000)').setRequired(true).setMinValue(1).setMaxValue(5000))
        .addIntegerOption(o => o.setName('segundos').setDescription('Delay (0-60)').setRequired(true).setMinValue(0).setMaxValue(60)),
].map(command => command.toJSON());

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Registrando comandos...');
        await rest.put(Routes.applicationCommands(process.env.APP_ID), { body: commands });
        console.log('Comandos registrados.');
    } catch (e) {
        console.error('Error registro comandos:', e);
    }
}

module.exports = { registerCommands };
