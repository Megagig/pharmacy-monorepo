import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Chip,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Checkbox,
    Alert,
    CircularProgress,
    Tooltip,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiHelpers } from '../../utils/apiHelpers';
import { format } from 'date-fns';

interface VitalsEntry {
    vitalsId: string;
    patientId: string;
    patientName: string;
    mrn: string;
    recordedDate: string;
    bloodPressure?: { systolic: number; diastolic: number };
    heartRate?: number;
    temperature?: number;
    weight?: number;
    glucose?: number;
    oxygenSaturation?: number;
    notes?: string;
}

const VitalsVerificationDashboard: React.FC = () => {
    const [pendingVitals, setPendingVitals] = useState<VitalsEntry[]>([]);
    const [selectedVitals, setSelectedVitals] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<VitalsEntry | null>(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchPendingVitals = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await apiHelpers.get('/pharmacist/vitals/pending-verification?page=' + page + '&limit=20');

            setPendingVitals(response.data.vitals);
            setTotal(response.data.pagination.total);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load pending vitals');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingVitals();
    }, [page]);

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            const allIds = new Set(pendingVitals.map((v) => `${v.patientId}-${v.vitalsId}`));
            setSelectedVitals(allIds);
        } else {
            setSelectedVitals(new Set());
        }
    };

    const handleSelectOne = (patientId: string, vitalsId: string) => {
        const key = `${patientId}-${vitalsId}`;
        const newSelected = new Set(selectedVitals);

        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }

        setSelectedVitals(newSelected);
    };

    const handleVerifySingle = async (patientId: string, vitalsId: string) => {
        setError(null);
        setSuccess(null);

        try {
            await apiHelpers.put(`/pharmacist/vitals/${patientId}/${vitalsId}/verify`);
            setSuccess('Vitals verified successfully');
            fetchPendingVitals();
            setSelectedVitals(new Set());
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to verify vitals');
        }
    };

    const handleBulkVerify = async () => {
        if (selectedVitals.size === 0) {
            setError('Please select at least one entry to verify');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const vitalsEntries = Array.from(selectedVitals).map((key) => {
                const [patientId, vitalsId] = key.split('-');
                return { patientId, vitalsId };
            });

            const response = await apiHelpers.post('/pharmacist/vitals/bulk-verify', {
                vitalsEntries,
            });

            setSuccess(
                `Successfully verified ${response.data.verified.length} out of ${vitalsEntries.length} entries`
            );
            fetchPendingVitals();
            setSelectedVitals(new Set());
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to bulk verify vitals');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (entry: VitalsEntry) => {
        setSelectedEntry(entry);
        setDetailsOpen(true);
    };

    const formatVitalsValue = (value: number | undefined, unit: string) => {
        return value !== undefined ? `${value} ${unit}` : 'N/A';
    };

    const getVitalStatus = (vitalName: string, value: number | undefined): 'default' | 'warning' | 'error' => {
        if (value === undefined) return 'default';

        switch (vitalName) {
            case 'heartRate':
                return value < 60 || value > 100 ? 'warning' : 'default';
            case 'temperature':
                return value < 36.5 || value > 37.5 ? 'warning' : 'default';
            case 'oxygenSaturation':
                return value < 95 ? 'error' : 'default';
            default:
                return 'default';
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" fontWeight="bold">
                    Vitals Verification Dashboard
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Tooltip title="Refresh">
                        <IconButton onClick={fetchPendingVitals} disabled={loading}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        onClick={handleBulkVerify}
                        disabled={selectedVitals.size === 0 || loading}
                        startIcon={loading ? <CircularProgress size={16} /> : <CheckCircleIcon />}
                    >
                        Verify Selected ({selectedVitals.size})
                    </Button>
                </Box>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                    {success}
                </Alert>
            )}

            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            Pending Verification ({total} total)
                        </Typography>
                        {pendingVitals.length > 0 && (
                            <Chip
                                label={`${pendingVitals.length} on this page`}
                                color="warning"
                                size="small"
                            />
                        )}
                    </Box>

                    {loading && pendingVitals.length === 0 ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : pendingVitals.length === 0 ? (
                        <Alert severity="info">No pending vitals to verify! 🎉</Alert>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selectedVitals.size === pendingVitals.length}
                                                indeterminate={
                                                    selectedVitals.size > 0 && selectedVitals.size < pendingVitals.length
                                                }
                                                onChange={handleSelectAll}
                                            />
                                        </TableCell>
                                        <TableCell>Patient</TableCell>
                                        <TableCell>MRN</TableCell>
                                        <TableCell>Recorded Date</TableCell>
                                        <TableCell>BP</TableCell>
                                        <TableCell>HR</TableCell>
                                        <TableCell>Temp</TableCell>
                                        <TableCell>SpO2</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {pendingVitals.map((entry) => {
                                        const key = `${entry.patientId}-${entry.vitalsId}`;
                                        const isSelected = selectedVitals.has(key);

                                        return (
                                            <TableRow key={key} hover selected={isSelected}>
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onChange={() => handleSelectOne(entry.patientId, entry.vitalsId)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {entry.patientName}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {entry.mrn}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">
                                                        {format(new Date(entry.recordedDate), 'MMM dd, yyyy HH:mm')}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    {entry.bloodPressure ? (
                                                        <Chip
                                                            label={`${entry.bloodPressure.systolic}/${entry.bloodPressure.diastolic}`}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            -
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {entry.heartRate ? (
                                                        <Chip
                                                            label={`${entry.heartRate} bpm`}
                                                            size="small"
                                                            color={getVitalStatus('heartRate', entry.heartRate)}
                                                            variant="outlined"
                                                        />
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            -
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {entry.temperature ? (
                                                        <Chip
                                                            label={`${entry.temperature}°C`}
                                                            size="small"
                                                            color={getVitalStatus('temperature', entry.temperature)}
                                                            variant="outlined"
                                                        />
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            -
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {entry.oxygenSaturation ? (
                                                        <Chip
                                                            label={`${entry.oxygenSaturation}%`}
                                                            size="small"
                                                            color={getVitalStatus('oxygenSaturation', entry.oxygenSaturation)}
                                                            variant="outlined"
                                                        />
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">
                                                            -
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                        <Tooltip title="View Details">
                                                            <IconButton size="small" onClick={() => handleViewDetails(entry)}>
                                                                <VisibilityIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Verify">
                                                            <IconButton
                                                                size="small"
                                                                color="success"
                                                                onClick={() => handleVerifySingle(entry.patientId, entry.vitalsId)}
                                                            >
                                                                <CheckCircleIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            {/* Details Dialog */}
            <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Vitals Details</DialogTitle>
                <DialogContent>
                    {selectedEntry && (
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                Patient Information
                            </Typography>
                            <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="body2">
                                    <strong>Name:</strong> {selectedEntry.patientName}
                                </Typography>
                                <Typography variant="body2">
                                    <strong>MRN:</strong> {selectedEntry.mrn}
                                </Typography>
                                <Typography variant="body2">
                                    <strong>Recorded:</strong>{' '}
                                    {format(new Date(selectedEntry.recordedDate), 'PPpp')}
                                </Typography>
                            </Box>

                            <Typography variant="subtitle2" gutterBottom>
                                Vital Signs
                            </Typography>
                            <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="body2">
                                    <strong>Blood Pressure:</strong>{' '}
                                    {selectedEntry.bloodPressure
                                        ? `${selectedEntry.bloodPressure.systolic}/${selectedEntry.bloodPressure.diastolic} mmHg`
                                        : 'Not recorded'}
                                </Typography>
                                <Typography variant="body2">
                                    <strong>Heart Rate:</strong> {formatVitalsValue(selectedEntry.heartRate, 'bpm')}
                                </Typography>
                                <Typography variant="body2">
                                    <strong>Temperature:</strong> {formatVitalsValue(selectedEntry.temperature, '°C')}
                                </Typography>
                                <Typography variant="body2">
                                    <strong>Weight:</strong> {formatVitalsValue(selectedEntry.weight, 'kg')}
                                </Typography>
                                <Typography variant="body2">
                                    <strong>Glucose:</strong> {formatVitalsValue(selectedEntry.glucose, 'mg/dL')}
                                </Typography>
                                <Typography variant="body2">
                                    <strong>Oxygen Saturation:</strong>{' '}
                                    {formatVitalsValue(selectedEntry.oxygenSaturation, '%')}
                                </Typography>
                            </Box>

                            {selectedEntry.notes && (
                                <>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Patient Notes
                                    </Typography>
                                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                        <Typography variant="body2">{selectedEntry.notes}</Typography>
                                    </Box>
                                </>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsOpen(false)}>Close</Button>
                    {selectedEntry && (
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => {
                                handleVerifySingle(selectedEntry.patientId, selectedEntry.vitalsId);
                                setDetailsOpen(false);
                            }}
                        >
                            Verify
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default VitalsVerificationDashboard;
