import { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { Droppable } from '@hello-pangea/dnd';
import { ArrowRightLeft, Plus, Trash2, Upload, X } from 'lucide-react';
import Menu from '../../ui/Menu';
import KanbanCard from '../KanbanCard/KanbanCard';
import { addTaskToColumn, addTasksFromCSV, deleteAllFromColumn } from '../../../store/slices/projectSlice';
import { COLUMN_LABELS, columnDot } from '../../../utils/Board';
import './KanbanColumn.css';

const parseCSVTitles = (text) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let rows = lines;
    if (lines.length > 1) {
        const cells = lines[0].split(',');
        if (cells.length > 1 && cells.every((c) => /^["']?[a-zA-Z\s_-]+["']?$/.test(c.trim()))) rows = lines.slice(1);
    }
    const titles = rows
        .map((line) => line.split(',')[0].replace(/^["']|["']$/g, '').trim())
        .filter((t) => t.length > 0 && t.length <= 200);
    return [...new Set(titles)];
};

const KanbanColumn = ({
    projectId, columnKey, cards, totalCount, selectedTasks, onToggleSelect, onMoveCard, onBulkMove, onBulkDelete,
}) => {
    const dispatch = useDispatch();
    const fileRef = useRef(null);
    const [csv, setCsv] = useState(null);
    const [importing, setImporting] = useState(false);
    const name = COLUMN_LABELS[columnKey];
    const selectedHere = cards.filter((c) => selectedTasks.has(c._id)).length;
    const selecting = selectedTasks.size > 0;

    const addCard = () => {
        dispatch(addTaskToColumn({ projectId, columnId: columnKey }))
            .unwrap()
            .catch(() => toast.error('Could not add a card'));
    };

    const readFile = (file) => {
        if (fileRef.current) fileRef.current.value = '';
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.csv')) return toast.error('Only .csv files are supported');
        if (file.size > 500 * 1024) return toast.error('That file is over 500 KB');
        const reader = new FileReader();
        reader.onload = (e) => {
            const titles = parseCSVTitles(e.target.result);
            if (!titles.length) toast.error('No card titles found in that file');
            else setCsv({ name: file.name, titles });
        };
        reader.onerror = () => toast.error('Could not read that file');
        reader.readAsText(file);
        return undefined;
    };

    const importCsv = async () => {
        setImporting(true);
        try {
            await dispatch(addTasksFromCSV({ projectId, columnId: columnKey, titles: csv.titles })).unwrap();
            toast.success(`Added ${csv.titles.length} ${csv.titles.length === 1 ? 'card' : 'cards'} to ${name}`);
            setCsv(null);
        } catch {
            toast.error('Import failed');
        } finally {
            setImporting(false);
        }
    };

    const deleteAll = () => {
        if (!window.confirm(`Delete all ${cards.length} cards in ${name}? This can't be undone.`)) return;
        dispatch(deleteAllFromColumn({ columnId: columnKey, taskIds: cards.map((c) => c._id) }))
            .unwrap()
            .catch(() => toast.error('Could not delete those cards'));
    };

    return (
        <section className="kanban-column" aria-label={name}>
            <div className="kanban-column-head">
                <span className="kanban-column-dot" style={{ background: columnDot(columnKey) }} aria-hidden="true" />
                <h2 className="kanban-column-name">{name}</h2>
                <span className="kanban-column-count tabular">
                    {cards.length !== totalCount ? `${cards.length}/${totalCount}` : totalCount}
                </span>
                <button type="button" className="kanban-column-btn" aria-label={`Add card to ${name}`} onClick={addCard}>
                    <Plus size={16} strokeWidth={2.2} />
                </button>
                <Menu
                    label={`${name} column options`}
                    items={[
                        selecting && { label: `Move ${selectedTasks.size} selected…`, icon: <ArrowRightLeft size={16} />, onSelect: onBulkMove },
                        selecting && { label: `Delete ${selectedTasks.size} selected`, icon: <Trash2 size={16} />, danger: true, onSelect: onBulkDelete },
                        { label: 'Import from CSV', icon: <Upload size={16} />, onSelect: () => fileRef.current?.click() },
                        { label: 'Delete all cards', icon: <Trash2 size={16} />, danger: true, disabled: !cards.length, onSelect: deleteAll },
                    ]}
                />
                <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => readFile(e.target.files?.[0])} />
            </div>

            {csv && (
                <div className="kanban-csv" role="status">
                    <span className="kanban-csv-text">
                        {importing ? 'Importing…' : <>{csv.titles.length} cards from <em>{csv.name}</em></>}
                    </span>
                    <button type="button" className="btn btn-primary btn-sm" disabled={importing} onClick={importCsv}>Add</button>
                    <button type="button" className="kanban-column-btn" aria-label="Cancel import" disabled={importing} onClick={() => setCsv(null)}>
                        <X size={14} />
                    </button>
                </div>
            )}

            {selectedHere > 0 && <span className="sr-only">{selectedHere} selected in {name}</span>}

            <Droppable droppableId={columnKey}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`kanban-column-cards ${snapshot.isDraggingOver ? 'is-over' : ''}`}
                    >
                        {cards.map((card, i) => (
                            <KanbanCard
                                key={card._id}
                                task={card}
                                index={i}
                                columnKey={columnKey}
                                isSelected={selectedTasks.has(card._id)}
                                selecting={selecting}
                                onToggleSelect={onToggleSelect}
                                onMove={onMoveCard}
                            />
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>

            <button type="button" className="kanban-add-card" onClick={addCard}>
                <Plus size={14} strokeWidth={2.4} aria-hidden="true" /> Add card
            </button>
        </section>
    );
};

export default KanbanColumn;
