import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Skeleton,
    Grid,
    Stack,
} from '@mui/material';

/**
 * Skeleton loader for Lab Result Cards
 */
export const LabResultSkeleton: React.FC = () => {
    return (
        <Card variant="outlined">
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="40%" height={28} />
                        <Skeleton variant="text" width="60%" height={20} />
                    </Box>
                    <Stack direction="row" spacing={1}>
                        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 2 }} />
                        <Skeleton variant="rectangular" width={100} height={24} sx={{ borderRadius: 2 }} />
                    </Stack>
                </Box>

                <Grid container spacing={2}>
                    {[1, 2, 3, 4].map((item) => (
                        <Grid item xs={12} sm={6} key={item}>
                            <Card variant="outlined">
                                <CardContent sx={{ py: 1.5 }}>
                                    <Skeleton variant="text" width="70%" height={20} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                        <Skeleton variant="text" width="30%" height={18} />
                                        <Skeleton variant="text" width="40%" height={18} />
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Skeleton variant="text" width="35%" height={18} />
                                        <Skeleton variant="text" width="45%" height={18} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                <Box sx={{ mt: 2, p: 2, borderRadius: 1 }}>
                    <Skeleton variant="text" width="50%" height={24} />
                    <Skeleton variant="text" width="100%" height={20} />
                    <Skeleton variant="text" width="90%" height={20} />
                </Box>
            </CardContent>
        </Card>
    );
};

/**
 * Skeleton loader for Vitals History Cards
 */
export const VitalsHistorySkeleton: React.FC = () => {
    return (
        <Card variant="outlined">
            <CardContent sx={{ py: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Skeleton variant="text" width="30%" height={20} />
                    <Stack direction="row" spacing={1}>
                        <Skeleton variant="rectangular" width={90} height={24} sx={{ borderRadius: 2 }} />
                        <Skeleton variant="rectangular" width={120} height={24} sx={{ borderRadius: 2 }} />
                    </Stack>
                </Box>

                <Grid container spacing={2}>
                    {[1, 2, 3, 4].map((item) => (
                        <Grid item xs={6} sm={3} key={item}>
                            <Skeleton variant="text" width="80%" height={18} />
                            <Skeleton variant="text" width="90%" height={22} />
                        </Grid>
                    ))}
                </Grid>

                <Skeleton variant="text" width="70%" height={18} sx={{ mt: 1 }} />
            </CardContent>
        </Card>
    );
};

/**
 * Skeleton loader for Visit History Cards
 */
export const VisitHistorySkeleton: React.FC = () => {
    return (
        <Card variant="outlined">
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box>
                        <Skeleton variant="text" width={200} height={28} />
                        <Skeleton variant="text" width={250} height={20} />
                    </Box>
                    <Stack direction="row" spacing={1}>
                        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 2 }} />
                        <Skeleton variant="rectangular" width={120} height={24} sx={{ borderRadius: 2 }} />
                    </Stack>
                </Box>

                <Box sx={{ mb: 3, p: 2, borderRadius: 2 }}>
                    <Skeleton variant="rectangular" width={150} height={24} sx={{ borderRadius: 2, mb: 1 }} />
                    <Skeleton variant="text" width="100%" height={20} />
                    <Skeleton variant="text" width="95%" height={20} />
                    <Skeleton variant="text" width="90%" height={20} />

                    <Box sx={{ mt: 2 }}>
                        <Skeleton variant="text" width="30%" height={20} />
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Skeleton variant="rectangular" width={120} height={28} sx={{ borderRadius: 3 }} />
                            <Skeleton variant="rectangular" width={100} height={28} sx={{ borderRadius: 3 }} />
                            <Skeleton variant="rectangular" width={130} height={28} sx={{ borderRadius: 3 }} />
                        </Stack>
                    </Box>

                    <Box sx={{ mt: 2 }}>
                        <Skeleton variant="text" width="25%" height={20} />
                        <Box sx={{ pl: 2 }}>
                            <Skeleton variant="text" width="90%" height={18} />
                            <Skeleton variant="text" width="85%" height={18} />
                        </Box>
                    </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Skeleton variant="text" width="35%" height={20} />
                    <Skeleton variant="text" width="80%" height={18} />
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Skeleton variant="text" width="30%" height={20} />
                    <Skeleton variant="text" width="85%" height={18} />
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 2 }}>
                    <Skeleton variant="text" width="40%" height={18} />
                    <Skeleton variant="circular" width={32} height={32} />
                </Box>
            </CardContent>
        </Card>
    );
};

/**
 * Skeleton loader for Vitals Chart
 */
export const VitalsChartSkeleton: React.FC = () => {
    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Skeleton variant="text" width="40%" height={28} />
                <Stack direction="row" spacing={1}>
                    <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 1 }} />
                    <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 1 }} />
                </Stack>
            </Box>
            <Skeleton variant="rectangular" width="100%" height={300} sx={{ borderRadius: 2 }} />
        </Box>
    );
};

