const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const extractPlaylistId = (playlistUrl) => {
    try {
        const url = new URL(playlistUrl);
        return url.searchParams.get('list');
    } catch {
        return null;
    }
};

// @desc    Preview a YouTube playlist as an ordered list of subtask titles
// @route   POST /api/youtube/playlist-preview
exports.previewPlaylist = async (req, res) => {
    try {
        const { playlistUrl } = req.body;

        if (!playlistUrl || typeof playlistUrl !== 'string') {
            return res.status(400).json({ success: false, message: 'playlistUrl is required' });
        }

        if (!process.env.YOUTUBE_API_KEY) {
            return res.status(500).json({ success: false, message: 'YouTube API is not configured on the server' });
        }

        const playlistId = extractPlaylistId(playlistUrl.trim());
        if (!playlistId) {
            return res.status(400).json({ success: false, message: 'Could not find a playlist ID in that link' });
        }

        // 1. Fetch the playlist's own metadata (title, existence check)
        const plRes = await fetch(
            `${YOUTUBE_API_BASE}/playlists?part=snippet&id=${encodeURIComponent(playlistId)}&key=${process.env.YOUTUBE_API_KEY}`
        );
        const plData = await plRes.json();

        if (!plRes.ok) {
            return res.status(plRes.status === 403 ? 502 : 400).json({
                success: false,
                message: plData.error?.message || 'Failed to reach the YouTube API'
            });
        }
        if (!plData.items || plData.items.length === 0) {
            return res.status(404).json({ success: false, message: 'Playlist not found (it may be private or deleted)' });
        }
        const playlistTitle = plData.items[0].snippet.title;

        // 2. Fetch every video in the playlist, paginating through nextPageToken
        const videoTitles = [];
        let pageToken = '';

        do {
            const itemsRes = await fetch(
                `${YOUTUBE_API_BASE}/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}` +
                `&key=${process.env.YOUTUBE_API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`
            );
            const itemsData = await itemsRes.json();

            if (!itemsRes.ok) {
                return res.status(itemsRes.status === 403 ? 502 : 400).json({
                    success: false,
                    message: itemsData.error?.message || 'Failed to reach the YouTube API'
                });
            }

            for (const item of itemsData.items || []) {
                const title = item.snippet?.title;
                // Skip videos that have been removed/privated since being added to the playlist
                if (title && title !== 'Deleted video' && title !== 'Private video') {
                    videoTitles.push(title);
                }
            }

            pageToken = itemsData.nextPageToken || '';
        } while (pageToken);

        if (videoTitles.length === 0) {
            return res.status(404).json({ success: false, message: 'That playlist has no available videos' });
        }

        const pad = String(videoTitles.length).length;
        const titles = videoTitles.map((title, index) =>
            `${String(index + 1).padStart(pad, '0')}. ${title}`
        );

        res.json({
            success: true,
            playlistTitle,
            count: titles.length,
            titles
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Failed to fetch playlist' });
    }
};
