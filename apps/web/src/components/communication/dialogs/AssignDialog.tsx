import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Stack } from '@mui/material';

interface AssignDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: { userId: string; role: string }) => Promise<void> | void;
}

const AssignDialog: React.FC<AssignDialogProps> = ({ open, onClose, onSubmit }) => {
    const [userId, setUserId] = useState('');
    const [role, setRole] = useState('pharmacist');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            setUserId('');
            setRole('pharmacist');
        }
    }, [open]);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await onSubmit({ userId, role });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Assign Query</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="User ID"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        fullWidth
                    />
                    <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value)} fullWidth>
                        <MenuItem value="pharmacist">Pharmacist</MenuItem>
                        <MenuItem value="physician">Physician</MenuItem>
                        <MenuItem value="nurse">Nurse</MenuItem>
                        <MenuItem value="forwarded">Forwarded</MenuItem>
                    </TextField>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit} disabled={!userId.trim() || submitting}>
                    Assign
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AssignDialog;
