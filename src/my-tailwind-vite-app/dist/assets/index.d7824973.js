(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))o(e);new MutationObserver(e=>{for(const t of e)if(t.type==="childList")for(const n of t.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&o(n)}).observe(document,{childList:!0,subtree:!0});function i(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerpolicy&&(t.referrerPolicy=e.referrerpolicy),e.crossorigin==="use-credentials"?t.credentials="include":e.crossorigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function o(e){if(e.ep)return;e.ep=!0;const t=i(e);fetch(e.href,t)}})();const s=document.getElementById("app");s&&(s.innerHTML=`
        <main class="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <section class="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
                <h1 class="text-2xl font-bold text-slate-800">App is running</h1>
                <p class="mt-3 text-slate-600">Output is now rendering correctly inside <code>#app</code>.</p>
            </section>
        </main>
    `);
