import React, { useState } from 'react';
import { supabase } from '../../../core/supabaseClient';
import { apiFetch } from '../../../core/api';

const TestParseCV = () => {
    const [file, setFile] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError("Please select a file first.");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await apiFetch('/candidat/account-setup/parse-cv', {
                method: 'POST',
                body: formData,
            });
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1>Test CV Parser Endpoint</h1>
            <p><strong>Note:</strong> Check your backend terminal/console to see the detailed logs (including the PyMuPDF/OCR steps and the Pydantic validation outcome). If <code>AccountSetupData</code> was safely imported, it will not bypass validation.</p>
            <div style={{ marginBottom: '1rem' }}>
                <input type="file" accept=".pdf" onChange={handleFileChange} />
                <button onClick={handleUpload} disabled={loading || !file} style={{ marginLeft: '1rem', padding: '0.5rem 1rem' }}>
                    {loading ? 'Parsing...' : 'Upload & Parse CV'}
                </button>
            </div>

            {error && (
                <div style={{ color: 'red', marginTop: '1rem', padding: '1rem', border: '1px solid red', borderRadius: '4px', background: '#ffe6e6' }}>
                    <strong>Error:</strong>
                    <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>{error}</pre>
                </div>
            )}

            {result && (
                <div style={{ marginTop: '2rem' }}>
                    <h3>Extracted Data:</h3>
                    <pre style={{
                        background: '#f4f4f4',
                        padding: '1rem',
                        borderRadius: '4px',
                        overflowX: 'auto',
                        maxHeight: '600px',
                        overflowY: 'auto'
                    }}>
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default TestParseCV;
