// Applies the saved appearance before the page paints, so there is no flash of the wrong theme.
// A separate file (not inline in index.html) because the server's security headers only allow scripts from the portal itself.
(function () { var t = localStorage.getItem('theme'); document.documentElement.dataset.theme = ['system', 'light', 'dark', 'black'].indexOf(t) >= 0 ? t : 'system'; })();
