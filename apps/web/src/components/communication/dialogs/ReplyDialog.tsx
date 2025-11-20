import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack } from '@mui/material';

interface ReplyDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (message: string) => Promise<void> | void;
}

const ReplyDialog: React.FC<ReplyDialogProps> = ({ open, onClose, onSubmit }) => {
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) setMessage('');
    }, [open]);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await onSubmit(message.trim());
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Reply to Query</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        fullWidth
                        multiline
                        minRows={3}
                        autoFocus
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={!message.trim() || submitting}>
                    Send
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ReplyDialog;
