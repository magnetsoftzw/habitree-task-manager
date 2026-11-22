import Modal from './Modal';

const ConfirmModal = ({ isOpen, title, message, confirmLabel = 'Delete', onConfirm, onClose }) => (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        width={420}
        footer={(
            <>
                <button type="button" className="btn" onClick={onClose}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
            </>
        )}
    >
        {message && <p className="muted" style={{ margin: 0 }}>{message}</p>}
    </Modal>
);

export default ConfirmModal;
