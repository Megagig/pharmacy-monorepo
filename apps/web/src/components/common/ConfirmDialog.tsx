import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    Button,
    CircularProgress,
} from '@mui/material';

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'primary' | 'error' | 'warning' | 'success' | 'info' | 'secondary';
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmColor = 'primary',
    onConfirm,
    onCancel,
    loading = false,
    maxWidth = 'sm',
}) => {
    // Handle keyboard shortcuts
    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !loading) {
            onConfirm();
        } else if (event.key === 'Escape' && !loading) {
            onCancel();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onCancel}
            maxWidth={maxWidth}
            fullWidth
            onKeyDown={handleKeyDown}
        >
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} disabled={loading}>
                    {cancelText}
                </Button>
                <Button
                    onClick={onConfirm}
                    color={confirmColor}
                    variant="contained"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : null}
                >
                    {confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;
