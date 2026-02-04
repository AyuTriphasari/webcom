"use client";

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// imgproxy - convert to WebP
const cfImage = (url, opts = {}) => {
    if (!url || url.startsWith('loading-')) return url;
    const { quality = 80 } = opts;
    return `https://imgproxy.zlkpro.tech/insecure/q:${quality}/plain/${url}@webp`;
};

const defaults = {
    prompt: 'embedding:Lazy_Embeddings/Positive/lazypos, embedding:Lazy_Embeddings/lazynsfw, embedding:Lazy_Embeddings/Positive/lazympos',
    negative: 'greyscale, black_white, simple_background, censored, logo, blur, kid, young woman, loli, embedding:Lazy_Embeddings/Negative/lazyneg, low quality, blurry, artifacts, watermark, text, logo',
    steps: 25,
    cfg: 4,
    width: 1024,
    height: 1024,
    batch: 2,
    seed: 'random',
    model: 'new_waiIllustriousSDXL_v160.safetensors'
};

export default function Home() {
    const [form, setForm] = useState(defaults);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [images, setImages] = useState([]);
    const [activeIndex, setActiveIndex] = useState(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [errors, setErrors] = useState({});
    const [touchStart, setTouchStart] = useState(null);
    const [models, setModels] = useState([]);
    const [loadingModels, setLoadingModels] = useState(true);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMoreModels, setHasMoreModels] = useState(true);
    const [loadingMoreModels, setLoadingMoreModels] = useState(false);
    const [enhanceEnabled, setEnhanceEnabled] = useState(true);
    const [enhancing, setEnhancing] = useState(false);
    const [currentTaskId, setCurrentTaskId] = useState(null);

    // Fetch models from RunningHub API
    const fetchModels = async (page = 1, append = false) => {
        if (!append) setLoadingModels(true);
        else setLoadingMoreModels(true);

        try {
            const response = await fetch('https://www.runninghub.ai/api/resource/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    size: 30,
                    current: page,
                    tags: null,
                    resourceType: "CHECKPOINT",
                    baseModels: ["IL-XL", "NoobAI-XL", "Pony-XL"],
                    resourceName: "",
                    systemResource: true,
                    choiceModel: true,
                    point: ""
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.code === 0 && result.data?.records) {
                    if (append) {
                        setModels(prev => [...prev, ...result.data.records]);
                    } else {
                        setModels(result.data.records);
                    }

                    // Check if there are more pages
                    const totalPages = Math.ceil(result.data.total / 30);
                    setHasMoreModels(page < totalPages);
                }
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
        } finally {
            setLoadingModels(false);
            setLoadingMoreModels(false);
        }
    };

    useEffect(() => {
        fetchModels(1, false);
    }, []);

    const openLightbox = (idx) => setActiveIndex(idx);
    const closeLightbox = () => setActiveIndex(null);

    const goNext = useCallback(() => {
        if (activeIndex !== null && activeIndex < images.length - 1) {
            setActiveIndex(activeIndex + 1);
        }
    }, [activeIndex, images.length]);

    const goPrev = useCallback(() => {
        if (activeIndex !== null && activeIndex > 0) {
            setActiveIndex(activeIndex - 1);
        }
    }, [activeIndex]);

    // Keyboard navigation
    useEffect(() => {
        const handleKey = (e) => {
            if (activeIndex === null) return;
            if (e.key === 'ArrowRight') goNext();
            if (e.key === 'ArrowLeft') goPrev();
            if (e.key === 'Escape') closeLightbox();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [activeIndex, goNext, goPrev]);

    // Touch swipe
    const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
    const handleTouchEnd = (e) => {
        if (!touchStart) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) goNext();
            else goPrev();
        }
        setTouchStart(null);
    };

    const onChange = (key) => (e) => {
        setForm((f) => ({ ...f, [key]: e.target.value }));
        setErrors((prev) => ({ ...prev, [key]: '' }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (form.steps < 2 || form.steps > 30) newErrors.steps = 'Steps: 2-30';
        if (form.cfg < 1 || form.cfg > 10) newErrors.cfg = 'CFG: 1-10';
        if (![1, 2, 3, 4, 6].includes(Number(form.batch))) newErrors.batch = 'Batch: 1,2,3,4,6';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Enhance prompt using AI
    const enhancePrompt = async (prompt) => {
        const resp = await fetch('/api/enchance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, type: 'image' })
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
        setCurrentTaskId(null);
        setImages(Array.from({ length: Number(form.batch) }, (_, i) => `loading-${i}`));

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

            setStatus('⏳ Generating...');

            const resp = await fetch('/api/generate', {
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
                            setImages(data.files || []);
                            setStatus('✓ Done');
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    }
                }
            }
        } catch (err) {
            if (err.message !== 'Cancelled') {
                setStatus(`❌ ${err.message}`);
                setImages([]);
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
                setImages([]);
                setLoading(false);
                setCurrentTaskId(null);
            }
        } catch (err) {
            console.error('Cancel failed:', err);
        }
    };

    const getGalleryClass = () => {
        const count = images.length;
        if (count === 1) return 'gallery gallery-single';
        if (count === 2) return 'gallery gallery-two';
        if (count === 3) return 'gallery gallery-three';
        return 'gallery gallery-grid';
    };

    return (
        <main>
            <div className="badge">✨ AI Image Generator</div>
            <h1>Create Beautiful Images</h1>
            <p className="lead">Enter a prompt and generate stunning AI images instantly.</p>

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
                                    placeholder="Describe your image..."
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
                        <div
                            className="enhance-toggle"
                            onClick={() => !loading && setEnhanceEnabled(!enhanceEnabled)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                background: enhanceEnabled ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${enhanceEnabled ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '8px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                marginBottom: '12px',
                                opacity: loading ? 0.6 : 1
                            }}
                        >
                            <div style={{
                                width: '44px',
                                height: '24px',
                                background: enhanceEnabled ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                position: 'relative',
                                transition: 'all 0.2s',
                                flexShrink: 0
                            }}>
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    background: '#fff',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '2px',
                                    left: enhanceEnabled ? '22px' : '2px',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 500, fontSize: '14px' }}>
                                    ✨ AI Enhance Prompt
                                </div>
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                                    {enhancing ? 'Enhancing...' : enhanceEnabled ? 'AI will improve your prompt' : 'Use original prompt'}
                                </div>
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
                                        <label>Steps (2-30)</label>
                                        <input
                                            type="number"
                                            min={2}
                                            max={30}
                                            value={form.steps}
                                            onChange={onChange('steps')}
                                            className={errors.steps ? 'input-error' : ''}
                                        />
                                        {errors.steps && <div className="error-message">{errors.steps}</div>}
                                    </div>
                                    <div>
                                        <label>CFG Scale (1-10)</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min={1}
                                            max={10}
                                            value={form.cfg}
                                            onChange={onChange('cfg')}
                                            className={errors.cfg ? 'input-error' : ''}
                                        />
                                        {errors.cfg && <div className="error-message">{errors.cfg}</div>}
                                    </div>
                                    <div>
                                        <label>Batch Size</label>
                                        <select
                                            value={form.batch}
                                            onChange={onChange('batch')}
                                            className={errors.batch ? 'input-error' : ''}
                                        >
                                            <option value={1}>1 image</option>
                                            <option value={2}>2 images</option>
                                            <option value={3}>3 images</option>
                                            <option value={4}>4 images</option>
                                            <option value={6}>6 images</option>
                                        </select>
                                        {errors.batch && <div className="error-message">{errors.batch}</div>}
                                    </div>
                                </div>

                                <div className="row three-cols">
                                    <div>
                                        <label>Width</label>
                                        <input
                                            type="number"
                                            min={512}
                                            max={1536}
                                            step={64}
                                            value={form.width}
                                            onChange={onChange('width')}
                                        />
                                    </div>
                                    <div>
                                        <label>Height</label>
                                        <input
                                            type="number"
                                            min={512}
                                            max={1536}
                                            step={64}
                                            value={form.height}
                                            onChange={onChange('height')}
                                        />
                                    </div>
                                    <div>
                                        <label>Seed</label>
                                        <input
                                            placeholder="random"
                                            value={form.seed}
                                            onChange={onChange('seed')}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label>Model</label>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input
                                            value={form.model}
                                            onChange={onChange('model')}
                                            style={{ flex: 1 }}
                                            readOnly
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowModelPicker(!showModelPicker)}
                                            style={{
                                                padding: '8px 16px',
                                                backgroundColor: showModelPicker ? '#0070f3' : '#333',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {showModelPicker ? 'Hide' : 'Browse'} Models
                                        </button>
                                    </div>

                                    {showModelPicker && (
                                        <div style={{ marginTop: '12px' }}>
                                            {loadingModels ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                                                    Loading models...
                                                </div>
                                            ) : (
                                                <>
                                                    <div
                                                        id="model-grid-container"
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                                            gap: '10px',
                                                            maxHeight: '400px',
                                                            overflowY: 'auto',
                                                            padding: '8px',
                                                            backgroundColor: '#0a0a0a',
                                                            borderRadius: '8px',
                                                            border: '1px solid #333',
                                                        }}
                                                        onScroll={(e) => {
                                                            const container = e.currentTarget;
                                                            const scrollTop = container.scrollTop;
                                                            const scrollHeight = container.scrollHeight;
                                                            const clientHeight = container.clientHeight;

                                                            // Check if scrolled near bottom (within 100px)
                                                            if (scrollHeight - scrollTop - clientHeight < 100 && hasMoreModels && !loadingMoreModels) {
                                                                const nextPage = currentPage + 1;
                                                                setCurrentPage(nextPage);
                                                                fetchModels(nextPage, true);
                                                            }
                                                        }}
                                                    >
                                                        {models.map((model) => {
                                                            const fullPath = model.versions?.[0]?.resourceStorageName || model.resourceName;
                                                            const modelFile = fullPath.split('/').pop();
                                                            const isSelected = form.model === modelFile;
                                                            const thumbnailUrl = model.posterUrl;

                                                            return (
                                                                <button
                                                                    key={model.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setForm(f => ({ ...f, model: modelFile }));
                                                                        setShowModelPicker(false);
                                                                    }}
                                                                    style={{
                                                                        position: 'relative',
                                                                        border: isSelected ? '3px solid #0070f3' : '2px solid #333',
                                                                        borderRadius: '8px',
                                                                        overflow: 'hidden',
                                                                        cursor: 'pointer',
                                                                        backgroundColor: '#1a1a1a',
                                                                        padding: 0,
                                                                        transition: 'all 0.2s',
                                                                        aspectRatio: '3/4',
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        if (!isSelected) e.currentTarget.style.borderColor = '#555';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        if (!isSelected) e.currentTarget.style.borderColor = '#333';
                                                                    }}
                                                                >
                                                                    {thumbnailUrl && (
                                                                        <Image
                                                                            src={cfImage(thumbnailUrl, { quality: 30 })}
                                                                            alt={model.resourceName}
                                                                            fill
                                                                            sizes="160px"
                                                                            style={{ objectFit: 'cover' }}
                                                                        />
                                                                    )}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: 0,
                                                                        left: 0,
                                                                        right: 0,
                                                                        padding: '4px 6px',
                                                                        background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
                                                                    }}>
                                                                        <div style={{
                                                                            fontSize: '9px',
                                                                            fontWeight: '600',
                                                                            color: 'white',
                                                                            backgroundColor: model.versions?.[0]?.baseModel === 'IL-XL' ? '#8b5cf6' : '#ec4899',
                                                                            padding: '2px 4px',
                                                                            borderRadius: '3px',
                                                                            display: 'inline-block',
                                                                        }}>
                                                                            {model.versions?.[0]?.baseModel || 'N/A'}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        bottom: 0,
                                                                        left: 0,
                                                                        right: 0,
                                                                        padding: '6px',
                                                                        background: 'linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0) 100%)',
                                                                    }}>
                                                                        <div style={{
                                                                            fontSize: '10px',
                                                                            fontWeight: '500',
                                                                            color: 'white',
                                                                            overflow: 'hidden',
                                                                            textOverflow: 'ellipsis',
                                                                            display: '-webkit-box',
                                                                            WebkitLineClamp: 2,
                                                                            WebkitBoxOrient: 'vertical',
                                                                            lineHeight: '1.2',
                                                                            textAlign: 'left',
                                                                        }}>
                                                                            {model.resourceName}
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && (
                                                                        <div style={{
                                                                            position: 'absolute',
                                                                            top: '6px',
                                                                            right: '6px',
                                                                            width: '20px',
                                                                            height: '20px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: '#0070f3',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontSize: '12px',
                                                                            color: 'white',
                                                                            fontWeight: 'bold',
                                                                        }}>
                                                                            ✓
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    {loadingMoreModels && (
                                                        <div style={{ padding: '12px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
                                                            Loading more models...
                                                        </div>
                                                    )}
                                                    {!hasMoreModels && models.length > 0 && (
                                                        <div style={{ padding: '12px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
                                                            No more models to load
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
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
                                <button className="primary" type="submit" disabled={loading}>
                                    {loading ? '⏳ Generating...' : '🚀 Generate'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {images.length > 0 && (
                <div className="card">
                    <h2 className="section-title">
                        {loading ? '⏳ Generating' : '🎨 Results'} ({images.length})
                    </h2>
                    <div className={getGalleryClass()}>
                        {images.map((src, idx) => {
                            const isLoading = typeof src === 'string' && src.startsWith('loading-');
                            return (
                                <button
                                    key={idx}
                                    className={`thumb ${isLoading ? 'thumb-loading' : ''}`}
                                    type="button"
                                    onClick={() => !isLoading && openLightbox(idx)}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <div className="loading-placeholder">
                                            <div className="spinner" />
                                            <span className="loading-text">#{idx + 1}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Image
                                                src={cfImage(src, { quality: 80 })}
                                                alt={`Generated ${idx + 1}`}
                                                fill
                                                sizes="(max-width: 640px) 50vw, 33vw"
                                            />
                                            <span className="thumb-badge">#{idx + 1}</span>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeIndex !== null && images[activeIndex] && (
                <div
                    className="lightbox"
                    onClick={closeLightbox}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="lightbox-inner">
                        <div onClick={(e) => e.stopPropagation()}>
                            <Image
                                src={cfImage(images[activeIndex], { quality: 80 })}
                                alt="Full view"
                                fill
                                sizes="100vw"
                                priority
                            />
                        </div>
                        <button className="lightbox-close" onClick={closeLightbox}>
                            ×
                        </button>

                        {/* Navigation arrows */}
                        {activeIndex > 0 && (
                            <button
                                className="lightbox-nav lightbox-prev"
                                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                            >
                                ‹
                            </button>
                        )}
                        {activeIndex < images.length - 1 && (
                            <button
                                className="lightbox-nav lightbox-next"
                                onClick={(e) => { e.stopPropagation(); goNext(); }}
                            >
                                ›
                            </button>
                        )}

                        {/* Counter */}
                        <div className="lightbox-counter">
                            {activeIndex + 1} / {images.length}
                        </div>
                    </div>
                </div>
            )}

            {/* Credits Notice */}
            <div style={{
                textAlign: 'center',
                padding: '16px 20px',
                marginTop: '24px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px', margin: 0 }}>
                    💡 Generation failed? My credits might be empty!{' '}
                    <a
                        href="https://www.runninghub.ai/?inviteCode=6cnkbyfd"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: 500 }}
                    >
                        Sign up with my referral
                    </a>
                    {' '}to help refill credits & get your own free generations! 🎁
                </p>
            </div>

            <footer className="powered-by">
                Powered by{' '}
                <a href="https://www.runninghub.ai/?inviteCode=6cnkbyfd" target="_blank" rel="noopener noreferrer">
                    RunningHub
                </a>
            </footer>
        </main>
    );
}
