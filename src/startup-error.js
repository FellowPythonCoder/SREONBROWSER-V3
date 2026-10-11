'use strict';
document.getElementById('message').textContent = new URLSearchParams(location.search).get('message') || 'Unknown startup error';
