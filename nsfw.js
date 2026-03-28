const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');

const autoTasks = new Map();

async function sendRule34(name, interaction, isUpdate = false, isHentai = false) {
    const r34User = process.env.RULE34_USER_ID;
    const r34Key = process.env.RULE34_API_KEY;
    const gelUser = process.env.GELBOORU_USER_ID;
    const gelKey = process.env.GELBOORU_API_KEY;

    if (!interaction.deferred && !interaction.replied) {
        if (interaction.isButton()) await interaction.deferUpdate();
        else await interaction.deferReply();
    }

    try {
        const cleanName = name.replace(/\s+/g, '_');
        const tagSets = [
            isHentai ? `${cleanName} animated` : `${cleanName} score:>5 -male -gay`,
            isHentai ? `${cleanName} video` : `${cleanName} -male`,
            isHentai ? `animated hentai` : `solo_female score:>10` 
        ];

        let providers = isHentai ? ['rule34', 'konachan'] : ['rule34'];
        if (isHentai && gelUser && gelKey) providers.push('gelbooru');
        if (isHentai) providers = providers.sort(() => Math.random() - 0.5);

        let posts = [];
        let finalProvider = '';

        outerLoop: for (const tagsQuery of tagSets) {
            for (const provider of providers) {
                try {
                    let url = '';
                    if (provider === 'konachan') {
                        url = `https://konachan.net/post.json?tags=${encodeURIComponent(tagsQuery + ' rating:explicit')}&limit=50`;
                    } else if (provider === 'gelbooru') {
                        url = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagsQuery + ' rating:explicit')}&user_id=${gelUser}&api_key=${gelKey}`;
                    } else if (provider === 'rule34') {
                        const filter = isHentai ? '-male -gay -futanari' : '-male -gay -futanari -solo_male -shemale -yaoi -trap -scat -gore -censored';
                        url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagsQuery + ' ' + filter)}&user_id=${r34User}&api_key=${r34Key}`;
                    }
                    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const data = await resp.json();
                    posts = provider === 'gelbooru' ? (data.post || []) : data;

                    if (posts && Array.isArray(posts) && posts.length > 0) {
                        finalProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
                        break outerLoop;
                    }
                } catch (e) {
                    console.error(`Error ${provider}:`, e.message);
                }
            }
        }

        if (!posts || posts.length === 0) return await interaction.editReply({ content: `❌ No se encontraron resultados para **${name}**.`, embeds: [], components: [] });

        const post = posts[Math.floor(Math.random() * Math.min(posts.length, 50))];
        const getUrl = (u) => u.startsWith('//') ? `https:${u}` : u;
        const fileUrl = getUrl(post.file_url);
        const isVideo = fileUrl.toLowerCase().endsWith('.mp4') || fileUrl.toLowerCase().endsWith('.webm');
        const displayImage = isVideo ? getUrl(post.sample_url || post.preview_url) : getUrl(post.sample_url || post.file_url);

        const embedColor = isHentai ? '#cc00ff' : '#ff0055';
        const embedTitle = isHentai ? `💜 Hentai (${finalProvider}) — ${name}` : `🔞 Rule34 (${finalProvider}) — ${name}`;

        const embed = new EmbedBuilder().setTitle(embedTitle).setColor(embedColor).setFooter({ text: `ID: ${post.id}` });
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`nsfw_next:${isHentai ? 'hentai' : 'rule34'}:${name.slice(0, 50)}`).setLabel('🔄 Cambiar').setStyle(ButtonStyle.Secondary)
        );

        if (isVideo) {
            try {
                const resp = await fetch(fileUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const buf = Buffer.from(await resp.arrayBuffer());
                const attachment = new AttachmentBuilder(buf, { name: `video.${fileUrl.split('.').pop()}` });
                return await interaction.editReply({ content: isUpdate ? '' : null, embeds: [], files: [attachment], components: [row] });
            } catch (e) {
                embed.setDescription(`🎬 ||${fileUrl}||`);
                return await interaction.editReply({ content: isUpdate ? '' : null, embeds: [embed], components: [row] });
            }
        }

        embed.setImage(displayImage);
        if (fileUrl.toLowerCase().endsWith('.gif')) embed.setImage(fileUrl);

        return await interaction.editReply({ content: isUpdate ? '' : null, embeds: [embed], files: [], components: [row] });
    } catch (e) {
        console.error('Error sendRule34:', e);
        if (interaction.deferred || interaction.replied) await interaction.editReply('Error al buscar.').catch(() => {});
    }
}

module.exports = {
    sendRule34,
    autoTasks
};
