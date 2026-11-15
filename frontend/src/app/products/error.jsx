'use client';
export default function ErrorPage({reset}){return <section className="container pl-page"><h1>Catalog unavailable</h1><p>Prices and availability could not be verified.</p><button onClick={reset}>Try again</button></section>;}
