'use client';
export default function AdminError({reset}){return <main id="admin-main" className="error-page"><h1>Administration is temporarily unavailable</h1><p>Your request could not be completed. Please try again shortly.</p><button type="button" className="primary-button" onClick={()=>reset()}>Try again</button></main>;}
