import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';

interface ConfirmDialogProps {
    open: boolean;
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title = 'Confirm',
    description = 'Are you sure?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onClose,
    onConfirm,
}) => {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText>{description}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{cancelText}</Button>
                <Button color="error" variant="contained" onClick={onConfirm}>{confirmText}</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;
