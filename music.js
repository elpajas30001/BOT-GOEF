const { createAudioPlayer, createAudioResource, AudioPlayerStatus, joinVoiceChannel, StreamType } = require('@discordjs/voice');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const play = require('play-dl');
const { spawn } = require('child_process');
const path = require('path');
const ffmpeg = require('ffmpeg-static');
const utils = require('./utils.js');

const player = createAudioPlayer();
const musicQueue = [];
let currentResource = null;
let lastMetadata = null;

async function getMetadata(query) {
    try {
        console.log(`[getMetadata] Buscando: ${query}`);
        const isUrl = play.yt_validate(query) !== false;
        const ytDlpPath = path.join(process.cwd(), 'yt-dlp.exe');
        
        // Intentar yt-dlp primero si no es URL (búsqueda más robusta) o si play-dl falla
        console.log(`[getMetadata] Usando yt-dlp fallback/search...`);
        const searchArg = isUrl ? query : `ytsearch1:${query.replace(/"/g, '')}`;
        const { spawnSync } = require('child_process');
        const result = spawnSync(`"${ytDlpPath}"`, ['--dump-json', '--no-playlist', searchArg], { encoding: 'utf8', shell: true });
        
        if (result.status === 0 && result.stdout) {
            const data = JSON.parse(result.stdout.trim().split('\n')[0]);
            console.log(`[getMetadata] Éxito con yt-dlp: ${data.title}`);
            return { url: data.webpage_url || data.url, title: data.title, thumbnail: data.thumbnail };
        }

        console.log(`[getMetadata] Falló yt-dlp, intentando play-dl...`);
        if (isUrl) {
            const info = await play.video_info(query).catch(e => { console.error('[play-dl] info error:', e.message); return null; });
            if (info) {
                const v = info.video_details;
                return { url: v.url, title: v.title, thumbnail: v.thumbnails?.[v.thumbnails.length - 1]?.url };
            }
        } else {
            const results = await play.search(query, { limit: 1 }).catch(e => { console.error('[play-dl] search error:', e.message); return []; });
            if (results.length) {
                const v = results[0];
                return { url: `https://www.youtube.com/watch?v=${v.id}`, title: v.title, thumbnail: v.thumbnails?.[v.thumbnails.length - 1]?.url };
            }
        }
        return null;
    } catch (e) {
        console.error('Error metadata:', e.message);
        return null;
    }
}

function getRows(isPaused = false) {
    const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('pause_resume').setEmoji(isPaused ? '▶️' : '⏸️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('skip').setEmoji('▶️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('reset').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
    );
    if (isPaused) controls.addComponents(new ButtonBuilder().setCustomId('stop').setEmoji('⏹️').setStyle(ButtonStyle.Secondary));
    const volumeMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('volume').setPlaceholder('Volumen').addOptions([
            { label: '20%', value: '0.2' }, { label: '50%', value: '0.5' }, { label: '80%', value: '0.8' }, { label: '100%', value: '1.0' }
        ])
    );
    return [controls, volumeMenu];
}

async function startPlayback(metadata, interaction, isUpdate = false) {
    try {
        console.log(`[startPlayback] Iniciando para: ${metadata.title}`);
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            console.error('[startPlayback] Sin canal de voz.');
            return;
        }
        console.log(`[startPlayback] Canal: ${voiceChannel.name} (${voiceChannel.id})`);

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfMute: false,
            selfDeaf: false,
        });

        const { VoiceConnectionStatus } = require('@discordjs/voice');
        connection.on(VoiceConnectionStatus.Ready, () => console.log('[Voice] Conexión lista.'));
        connection.on(VoiceConnectionStatus.Disconnected, () => console.log('[Voice] Desconectado.'));
        connection.on('error', (e) => console.error('[Voice] Error:', e));
        player.on('error', (e) => console.error('[Player] Error:', e));

        utils.stopStreams();
        const ytDlpPath = path.join(process.cwd(), 'yt-dlp.exe');
        const ytDlpProcess = spawn(`"${ytDlpPath}"`, ['-o', '-', '-f', 'bestaudio', '--no-playlist', metadata.url], { shell: true });
        const ffmpegProcess = spawn(`"${ffmpeg}"`, [
            '-i', 'pipe:0',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        ], { shell: true });
        
        ytDlpProcess.stdout.pipe(ffmpegProcess.stdin);
        utils.activeProcesses.push(ytDlpProcess, ffmpegProcess);

        let dataCount = 0;
        ffmpegProcess.stdout.on('data', () => { if (dataCount++ % 100 === 0) console.log(`[Playback] Recibiendo datos... (${dataCount})`); });
        ffmpegProcess.stderr.on('data', (d) => console.log(`[FFMPEG Stderr] ${d.toString()}`));
        ytDlpProcess.stderr.on('data', (d) => console.log(`[yt-dlp Stderr] ${d.toString()}`));

        currentResource = createAudioResource(ffmpegProcess.stdout, { inputType: StreamType.Raw, inlineVolume: true });
        currentResource.volume.setVolume(0.5);

        player.unpause();
        player.play(currentResource);
        connection.subscribe(player);
        lastMetadata = metadata;

        const embed = new EmbedBuilder()
            .setTitle(metadata.title || 'Reproduciendo')
            .setURL(metadata.url)
            .setImage(metadata.thumbnail || null)
            .setColor('#313338')
            .setFooter({ text: isUpdate ? 'Reiniciado' : 'Disfruta de la música' });

        await interaction.editReply({ embeds: [embed], components: getRows(false) });
    } catch (e) {
        console.error('Error playback:', e);
        await interaction.editReply(`Error: ${e.message}`);
    }
}

player.on(AudioPlayerStatus.Idle, () => {
    if (musicQueue.length > 0) {
        const next = musicQueue.shift();
        startPlayback(next.metadata, next.interaction).catch(console.error);
    }
});

module.exports = {
    player,
    musicQueue,
    getMetadata,
    startPlayback,
    getRows,
    get lastMetadata() { return lastMetadata; },
    get currentResource() { return currentResource; }
};
