import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Chip,
    IconButton,
    Tooltip,
    Paper,
    Skeleton,
    Alert,
    TextField,
    InputAdornment,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Helmet } from 'react-helmet-async';
import { useApprovedCases } from '../hooks/useLabIntegration';
import type { LabIntegration } from '../services/labIntegrationService';

const ApprovedLabIntegrations: React.FC = () => {
    const navigate = useNavigate();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchQuery, setSearchQuery] = useState('');

    const { data: approvedCases, isLoading } = useApprovedCases();

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleViewCase = (caseId: string) => {
        navigate(`/pharmacy/lab-integration/${caseId}`);
    };

    const getPatientName = (patientId: LabIntegration['patientId']) => {
        if (typeof patientId === 'string') {
            return patientId.substring(0, 8) + '...';
        }
        const fullName = `${patientId.firstName} ${patientId.lastName}`;
        return patientId.otherNames ? `${patientId.firstName} ${patientId.otherNames} ${patientId.lastName}` : fullName;
    };

    const getReviewerName = (reviewedBy: any) => {
        if (!reviewedBy) return 'N/A';
        if (typeof reviewedBy === 'string') {
            return reviewedBy.substring(0, 8) + '...';
        }
        return `${reviewedBy.firstName} ${reviewedBy.lastName}`;
    };

    const getStatusColor = (status: LabIntegration['status']) => {
        const colors: Record<LabIntegration['status'], string> = {
            draft: 'default',
            pending_interpretation: 'info',
            pending_review: 'warning',
            pending_approval: 'warning',
            approved: 'success',
            implemented: 'success',
            completed: 'success',
            cancelled: 'error',
        };
        return colors[status] || 'default';
    };

    // Filter cases based on search query
    const filteredCases = approvedCases?.filter((case_) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            case_._id.toLowerCase().includes(query) ||
            case_.patientId.toString().toLowerCase().includes(query) ||
            case_.status.toLowerCase().includes(query)
        );
    });

    const paginatedCases = filteredCases?.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    return (
        <>
            <Helmet>
                <title>Approved Lab Integrations | PharmaCare</title>
            </Helmet>

            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                {/* Header */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon fontSize="large" color="success" />
                        Approved Lab Integrations
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        View all approved and implemented lab integration cases
                    </Typography>
                </Box>

                {/* Search */}
                <Box sx={{ mb: 3 }}>
                    <TextField
                        fullWidth
                        placeholder="Search by Case ID, Patient ID, or Status..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>

                {/* Table */}
                <Card>
                    <CardContent sx={{ p: 0 }}>
                        <TableContainer component={Paper} elevation={0}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Case ID</TableCell>
                                        <TableCell>Patient Name</TableCell>
                                        <TableCell>Lab Tests</TableCell>
                                        <TableCell>Approved Date</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Approved By</TableCell>
                                        <TableCell align="center">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: rowsPerPage }).map((_, index) => (
                                            <TableRow key={index}>
                                                <TableCell><Skeleton /></TableCell>
                                                <TableCell><Skeleton /></TableCell>
                                                <TableCell><Skeleton /></TableCell>
                                                <TableCell><Skeleton /></TableCell>
                                                <TableCell><Skeleton /></TableCell>
                                                <TableCell><Skeleton /></TableCell>
                                                <TableCell><Skeleton /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : paginatedCases && paginatedCases.length > 0 ? (
                                        paginatedCases.map((case_) => (
                                            <TableRow
                                                key={case_._id}
                                                hover
                                                sx={{ cursor: 'pointer' }}
                                                onClick={() => handleViewCase(case_._id)}
                                            >
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {case_._id.substring(0, 8)}...
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight="medium">
                                                        {getPatientName(case_.patientId)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={`${case_.labResultIds?.length || 0} tests`}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {case_.pharmacistReview?.reviewedAt
                                                        ? format(new Date(case_.pharmacistReview.reviewedAt), 'MMM dd, yyyy HH:mm')
                                                        : 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={case_.status.replace(/_/g, ' ')}
                                                        color={getStatusColor(case_.status) as any}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {getReviewerName(case_.pharmacistReview?.reviewedBy)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="View Details">
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewCase(case_._id);
                                                            }}
                                                        >
                                                            <VisibilityIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7}>
                                                <Alert severity="info" sx={{ my: 2 }}>
                                                    {searchQuery
                                                        ? 'No approved cases found matching your search.'
                                                        : 'No approved cases yet.'}
                                                </Alert>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {filteredCases && filteredCases.length > 0 && (
                            <TablePagination
                                rowsPerPageOptions={[5, 10, 25, 50]}
                                component="div"
                                count={filteredCases.length}
                                rowsPerPage={rowsPerPage}
                                page={page}
                                onPageChange={handleChangePage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                            />
                        )}
                    </CardContent>
                </Card>
            </Container>
        </>
    );
};

export default ApprovedLabIntegrations;
