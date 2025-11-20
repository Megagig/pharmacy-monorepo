import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import 'react-quill/dist/quill.snow.css';

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = React.lazy(() => import('react-quill'));

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string | number;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter content here...',
  readOnly = false,
  minHeight = '300px',
}) => {
  // Quill modules configuration
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        [{ font: [] }],
        [{ size: ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ script: 'sub' }, { script: 'super' }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        [{ align: [] }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'video'],
        ['clean'],
      ],
    }),
    []
  );

  // Quill formats configuration
  const formats = [
    'header',
    'font',
    'size',
    'bold',
    'italic',
    'underline',
    'strike',
    'color',
    'background',
    'script',
    'list',
    'bullet',
    'indent',
    'align',
    'blockquote',
    'code-block',
    'link',
    'image',
    'video',
  ];

  return (
    <Box
      sx={{
        '& .quill': {
          display: 'flex',
          flexDirection: 'column',
        },
        '& .ql-toolbar': {
          backgroundColor: '#f5f5f5',
          borderTopLeftRadius: '4px',
          borderTopRightRadius: '4px',
          border: '1px solid rgba(0, 0, 0, 0.23)',
          borderBottom: 'none',
        },
        '& .ql-container': {
          flex: 1,
          minHeight: minHeight,
          border: '1px solid rgba(0, 0, 0, 0.23)',
          borderBottomLeftRadius: '4px',
          borderBottomRightRadius: '4px',
          fontSize: '16px',
          fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
        },
        '& .ql-editor': {
          minHeight: minHeight,
          fontSize: '16px',
          '&.ql-blank::before': {
            fontStyle: 'normal',
            color: 'rgba(0, 0, 0, 0.38)',
          },
        },
        '& .ql-editor p': {
          marginBottom: '1em',
        },
        '& .ql-editor h1': {
          fontSize: '2em',
          fontWeight: 'bold',
          marginTop: '0.67em',
          marginBottom: '0.67em',
        },
        '& .ql-editor h2': {
          fontSize: '1.5em',
          fontWeight: 'bold',
          marginTop: '0.83em',
          marginBottom: '0.83em',
        },
        '& .ql-editor h3': {
          fontSize: '1.17em',
          fontWeight: 'bold',
          marginTop: '1em',
          marginBottom: '1em',
        },
        '& .ql-editor ul, & .ql-editor ol': {
          paddingLeft: '1.5em',
        },
        '& .ql-editor blockquote': {
          borderLeft: '4px solid #ccc',
          paddingLeft: '16px',
          marginLeft: 0,
          marginRight: 0,
        },
      }}
    >
      <React.Suspense fallback={<Box sx={{ minHeight, border: '1px solid rgba(0, 0, 0, 0.23)', borderRadius: '4px', p: 2 }}>Loading editor...</Box>}>
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          readOnly={readOnly}
        />
      </React.Suspense>
    </Box>
  );
};

export default RichTextEditor;
