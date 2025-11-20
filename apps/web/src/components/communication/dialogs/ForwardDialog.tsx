import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack } from '@mui/material';

interface ForwardDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: { userId: string; note?: string }) => Promise<void> | void;
}

const ForwardDialog: React.FC<ForwardDialogProps> = ({ open, onClose, onSubmit }) => {
    const [userId, setUserId] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            setUserId('');
            setNote('');
        }
    }, [open]);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await onSubmit({ userId, note: note.trim() || undefined });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Forward Query</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField label="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} fullWidth />
                    <TextField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} fullWidth multiline minRows={2} />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={!userId.trim() || submitting}>
                    Forward
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ForwardDialog;
