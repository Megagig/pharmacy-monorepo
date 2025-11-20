import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  TextField,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Description as WordIcon,
  Code as JsonIcon,
  Print as PrintIcon,
  Email as EmailIcon,
  Link as LinkIcon,
  Share as ShareIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useNotifications } from '../common/NotificationSystem';
import diagnosticExportService, {
  ExportOptions,
  ShareOptions,
  PrintOptions,
} from '../../services/diagnosticExportService';
import { DiagnosticHistoryItem } from '../../services/diagnosticHistoryService';

interface DiagnosticExportDialogProps {
  open: boolean;
  onClose: () => void;
  history: DiagnosticHistoryItem;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
  </div>
);

const DiagnosticExportDialog: React.FC<DiagnosticExportDialogProps> = ({
  open,
  onClose,
  history,
}) => {
  const { showSuccess, showError } = useNotifications();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);

  // Export options
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | 'json'>('pdf');
  const [exportPurpose, setExportPurpose] = useState<'referral' | 'patient_record' | 'consultation' | 'audit'>('patient_record');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeImages, setIncludeImages] = useState(false);
  const [watermark, setWatermark] = useState(false);

  // Share options
  const [shareMethod, setShareMethod] = useState<'email' | 'secure_link'>('email');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [expiresIn, setExpiresIn] = useState(24);
  const [requirePassword, setRequirePassword] = useState(true);

  // Print options
  const [printLayout, setPrintLayout] = useState<'portrait' | 'landscape'>('portrait');
  const [paperSize, setPaperSize] = useState<'A4' | 'Letter'>('A4');
  const [printSections, setPrintSections] = useState({
    summary: true,
    diagnosis: true,
    recommendations: true,
    notes: true,
    timeline: false,
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const options: Partial<ExportOptions> = {
        format: exportFormat,
        purpose: exportPurpose,
        includeNotes,
        includeImages,
        watermark,
      };

      let blob: Blob;
      let filename: string;

      switch (exportFormat) {
        case 'pdf':
          blob = await diagnosticExportService.exportAsPDF(history._id, options);
          filename = diagnosticExportService.generateFilename(history, 'pdf', exportPurpose);
          break;
        case 'docx':
          blob = await diagnosticExportService.exportAsWord(history._id, options);
          filename = diagnosticExportService.generateFilename(history, 'docx', exportPurpose);
          break;
        case 'json':
          const jsonData = await diagnosticExportService.exportAsJSON(history._id, options);
          blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
          filename = diagnosticExportService.generateFilename(history, 'json', exportPurpose);
          break;
        default:
          throw new Error('Unsupported format');
      }

      diagnosticExportService.downloadFile(blob, filename);
      showSuccess({
        title: 'Export Successful',
        message: `Diagnostic history exported as ${exportFormat.toUpperCase()}`,
      });
      onClose();
    } catch (error) {
      showError({
        title: 'Export Failed',
        message: 'Failed to export diagnostic history. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    setLoading(true);
    try {
      const options: ShareOptions = {
        method: shareMethod,
        recipients,
        message: shareMessage,
        expiresIn,
        requirePassword,
      };

      const result = await diagnosticExportService.shareHistory(history._id, options);
      
      if (shareMethod === 'secure_link' && result.shareUrl) {
        // Copy link to clipboard
        await navigator.clipboard.writeText(result.shareUrl);
        showSuccess({
          title: 'Link Created',
          message: 'Secure sharing link copied to clipboard',
        });
      } else {
        showSuccess({
          title: 'Shared Successfully',
          message: `Diagnostic history shared via ${shareMethod}`,
        });
      }
      onClose();
    } catch (error) {
      showError({
        title: 'Share Failed',
        message: 'Failed to share diagnostic history. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    setLoading(true);
    try {
      const options: Partial<PrintOptions> = {
        layout: printLayout,
        paperSize,
        sections: printSections,
      };

      await diagnosticExportService.printHistory(history._id, options);
      showSuccess({
        title: 'Print Initiated',
        message: 'Print dialog opened in new window',
      });
      onClose();
    } catch (error) {
      showError({
        title: 'Print Failed',
        message: 'Failed to generate print version. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = () => {
    if (recipientInput.trim() && !recipients.includes(recipientInput.trim())) {
      setRecipients([...recipients, recipientInput.trim()]);
      setRecipientInput('');
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const handleRecipientKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addRecipient();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Export Diagnostic History</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Case: {history.caseId} • Patient: {history.patientId}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab icon={<DownloadIcon />} label="Export" />
          <Tab icon={<ShareIcon />} label="Share" />
          <Tab icon={<PrintIcon />} label="Print" />
        </Tabs>

        {/* Export Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Format</InputLabel>
              <Select
                value={exportFormat}
                label="Format"
                onChange={(e) => setExportFormat(e.target.value as any)}
              >
                <MenuItem value="pdf">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PdfIcon sx={{ mr: 1, color: 'error.main' }} />
                    PDF Document
                  </Box>
                </MenuItem>
                <MenuItem value="docx">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <WordIcon sx={{ mr: 1, color: 'info.main' }} />
                    Word Document
                  </Box>
                </MenuItem>
                <MenuItem value="json">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <JsonIcon sx={{ mr: 1, color: 'success.main' }} />
                    JSON Data
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Purpose</InputLabel>
              <Select
                value={exportPurpose}
                label="Purpose"
                onChange={(e) => setExportPurpose(e.target.value as any)}
              >
                <MenuItem value="patient_record">Patient Record</MenuItem>
                <MenuItem value="referral">Medical Referral</MenuItem>
                <MenuItem value="consultation">Consultation</MenuItem>
                <MenuItem value="audit">Audit Trail</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Include Options
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                  />
                }
                label="Include Notes"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeImages}
                    onChange={(e) => setIncludeImages(e.target.checked)}
                  />
                }
                label="Include Images"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={watermark}
                    onChange={(e) => setWatermark(e.target.checked)}
                  />
                }
                label="Add Watermark"
              />
            </Box>
          </Box>
        </TabPanel>

        {/* Share Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Share Method</InputLabel>
              <Select
                value={shareMethod}
                label="Share Method"
                onChange={(e) => setShareMethod(e.target.value as any)}
              >
                <MenuItem value="email">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <EmailIcon sx={{ mr: 1 }} />
                    Email
                  </Box>
                </MenuItem>
                <MenuItem value="secure_link">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <LinkIcon sx={{ mr: 1 }} />
                    Secure Link
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {shareMethod === 'email' && (
              <Box>
                <TextField
                  fullWidth
                  label="Add Recipients"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyPress={handleRecipientKeyPress}
                  placeholder="Enter email address and press Enter"
                  helperText="Press Enter to add each email address"
                />
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {recipients.map((email) => (
                    <Chip
                      key={email}
                      label={email}
                      onDelete={() => removeRecipient(email)}
                      size="small"
                    />
                  ))}
                </Box>
              </Box>
            )}

            <TextField
              fullWidth
              label="Message (Optional)"
              multiline
              rows={3}
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              placeholder="Add a message to include with the shared document..."
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Expires In</InputLabel>
                <Select
                  value={expiresIn}
                  label="Expires In"
                  onChange={(e) => setExpiresIn(Number(e.target.value))}
                >
                  <MenuItem value={1}>1 Hour</MenuItem>
                  <MenuItem value={24}>24 Hours</MenuItem>
                  <MenuItem value={72}>3 Days</MenuItem>
                  <MenuItem value={168}>1 Week</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={requirePassword}
                    onChange={(e) => setRequirePassword(e.target.checked)}
                  />
                }
                label="Require Password"
              />
            </Box>
          </Box>
        </TabPanel>

        {/* Print Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Layout</InputLabel>
                <Select
                  value={printLayout}
                  label="Layout"
                  onChange={(e) => setPrintLayout(e.target.value as any)}
                >
                  <MenuItem value="portrait">Portrait</MenuItem>
                  <MenuItem value="landscape">Landscape</MenuItem>
                </Select>
              </FormControl>

              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Paper Size</InputLabel>
                <Select
                  value={paperSize}
                  label="Paper Size"
                  onChange={(e) => setPaperSize(e.target.value as any)}
                >
                  <MenuItem value="A4">A4</MenuItem>
                  <MenuItem value="Letter">Letter</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Sections to Include
              </Typography>
              <List dense>
                {Object.entries(printSections).map(([key, value]) => (
                  <ListItem key={key} sx={{ py: 0 }}>
                    <ListItemIcon>
                      <Checkbox
                        checked={value}
                        onChange={(e) =>
                          setPrintSections({
                            ...printSections,
                            [key]: e.target.checked,
                          })
                        }
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={
            activeTab === 0
              ? handleExport
              : activeTab === 1
              ? handleShare
              : handlePrint
          }
          variant="contained"
          disabled={
            loading ||
            (activeTab === 1 && shareMethod === 'email' && recipients.length === 0)
          }
          startIcon={
            loading ? (
              <CircularProgress size={16} />
            ) : activeTab === 0 ? (
              <DownloadIcon />
            ) : activeTab === 1 ? (
              <ShareIcon />
            ) : (
              <PrintIcon />
            )
          }
        >
          {loading
            ? 'Processing...'
            : activeTab === 0
            ? 'Export'
            : activeTab === 1
            ? 'Share'
            : 'Print'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DiagnosticExportDialog;