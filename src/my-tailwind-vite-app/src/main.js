import './assets/styles/main.css';

const app = document.getElementById('app');

if (app) {
    app.innerHTML = `
        <main class="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <section class="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
                <h1 class="text-2xl font-bold text-slate-800">App is running</h1>
                <p class="mt-3 text-slate-600">Output is now rendering correctly inside <code>#app</code>.</p>
            </section>
        </main>
    `;
}
