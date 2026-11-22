import { useRef, useState } from 'react';
import { CheckCircle2, Upload, X, Youtube } from 'lucide-react';
import API from '../../api/axiosInstance';

const MAX_CSV_BYTES = 500 * 1024;

const parseCsv = (text, existing) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let rows = lines;
    if (lines.length > 1) {
        const first = lines[0].split(',');
        if (first.length > 1 && first.every((c) => /^["']?[a-zA-Z\s_-]+["']?$/.test(c.trim()))) rows = lines.slice(1);
    }
    const titles = rows
        .map((l) => l.split(',')[0].replace(/^["']|["']$/g, '').trim())
        .filter((t) => t.length > 0 && t.length <= 200 && !existing.has(t.toLowerCase()));
    return [...new Set(titles)];
};

const Preview = ({ titles, heading, onConfirm, onCancel }) => (
    <div className="td-preview">
        <div className="td-preview-head">
            <span><CheckCircle2 size={15} aria-hidden="true" /> {heading}</span>
            <button type="button" className="icon-btn td-icon-sm" aria-label="Cancel import" onClick={onCancel}><X size={16} /></button>
        </div>
        <ul className="td-preview-list">
            {titles.slice(0, 8).map((t) => <li key={t}>{t}</li>)}
            {titles.length > 8 && <li className="td-preview-more">+{titles.length - 8} more</li>}
        </ul>
        <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm}>
            <Upload size={14} aria-hidden="true" /> Add {titles.length} {titles.length === 1 ? 'subtask' : 'subtasks'}
        </button>
    </div>
);

const SubtaskImport = ({ subtasks, onImport }) => {
    const fileRef = useRef(null);
    const [csv, setCsv] = useState({ titles: [], name: '', error: '' });
    const [dragOver, setDragOver] = useState(false);
    const [yt, setYt] = useState({ url: '', titles: [], playlist: '', error: '', loading: false });

    const existing = () => new Set(subtasks.map((s) => s.title.trim().toLowerCase()));

    const readFile = (file) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.csv')) return setCsv({ titles: [], name: '', error: 'Only .csv files are supported.' });
        if (file.size > MAX_CSV_BYTES) return setCsv({ titles: [], name: '', error: 'That file is over 500 KB.' });
        const reader = new FileReader();
        reader.onload = (e) => {
            const titles = parseCsv(String(e.target.result), existing());
            setCsv(titles.length
                ? { titles, name: file.name, error: '' }
                : { titles: [], name: '', error: 'No new subtask titles found. The file may be empty or already imported.' });
        };
        reader.onerror = () => setCsv({ titles: [], name: '', error: "Couldn't read that file." });
        reader.readAsText(file);
    };

    const resetCsv = () => {
        setCsv({ titles: [], name: '', error: '' });
        if (fileRef.current) fileRef.current.value = '';
    };

    const fetchPlaylist = async (raw) => {
        const playlistUrl = (raw ?? yt.url).trim();
        if (!playlistUrl) return;
        setYt((s) => ({ ...s, url: playlistUrl, titles: [], playlist: '', error: '', loading: true }));
        try {
            const { data } = await API.post('/youtube/playlist-preview', { playlistUrl });
            const known = existing();
            const titles = (data.titles || []).filter((t) => !known.has(t.trim().toLowerCase()));
            setYt((s) => ({
                ...s,
                loading: false,
                titles,
                playlist: data.playlistTitle || '',
                error: titles.length ? '' : 'Every video in that playlist is already a subtask.',
            }));
        } catch (err) {
            setYt((s) => ({ ...s, loading: false, error: err.response?.data?.message || "Couldn't fetch that playlist." }));
        }
    };

    return (
        <div className="td-import">
            <h3 className="td-import-title">Import subtasks</h3>
            {csv.titles.length ? (
                <Preview
                    titles={csv.titles}
                    heading={`${csv.titles.length} from ${csv.name}`}
                    onCancel={resetCsv}
                    onConfirm={() => {
                        onImport(csv.titles);
                        resetCsv();
                    }}
                />
            ) : (
                <button
                    type="button"
                    className={`td-drop ${dragOver ? 'is-over' : ''}`}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files?.[0]); }}
                >
                    <Upload size={16} aria-hidden="true" />
                    <span>From a CSV file — click or drop it here. The first column becomes the title.</span>
                </button>
            )}
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => readFile(e.target.files?.[0])} />
            {csv.error && <p className="td-import-error" role="alert">{csv.error}</p>}

            {yt.titles.length ? (
                <Preview
                    titles={yt.titles}
                    heading={`${yt.titles.length} from ${yt.playlist ? `“${yt.playlist}”` : 'the playlist'}`}
                    onCancel={() => setYt({ url: '', titles: [], playlist: '', error: '', loading: false })}
                    onConfirm={() => {
                        onImport(yt.titles);
                        setYt({ url: '', titles: [], playlist: '', error: '', loading: false });
                    }}
                />
            ) : (
                <form
                    className="td-yt"
                    onSubmit={(e) => { e.preventDefault(); fetchPlaylist(); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        const dropped = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
                        if (dropped) fetchPlaylist(dropped);
                    }}
                >
                    <Youtube size={18} className="td-yt-icon" aria-hidden="true" />
                    <input
                        className="input"
                        aria-label="YouTube playlist link"
                        placeholder="Paste a YouTube playlist link"
                        value={yt.url}
                        disabled={yt.loading}
                        onChange={(e) => setYt((s) => ({ ...s, url: e.target.value, error: '' }))}
                    />
                    <button type="submit" className="btn" disabled={yt.loading || !yt.url.trim()}>
                        {yt.loading ? 'Fetching…' : 'Fetch'}
                    </button>
                </form>
            )}
            {yt.error && <p className="td-import-error" role="alert">{yt.error}</p>}
        </div>
    );
};

export default SubtaskImport;
