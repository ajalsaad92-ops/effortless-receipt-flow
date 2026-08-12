import React from 'react';

export function renderErrorPage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Internal Server Error</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: white; }
        .container { text-align: center; }
        h1 { font-size: 2rem; margin-bottom: 1rem; }
        p { color: #888; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Something went wrong</h1>
        <p>Please try refreshing the page or contact support if the issue persists.</p>
      </div>
    </body>
    </html>
  `;
}
