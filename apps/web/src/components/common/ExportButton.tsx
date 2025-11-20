import React, { useState } from 'react';
import {
    Button,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
    Divider,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import DescriptionIcon from '@mui/icons-material/Description';

export interface ExportButtonProps {
    formats: Array<'csv' | 'excel' | 'pdf'>;
    onExport: (format: 'csv' | 'excel' | 'pdf') => Promise<Blob>;
    filename?: string;
    disabled?: boolean;
    variant?: 'text' | 'outlined' | 'contained';
    size?: 'small' | 'medium' | 'large';
}

const ExportButton: React.FC<ExportButtonProps> = ({
    formats,
    onExport,
    filename = 'export',
    disabled = false,
    variant = 'outlined',
    size = 'medium',
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [loading, setLoading] = useState(false);
    const [exportingFormat, setExportingFormat] = useState<string | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
        setLoading(true);
        setExportingFormat(format);
        handleClose();

        try {
            const blob = await onExport(format);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Set filename with appropriate extension
            const extension = format === 'excel' ? 'xlsx' : format;
            link.download = `${filename}.${extension}`;

            // Trigger download
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            // You might want to show an error notification here
        } finally {
            setLoading(false);
            setExportingFormat(null);
        }
    };

    const getFormatIcon = (format: string) => {
        switch (format) {
            case 'pdf':
                return <PictureAsPdfIcon />;
            case 'excel':
                return <TableChartIcon />;
            case 'csv':
                return <DescriptionIcon />;
            default:
                return <DownloadIcon />;
        }
    };

    const getFormatLabel = (format: string) => {
        switch (format) {
            case 'pdf':
                return 'Export as PDF';
            case 'excel':
                return 'Export as Excel';
            case 'csv':
                return 'Export as CSV';
            default:
                return format.toUpperCase();
        }
    };

    return (
        <>
            <Button
                variant={variant}
                size={size}
                startIcon={loading ? <CircularProgress size={16} /> : <DownloadIcon />}
                onClick={handleClick}
                disabled={disabled || loading}
            >
                {loading ? `Exporting ${exportingFormat?.toUpperCase()}...` : 'Export'}
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                {formats.map((format, index) => (
                    <div key={format}>
                        <MenuItem onClick={() => handleExport(format)}>
                            <ListItemIcon>{getFormatIcon(format)}</ListItemIcon>
                            <ListItemText>{getFormatLabel(format)}</ListItemText>
                        </MenuItem>
                        {index < formats.length - 1 && <Divider />}
                    </div>
                ))}
            </Menu>
        </>
    );
};

export default ExportButton;
