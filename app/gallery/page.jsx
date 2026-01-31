"use client";

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// imgproxy - convert to WebP (skip for local API URLs)
const cfImage = (url, opts = {}) => {
    if (!url) return url;
    // Skip imgproxy for local API URLs (ComfyUI images)
    if (url.startsWith('/api/')) return url;
    const { quality = 80 } = opts;
    return `https://imgproxy.zlkpro.tech/insecure/q:${quality}/plain/${url}@webp`;
};

export default function Gallery() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [touchStart, setTouchStart] = useState(null);

    useEffect(() => {
        fetch('/api/gallery')
            .then((r) => r.json())
            .then((data) => setItems(data))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    const openLightbox = (idx) => {
        setActiveIndex(idx);
        setShowPrompt(false);
    };

    const closeLightbox = () => {
        setActiveIndex(null);
        setShowPrompt(false);
    };

    const goNext = useCallback(() => {
        if (activeIndex !== null && activeIndex < items.length - 1) {
            setActiveIndex(activeIndex + 1);
            setShowPrompt(false);
        }
    }, [activeIndex, items.length]);

    const goPrev = useCallback(() => {
        if (activeIndex !== null && activeIndex > 0) {
            setActiveIndex(activeIndex - 1);
            setShowPrompt(false);
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

    // Touch swipe handlers
    const handleTouchStart = (e) => {
        setTouchStart(e.touches[0].clientX);
    };

    const handleTouchEnd = (e) => {
        if (!touchStart) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) goNext();
            else goPrev();
        }
        setTouchStart(null);
    };

    const getGridClass = () => {
        if (items.length === 1) return 'gallery gallery-single';
        if (items.length === 2) return 'gallery gallery-two';
        if (items.length === 3) return 'gallery gallery-three';
        return 'gallery gallery-grid';
    };

    const active = activeIndex !== null ? items[activeIndex] : null;

    if (loading) {
        return (
            <main>
                <div className="badge">📸 Collection</div>
                <h1>Gallery</h1>
                <p className="lead">Loading your images...</p>
                <div className="card">
                    <div className="gallery gallery-grid">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="thumb thumb-loading">
                                <div className="loading-placeholder">
                                    <div className="spinner" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main>
            <div className="badge">📸 Collection</div>
            <h1>Gallery</h1>
            <p className="lead">{items.length} generated images</p>

            {items.length === 0 ? (
                <div className="card">
                    <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                        No images yet. Generate some first!
                    </p>
                </div>
            ) : (
                <div className="card">
                    <div className={getGridClass()}>
                        {items.map((item, idx) => (
                            <button
                                key={idx}
                                className="thumb"
                                type="button"
                                onClick={() => openLightbox(idx)}
                            >
                                <Image
                                    src={cfImage(item.file, { quality: 80 })}
                                    alt={`Image ${idx + 1}`}
                                    fill
                                    sizes="(max-width: 640px) 50vw, 33vw"
                                    unoptimized={item.file?.startsWith('/api/')}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {active && (
                <div
                    className="lightbox"
                    onClick={closeLightbox}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
                        <div>
                            <Image
                                src={cfImage(active.file, { quality: 80 })}
                                alt="Full view"
                                fill
                                sizes="100vw"
                                priority
                                unoptimized={active.file?.startsWith('/api/')}
                            />

                            {/* Close button */}
                            <button className="lightbox-close" onClick={closeLightbox}>
                                ×
                            </button>

                            {/* Info icon - shows prompt */}
                            <button
                                className="lightbox-info"
                                onClick={() => setShowPrompt(!showPrompt)}
                                title="Show prompt"
                            >
                                ℹ
                            </button>

                            {/* Prompt overlay */}
                            {showPrompt && (
                                <div className="lightbox-prompt">
                                    {active.prompt}
                                </div>
                            )}

                            {/* Navigation arrows */}
                            {activeIndex > 0 && (
                                <button
                                    className="lightbox-nav lightbox-prev"
                                    onClick={(e) => { e.stopPropagation(); goPrev(); }}
                                >
                                    ‹
                                </button>
                            )}
                            {activeIndex < items.length - 1 && (
                                <button
                                    className="lightbox-nav lightbox-next"
                                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                                >
                                    ›
                                </button>
                            )}

                            {/* Counter */}
                            <div className="lightbox-counter">
                                {activeIndex + 1} / {items.length}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
