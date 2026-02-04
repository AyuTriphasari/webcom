"use client";

import { useState, useEffect, useCallback } from 'react';

const defaults = {
    prompt: 'SmoothMixAnime. A woman doing a sexy dance. The background is a luxurious living room. Her expression is charming and with a happy smile.',
    negative: 'censored, mosaic censoring, bar censor, pixelated, glowing, bloom, blurry, out of focus, low detail, bad anatomy, ugly, worst quality, low quality',
    width: 480,
    height: 720,
    length: 81, // 5 seconds
    seed: 'random',
};

export default function VideoPage() {
    const [form, setForm] = useState(defaults);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [errors, setErrors] = useState({});
    const [progress, setProgress] = useState(0);
    const [enhanceEnabled, setEnhanceEnabled] = useState(true);
    const [enhancing, setEnhancing] = useState(false);
    const [currentTaskId, setCurrentTaskId] = useState(null);

    const onChange = (key) => (e) => {
        setForm((f) => ({ ...f, [key]: e.target.value }));
        setErrors((prev) => ({ ...prev, [key]: '' }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (form.width < 256 || form.width > 1024) newErrors.width = 'Width: 256-1024';
        if (form.height < 256 || form.height > 1024) newErrors.height = 'Height: 256-1024';
        if (form.length < 17 || form.length > 129) newErrors.length = 'Length: 17-129';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Enhance prompt using AI
    const enhancePrompt = async (prompt) => {
        const resp = await fetch('/api/enchance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, type: 'video' })
        });
        if (!resp.ok) throw new Error('Failed to enhance prompt');
        const data = await resp.json();
        return data.enhanced || prompt;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            setStatus('❌ Fix errors');
            return;
        }

        setLoading(true);
        setVideoUrl('');
        setProgress(0);
        setCurrentTaskId(null);

        try {
            let promptToUse = form.prompt;

            // Enhance prompt if enabled
            if (enhanceEnabled) {
                setStatus('✨ Enhancing prompt...');
                setEnhancing(true);
                try {
                    promptToUse = await enhancePrompt(form.prompt);
                    console.log('Enhanced prompt:', promptToUse);
                } catch (err) {
                    console.warn('Enhance failed, using original:', err.message);
                }
                setEnhancing(false);
            }

            setStatus('⏳ Generating video...');

            const resp = await fetch('/api/video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, prompt: promptToUse })
            });

            if (!resp.ok) throw new Error('Failed to start generation');

            // Handle streaming response
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'taskId') {
                            setCurrentTaskId(data.taskId);
                            console.log('Task ID:', data.taskId);
                        } else if (data.type === 'result') {
                            setVideoUrl(data.videoUrl || '');
                            setStatus(`✓ Done! (seed: ${data.seed})`);
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    }
                }
            }
        } catch (err) {
            if (err.message !== 'Cancelled') {
                setStatus(`❌ ${err.message}`);
                setVideoUrl('');
            }
        } finally {
            setLoading(false);
            setEnhancing(false);
            setCurrentTaskId(null);
        }
    };

    const handleCancel = async () => {
        if (!currentTaskId) return;

        try {
            setStatus('🛑 Cancelling...');
            const resp = await fetch('/api/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: currentTaskId })
            });

            if (resp.ok) {
                setStatus('🛑 Cancelled');
                setVideoUrl('');
                setLoading(false);
                setCurrentTaskId(null);
            }
        } catch (err) {
            console.error('Cancel failed:', err);
        }
    };

    // Duration presets (max 8s = 129 frames)
    const durationPresets = [
        { label: '3s', value: 49 },
        { label: '4s', value: 65 },
        { label: '5s', value: 81 },
        { label: '6s', value: 97 },
        { label: '7s', value: 113 },
        { label: '8s', value: 129 },
    ];

    return (
        <main>
            <div className="badge" style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)' }}>
                🎬 AI Video Generator
            </div>
            <h1>Create AI Videos</h1>
            <p className="lead">Generate stunning AI videos with text-to-video technology.</p>

            <div className="card">
                <form onSubmit={handleSubmit}>
                    <div className="grid">
                        <div className="row two-cols">
                            <div>
                                <label>Prompt</label>
                                <textarea
                                    rows={4}
                                    value={form.prompt}
                                    onChange={onChange('prompt')}
                                    placeholder="Describe your video scene..."
                                    spellCheck={false}
                                    required
                                />
                            </div>
                            <div>
                                <label>Negative Prompt</label>
                                <textarea
                                    rows={4}
                                    value={form.negative}
                                    onChange={onChange('negative')}
                                    placeholder="What to avoid..."
                                    spellCheck={false}
                                />
                            </div>
                        </div>

                        {/* Enhance Toggle */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            backgroundColor: enhanceEnabled ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            border: enhanceEnabled ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid #333',
                            transition: 'all 0.2s',
                        }}>
                            <button
                                type="button"
                                onClick={() => setEnhanceEnabled(!enhanceEnabled)}
                                style={{
                                    width: '48px',
                                    height: '26px',
                                    borderRadius: '13px',
                                    border: 'none',
                                    backgroundColor: enhanceEnabled ? '#a855f7' : '#444',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <div style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    backgroundColor: 'white',
                                    position: 'absolute',
                                    top: '2px',
                                    left: enhanceEnabled ? '24px' : '2px',
                                    transition: 'all 0.2s',
                                }} />
                            </button>
                            <div>
                                <div style={{ fontWeight: '500', fontSize: '14px' }}>
                                    ✨ AI Enhance Prompt
                                </div>
                                <div style={{ fontSize: '12px', color: '#888' }}>
                                    {enhanceEnabled ? 'AI will improve your prompt before generating' : 'Using original prompt'}
                                </div>
                            </div>
                            {enhancing && (
                                <div style={{ marginLeft: 'auto', color: '#a855f7', fontSize: '12px' }}>
                                    Enhancing...
                                </div>
                            )}
                        </div>

                        {/* Duration Presets */}
                        <div style={{ marginBottom: '16px' }}>
                            <label>Video Duration</label>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                {durationPresets.map((preset) => (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, length: preset.value }))}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: form.length === preset.value ? '#f43f5e' : '#333',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            type="button"
                            className="advanced-toggle"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            <span>⚙️ Advanced Options</span>
                            <span style={{
                                transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0)',
                                transition: '0.2s'
                            }}>▼</span>
                        </button>

                        {showAdvanced && (
                            <div className="advanced-options">
                                <div className="row three-cols">
                                    <div>
                                        <label>Width (256-1024)</label>
                                        <input
                                            type="number"
                                            min={256}
                                            max={1024}
                                            step={16}
                                            value={form.width}
                                            onChange={onChange('width')}
                                            className={errors.width ? 'input-error' : ''}
                                        />
                                        {errors.width && <div className="error-message">{errors.width}</div>}
                                    </div>
                                    <div>
                                        <label>Height (256-1024)</label>
                                        <input
                                            type="number"
                                            min={256}
                                            max={1024}
                                            step={16}
                                            value={form.height}
                                            onChange={onChange('height')}
                                            className={errors.height ? 'input-error' : ''}
                                        />
                                        {errors.height && <div className="error-message">{errors.height}</div>}
                                    </div>
                                    <div>
                                        <label>Length (frames)</label>
                                        <input
                                            type="number"
                                            min={17}
                                            max={129}
                                            value={form.length}
                                            onChange={onChange('length')}
                                            className={errors.length ? 'input-error' : ''}
                                        />
                                        {errors.length && <div className="error-message">{errors.length}</div>}
                                    </div>
                                </div>

                                <div className="row three-cols">
                                    <div>
                                        <label>Seed</label>
                                        <input
                                            placeholder="random"
                                            value={form.seed}
                                            onChange={onChange('seed')}
                                        />
                                    </div>
                                    <div></div>
                                    <div></div>
                                </div>
                            </div>
                        )}

                        <div className="status-bar">
                            <span className="status">{status || '✨ Ready'}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {loading && currentTaskId && (
                                    <button
                                        type="button"
                                        className="cancel-btn"
                                        onClick={handleCancel}
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                            color: '#ef4444',
                                            padding: '10px 20px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontWeight: 500,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        🛑 Cancel
                                    </button>
                                )}
                                <button
                                    className="primary"
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        background: loading ? '#666' : 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)',
                                    }}
                                >
                                    {loading ? '⏳ Generating...' : '🎬 Generate Video'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {/* Video Result */}
            {(loading || videoUrl) && (
                <div className="card">
                    <h2 className="section-title">
                        {loading ? '⏳ Generating Video' : '🎬 Result'}
                    </h2>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '300px',
                        backgroundColor: '#0a0a0a',
                        borderRadius: '8px',
                        overflow: 'hidden',
                    }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <div className="spinner" style={{
                                    width: '60px',
                                    height: '60px',
                                    margin: '0 auto 20px',
                                }} />
                                <p style={{ color: '#888', fontSize: '14px' }}>
                                    Video generation takes a few minutes...
                                </p>
                            </div>
                        ) : videoUrl && (
                            <video
                                controls
                                autoPlay
                                loop
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '600px',
                                    borderRadius: '8px',
                                }}
                            >
                                <source src={videoUrl} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        )}
                    </div>
                    {videoUrl && (
                        <div style={{ marginTop: '12px', textAlign: 'center' }}>
                            <a
                                href={videoUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-block',
                                    padding: '10px 20px',
                                    backgroundColor: '#333',
                                    color: 'white',
                                    borderRadius: '6px',
                                    textDecoration: 'none',
                                    fontSize: '14px',
                                }}
                            >
                                📥 Download Video
                            </a>
                        </div>
                    )}
                </div>
            )}

            <footer className="powered-by">
                Powered by{' '}
                <a href="https://www.runninghub.ai/?inviteCode=6cnkbyfd" target="_blank" rel="noopener noreferrer">
                    RunningHub
                </a>
            </footer>
        </main>
    );
}