/**
 * Skeleton loader for Summary Cards (Super Admin Dashboard)
 */
export const SummaryCardSkeleton: React.FC = () => {
    return (
        <Card>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="60%" height={20} />
                        <Skeleton variant="text" width="40%" height={36} sx={{ mt: 1 }} />
                        <Skeleton variant="text" width="70%" height={18} sx={{ mt: 0.5 }} />
                    </Box>
                    <Skeleton variant="circular" width={48} height={48} />
                </Box>
            </CardContent>
        </Card>
    );
};

/**
 * Skeleton loader for Charts (Super Admin Dashboard)
 */
export const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 300 }) => {
    return (
        <Card>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Skeleton variant="text" width="40%" height={28} />
                    <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
                </Box>
                <Skeleton variant="rectangular" width="100%" height={height} sx={{ borderRadius: 2 }} />
            </CardContent>
        </Card>
    );
};

/**
 * Skeleton loader for Appointment Health Records Panel
 */
export const AppointmentHealthRecordsSkeleton: React.FC = () => {
    return (
        <Card>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Skeleton variant="text" width="30%" height={28} />
                    <Stack direction="row" spacing={1}>
                        <Skeleton variant="rectangular" width={100} height={24} sx={{ borderRadius: 2 }} />
                        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 2 }} />
                        <Skeleton variant="rectangular" width={90} height={24} sx={{ borderRadius: 2 }} />
                    </Stack>
                </Box>

                <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
                    <Stack direction="row" spacing={2}>
                        <Skeleton variant="rectangular" width={120} height={40} />
                        <Skeleton variant="rectangular" width={100} height={40} />
                        <Skeleton variant="rectangular" width={110} height={40} />
                    </Stack>
                </Box>

                <Box sx={{ py: 3 }}>
                    <Skeleton variant="text" width="100%" height={80} />
                    <Skeleton variant="text" width="95%" height={80} sx={{ mt: 2 }} />
                    <Skeleton variant="text" width="90%" height={80} sx={{ mt: 2 }} />
                </Box>
            </CardContent>
        </Card>
    );
};

/**
 * Skeleton loader for Timeline
 */
export const TimelineSkeleton: React.FC = () => {
    return (
        <Card>
            <CardContent>
                <Skeleton variant="text" width="40%" height={28} sx={{ mb: 3 }} />

                {[1, 2, 3, 4].map((item) => (
                    <Box key={item} sx={{ display: 'flex', mb: 3 }}>
                        <Box sx={{ mr: 2 }}>
                            <Skeleton variant="circular" width={40} height={40} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Skeleton variant="text" width="20%" height={18} sx={{ mb: 1 }} />
                            <Skeleton variant="rectangular" width="100%" height={100} sx={{ borderRadius: 1 }} />
                        </Box>
                    </Box>
                ))}
            </CardContent>
        </Card>
    );
};

/**
 * Skeleton loader for Workspace List (Super Admin)
 */
export const WorkspaceListSkeleton: React.FC = () => {
    return (
        <>
            {[1, 2, 3, 4, 5].map((item) => (
                <Card key={item} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ flex: 1 }}>
                                <Skeleton variant="text" width="40%" height={24} />
                                <Skeleton variant="text" width="60%" height={18} sx={{ mt: 0.5 }} />
                            </Box>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Box>
                                    <Skeleton variant="text" width={60} height={18} />
                                    <Skeleton variant="text" width={80} height={24} />
                                </Box>
                                <Box>
                                    <Skeleton variant="text" width={60} height={18} />
                                    <Skeleton variant="text" width={80} height={24} />
                                </Box>
                                <Box>
                                    <Skeleton variant="text" width={60} height={18} />
                                    <Skeleton variant="text" width={80} height={24} />
                                </Box>
                            </Stack>
                        </Box>
                    </CardContent>
                </Card>
            ))}
        </>
    );
};

/**
 * Skeleton loader for Table
 */
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
    rows = 5,
    columns = 6
}) => {
    return (
        <Card>
            <Box sx={{ p: 2 }}>
                {/* Table Header */}
                <Box sx={{ display: 'flex', gap: 2, mb: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
                    {Array.from({ length: columns }).map((_, i) => (
                        <Skeleton key={`header-${i}`} variant="text" width={`${100 / columns}%`} height={24} />
                    ))}
                </Box>
                {/* Table Rows */}
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <Box
                        key={`row-${rowIndex}`}
                        sx={{
                            display: 'flex',
                            gap: 2,
                            mb: 2,
                            pb: 2,
                            borderBottom: rowIndex < rows - 1 ? 1 : 0,
                            borderColor: 'divider'
                        }}
                    >
                        {Array.from({ length: columns }).map((_, colIndex) => (
                            <Skeleton
                                key={`cell-${rowIndex}-${colIndex}`}
                                variant="text"
                                width={`${100 / columns}%`}
                                height={20}
                            />
                        ))}
                    </Box>
                ))}
            </Box>
        </Card>
    );
};

