import { useState, useEffect } from 'react';
import { ExternalLink, Plus, Trash2, Globe, Search, Smartphone, Monitor, ShieldCheck, X } from 'lucide-react';

export type WebsiteShortcut = {
  id: string;
  title: string;
  url: string;
  category: 'all' | 'pc' | 'mobile' | 'tools';
  icon?: string;
};

const STORAGE_KEY = 'morning-light-websites';

const initialWebsites: WebsiteShortcut[] = [
  { id: '1', title: 'Google', url: 'https://google.com', category: 'tools', icon: '🔍' },
  { id: '2', title: 'YouTube', url: 'https://youtube.com', category: 'mobile', icon: '📺' },
  { id: '3', title: 'Notion Notes', url: 'https://notion.so', category: 'pc', icon: '📝' },
  { id: '4', title: 'Google Calendar', url: 'https://calendar.google.com', category: 'tools', icon: '📅' },
  { id: '5', title: 'GitHub', url: 'https://github.com', category: 'pc', icon: '💻' },
  { id: '6', title: 'Railway Console', url: 'https://railway.app', category: 'tools', icon: '🚀' },
  { id: '7', title: 'Supabase DB', url: 'https://supabase.com', category: 'tools', icon: '⚡' },
];

export function WebsitesView() {
  const [websites, setWebsites] = useState<WebsiteShortcut[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialWebsites;
    } catch {
      return initialWebsites;
    }
  });

  const [filter, setFilter] = useState<'all' | 'pc' | 'mobile' | 'tools'>('all');
  const [query, setQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<{ title: string; url: string; category: 'pc' | 'mobile' | 'tools'; icon: string }>({
    title: '',
    url: '',
    category: 'pc',
    icon: '🌐',
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(websites));
  }, [websites]);

  const filtered = websites.filter((site) => {
    const matchesCategory = filter === 'all' || site.category === filter;
    const matchesQuery =
      !query.trim() ||
      site.title.toLowerCase().includes(query.toLowerCase()) ||
      site.url.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;

    let formattedUrl = form.url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const newSite: WebsiteShortcut = {
      id: `site-${Date.now()}`,
      title: form.title.trim(),
      url: formattedUrl,
      category: form.category,
      icon: form.icon || '🌐',
    };

    setWebsites((prev) => [newSite, ...prev]);
    setForm({ title: '', url: '', category: 'pc', icon: '🌐' });
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setWebsites((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] font-semibold text-blue-600">Home & Desktop</span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Websites & Web Apps
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quick launcher for your desktop and mobile web apps and daily shortcuts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Add Website
        </button>
      </div>

      {/* Filters & Search */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {(['all', 'pc', 'mobile', 'tools'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                filter === cat
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {cat === 'all' ? 'All Sites' : cat === 'pc' ? '🖥️ Desktop' : cat === 'mobile' ? '📱 Mobile' : '🛠️ Tools'}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search web shortcuts…"
            className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Shortcuts Grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((site) => (
          <article
            key={site.id}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                  {site.icon || '🌐'}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {site.title}
                  </h3>
                  <p className="truncate text-xs text-slate-400 mt-0.5">{site.url.replace(/^https?:\/\//, '')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(site.id)}
                title="Delete shortcut"
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-1 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {site.category === 'mobile' ? (
                  <>
                    <Smartphone size={12} /> Mobile
                  </>
                ) : site.category === 'pc' ? (
                  <>
                    <Monitor size={12} /> PC
                  </>
                ) : (
                  <>
                    <Globe size={12} /> Tool
                  </>
                )}
              </span>

              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
              >
                Open <ExternalLink size={12} />
              </a>
            </div>
          </article>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
            <Globe size={28} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-600">No websites found.</p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
            >
              <Plus size={14} /> Add your first website shortcut
            </button>
          </div>
        )}
      </div>

      {/* Add Website Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Add Website Shortcut</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Shortcut Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Mobile App"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1.5 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Website URL
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. https://example.com"
                  value={form.url}
                  onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                  className="mt-1.5 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, category: e.target.value as 'pc' | 'mobile' | 'tools' }))
                    }
                    className="mt-1.5 w-full h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="pc">🖥️ PC / Desktop</option>
                    <option value="mobile">📱 Mobile</option>
                    <option value="tools">🛠️ Tool</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Emoji Icon
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={form.icon}
                    onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                    className="mt-1.5 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-center outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                >
                  Save Shortcut
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
