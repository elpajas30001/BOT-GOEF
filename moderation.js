const { EmbedBuilder } = require('discord.js');
const { sleep } = require('./utils.js');

async function handlePurge(interaction) {
    const amount = interaction.options.getInteger('cantidad');
    const delaySecs = interaction.options.getInteger('segundos');
    
    await interaction.deferReply({ ephemeral: true });
    
    let deletedCount = 0;
    let lastMessageId = null;
    
    try {
        while (deletedCount < amount) {
            const limit = Math.min(amount - deletedCount, 100);
            const options = { limit };
            if (lastMessageId) options.before = lastMessageId;
            
            const messages = await interaction.channel.messages.fetch(options);
            if (messages.size === 0) break;
            
            if (delaySecs === 0) {
                const now = Date.now();
                const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
                const recentMessages = messages.filter(m => (now - m.createdTimestamp) < twoWeeksMs);
                const oldMessages = messages.filter(m => (now - m.createdTimestamp) >= twoWeeksMs);

                if (recentMessages.size > 0) {
                    await interaction.channel.bulkDelete(recentMessages, true);
                    deletedCount += recentMessages.size;
                }

                if (oldMessages.size > 0) {
                    for (const msg of oldMessages.values()) {
                        await msg.delete();
                        deletedCount++;
                        if (deletedCount >= amount) break;
                        await sleep(1000);
                    }
                }
            } else {
                for (const msg of messages.values()) {
                    await msg.delete();
                    deletedCount++;
                    if (deletedCount >= amount) break;
                    await sleep(delaySecs * 1000);
                }
            }

            lastMessageId = messages.last().id;
            await interaction.editReply(`🧹 Purgando mensajes: **${deletedCount}/${amount}** eliminados...`);
        }
        
        return await interaction.editReply(`✅ **Purga completada**: Se eliminaron **${deletedCount}** mensajes.`);
    } catch (error) {
        console.error('Error en purge:', error);
        return await interaction.editReply(`❌ Error durante la purga. Se eliminaron ${deletedCount} mensajes.`);
    }
}

module.exports = { handlePurge };
