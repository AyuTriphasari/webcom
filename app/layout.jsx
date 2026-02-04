import './globals.css';
import Link from 'next/link';

export const metadata = {
    title: 'Running Hub Image Generator',
    description: 'Generate images via Running Hub AI'
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>
                <nav className="navbar">
                    <div className="navbar-container">
                        <Link href="/" className="navbar-logo">
                            <span className="logo-icon">⚡</span>
                            <span className="logo-text">ZLK<span style={{ color: '#a78bfa' }}>cyber</span></span>
                        </Link>
                        <div className="navbar-links">
                            <Link href="/" className="nav-link">
                                🏠 Home
                            </Link>
                            <Link href="/video" className="nav-link">
                                🎬 Video
                            </Link>
                            <Link href="/gallery" className="nav-link">
                                🖼️ Public Feed
                            </Link>
                        </div>
                    </div>
                </nav>
                {children}
            </body>
        </html>
    );
}
