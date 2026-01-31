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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            setStatus('❌ Fix errors');
            return;
        }

        setLoading(true);
        setStatus('Generating...');
        setImages(Array.from({ length: Number(form.batch) }, (_, i) => `loading-${i}`));

        try {
            const resp = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).message || 'Failed');
            const data = await resp.json();
            setImages(data.files || []);
            setStatus('✓ Done');
        } catch (err) {
            setStatus(`❌ ${err.message}`);
            setImages([]);
        } finally {
            setLoading(false);
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
                                />
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
                                    <input value={form.model} onChange={onChange('model')} />
                                </div>
                            </div>
                        )}

                        <div className="status-bar">
                            <span className="status">{status || '✨ Ready'}</span>
                            <button className="primary" type="submit" disabled={loading}>
                                {loading ? '⏳ Generating...' : '🚀 Generate'}
                            </button>
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

            <footer className="powered-by">
                Powered by{' '}
                <a href="https://www.runninghub.ai/?inviteCode=6cnkbyfd" target="_blank" rel="noopener noreferrer">
                    RunningHub
                </a>
            </footer>
        </main>
    );
}
