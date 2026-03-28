require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { registerCommands } = require('./commands.js');
const { handleInteraction } = require('./interactions.js');
const state = require('./state.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers, 
    ]
});

process.on('unhandledRejection', e => console.error('Petición rechazada:', e));
process.on('uncaughtException', e => console.error('Excepción no capturada:', e));

client.once('ready', () => {
    console.log(`Bot listo: ${client.user.tag} 🤖`);
    registerCommands(); 
});

client.on('interactionCreate', async interaction => {
    // Audit log opcional:
    // console.log(`[Interaction] ${interaction.commandName || interaction.customId} por ${interaction.user.tag}`);
    try {
        await handleInteraction(interaction);
    } catch (e) {
        console.error('Error interacción:', e);
    }
});

client.on('guildMemberAdd', async member => {
    if (state.autoRollGuildId === member.guild.id && state.autoRollRoleId) {
        try {
            const role = member.guild.roles.cache.get(state.autoRollRoleId);
            if (role) await member.roles.add(role);
        } catch (e) {
            console.error('Error auto-roll:', e);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
