import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Stack } from '@mui/material';

interface EditQueryDialogProps {
    open: boolean;
    initialTitle?: string;
    initialPriority?: 'low' | 'normal' | 'high' | 'urgent';
    onClose: () => void;
    onSubmit: (payload: { title: string; priority: 'low' | 'normal' | 'high' | 'urgent' }) => Promise<void> | void;
}

const EditQueryDialog: React.FC<EditQueryDialogProps> = ({ open, onClose, initialTitle = '', initialPriority = 'normal', onSubmit }) => {
    const [title, setTitle] = useState(initialTitle);
    const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>(initialPriority);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setTitle(initialTitle);
            setPriority(initialPriority);
        }
    }, [open, initialTitle, initialPriority]);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await onSubmit({ title: title.trim(), priority });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Edit Query</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
                    <TextField select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as any)} fullWidth>
                        <MenuItem value="low">Low</MenuItem>
                        <MenuItem value="normal">Normal</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="urgent">Urgent</MenuItem>
                    </TextField>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={!title.trim() || submitting}>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditQueryDialog;
